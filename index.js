/**
 * 思源笔记查询工具
 * 提供SQL查询、文档搜索、笔记本管理等功能
 * 基于思源笔记SQL查询系统规范
 */

const fs = require('fs');
const path = require('path');
const { createCliHandlers, printCliUsage } = require('./cli');
const {
    strftime,
    truncateText,
    formatSiyuanTime,
    formatResults,
    formatStructuredResults,
    generateEmbedBlock
} = require('./format-utils');

const DEBUG_ARGV_FLAG = process.argv.includes('--debug');

function isDebugModeEnabled() {
    return process.env.DEBUG === 'true' || DEBUG_ARGV_FLAG;
}

function stripOptionalWrappingQuotes(value) {
    const raw = String(value || '').trim();
    if (raw.length < 2) {
        return raw;
    }
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
        return raw.slice(1, -1);
    }
    return raw;
}

// 加载.env文件
function loadEnvFile() {
    try {
        // 始终使用当前JS文件所在目录下的.env文件
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            envContent.split('\n').forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && !trimmedLine.startsWith('#')) {
                    const [key, ...valueParts] = trimmedLine.split('=');
                    if (key && valueParts.length > 0) {
                        const envKey = key.trim().replace(/^export\s+/, '');
                        const value = stripOptionalWrappingQuotes(valueParts.join('=').trim());
                        if (envKey) {
                            process.env[envKey] = value;
                        }
                    }
                }
            });
            if (isDebugModeEnabled()) console.log('✅ 已加载.env配置文件:', envPath);
        } else {
            if (isDebugModeEnabled()) console.log('⚠️  未找到.env文件:', envPath);
        }
    } catch (error) {
        if (isDebugModeEnabled()) console.log('⚠️  .env文件加载失败:', error.message);
    }
}

// 加载环境变量 (静默模式)
loadEnvFile();

// 只在调试模式下输出配置信息
const DEBUG_MODE = isDebugModeEnabled();

/** 环境变量或默认配置 */
const SIYUAN_HOST = process.env.SIYUAN_HOST || 'localhost';
const SIYUAN_PORT = process.env.SIYUAN_PORT || '';
const SIYUAN_API_TOKEN = process.env.SIYUAN_API_TOKEN || '';
const SIYUAN_USE_HTTPS = process.env.SIYUAN_USE_HTTPS === 'true';
const SIYUAN_BASIC_AUTH_USER = process.env.SIYUAN_BASIC_AUTH_USER || '';
const SIYUAN_BASIC_AUTH_PASS = process.env.SIYUAN_BASIC_AUTH_PASS || '';
const SIYUAN_ALLOW_TOKEN_IN_QUERY = process.env.SIYUAN_ALLOW_TOKEN_IN_QUERY === 'true';
const SIYUAN_ENABLE_WRITE = process.env.SIYUAN_ENABLE_WRITE === 'true';
const SIYUAN_REQUIRE_READ_BEFORE_WRITE = process.env.SIYUAN_REQUIRE_READ_BEFORE_WRITE !== 'false';
const SIYUAN_READ_GUARD_TTL_SECONDS = normalizeInt(process.env.SIYUAN_READ_GUARD_TTL_SECONDS, 3600, 30, 604800);
const SIYUAN_LIST_DOCUMENTS_LIMIT = normalizeInt(process.env.SIYUAN_LIST_DOCUMENTS_LIMIT, 200, 1, 2000);
const SIYUAN_BLOCK_ROOT_CACHE_MAX = normalizeInt(process.env.SIYUAN_BLOCK_ROOT_CACHE_MAX, 5000, 100, 50000);
const READ_GUARD_CACHE_FILE = path.join(__dirname, '.siyuan-read-guard-cache.json');

/** API端点配置 */
const API_BASE_URL = `${SIYUAN_USE_HTTPS ? 'https' : 'http'}://${SIYUAN_HOST}${SIYUAN_PORT ? ':' + SIYUAN_PORT : ''}`;
const API_ENDPOINTS = {
    SQL_QUERY: '/api/query/sql',
    SYSTEM_VERSION: '/api/system/version',
    NOTEBOOKS: '/api/notebook/lsNotebooks',
    EXPORT_MD_CONTENT: '/api/export/exportMdContent',
    GET_BLOCK_KRAMDOWN: '/api/block/getBlockKramdown',
    GET_CHILD_BLOCKS: '/api/block/getChildBlocks',
    APPEND_BLOCK: '/api/block/appendBlock',
    INSERT_BLOCK: '/api/block/insertBlock',
    UPDATE_BLOCK: '/api/block/updateBlock',
    MOVE_BLOCK: '/api/block/moveBlock',
    DELETE_BLOCK: '/api/block/deleteBlock',
    GET_BLOCK_ATTRS: '/api/attr/getBlockAttrs',
    CREATE_DOC_WITH_MD: '/api/filetree/createDocWithMd',
    LIST_DOCS_BY_PATH: '/api/filetree/listDocsByPath',
    GET_HPATH_BY_ID: '/api/filetree/getHPathByID',
    GET_PATH_BY_ID: '/api/filetree/getPathByID',
    GET_IDS_BY_HPATH: '/api/filetree/getIDsByHPath',
    MOVE_DOCS_BY_ID: '/api/filetree/moveDocsByID',
    RENAME_DOC: '/api/filetree/renameDoc'
};

if (DEBUG_MODE) {
    console.log(`📡 服务器地址: ${API_BASE_URL}`);
    console.log(`🔑 API Token: ${SIYUAN_API_TOKEN ? '已配置' : '未配置'}`);
    console.log(`🔐 Basic Auth: ${SIYUAN_BASIC_AUTH_USER ? `用户: ${SIYUAN_BASIC_AUTH_USER}` : '未配置'}`);
    console.log(`🔐 Token查询串: ${SIYUAN_ALLOW_TOKEN_IN_QUERY ? '已启用(不推荐)' : '已禁用(默认)'}`);
    console.log(`✏️ 写入能力: ${SIYUAN_ENABLE_WRITE ? '已启用' : '未启用'}`);
    console.log(`🛡️  读后写围栏: ${SIYUAN_REQUIRE_READ_BEFORE_WRITE ? '已启用' : '已关闭'}`);
    console.log(`📚 文档列表默认限制: ${SIYUAN_LIST_DOCUMENTS_LIMIT}`);
    console.log(`🧠 块根缓存上限: ${SIYUAN_BLOCK_ROOT_CACHE_MAX}`);
}

/** HTTP Basic Auth编码 */
function getBasicAuthHeader() {
    if (!SIYUAN_BASIC_AUTH_USER || !SIYUAN_BASIC_AUTH_PASS) {
        return {};
    }
    const credentials = Buffer.from(`${SIYUAN_BASIC_AUTH_USER}:${SIYUAN_BASIC_AUTH_PASS}`).toString('base64');
    return { 'Authorization': `Basic ${credentials}` };
}

/**
 * 对SQL字符串进行转义
 * @param {string|number|boolean} value - 原始值
 * @returns {string} 转义后的字符串
 */
function escapeSqlValue(value) {
    return String(value).replace(/'/g, "''");
}

/**
 * 转义 SQL LIKE 模式中的通配符
 * @param {string|number|boolean} value - 原始值
 * @returns {string} 转义后的 LIKE 模式文本
 */
function escapeSqlLikeValue(value) {
    return escapeSqlValue(value)
        .replace(/!/g, '!!')
        .replace(/%/g, '!%')
        .replace(/_/g, '!_');
}

/**
 * 限制整数参数范围
 * @param {number|string} value - 输入值
 * @param {number} fallback - 默认值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 规范化后的值
 */
function normalizeInt(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, parsed));
}

/**
 * 检查写入能力是否启用
 */
function ensureWriteEnabled() {
    if (!SIYUAN_ENABLE_WRITE) {
        throw new Error('当前为只读模式。请设置 SIYUAN_ENABLE_WRITE=true 后再执行写入操作');
    }
}

/**
 * 判断是否清空章节内容
 * @param {Array<string>} args - 命令参数
 * @returns {boolean} 是否清空
 */
function hasClearFlag(args) {
    return args.includes('--clear');
}

/** 已废弃的标志，若出现则抛出迁移提示 */
const DEPRECATED_FLAGS = new Set(['--execute', '--dry-run', '--plan', '--apply']);

/**
 * 检查并拒绝已废弃的 CLI 标志
 * @param {Array<string>} args - 命令参数
 * @throws {Error} 如果发现已废弃标志
 */
function rejectDeprecatedFlags(args) {
    for (const arg of args) {
        if (DEPRECATED_FLAGS.has(arg)) {
            throw new Error(
                `已废弃标志 "${arg}" 已在此版本移除。` +
                `写入命令现在直接执行，只需设置 SIYUAN_ENABLE_WRITE=true。` +
                `请移除 "${arg}" 后重试。`
            );
        }
    }
}

/**
 * 去除命令中的标志位参数
 * @param {Array<string>} args - 命令参数
 * @returns {Array<string>} 位置参数
 */
function stripCommandFlags(args) {
    const flags = new Set(['--clear']);
    return args.filter((item) => !flags.has(item));
}

/**
 * 解析ID列表（逗号或空白分隔）
 * @param {string} raw - 原始字符串
 * @returns {Array<string>} ID数组
 */
function parseIdList(raw) {
    return String(raw || '')
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

/**
 * 读取标准输入文本
 * @returns {Promise<string>} stdin文本
 */
async function readStdinText() {
    if (process.stdin.isTTY) {
        return '';
    }

    return await new Promise((resolve, reject) => {
        let buffer = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            buffer += chunk;
        });
        process.stdin.on('end', () => {
            resolve(buffer);
        });
        process.stdin.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * 校验非空字符串
 * @param {string} value - 输入值
 * @param {string} fieldName - 字段名
 */
function assertNonEmptyString(value, fieldName) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${fieldName} 不能为空`);
    }
}

/**
 * 粗略判断是否为思源块ID格式
 * @param {string} id - 块ID
 * @returns {boolean} 是否匹配
 */
function isLikelyBlockId(id) {
    return /^\d{14}-[a-z0-9]+$/i.test(String(id || '').trim());
}

const blockRootCache = new Map();
let readGuardCacheLoaded = false;
let readGuardCache = {
    version: 1,
    docs: {}
};

function cacheBlockRoot(blockId, rootDocId) {
    if (!isLikelyBlockId(blockId) || !isLikelyBlockId(rootDocId)) {
        return;
    }
    if (blockRootCache.has(blockId)) {
        blockRootCache.delete(blockId);
    }
    blockRootCache.set(blockId, rootDocId);
    while (blockRootCache.size > SIYUAN_BLOCK_ROOT_CACHE_MAX) {
        const oldestKey = blockRootCache.keys().next().value;
        blockRootCache.delete(oldestKey);
    }
}

function getCachedBlockRoot(blockId) {
    if (!blockRootCache.has(blockId)) {
        return '';
    }
    const rootDocId = blockRootCache.get(blockId);
    blockRootCache.delete(blockId);
    blockRootCache.set(blockId, rootDocId);
    return rootDocId;
}

/**
 * 加载读后写围栏缓存
 */
function loadReadGuardCache() {
    if (readGuardCacheLoaded) {
        return;
    }

    readGuardCacheLoaded = true;
    if (!SIYUAN_REQUIRE_READ_BEFORE_WRITE) {
        return;
    }

    try {
        if (!fs.existsSync(READ_GUARD_CACHE_FILE)) {
            return;
        }

        const content = fs.readFileSync(READ_GUARD_CACHE_FILE, 'utf8');
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && parsed.docs && typeof parsed.docs === 'object') {
            readGuardCache = {
                version: 1,
                docs: parsed.docs
            };
        }
    } catch (error) {
        if (DEBUG_MODE) {
            console.log('⚠️  读后写围栏缓存加载失败:', error.message);
        }
        readGuardCache = {
            version: 1,
            docs: {}
        };
    }
}

/**
 * 保存读后写围栏缓存
 */
function saveReadGuardCache() {
    if (!SIYUAN_REQUIRE_READ_BEFORE_WRITE) {
        return;
    }

    try {
        const content = JSON.stringify(readGuardCache, null, 2);
        fs.writeFileSync(READ_GUARD_CACHE_FILE, content, 'utf8');
    } catch (error) {
        if (DEBUG_MODE) {
            console.log('⚠️  读后写围栏缓存写入失败:', error.message);
        }
    }
}

/**
 * 清理过期读标记
 */
function pruneExpiredReadMarks() {
    if (!SIYUAN_REQUIRE_READ_BEFORE_WRITE) {
        return;
    }

    const ttlMs = SIYUAN_READ_GUARD_TTL_SECONDS * 1000;
    const now = Date.now();
    const docs = readGuardCache.docs || {};

    for (const [docId, meta] of Object.entries(docs)) {
        const ts = Number(meta?.ts || 0);
        if (!ts || (now - ts) > ttlMs) {
            delete docs[docId];
        }
    }
}

/**
 * 标记文档已读（同时记录文档 updated 时间戳用于乐观锁）
 * @param {string} docId - 文档ID
 * @param {string} source - 读取来源
 * @param {string} [updatedAt] - 已知的 updated 值（避免重复查询）
 */
async function markDocumentRead(docId, source = 'unknown', updatedAt) {
    if (!SIYUAN_REQUIRE_READ_BEFORE_WRITE || !isLikelyBlockId(docId)) {
        return;
    }

    loadReadGuardCache();
    pruneExpiredReadMarks();

    let resolvedUpdated = updatedAt || '';
    if (!resolvedUpdated) {
        try {
            const meta = await getDocumentMeta(docId);
            resolvedUpdated = meta?.updated || '';
        } catch (_) {
            // 查询失败时退化为纯 TTL 模式
        }
    }

    readGuardCache.docs[docId] = {
        ts: Date.now(),
        source: String(source || 'unknown'),
        updatedAt: resolvedUpdated
    };
    saveReadGuardCache();
}

/**
 * 确认文档已读后才允许写入（含乐观锁版本检查）
 * @param {string} docId - 文档ID
 * @param {string} operation - 操作名
 */
async function ensureDocumentReadBeforeWrite(docId, operation = 'write') {
    if (!SIYUAN_REQUIRE_READ_BEFORE_WRITE) {
        return;
    }

    if (!isLikelyBlockId(docId)) {
        throw new Error(`读后写围栏: 非法文档ID(${docId})`);
    }

    loadReadGuardCache();
    pruneExpiredReadMarks();

    const meta = readGuardCache.docs[docId];
    const ts = Number(meta?.ts || 0);
    const ttlMs = SIYUAN_READ_GUARD_TTL_SECONDS * 1000;
    const fresh = !!ts && (Date.now() - ts <= ttlMs);
    if (!fresh) {
        throw new Error(
            `读后写围栏: 执行 ${operation} 前必须先读取文档 ${docId}。` +
            `请先运行 open-doc ${docId} readable|patchable (或调用 openDocument)。`
        );
    }

    // 乐观锁：对比读取时的 updated 与当前 updated
    const storedUpdated = meta.updatedAt || '';
    if (storedUpdated) {
        const currentMeta = await getDocumentMeta(docId);
        const currentUpdated = currentMeta?.updated || '';
        if (currentUpdated && storedUpdated !== currentUpdated) {
            // 可能是写后刷新时 updated 尚未稳定，等待后重试一次
            await new Promise(r => setTimeout(r, 200));
            const retryMeta = await getDocumentMeta(docId);
            const retryUpdated = retryMeta?.updated || '';
            // 用 retryUpdated 再检查：如果和 stored 一致，说明是瞬时抖动
            // 如果 retryUpdated 与 currentUpdated 一致且都不等于 stored，则确实被外部修改
            if (retryUpdated && storedUpdated !== retryUpdated) {
                throw new Error(
                    `读后写围栏: 文档 ${docId} 自上次读取后已被修改` +
                    `（读取时版本: ${storedUpdated}, 当前版本: ${retryUpdated}）。` +
                    `请重新运行 open-doc ${docId} readable|patchable。`
                );
            }
        }
    }
}

/**
 * 根据块ID解析根文档ID
 * @param {string} blockId - 块ID
 * @returns {Promise<string>} 根文档ID
 */
async function getRootDocIdByBlockId(blockId) {
    const cachedRoot = getCachedBlockRoot(blockId);
    if (cachedRoot) {
        return cachedRoot;
    }

    const safeId = escapeSqlValue(blockId);
    const rows = await executeSiyuanQuery(`
        SELECT id, type, root_id
        FROM blocks
        WHERE id = '${safeId}'
        LIMIT 1
    `);

    if (!rows || rows.length === 0) {
        throw new Error(`未找到目标块: ${blockId}`);
    }

    const row = rows[0] || {};
    const rootDocId = row.type === 'd' ? row.id : row.root_id;
    if (!isLikelyBlockId(rootDocId)) {
        throw new Error(`无法解析块 ${blockId} 的根文档ID`);
    }

    cacheBlockRoot(blockId, rootDocId);
    cacheBlockRoot(rootDocId, rootDocId);
    return rootDocId;
}

/**
 * 确认块所属文档已读后才允许写入
 * @param {string} blockId - 块ID
 * @param {string} operation - 操作名
 */
async function ensureBlockReadBeforeWrite(blockId, operation = 'write') {
    if (!SIYUAN_REQUIRE_READ_BEFORE_WRITE) {
        return;
    }

    assertNonEmptyString(blockId, 'blockId');
    if (!isLikelyBlockId(blockId)) {
        throw new Error(`blockId 格式不正确: ${blockId}`);
    }

    const rootDocId = await getRootDocIdByBlockId(blockId);
    await ensureDocumentReadBeforeWrite(rootDocId, operation);
}

/**
 * 写入成功后刷新文档版本号（支持连续写入）
 * 轮询直到 updated 稳定，避免内核延迟更新导致下次写入误报冲突
 * @param {string} docId - 文档ID
 */
async function refreshDocumentVersion(docId) {
    if (!SIYUAN_REQUIRE_READ_BEFORE_WRITE) {
        return;
    }

    const meta = readGuardCache.docs[docId];
    if (!meta) {
        return;
    }

    try {
        // 轮询直到 updated 连续两次相同（最多 5 轮，每轮间隔 150ms）
        let prev = '';
        for (let i = 0; i < 5; i++) {
            const currentMeta = await getDocumentMeta(docId);
            const cur = currentMeta?.updated || '';
            if (cur && cur === prev) {
                break; // 稳定
            }
            prev = cur;
            if (i < 4) {
                await new Promise(r => setTimeout(r, 150));
            }
        }
        meta.updatedAt = prev;
        meta.ts = Date.now();
        saveReadGuardCache();
    } catch (_) {
        // 刷新失败不阻塞写入流程
    }
}

/**
 * 检查环境配置是否完整
 * @returns {boolean} 配置是否完整
 */
function checkEnvironmentConfig() {
    if (!SIYUAN_API_TOKEN || SIYUAN_API_TOKEN.trim() === '') {
        console.error(`
❌ 错误: 未配置思源笔记API Token

请按以下步骤配置:

1. 打开思源笔记
2. 进入 设置 → 关于
3. 复制 API Token
4. 创建 .env 文件并填入配置:

cp .env.example .env

然后编辑 .env 文件，填入你的配置:

# 基础配置
SIYUAN_HOST=你的服务器地址
SIYUAN_PORT=端口号 (HTTPS且无特殊端口可留空)
SIYUAN_USE_HTTPS=true (如果使用HTTPS)
SIYUAN_API_TOKEN=你的实际API_TOKEN

# 可选：HTTP Basic Auth (如果启用了Basic Auth)
SIYUAN_BASIC_AUTH_USER=用户名
SIYUAN_BASIC_AUTH_PASS=密码
# 若网关仅支持 URL token（有泄漏风险），可设置:
SIYUAN_ALLOW_TOKEN_IN_QUERY=true

# 示例配置 (本地)
SIYUAN_HOST=localhost
SIYUAN_PORT=6806
SIYUAN_USE_HTTPS=false
SIYUAN_API_TOKEN=your_api_token_here

# 示例配置 (远程服务器+HTTPS+Basic Auth)
SIYUAN_HOST=note.example.com
SIYUAN_PORT=
SIYUAN_USE_HTTPS=true
SIYUAN_API_TOKEN=your_api_token
SIYUAN_BASIC_AUTH_USER=username
SIYUAN_BASIC_AUTH_PASS=password
# SIYUAN_ALLOW_TOKEN_IN_QUERY=true

配置完成后重新运行命令。
        `);
        return false;
    }
    return true;
}

/**
 * 调用思源Kernel API
 * @param {string} apiPath - API路径，如 /api/query/sql
 * @param {Object} requestBody - 请求体
 * @param {Object} options - 请求选项
 * @param {boolean} options.requireAuth - 是否要求Token认证
 * @returns {Promise<Object>} data字段
 */
async function requestSiyuanApi(apiPath, requestBody = {}, options = {}) {
    const {
        requireAuth = true
    } = options;

    if (requireAuth && !checkEnvironmentConfig()) {
        throw new Error('环境配置不完整');
    }

    const headers = {
        'Content-Type': 'application/json'
    };

    let requestUrl = `${API_BASE_URL}${apiPath}`;
    const basicAuthHeader = getBasicAuthHeader();
    const hasBasicAuth = Object.keys(basicAuthHeader).length > 0;
    let authMode = requireAuth ? 'Token(header)' : 'No Auth';

    if (hasBasicAuth) {
        headers.Authorization = basicAuthHeader.Authorization;
        authMode = 'Basic Auth';
        if (requireAuth) {
            if (SIYUAN_ALLOW_TOKEN_IN_QUERY) {
                requestUrl += `${requestUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(SIYUAN_API_TOKEN)}`;
                authMode = 'Basic Auth + Token(query)';
            } else {
                headers['X-SiYuan-Token'] = SIYUAN_API_TOKEN;
                authMode = 'Basic Auth + Token(header:x-siyuan-token)';
            }
        }
    } else if (requireAuth) {
        headers.Authorization = `Token ${SIYUAN_API_TOKEN}`;
    }

    if (DEBUG_MODE) {
        console.log(`📨 请求: ${apiPath} (${authMode})`);
    }

    try {
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            switch (response.status) {
                case 401:
                    errorMessage = '认证失败，请检查API Token或Basic Auth配置';
                    if (hasBasicAuth && !SIYUAN_ALLOW_TOKEN_IN_QUERY) {
                        errorMessage += '。若你的网关仅支持 URL token，可设置 SIYUAN_ALLOW_TOKEN_IN_QUERY=true（有日志泄漏风险）';
                    }
                    break;
                case 403:
                    errorMessage = '权限不足，请检查API权限设置';
                    break;
                case 404:
                    errorMessage = `API端点未找到: ${apiPath}`;
                    break;
                case 500:
                    errorMessage = '服务器内部错误，请检查思源笔记状态';
                    break;
                case 503:
                    errorMessage = '服务不可用，请确认思源笔记正在运行';
                    break;
                default:
                    break;
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        if (result.code !== 0) {
            const apiMessage = result.msg || '未知错误';
            throw new Error(`思源API错误: ${apiMessage}`);
        }

        return result.data;
    } catch (error) {
        if (error.name === 'FetchError' || error.code === 'ECONNREFUSED' || String(error.message).includes('fetch failed')) {
            throw new Error(`无法连接到思源笔记: ${error.message}. 请确认思源笔记正在运行且地址端口可达`);
        }

        if (error.message.includes('认证失败') || error.message.includes('token') || error.message.includes('Authorization')) {
            throw new Error(`认证失败: ${error.message}. 请检查API Token或Basic Auth配置`);
        }

        if (error.message.includes('思源API错误') || error.message.includes('HTTP') || error.message.includes('API端点未找到')) {
            throw error;
        }

        throw new Error(`API请求失败(${apiPath}): ${error.message}`);
    }
}

/**
 * 执行思源笔记SQL查询
 * @param {string} sqlQuery - SQL查询语句
 * @returns {Promise<Array>} 查询结果
 */
async function executeSiyuanQuery(sqlQuery) {
    const data = await requestSiyuanApi(API_ENDPOINTS.SQL_QUERY, { stmt: sqlQuery }, { requireAuth: true });
    return Array.isArray(data) ? data : [];
}

/**
 * 获取思源版本
 * @returns {Promise<string>} 版本号
 */
async function getSystemVersion() {
    const data = await requestSiyuanApi(API_ENDPOINTS.SYSTEM_VERSION, {}, { requireAuth: false });
    return typeof data === 'string' ? data : '';
}

/**
 * 导出文档Markdown内容
 * @param {string} id - 文档ID
 * @returns {Promise<Object>} 导出结果
 */
async function exportMdContent(id) {
    return await requestSiyuanApi(API_ENDPOINTS.EXPORT_MD_CONTENT, { id }, { requireAuth: true });
}

/**
 * 获取块的Kramdown
 * @param {string} id - 块ID
 * @returns {Promise<string>} kramdown文本
 */
async function getBlockKramdown(id) {
    const data = await requestSiyuanApi(API_ENDPOINTS.GET_BLOCK_KRAMDOWN, { id }, { requireAuth: true });
    if (typeof data === 'string') {
        return data;
    }

    if (data && typeof data.kramdown === 'string') {
        return data.kramdown;
    }

    return '';
}

/**
 * 根据文档ID获取人类可读路径
 * @param {string} id - 文档ID
 * @returns {Promise<string>} hPath
 */
async function getHPathByID(id) {
    const data = await requestSiyuanApi(API_ENDPOINTS.GET_HPATH_BY_ID, { id }, { requireAuth: true });
    return typeof data === 'string' ? data : '';
}

/**
 * 根据hPath反查文档ID
 * @param {string} notebook - 笔记本ID
 * @param {string} pathValue - hPath
 * @returns {Promise<Array>} 文档ID列表
 */
async function getIDsByHPath(notebook, pathValue) {
    const data = await requestSiyuanApi(API_ENDPOINTS.GET_IDS_BY_HPATH, {
        notebook,
        path: pathValue
    }, { requireAuth: true });

    return Array.isArray(data) ? data : [];
}

/**
 * 根据块ID获取存储路径
 * @param {string} id - 块ID
 * @returns {Promise<{notebook: string, path: string}>} 路径信息
 */
async function getPathByID(id) {
    assertNonEmptyString(id, 'id');
    const data = await requestSiyuanApi(API_ENDPOINTS.GET_PATH_BY_ID, { id }, { requireAuth: true });
    if (data && typeof data === 'object') {
        return {
            notebook: data.notebook || '',
            path: data.path || ''
        };
    }

    return {
        notebook: '',
        path: ''
    };
}

/**
 * 列出指定路径下的子文档
 * @param {string} notebook - 笔记本ID
 * @param {string} pathValue - 存储路径，如 / 或 /xxx.sy
 * @returns {Promise<{box: string, path: string, files: Array}>} 子文档信息
 */
async function listDocsByPath(notebook, pathValue = '/') {
    assertNonEmptyString(notebook, 'notebook');
    const normalizedPath = typeof pathValue === 'string' && pathValue.trim() ? pathValue.trim() : '/';

    const data = await requestSiyuanApi(API_ENDPOINTS.LIST_DOCS_BY_PATH, {
        notebook,
        path: normalizedPath
    }, { requireAuth: true });

    return {
        box: data?.box || notebook,
        path: data?.path || normalizedPath,
        files: Array.isArray(data?.files) ? data.files : []
    };
}

/**
 * 获取指定路径下子文档（精简字段）
 * @param {string} notebook - 笔记本ID
 * @param {string} pathValue - 存储路径
 * @returns {Promise<Array>} 子文档数组
 */
async function getDocumentChildren(notebook, pathValue = '/') {
    const result = await listDocsByPath(notebook, pathValue);
    return result.files.map((file) => ({
        id: file.id || '',
        name: String(file.name || '').replace(/\.sy$/i, ''),
        path: file.path || '',
        subFileCount: normalizeInt(file.subFileCount, 0, 0, 100000),
        sort: typeof file.sort === 'number' ? file.sort : 0,
        hidden: !!file.hidden,
        mtime: file.mtime || 0
    }));
}

/**
 * 获取文档路径前缀（用于子文档判断）
 * @param {string} docPath - 文档存储路径，如 /a/b.sy
 * @returns {string} 前缀路径，如 /a/b/
 */
function getDocPathPrefix(docPath) {
    const value = String(docPath || '').trim();
    if (!value) {
        return '';
    }

    if (value === '/') {
        return '/';
    }

    if (value.endsWith('.sy')) {
        return `${value.slice(0, -3)}/`;
    }

    return value.endsWith('/') ? value : `${value}/`;
}

/**
 * 判断 childPath 是否位于 ancestorPath 之下
 * @param {string} ancestorPath - 祖先文档路径
 * @param {string} childPath - 子路径
 * @returns {boolean} 是否为后代路径
 */
function isDescendantDocPath(ancestorPath, childPath) {
    const a = String(ancestorPath || '').trim();
    const c = String(childPath || '').trim();
    if (!a || !c || a === c) {
        return false;
    }

    const prefix = getDocPathPrefix(a);
    return !!prefix && c.startsWith(prefix);
}

/**
 * 计算文档路径深度
 * @param {string} pathValue - 文档路径
 * @returns {number} 深度
 */
function getDocPathDepth(pathValue) {
    const normalized = String(pathValue || '').replace(/^\/+|\/+$/g, '');
    if (!normalized) {
        return 0;
    }

    return normalized.split('/').length;
}

/**
 * 构建文档树
 * @param {string} notebook - 笔记本ID
 * @param {string} startPath - 起始路径，默认 /
 * @param {number} maxDepth - 最大深度，默认 4
 * @returns {Promise<Object>} 文档树结构
 */
async function getDocumentTree(notebook, startPath = '/', maxDepth = 4) {
    assertNonEmptyString(notebook, 'notebook');
    const safeDepth = normalizeInt(maxDepth, 4, 1, 10);
    const visited = new Set();

    async function walk(pathValue, depth) {
        if (visited.has(pathValue)) {
            return [];
        }
        visited.add(pathValue);

        const children = await getDocumentChildren(notebook, pathValue);
        const nodes = [];

        for (const child of children) {
            let descendants = [];
            if (depth < safeDepth && child.subFileCount > 0) {
                descendants = await walk(child.path, depth + 1);
            }

            nodes.push({
                ...child,
                children: descendants
            });
        }

        return nodes;
    }

    return {
        notebook,
        startPath,
        maxDepth: safeDepth,
        nodes: await walk(startPath, 1)
    };
}

/**
 * 根据文档ID获取其子文档树
 * @param {string} docId - 文档ID
 * @param {number} maxDepth - 最大深度
 * @returns {Promise<Object>} 子文档树
 */
async function getDocumentTreeByID(docId, maxDepth = 4) {
    assertNonEmptyString(docId, 'docId');
    if (!isLikelyBlockId(docId)) {
        throw new Error('docId 格式不正确');
    }

    const docType = await getBlockTypeById(docId);
    if (docType !== 'd') {
        throw new Error(`docId 不是文档块(type=${docType || 'unknown'})`);
    }

    const pathInfo = await getPathByID(docId);
    if (!pathInfo.path) {
        throw new Error(`未找到文档路径: ${docId}`);
    }

    const tree = await getDocumentTree(pathInfo.notebook, pathInfo.path, maxDepth);
    return {
        ...tree,
        rootDocID: docId
    };
}

/**
 * 统计文档树复杂度
 * @param {Object} tree - 文档树
 * @returns {Object} 统计信息
 */
function analyzeDocumentTree(tree) {
    const stats = {
        rootDocID: tree.rootDocID || '',
        notebook: tree.notebook || '',
        startPath: tree.startPath || '/',
        totalNodes: 0,
        leafNodes: 0,
        maxObservedDepth: 0,
        averageBranchingFactor: 0,
        branchingNodeCount: 0,
        maxChildrenOnSingleNode: 0,
        deepestNodePath: ''
    };

    let totalChildren = 0;

    function walk(nodes, depth) {
        if (!Array.isArray(nodes)) {
            return;
        }

        for (const node of nodes) {
            stats.totalNodes += 1;
            if (depth > stats.maxObservedDepth) {
                stats.maxObservedDepth = depth;
                stats.deepestNodePath = node.path || '';
            }

            const childCount = Array.isArray(node.children) ? node.children.length : 0;
            if (childCount === 0) {
                stats.leafNodes += 1;
            } else {
                stats.branchingNodeCount += 1;
                totalChildren += childCount;
                if (childCount > stats.maxChildrenOnSingleNode) {
                    stats.maxChildrenOnSingleNode = childCount;
                }
                walk(node.children, depth + 1);
            }
        }
    }

    walk(tree.nodes, 1);

    if (stats.branchingNodeCount > 0) {
        stats.averageBranchingFactor = Number((totalChildren / stats.branchingNodeCount).toFixed(3));
    }

    return stats;
}

/**
 * 将文档树渲染为Markdown
 * @param {Object} tree - 文档树
 * @returns {string} Markdown文本
 */
function renderDocumentTreeMarkdown(tree) {
    const stats = analyzeDocumentTree(tree);
    const lines = [];
    lines.push('---');
    lines.push('siyuan_view: document_tree');
    lines.push(`notebook: ${JSON.stringify(tree.notebook || '')}`);
    lines.push(`start_path: ${JSON.stringify(tree.startPath || '/')}`);
    lines.push(`max_depth: ${tree.maxDepth || 0}`);
    if (tree.rootDocID) {
        lines.push(`root_doc_id: ${tree.rootDocID}`);
    }
    lines.push(`generated_at: ${new Date().toISOString()}`);
    lines.push('---');
    lines.push('');
    lines.push('# 子文档组织关系');
    lines.push('');
    lines.push(`- total_nodes: ${stats.totalNodes}`);
    lines.push(`- leaf_nodes: ${stats.leafNodes}`);
    lines.push(`- max_observed_depth: ${stats.maxObservedDepth}`);
    lines.push(`- avg_branching_factor: ${stats.averageBranchingFactor}`);
    if (stats.deepestNodePath) {
        lines.push(`- deepest_node_path: \`${stats.deepestNodePath}\``);
    }
    lines.push('');

    function walk(nodes, level) {
        for (const node of nodes) {
            const indent = '  '.repeat(level);
            const label = node.name || '(未命名文档)';
            lines.push(`${indent}- ${label} \`${node.id}\` (${node.path})`);
            if (Array.isArray(node.children) && node.children.length > 0) {
                walk(node.children, level + 1);
            }
        }
    }

    if (!Array.isArray(tree.nodes) || tree.nodes.length === 0) {
        lines.push('（该路径下没有子文档）');
    } else {
        walk(tree.nodes, 0);
    }

    return lines.join('\n');
}

/**
 * 解析文档移动目标
 * @param {string} toID - 目标ID（文档ID或笔记本ID）
 * @returns {Promise<Object>} 目标信息
 */
async function resolveMoveTarget(toID) {
    assertNonEmptyString(toID, 'toID');

    const notebooks = await listNotebooks();
    const notebook = notebooks.find((item) => item.id === toID);
    if (notebook) {
        return {
            kind: 'notebook',
            id: toID,
            notebook: toID,
            path: '/'
        };
    }

    if (!isLikelyBlockId(toID)) {
        throw new Error(`目标ID格式不正确: ${toID}`);
    }

    const targetType = await getBlockTypeById(toID);
    if (targetType !== 'd') {
        throw new Error(`目标ID不是文档或笔记本(type=${targetType || 'unknown'})`);
    }

    const pathInfo = await getPathByID(toID);
    if (!pathInfo.path) {
        throw new Error(`未找到目标文档路径: ${toID}`);
    }

    return {
        kind: 'doc',
        id: toID,
        notebook: pathInfo.notebook,
        path: pathInfo.path
    };
}

/**
 * 按ID移动文档
 * @param {Array<string>} fromIDs - 源文档ID数组
 * @param {string} toID - 目标父文档ID或笔记本ID
 * @returns {Promise<Object>} API结果
 */
async function moveDocsByID(fromIDs, toID) {
    ensureWriteEnabled();
    assertNonEmptyString(toID, 'toID');
    if (!Array.isArray(fromIDs) || fromIDs.length === 0) {
        throw new Error('fromIDs 不能为空');
    }

    return await requestSiyuanApi(API_ENDPOINTS.MOVE_DOCS_BY_ID, {
        fromIDs,
        toID
    }, { requireAuth: true });
}

/**
 * 生成按ID移动文档计划
 * @param {string} toID - 目标父文档ID或笔记本ID
 * @param {Array<string>} fromIDs - 源文档ID数组
 * @returns {Promise<Object>} 移动计划
 */
async function planMoveDocsByID(toID, fromIDs) {
    const target = await resolveMoveTarget(toID);
    if (!Array.isArray(fromIDs) || fromIDs.length === 0) {
        throw new Error('fromIDs 不能为空');
    }

    const uniqueFromIDs = [...new Set(fromIDs.map((id) => String(id || '').trim()).filter(Boolean))];
    if (uniqueFromIDs.length === 0) {
        throw new Error('fromIDs 不能为空');
    }

    const filteredFromIDs = uniqueFromIDs.filter((id) => id !== target.id);
    if (filteredFromIDs.length === 0) {
        throw new Error('fromIDs 与 toID 不能相同');
    }

    const sourceDocs = [];
    for (const id of filteredFromIDs) {
        if (!isLikelyBlockId(id)) {
            throw new Error(`文档ID格式不正确: ${id}`);
        }

        const type = await getBlockTypeById(id);
        if (type !== 'd') {
            throw new Error(`来源ID不是文档块: ${id} (type=${type || 'unknown'})`);
        }

        const pathInfo = await getPathByID(id);
        if (!pathInfo.path) {
            throw new Error(`未找到文档ID: ${id}`);
        }

        if (target.kind === 'doc' && isDescendantDocPath(pathInfo.path, target.path)) {
            throw new Error(`移动将形成循环: 不能将祖先文档 ${id} 移动到其后代 ${target.id} 之下`);
        }

        sourceDocs.push({ id, ...pathInfo });
    }

    sourceDocs.sort((a, b) => getDocPathDepth(a.path) - getDocPathDepth(b.path));

    const effectiveSources = [];
    const prunedDescendantIDs = [];
    for (const source of sourceDocs) {
        const shouldPrune = effectiveSources.some((picked) => isDescendantDocPath(picked.path, source.path));
        if (shouldPrune) {
            prunedDescendantIDs.push(source.id);
            continue;
        }
        effectiveSources.push(source);
    }

    if (effectiveSources.length === 0) {
        throw new Error('没有可移动的来源文档（可能都被祖先文档覆盖）');
    }

    const warnings = [];
    if (target.kind === 'doc') {
        const crossNotebook = effectiveSources.some((item) => item.notebook !== target.notebook);
        if (crossNotebook) {
            warnings.push('检测到跨笔记本移动到目标文档，实际效果取决于思源内核版本');
        }
    }

    return {
        action: 'move_docs_by_id',
        toID: target.id,
        target,
        fromIDs: filteredFromIDs,
        effectiveFromIDs: effectiveSources.map((item) => item.id),
        moveCount: effectiveSources.length,
        prunedDescendantIDs,
        beforePaths: effectiveSources,
        warnings
    };
}

/**
 * 重新组织子文档（按ID移动）
 * @param {string} toID - 目标父文档ID或笔记本ID
 * @param {Array<string>} fromIDs - 源文档ID数组
 * @returns {Promise<Object>} 结果
 */
async function reorganizeSubdocsByID(toID, fromIDs) {
    const plan = await planMoveDocsByID(toID, fromIDs);

    ensureWriteEnabled();

    if (plan.target.kind === 'doc') {
        await ensureDocumentReadBeforeWrite(plan.target.id, 'moveDocsByID(target)');
    }
    for (const id of plan.effectiveFromIDs) {
        await ensureDocumentReadBeforeWrite(id, 'moveDocsByID(source)');
    }

    const apiResult = await moveDocsByID(plan.effectiveFromIDs, plan.toID);

    const afterPaths = [];
    for (const id of plan.effectiveFromIDs) {
        const pathInfo = await getPathByID(id);
        afterPaths.push({ id, ...pathInfo });
    }

    const mismatches = [];
    if (plan.target.kind === 'doc') {
        const targetPrefix = getDocPathPrefix(plan.target.path);
        for (const item of afterPaths) {
            const okNotebook = item.notebook === plan.target.notebook;
            const okPath = !!targetPrefix && item.path.startsWith(targetPrefix);
            if (!okNotebook || !okPath) {
                mismatches.push({
                    id: item.id,
                    notebook: item.notebook,
                    path: item.path,
                    expectedNotebook: plan.target.notebook,
                    expectedPathPrefix: targetPrefix
                });
            }
        }
    } else {
        for (const item of afterPaths) {
            if (item.notebook !== plan.target.notebook) {
                mismatches.push({
                    id: item.id,
                    notebook: item.notebook,
                    path: item.path,
                    expectedNotebook: plan.target.notebook
                });
            }
        }
    }

    if (plan.target.kind === 'doc') {
        await refreshDocumentVersion(plan.target.id);
    }
    for (const id of plan.effectiveFromIDs) {
        await refreshDocumentVersion(id);
    }

    return {
        plan,
        execution: {
            result: apiResult,
            afterPaths,
            verification: {
                passed: mismatches.length === 0,
                mismatchCount: mismatches.length,
                mismatches
            }
        }
    };
}

/**
 * 分析子文档重组计划（不执行）
 * @param {string} toID - 目标ID
 * @param {Array<string>} fromIDs - 来源文档ID数组
 * @param {number} maxDepth - 树分析深度
 * @returns {Promise<Object>} 分析报告
 */
async function analyzeSubdocMovePlan(toID, fromIDs, maxDepth = 5) {
    const safeDepth = normalizeInt(maxDepth, 5, 1, 10);
    const plan = await planMoveDocsByID(toID, fromIDs);

    let targetTree = null;
    let targetTreeStats = null;
    if (plan.target.kind === 'doc') {
        targetTree = await getDocumentTreeByID(plan.target.id, safeDepth);
        targetTreeStats = analyzeDocumentTree(targetTree);
    } else {
        const notebookTree = await getDocumentTree(plan.target.notebook, '/', safeDepth);
        targetTree = {
            ...notebookTree,
            rootDocID: ''
        };
        targetTreeStats = analyzeDocumentTree(targetTree);
    }

    const sourceTrees = [];
    for (const source of plan.beforePaths) {
        const tree = await getDocumentTreeByID(source.id, safeDepth);
        sourceTrees.push({
            id: source.id,
            path: source.path,
            stats: analyzeDocumentTree(tree)
        });
    }

    return {
        action: 'analyze_subdoc_move_plan',
        maxDepth: safeDepth,
        plan,
        analysis: {
            targetTreeStats,
            sourceTrees,
            estimatedMovedDocCount: plan.moveCount,
            prunedDescendantCount: plan.prunedDescendantIDs.length,
            warnings: plan.warnings || []
        }
    };
}

/**
 * 列出笔记本
 * @returns {Promise<Array>} 笔记本列表
 */
async function listNotebooks() {
    const data = await requestSiyuanApi(API_ENDPOINTS.NOTEBOOKS, {}, { requireAuth: true });
    if (Array.isArray(data)) {
        return data;
    }

    if (data && Array.isArray(data.notebooks)) {
        return data.notebooks;
    }

    return [];
}

/**
 * 创建文档（用于测试和初始化）
 * @param {string} notebook - 笔记本ID
 * @param {string} pathValue - 文档路径
 * @param {string} markdown - 初始内容
 * @returns {Promise<Object>} 创建结果
 */
async function createDocWithMd(notebook, pathValue, markdown = '') {
    ensureWriteEnabled();
    assertNonEmptyString(notebook, 'notebook');
    assertNonEmptyString(pathValue, 'path');

    return await requestSiyuanApi(API_ENDPOINTS.CREATE_DOC_WITH_MD, {
        notebook,
        path: pathValue,
        markdown
    }, { requireAuth: true });
}

/**
 * 重命名文档
 * @param {string} notebook - 笔记本ID
 * @param {string} docPath - 文档存储路径（如 /20260101120000-abc1234.sy）
 * @param {string} title - 新标题
 * @returns {Promise<Object>} API 响应
 */
async function renameDoc(notebook, docPath, title) {
    ensureWriteEnabled();
    assertNonEmptyString(notebook, 'notebook');
    assertNonEmptyString(docPath, 'path');
    assertNonEmptyString(title, 'title');

    return await requestSiyuanApi(API_ENDPOINTS.RENAME_DOC, {
        notebook,
        path: docPath,
        title
    }, { requireAuth: true });
}

/**
 * 获取块属性
 * @param {string} id - 块ID
 * @returns {Promise<Object>} 块属性
 */
async function getBlockAttrs(id) {
    assertNonEmptyString(id, 'id');
    const data = await requestSiyuanApi(API_ENDPOINTS.GET_BLOCK_ATTRS, { id }, { requireAuth: true });
    return (data && typeof data === 'object') ? data : {};
}

/**
 * 获取子块
 * @param {string} id - 父块ID
 * @returns {Promise<Array>} 子块数组
 */
async function getChildBlocks(id) {
    assertNonEmptyString(id, 'id');
    const data = await requestSiyuanApi(API_ENDPOINTS.GET_CHILD_BLOCKS, { id }, { requireAuth: true });

    if (Array.isArray(data)) {
        return data;
    }

    if (data && Array.isArray(data.blocks)) {
        return data.blocks;
    }

    return [];
}

/**
 * 根据块ID查询块类型
 * @param {string} id - 块ID
 * @returns {Promise<string>} 块类型
 */
async function getBlockTypeById(id) {
    const safeId = escapeSqlValue(id);
    const rows = await executeSiyuanQuery(`
        SELECT type
        FROM blocks
        WHERE id = '${safeId}'
        LIMIT 1
    `);

    if (!rows || rows.length === 0) {
        return '';
    }

    return rows[0]?.type || '';
}

/**
 * 追加块内容
 * @param {string} parentID - 父块ID
 * @param {string} markdown - Markdown内容
 * @returns {Promise<Object>} API返回
 */
async function appendBlock(parentID, markdown) {
    ensureWriteEnabled();
    assertNonEmptyString(parentID, 'parentID');
    assertNonEmptyString(markdown, 'markdown');
    await ensureBlockReadBeforeWrite(parentID, 'appendBlock');
    return await requestSiyuanApi(API_ENDPOINTS.APPEND_BLOCK, {
        parentID,
        dataType: 'markdown',
        data: markdown
    }, { requireAuth: true });
}

/**
 * 在指定锚点插入块
 * @param {string} markdown - Markdown内容
 * @param {Object} anchors - 锚点参数
 * @param {string} anchors.parentID - 父块ID
 * @param {string} anchors.previousID - 前一个块ID
 * @param {string} anchors.nextID - 后一个块ID
 * @returns {Promise<Object>} API返回
 */
async function insertBlock(markdown, anchors = {}) {
    ensureWriteEnabled();
    assertNonEmptyString(markdown, 'markdown');

    const parentID = typeof anchors.parentID === 'string' ? anchors.parentID.trim() : '';
    const previousID = typeof anchors.previousID === 'string' ? anchors.previousID.trim() : '';
    const nextID = typeof anchors.nextID === 'string' ? anchors.nextID.trim() : '';

    if (!parentID && !previousID && !nextID) {
        throw new Error('insertBlock 需要至少一个锚点参数(parentID/previousID/nextID)');
    }

    const guardAnchors = new Set([parentID, previousID, nextID].filter(Boolean));
    for (const anchorId of guardAnchors) {
        await ensureBlockReadBeforeWrite(anchorId, 'insertBlock');
    }

    return await requestSiyuanApi(API_ENDPOINTS.INSERT_BLOCK, {
        dataType: 'markdown',
        data: markdown,
        parentID,
        previousID,
        nextID
    }, { requireAuth: true });
}

/**
 * 移动块到目标位置
 * @param {string} id - 要移动的块ID
 * @param {Object} anchors - 目标锚点
 * @param {string} anchors.parentID - 目标父块ID
 * @param {string} anchors.previousID - 目标前序块ID
 * @returns {Promise<Object>} API返回
 */
async function moveBlock(id, anchors = {}) {
    ensureWriteEnabled();
    assertNonEmptyString(id, 'id');
    await ensureBlockReadBeforeWrite(id, 'moveBlock');

    const parentID = typeof anchors.parentID === 'string' ? anchors.parentID.trim() : '';
    const previousID = typeof anchors.previousID === 'string' ? anchors.previousID.trim() : '';

    if (!parentID && !previousID) {
        throw new Error('moveBlock 需要 parentID 或 previousID 作为锚点');
    }

    return await requestSiyuanApi(API_ENDPOINTS.MOVE_BLOCK, {
        id,
        parentID,
        previousID
    }, { requireAuth: true });
}

/**
 * 更新块内容
 * @param {string} id - 块ID
 * @param {string} markdown - 新Markdown内容
 * @returns {Promise<Object>} API返回
 */
async function updateBlock(id, markdown) {
    ensureWriteEnabled();
    assertNonEmptyString(id, 'id');
    assertNonEmptyString(markdown, 'markdown');
    await ensureBlockReadBeforeWrite(id, 'updateBlock');

    return await requestSiyuanApi(API_ENDPOINTS.UPDATE_BLOCK, {
        id,
        dataType: 'markdown',
        data: markdown
    }, { requireAuth: true });
}

/**
 * 删除块
 * @param {string} id - 块ID
 * @returns {Promise<Object>} API返回
 */
async function deleteBlock(id) {
    ensureWriteEnabled();
    assertNonEmptyString(id, 'id');
    await ensureBlockReadBeforeWrite(id, 'deleteBlock');
    return await requestSiyuanApi(API_ENDPOINTS.DELETE_BLOCK, { id }, { requireAuth: true });
}

/**
 * 标准化Markdown写入内容
 * @param {string} markdown - 输入文本
 * @returns {string} 规范化文本
 */
function normalizeWritableMarkdown(markdown) {
    const normalized = normalizeMarkdown(markdown);
    if (!normalized) {
        throw new Error('markdown 不能为空');
    }

    if (normalized.length > 200000) {
        throw new Error('markdown 超出安全长度限制(200000字符)');
    }

    return normalized;
}

/**
 * 生成替换章节的执行计划
 * @param {string} headingBlockId - 标题块ID
 * @param {string} markdown - 替换内容
 * @returns {Promise<Object>} 执行计划
 */
async function planReplaceSection(headingBlockId, markdown) {
    assertNonEmptyString(headingBlockId, 'headingBlockId');
    if (!isLikelyBlockId(headingBlockId)) {
        throw new Error('headingBlockId 格式不正确');
    }

    const [attrs, dbType] = await Promise.all([
        getBlockAttrs(headingBlockId),
        getBlockTypeById(headingBlockId)
    ]);

    const headingType = dbType || attrs?.type || '';
    if (!headingType) {
        throw new Error('未找到目标块，请确认 headingBlockId 是否存在');
    }

    if (headingType && headingType !== 'h') {
        throw new Error(`目标块不是标题块(type=${headingType})，无法执行 replace-section`);
    }

    const childBlocks = await getChildBlocks(headingBlockId);
    const childIds = childBlocks.map((item) => item?.id).filter(Boolean);

    const normalizedMarkdown = normalizeMarkdown(markdown);
    if (normalizedMarkdown.length > 200000) {
        throw new Error('markdown 超出安全长度限制(200000字符)');
    }
    const hasInsert = normalizedMarkdown.length > 0;

    return {
        action: 'replace_section',
        headingBlockId,
        deleteCount: childIds.length,
        insert: hasInsert,
        insertCharCount: normalizedMarkdown.length,
        deleteBlockIds: childIds,
        insertMarkdownPreview: hasInsert ? truncateText(normalizedMarkdown, 180) : '',
        operations: [
            ...childIds.map((id) => ({ op: 'deleteBlock', id })),
            ...(hasInsert ? [{ op: 'appendBlock', parentID: headingBlockId, dataType: 'markdown' }] : [])
        ]
    };
}

/**
 * 执行章节替换
 * @param {string} headingBlockId - 标题块ID
 * @param {string} markdown - 替换内容
 * @returns {Promise<Object>} 执行结果
 */
async function replaceSection(headingBlockId, markdown) {
    const plan = await planReplaceSection(headingBlockId, markdown);

    ensureWriteEnabled();
    const rootDocId = await getRootDocIdByBlockId(headingBlockId);
    await ensureDocumentReadBeforeWrite(rootDocId, 'replaceSection');
    cacheBlockRoot(headingBlockId, rootDocId);
    for (const id of plan.deleteBlockIds) {
        if (isLikelyBlockId(id)) {
            cacheBlockRoot(id, rootDocId);
        }
    }

    const normalizedMarkdown = normalizeMarkdown(markdown);
    const deleted = [];
    const deleteOrder = [...plan.deleteBlockIds].reverse();
    for (const blockId of deleteOrder) {
        await deleteBlock(blockId);
        deleted.push(blockId);
    }

    let appendResult = null;
    if (normalizedMarkdown.length > 0) {
        appendResult = await appendBlock(headingBlockId, normalizedMarkdown);
    }

    await refreshDocumentVersion(rootDocId);

    return {
        plan,
        execution: {
            deletedCount: deleted.length,
            deletedIds: deleted,
            appended: normalizedMarkdown.length > 0,
            appendResult
        }
    };
}

/**
 * 向指定父块追加内容
 * @param {string} parentBlockId - 父块ID
 * @param {string} markdown - 追加内容
 * @returns {Promise<Object>} 执行结果
 */
async function appendMarkdownToBlock(parentBlockId, markdown) {
    assertNonEmptyString(parentBlockId, 'parentBlockId');
    if (!isLikelyBlockId(parentBlockId)) {
        throw new Error('parentBlockId 格式不正确');
    }

    const parentType = await getBlockTypeById(parentBlockId);
    if (!parentType) {
        throw new Error('未找到父块，请确认 parentBlockId 是否存在');
    }

    ensureWriteEnabled();

    const normalizedMarkdown = normalizeWritableMarkdown(markdown);
    const result = await appendBlock(parentBlockId, normalizedMarkdown);
    const rootDocId = await getRootDocIdByBlockId(parentBlockId);
    await refreshDocumentVersion(rootDocId);
    return {
        action: 'append_block',
        parentBlockId,
        parentType,
        execution: {
            appended: true,
            result
        }
    };
}

/**
 * 搜索包含关键词的笔记内容 (基于思源SQL规范)
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回结果数量限制
 * @param {string} blockType - 块类型过滤
 * @returns {Promise<Array>} 查询结果
 */
async function searchNotes(keyword, limit = 20, blockType = null) {
    const safeKeyword = escapeSqlLikeValue(keyword);
    const safeLimit = normalizeInt(limit, 20, 1, 200);
    let sql = `
        SELECT id, content, type, subtype, created, updated, root_id, parent_id, box, path, hpath
        FROM blocks
        WHERE markdown LIKE '%${safeKeyword}%' ESCAPE '!'
    `;

    if (blockType) {
        const safeBlockType = escapeSqlValue(blockType);
        sql += ` AND type = '${safeBlockType}'`;
    }

    sql += `
        ORDER BY updated DESC
        LIMIT ${safeLimit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询所有文档块
 * @param {string} notebookId - 笔记本ID过滤
 * @param {number} limit - 返回数量上限
 * @returns {Promise<Array>} 文档列表
 */
async function listDocuments(notebookId = null, limit = SIYUAN_LIST_DOCUMENTS_LIMIT) {
    const safeLimit = normalizeInt(limit, SIYUAN_LIST_DOCUMENTS_LIMIT, 1, 2000);
    let sql = `
        SELECT id, content, created, updated, box, path, hpath
        FROM blocks
        WHERE type = 'd'
    `;

    if (notebookId) {
        sql += ` AND box = '${escapeSqlValue(notebookId)}'`;
    }

    sql += ` ORDER BY updated DESC LIMIT ${safeLimit}`;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询指定文档下的标题块
 * @param {string} rootId - 根文档ID
 * @param {string} headingType - 标题类型 (h1, h2等)
 * @returns {Promise<Array>} 标题列表
 */
async function getDocumentHeadings(rootId, headingType = null) {
    const safeRootId = escapeSqlValue(rootId);
    let sql = `
        SELECT id, content, subtype, created, updated, parent_id
        FROM blocks
        WHERE root_id = '${safeRootId}'
        AND type = 'h'
    `;

    if (headingType) {
        sql += ` AND subtype = '${escapeSqlValue(headingType)}'`;
    }

    sql += ' ORDER BY created ASC';

    return await executeSiyuanQuery(sql);
}

/**
 * 查询指定文档的所有子块
 * @param {string} rootId - 根文档ID
 * @param {string} blockType - 块类型过滤
 * @returns {Promise<Array>} 子块列表
 */
async function getDocumentBlocks(rootId, blockType = null) {
    const safeRootId = escapeSqlValue(rootId);
    let sql = `
        SELECT id, content, type, subtype, created, updated, parent_id, ial
        FROM blocks
        WHERE root_id = '${safeRootId}'
    `;

    if (blockType) {
        sql += ` AND type = '${escapeSqlValue(blockType)}'`;
    }

    sql += ' ORDER BY created ASC';

    return await executeSiyuanQuery(sql);
}

/**
 * 查询包含特定标签的笔记
 * @param {string} tag - 标签名 (不需要包含#)
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 包含标签的笔记列表
 */
async function searchByTag(tag, limit = 20) {
    const normalizedTag = String(tag || '').trim().replace(/^#+|#+$/g, '');
    assertNonEmptyString(normalizedTag, 'tag');
    const safeTag = escapeSqlLikeValue(normalizedTag);
    const safeLimit = normalizeInt(limit, 20, 1, 200);
    const sql = `
        SELECT id, content, type, subtype, created, updated, root_id, parent_id
        FROM blocks
        WHERE tag LIKE '%#${safeTag}#%' ESCAPE '!'
        ORDER BY updated DESC
        LIMIT ${safeLimit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询块的反向链接 (引用了这个块的所有块)
 * @param {string} defBlockId - 被引用的块ID
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 反向链接列表
 */
async function getBacklinks(defBlockId, limit = 999) {
    const safeDefBlockId = escapeSqlValue(defBlockId);
    const safeLimit = normalizeInt(limit, 999, 1, 2000);
    const sql = `
        SELECT * FROM blocks
        WHERE id IN (
            SELECT block_id FROM refs WHERE def_block_id = '${safeDefBlockId}'
        )
        ORDER BY updated DESC
        LIMIT ${safeLimit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询任务列表
 * @param {string} status - 任务状态 ('[ ]'未完成, '[x]'已完成, '[-]'进行中)
 * @param {number} days - 查询最近N天的任务
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 任务列表
 */
async function searchTasks(status = '[ ]', days = 7, limit = 50) {
    const safeStatus = escapeSqlValue(status);
    const safeDays = normalizeInt(days, 7, 1, 3650);
    const safeLimit = normalizeInt(limit, 50, 1, 500);
    const sql = `
        SELECT * FROM blocks
        WHERE type = 'l' AND subtype = 't'
        AND created > strftime('%Y%m%d%H%M%S', datetime('now', '-${safeDays} day'))
        AND markdown LIKE '* ${safeStatus} %'
        AND parent_id NOT IN (
            SELECT id FROM blocks WHERE subtype = 't'
        )
        ORDER BY updated DESC
        LIMIT ${safeLimit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询Daily Note (日记)
 * @param {string} startDate - 开始日期 (格式: YYYYMMDD)
 * @param {string} endDate - 结束日期 (格式: YYYYMMDD)
 * @returns {Promise<Array>} Daily Note列表
 */
async function getDailyNotes(startDate, endDate) {
    const safeStartDate = escapeSqlValue(startDate);
    const safeEndDate = escapeSqlValue(endDate);
    const sql = `
        SELECT DISTINCT B.* FROM blocks AS B
        JOIN attributes AS A ON B.id = A.block_id
        WHERE A.name LIKE 'custom-dailynote-%'
        AND B.type = 'd'
        AND A.value >= '${safeStartDate}'
        AND A.value <= '${safeEndDate}'
        ORDER BY A.value DESC
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询包含特定属性的块
 * @param {string} attrName - 属性名称
 * @param {string} attrValue - 属性值 (可选)
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 包含属性的块列表
 */
async function searchByAttribute(attrName, attrValue = null, limit = 20) {
    const safeAttrName = escapeSqlValue(attrName);
    const safeLimit = normalizeInt(limit, 20, 1, 500);
    let sql = `
        SELECT * FROM blocks
        WHERE id IN (
            SELECT block_id FROM attributes
            WHERE name = '${safeAttrName}'
    `;

    if (attrValue) {
        sql += ` AND value = '${escapeSqlValue(attrValue)}'`;
    }

    sql += `
        )
        ORDER BY updated DESC
        LIMIT ${safeLimit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询书签
 * @param {string} bookmarkName - 书签名 (可选)
 * @returns {Promise<Array>} 书签列表
 */
async function getBookmarks(bookmarkName = null) {
    let sql = `
        SELECT * FROM blocks
        WHERE id IN (
            SELECT block_id FROM attributes
            WHERE name = 'bookmark'
    `;

    if (bookmarkName) {
        sql += ` AND value = '${escapeSqlValue(bookmarkName)}'`;
    }

    sql += ') ORDER BY updated DESC';

    return await executeSiyuanQuery(sql);
}

/**
 * 随机漫游某个文档内的标题块
 * @param {string} rootId - 文档ID
 * @returns {Promise<Array>} 随机标题块
 */
async function getRandomHeading(rootId) {
    const safeRootId = escapeSqlValue(rootId);
    const sql = `
        SELECT * FROM blocks
        WHERE root_id = '${safeRootId}' AND type = 'h'
        ORDER BY random() LIMIT 1
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询最近创建或修改的块
 * @param {number} days - 天数
 * @param {string} orderBy - 排序方式 (created/updated)
 * @param {string} blockType - 块类型过滤
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 最近块列表
 */
async function getRecentBlocks(days = 7, orderBy = 'updated', blockType = null, limit = 50) {
    const safeDays = normalizeInt(days, 7, 1, 3650);
    const safeLimit = normalizeInt(limit, 50, 1, 500);
    const safeOrderBy = orderBy === 'created' ? 'created' : 'updated';
    const dateThreshold = strftime('%Y%m%d%H%M%S', Date.now() - (safeDays * 24 * 60 * 60 * 1000));

    let sql = `
        SELECT id, content, type, subtype, created, updated, root_id, box, hpath
        FROM blocks
        WHERE ${safeOrderBy} > '${dateThreshold}'
    `;

    if (blockType) {
        sql += ` AND type = '${escapeSqlValue(blockType)}'`;
    }

    sql += `
        ORDER BY ${safeOrderBy} DESC
        LIMIT ${safeLimit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 查询笔记本下未被引用的文档
 * @param {string} notebookId - 笔记本ID
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise<Array>} 未被引用的文档列表
 */
async function getUnreferencedDocuments(notebookId, limit = 128) {
    const safeNotebookId = escapeSqlValue(notebookId);
    const safeLimit = normalizeInt(limit, 128, 1, 1000);
    const sql = `
        SELECT * FROM blocks AS B
        WHERE B.type = 'd'
        AND box = '${safeNotebookId}'
        AND B.id NOT IN (
            SELECT DISTINCT R.def_block_id FROM refs AS R
        )
        ORDER BY updated DESC
        LIMIT ${safeLimit}
    `;

    return await executeSiyuanQuery(sql);
}

/**
 * 检查思源笔记连接状态
 * @returns {Promise<boolean>} 连接是否正常
 */
async function checkConnection() {
    // 先检查环境配置
    if (!checkEnvironmentConfig()) {
        return false;
    }

    try {
        const result = await executeSiyuanQuery('SELECT 1 as test');
        return result && result.length > 0;
    } catch (error) {
        console.error('思源笔记连接检查失败:', error.message);
        console.log('\n请检查:');
        console.log('1. 思源笔记是否正在运行');
        console.log('2. API端口是否为6806 (可在设置中修改)');
        console.log('3. API Token是否正确');
        return false;
    }
}

const CLI_HANDLERS = createCliHandlers({
    parseIdList,
    readStdinText,
    normalizeInt,
    hasClearFlag,
    rejectDeprecatedFlags,
    stripCommandFlags,
    formatResults,
    searchNotes,
    searchNotesMarkdown,
    openDocument,
    listNotebooks,
    getDocumentChildren,
    getDocumentTree,
    renderDocumentTreeMarkdown,
    getDocumentTreeByID,
    analyzeSubdocMovePlan,
    reorganizeSubdocsByID,
    appendMarkdownToBlock,
    replaceSection,
    applyPatchToDocument,
    listDocuments,
    getDocumentHeadings,
    getDocumentBlocks,
    searchByTag,
    getBacklinks,
    searchTasks,
    getDailyNotes,
    searchByAttribute,
    getBookmarks,
    getRandomHeading,
    getRecentBlocks,
    getUnreferencedDocuments,
    checkConnection,
    getSystemVersion,
    createDocWithMd,
    renameDoc,
    getPathByID
});

/**
 * 主函数 - 命令行入口
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    // 除了check/version命令，其他命令都需要检查环境配置
    if (args.length > 0 && command !== 'check' && command !== 'version' && !checkEnvironmentConfig()) {
        return;
    }

    if (args.length === 0) {
        printCliUsage();
        return;
    }

    try {
        const handler = CLI_HANDLERS[command];
        if (!handler) {
            console.error(`未知命令: ${command}`);
            return;
        }

        await handler(args);
    } catch (error) {
        console.error('执行失败:', error.message);
    }
}

// 导出函数供其他模块使用
module.exports = {
    requestSiyuanApi,
    executeSiyuanQuery,
    getSystemVersion,
    listNotebooks,
    createDocWithMd,
    renameDoc,
    exportMdContent,
    getBlockKramdown,
    getChildBlocks,
    getBlockAttrs,
    updateBlock,
    getHPathByID,
    getPathByID,
    getIDsByHPath,
    listDocsByPath,
    getDocumentChildren,
    getDocumentTree,
    getDocumentTreeByID,
    analyzeDocumentTree,
    renderDocumentTreeMarkdown,
    moveDocsByID,
    planMoveDocsByID,
    reorganizeSubdocsByID,
    analyzeSubdocMovePlan,
    appendBlock,
    insertBlock,
    moveBlock,
    deleteBlock,
    appendMarkdownToBlock,
    planReplaceSection,
    replaceSection,
    searchNotes,
    searchNotesMarkdown,
    listDocuments,
    getDocumentHeadings,
    getDocumentBlocks,
    searchByTag,
    getBacklinks,
    searchTasks,
    getDailyNotes,
    searchByAttribute,
    getBookmarks,
    getRandomHeading,
    getRecentBlocks,
    getUnreferencedDocuments,
    openDocument,
    openDocumentReadableView,
    openDocumentPatchableView,
    renderPatchableMarkdown,
    parsePatchableMarkdown,
    buildApplyPatchPlan,
    executeApplyPatchPlan,
    applyPatchToDocument,
    parseBlocksFromKramdown,
    renderSearchResultsMarkdown,
    normalizeMarkdown,
    stripKramdownIAL,
    checkConnection,
    formatSiyuanTime,
    formatResults,
    formatStructuredResults,
    generateEmbedBlock
};

// 如果直接运行此文件，执行主函数
if (require.main === module) {
    main();
}

/**
 * 规范化Markdown内容
 * @param {string} markdown - 原始Markdown
 * @returns {string} 规范化后的Markdown
 */
function normalizeMarkdown(markdown) {
    const raw = String(markdown || '');
    const normalizedNewlines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalizedNewlines.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 更新 fenced code 状态
 * @param {Object} state - 当前状态
 * @param {string} line - 当前行
 */
function updateFenceState(state, line) {
    const text = String(line || '').trimStart();
    const match = text.match(/^(`{3,}|~{3,})/);
    if (!match) {
        return;
    }

    const marker = match[1];
    const char = marker[0];
    const size = marker.length;

    if (!state.active) {
        state.active = true;
        state.char = char;
        state.size = size;
        return;
    }

    if (state.char === char && size >= state.size) {
        state.active = false;
        state.char = '';
        state.size = 0;
    }
}

/**
 * 清理kramdown中的IAL标记，尽量还原为常规Markdown
 * @param {string} markdown - kramdown片段
 * @returns {string} 清理后的markdown
 */
function stripKramdownIAL(markdown) {
    const lines = String(markdown || '').split('\n');
    const output = [];
    const fenceState = { active: false, char: '', size: 0 };

    for (const line of lines) {
        const inFence = fenceState.active;
        const trimmed = line.trim();
        if (!inFence && /^\{:[^}]*\}$/.test(trimmed)) {
            updateFenceState(fenceState, line);
            continue;
        }

        const cleaned = inFence
            ? line
            : line
                .replace(/\s+\{:[^}]*\}\s*$/g, '')
                .replace(/\s+$/g, '');

        output.push(cleaned);
        updateFenceState(fenceState, line);
    }

    return normalizeMarkdown(output.join('\n'));
}

/**
 * 安全获取文档基础元信息
 * @param {string} docId - 文档ID
 * @returns {Promise<Object>} 文档信息
 */
async function getDocumentMeta(docId) {
    const safeDocId = escapeSqlValue(docId);
    const rows = await executeSiyuanQuery(`
        SELECT id, content, hpath, created, updated
        FROM blocks
        WHERE id = '${safeDocId}'
        LIMIT 1
    `);

    if (!rows || rows.length === 0) {
        return {
            id: docId,
            title: '',
            hpath: '',
            created: '',
            updated: ''
        };
    }

    const row = rows[0];
    return {
        id: row.id || docId,
        title: row.content || '',
        hpath: row.hpath || '',
        created: row.created || '',
        updated: row.updated || ''
    };
}

/**
 * 从exportMdContent结果中提取Markdown文本
 * @param {Object|string} exportResult - 导出结果
 * @returns {string} markdown文本
 */
function extractMarkdownFromExport(exportResult) {
    if (typeof exportResult === 'string') {
        return exportResult;
    }

    if (!exportResult || typeof exportResult !== 'object') {
        return '';
    }

    if (typeof exportResult.content === 'string') {
        return exportResult.content;
    }

    if (typeof exportResult.markdown === 'string') {
        return exportResult.markdown;
    }

    if (typeof exportResult.md === 'string') {
        return exportResult.md;
    }

    return '';
}

/**
 * 渲染Markdown搜索结果页
 * @param {Object} params - 渲染参数
 * @param {string} params.query - 查询词
 * @param {Array} params.results - 搜索结果
 * @param {number} params.limit - 限制数量
 * @returns {string} Markdown结果页
 */
function renderSearchResultsMarkdown({ query, results, limit }) {
    const safeResults = Array.isArray(results) ? results : [];
    const lines = [];
    lines.push(`---`);
    lines.push(`siyuan_view: search_results`);
    lines.push(`query: ${JSON.stringify(query || '')}`);
    lines.push(`total: ${safeResults.length}`);
    lines.push(`limit: ${limit}`);
    lines.push(`generated_at: ${new Date().toISOString()}`);
    lines.push(`---`);
    lines.push('');
    lines.push(`# 搜索结果: ${query}`);
    lines.push('');

    if (safeResults.length === 0) {
        lines.push('未找到匹配内容。');
        return lines.join('\n');
    }

    safeResults.forEach((item, index) => {
        const itemType = item.subtype || item.type || 'unknown';
        const itemTitle = truncateText(item.content || '(无内容)', 90);
        lines.push(`## ${index + 1}. ${itemTitle}`);
        lines.push(`- id: \`${item.id || ''}\``);
        lines.push(`- type: \`${itemType}\``);
        if (item.hpath) {
            lines.push(`- hpath: \`${item.hpath}\``);
        }
        if (item.updated || item.created) {
            lines.push(`- updated: ${formatSiyuanTime(item.updated || item.created)}`);
        }
        lines.push(`- snippet: ${truncateText(item.content || '', 180)}`);
        lines.push('');
    });

    return lines.join('\n').trim();
}

/**
 * 读取文档Readable视图
 * @param {string} docId - 文档ID
 * @returns {Promise<string>} Markdown视图
 */
async function openDocumentReadableView(docId) {
    const [meta, exported] = await Promise.all([
        getDocumentMeta(docId),
        exportMdContent(docId)
    ]);
    await markDocumentRead(docId, 'openDocumentReadableView', meta?.updated || '');

    let hpath = meta.hpath;
    if (!hpath) {
        hpath = await getHPathByID(docId);
    }

    const body = normalizeMarkdown(extractMarkdownFromExport(exported));
    const lines = [];
    lines.push('---');
    lines.push('siyuan:');
    lines.push(`  doc_id: ${docId}`);
    lines.push(`  hpath: ${JSON.stringify(hpath || '')}`);
    lines.push('  view: readable');
    lines.push('  source: exportMdContent');
    lines.push(`  exported_at: ${new Date().toISOString()}`);
    lines.push('---');
    lines.push('');
    lines.push(body || '_文档内容为空_');

    return lines.join('\n');
}

/**
 * 推断块类型
 * @param {string} markdown - 块Markdown
 * @returns {{type: string, subType: string}} 推断结果
 */
function inferBlockType(markdown) {
    const nonEmptyLines = String(markdown || '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const firstLine = nonEmptyLines[0] || '';
    const secondLine = nonEmptyLines[1] || '';

    if (/^```/.test(firstLine)) {
        return { type: 'c', subType: '' };
    }

    if (/^\$\$/.test(firstLine)) {
        return { type: 'm', subType: '' };
    }

    if (/^\|.*\|$/.test(firstLine) && /^\|\s*[:\-]+\s*(\|\s*[:\-]+\s*)+\|?$/.test(secondLine)) {
        return { type: 't', subType: '' };
    }

    const headingMatch = firstLine.match(/^(#{1,6})\s+/);
    if (headingMatch) {
        const level = headingMatch[1].length;
        return { type: 'h', subType: `h${level}` };
    }

    if (/^\s*[-*+]\s+\[[ xX-]\]\s+/.test(firstLine)) {
        return { type: 'l', subType: 't' };
    }

    if (/^\s*[-*+]\s+/.test(firstLine)) {
        return { type: 'l', subType: 'u' };
    }

    if (/^\s*\d+[.)]\s+/.test(firstLine)) {
        return { type: 'l', subType: 'o' };
    }

    if (/^\s*>\s+/.test(firstLine)) {
        return { type: 'b', subType: '' };
    }

    return { type: 'p', subType: '' };
}

/**
 * 从kramdown解析块序列
 * @param {string} kramdown - kramdown文本
 * @param {Object} parentIdMap - 块ID到父块ID映射
 * @returns {Array} 块列表
 */
function parseBlocksFromKramdown(kramdown, parentIdMap = {}) {
    const text = String(kramdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!text.trim()) {
        return [];
    }

    const lines = text.split('\n');
    const blocks = [];
    let buffer = [];

    for (const line of lines) {
        const match = line.match(/^\{:[^}]*\bid="([^"]+)"[^}]*\}\s*$/);
        if (!match) {
            buffer.push(line);
            continue;
        }

        const markdown = buffer.join('\n').trimEnd();
        const cleanedMarkdown = stripKramdownIAL(markdown);
        const id = match[1];
        const inferred = inferBlockType(cleanedMarkdown);
        blocks.push({
            id,
            markdown: cleanedMarkdown,
            type: inferred.type,
            subType: inferred.subType,
            parentId: parentIdMap[id] || ''
        });
        buffer = [];
    }

    if (buffer.join('\n').trim()) {
        const markdown = buffer.join('\n').trimEnd();
        const cleanedMarkdown = stripKramdownIAL(markdown);
        const inferred = inferBlockType(cleanedMarkdown);
        blocks.push({
            id: `tail-${blocks.length + 1}`,
            markdown: cleanedMarkdown,
            type: inferred.type,
            subType: inferred.subType,
            parentId: ''
        });
    }

    return blocks.filter((block) => block.markdown.trim().length > 0);
}

/**
 * 渲染Patchable Markdown Format (PMF v1)
 * @param {Object} params - 渲染参数
 * @param {string} params.docId - 文档ID
 * @param {Object} params.meta - 文档元信息
 * @param {Array} params.blocks - 块列表
 * @returns {string} patchable markdown
 */
function renderPatchableMarkdown({ docId, meta, blocks }) {
    const lines = [];
    const updatedPart = meta.updated ? ` updated=${meta.updated}` : '';
    lines.push(`<!-- @siyuan:doc id=${docId} hpath=${JSON.stringify(meta.hpath || '')} view=patchable pmf=v1${updatedPart} -->`);
    lines.push('');

    blocks.forEach((block) => {
        const subTypePart = block.subType ? ` subType=${block.subType}` : '';
        const parentPart = block.parentId ? ` parent=${block.parentId}` : '';
        lines.push(`<!-- @siyuan:block id=${block.id} type=${block.type}${subTypePart}${parentPart} -->`);
        lines.push(block.markdown);
        lines.push('');
    });

    return lines.join('\n').trim();
}

/**
 * 读取文档Patchable视图
 * @param {string} docId - 文档ID
 * @returns {Promise<string>} patchable markdown
 */
async function openDocumentPatchableView(docId) {
    const [meta, kramdown, docBlocks] = await Promise.all([
        getDocumentMeta(docId),
        getBlockKramdown(docId),
        getDocumentBlocks(docId)
    ]);
    await markDocumentRead(docId, 'openDocumentPatchableView', meta?.updated || '');

    if (!meta.hpath) {
        meta.hpath = await getHPathByID(docId);
    }

    const parentIdMap = {};
    for (const block of docBlocks) {
        if (block && block.id) {
            parentIdMap[block.id] = block.parent_id || '';
        }
    }

    const blocks = parseBlocksFromKramdown(kramdown, parentIdMap);
    return renderPatchableMarkdown({ docId, meta, blocks });
}

/**
 * 按视图类型读取文档
 * @param {string} docId - 文档ID
 * @param {string} view - readable/patchable
 * @returns {Promise<string>} Markdown视图
 */
async function openDocument(docId, view = 'readable') {
    if (view === 'patchable') {
        return await openDocumentPatchableView(docId);
    }

    return await openDocumentReadableView(docId);
}

/**
 * 搜索并返回Markdown结果页
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 最大结果数
 * @param {string|null} blockType - 块类型过滤
 * @returns {Promise<string>} Markdown结果页
 */
async function searchNotesMarkdown(keyword, limit = 20, blockType = null) {
    const safeLimit = normalizeInt(limit, 20, 1, 200);
    const results = await searchNotes(keyword, safeLimit, blockType);
    return renderSearchResultsMarkdown({
        query: keyword,
        results,
        limit: safeLimit
    });
}

/**
 * 规范化块内容（用于比较）
 * @param {string} markdown - 原始内容
 * @returns {string} 规范化内容
 */
function normalizeBlockMarkdown(markdown) {
    return String(markdown || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/^\n+/, '')
        .replace(/\n+$/, '');
}

/**
 * 解析PMF注释属性
 * @param {string} raw - 属性文本
 * @returns {Object} 属性对象
 */
function parsePmfAttributes(raw) {
    const attrs = {};
    const text = String(raw || '');
    const regex = /([a-zA-Z_][\w-]*)=("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s]+)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const key = match[1];
        let value = match[2];

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            const quote = value[0];
            value = value.slice(1, -1);
            if (quote === '"') {
                try {
                    value = JSON.parse(`"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
                } catch (error) {
                    // fallback: keep raw unescaped content
                }
            }
        }

        attrs[key] = value;
    }

    return attrs;
}

/**
 * 解析Patchable Markdown Format
 * @param {string} patchableMarkdown - PMF文本
 * @returns {{doc: Object, blocks: Array}} 解析结果
 */
function parsePatchableMarkdown(patchableMarkdown) {
    const text = String(patchableMarkdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n');

    const result = {
        doc: {},
        blocks: []
    };

    let currentBlock = null;
    let buffer = [];
    let fenceState = { active: false, char: '', size: 0 };

    const flushBlock = () => {
        if (!currentBlock) {
            return;
        }

        const markdown = normalizeBlockMarkdown(buffer.join('\n'));
        result.blocks.push({
            id: currentBlock.id,
            type: currentBlock.type || inferBlockType(markdown).type,
            subType: currentBlock.subType || '',
            parentId: currentBlock.parentId || '',
            markdown
        });

        currentBlock = null;
        buffer = [];
        fenceState = { active: false, char: '', size: 0 };
    };

    for (const line of lines) {
        if (!currentBlock) {
            const docMatch = line.match(/^<!--\s*@siyuan:doc\s+(.+?)\s*-->$/);
            if (docMatch && result.blocks.length === 0) {
                result.doc = parsePmfAttributes(docMatch[1]);
                continue;
            }

            const blockMatch = line.match(/^<!--\s*@siyuan:block\s+(.+?)\s*-->$/);
            if (blockMatch) {
                const attrs = parsePmfAttributes(blockMatch[1]);
                if (!attrs.id) {
                    throw new Error('PMF 格式错误: block marker 缺少 id');
                }

                currentBlock = {
                    id: String(attrs.id),
                    type: attrs.type ? String(attrs.type) : '',
                    subType: attrs.subType ? String(attrs.subType) : '',
                    parentId: attrs.parent ? String(attrs.parent) : (attrs.parentID ? String(attrs.parentID) : '')
                };
                continue;
            }

            continue;
        }

        if (!fenceState.active) {
            const blockMatch = line.match(/^<!--\s*@siyuan:block\s+(.+?)\s*-->$/);
            if (blockMatch) {
                flushBlock();
                const attrs = parsePmfAttributes(blockMatch[1]);
                if (!attrs.id) {
                    throw new Error('PMF 格式错误: block marker 缺少 id');
                }

                currentBlock = {
                    id: String(attrs.id),
                    type: attrs.type ? String(attrs.type) : '',
                    subType: attrs.subType ? String(attrs.subType) : '',
                    parentId: attrs.parent ? String(attrs.parent) : (attrs.parentID ? String(attrs.parentID) : '')
                };
                continue;
            }
        }

        buffer.push(line);
        updateFenceState(fenceState, line);
    }

    flushBlock();

    if (!result.doc.id && result.blocks.length === 0) {
        throw new Error('PMF 解析失败: 未找到 @siyuan:doc 或 @siyuan:block 标记');
    }

    return result;
}

/**
 * 比较两个字符串数组是否一致
 * @param {Array<string>} a - 数组A
 * @param {Array<string>} b - 数组B
 * @returns {boolean} 是否一致
 */
function isSameStringArray(a, b) {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
}

/**
 * 生成 PMF apply-patch 计划
 * 当前策略：
 * - 支持 update / delete / insert(含中间插入)
 * - 支持已有块重排（通过 moveBlock）
 * @param {string} docId - 文档ID
 * @param {string} patchableMarkdown - PMF文本
 * @returns {Promise<Object>} 执行计划
 */
async function buildApplyPatchPlan(docId, patchableMarkdown) {
    assertNonEmptyString(docId, 'docId');
    if (!isLikelyBlockId(docId)) {
        throw new Error('docId 格式不正确');
    }

    const parsedTarget = parsePatchableMarkdown(patchableMarkdown);
    if (parsedTarget.doc.id && parsedTarget.doc.id !== docId) {
        throw new Error(`PMF 文档ID不匹配: expected=${docId}, actual=${parsedTarget.doc.id}`);
    }

    // PMF 快速版本检查：若 PMF 中包含 updated 字段，与当前文档对比
    const pmfUpdated = parsedTarget.doc.updated || '';
    if (pmfUpdated) {
        const currentMeta = await getDocumentMeta(docId);
        const currentUpdated = currentMeta?.updated || '';
        if (currentUpdated && pmfUpdated !== currentUpdated) {
            throw new Error(
                `PMF 版本冲突: 文档 ${docId} 自 PMF 导出后已被修改` +
                `（PMF 版本: ${pmfUpdated}, 当前版本: ${currentUpdated}）。` +
                `请重新运行 open-doc ${docId} patchable 导出最新 PMF。`
            );
        }
    }

    const currentPmf = await openDocumentPatchableView(docId);
    const parsedCurrent = parsePatchableMarkdown(currentPmf);

    const currentBlocks = parsedCurrent.blocks;
    const targetBlocks = parsedTarget.blocks;

    const seenIds = new Set();
    for (const block of targetBlocks) {
        if (seenIds.has(block.id)) {
            throw new Error(`PMF 中存在重复 block id: ${block.id}`);
        }
        seenIds.add(block.id);
    }

    const currentMap = new Map(currentBlocks.map((block) => [block.id, block]));
    const targetMap = new Map(targetBlocks.map((block) => [block.id, block]));
    const targetIndexMap = new Map(targetBlocks.map((block, index) => [block.id, index]));
    const currentIds = currentBlocks.map((block) => block.id);
    const targetIds = targetBlocks.map((block) => block.id);
    const targetIdSet = new Set(targetIds);

    const normalizeParentId = (value) => {
        if (value && isLikelyBlockId(value)) {
            return value;
        }
        return docId;
    };

    const getTargetParentId = (id) => {
        const targetBlock = targetMap.get(id);
        const currentBlock = currentMap.get(id);
        return normalizeParentId((targetBlock && targetBlock.parentId) || (currentBlock && currentBlock.parentId) || docId);
    };

    const getPreviousSiblingRef = (id, parentId) => {
        const targetIndex = targetIndexMap.get(id);
        if (typeof targetIndex !== 'number') {
            return '';
        }

        for (let i = targetIndex - 1; i >= 0; i -= 1) {
            const candidateId = targetBlocks[i]?.id;
            if (!candidateId || !currentMap.has(candidateId)) {
                continue;
            }

            const candidateBlock = currentMap.get(candidateId);
            if (!candidateBlock || candidateBlock.type === 'd' || candidateId === docId) {
                continue;
            }

            const candidateParent = getTargetParentId(candidateId);
            if (candidateParent === parentId) {
                return candidateId;
            }
        }

        return '';
    };

    const targetKnownIds = targetBlocks
        .filter((block) => currentMap.has(block.id))
        .map((block) => block.id);

    const currentKnownIds = currentIds.filter((id) => targetIdSet.has(id));

    const deleteIds = currentIds.filter((id) => !targetIdSet.has(id));

    const movesById = new Map();
    if (!isSameStringArray(targetKnownIds, currentKnownIds)) {
        const simulated = [...currentKnownIds];
        for (let idx = 0; idx < targetKnownIds.length; idx += 1) {
            const id = targetKnownIds[idx];
            if (simulated[idx] === id) {
                continue;
            }

            const currentIndex = simulated.indexOf(id);
            if (currentIndex < 0) {
                continue;
            }

            simulated.splice(currentIndex, 1);
            simulated.splice(idx, 0, id);

            const parentHint = getTargetParentId(id);
            let previousRef = getPreviousSiblingRef(id, parentHint);
            if (!previousRef && parentHint !== docId) {
                previousRef = parentHint;
            }
            movesById.set(id, {
                id,
                previousRef,
                parentHint
            });
        }
    }

    for (const block of targetBlocks) {
        if (!currentMap.has(block.id)) {
            continue;
        }

        const currentParent = normalizeParentId(currentMap.get(block.id).parentId);
        const targetParent = getTargetParentId(block.id);
        if (currentParent === targetParent) {
            continue;
        }

        let previousRef = getPreviousSiblingRef(block.id, targetParent);
        if (!previousRef && targetParent !== docId) {
            previousRef = targetParent;
        }

        movesById.set(block.id, {
            id: block.id,
            previousRef,
            parentHint: targetParent
        });
    }

    const moves = Array.from(movesById.values());

    const knownParentMap = new Map();
    for (const [id, block] of currentMap.entries()) {
        if (block.parentId && isLikelyBlockId(block.parentId)) {
            knownParentMap.set(id, block.parentId);
        }
    }
    for (const block of targetBlocks) {
        if (block.parentId && isLikelyBlockId(block.parentId)) {
            knownParentMap.set(block.id, block.parentId);
        }
    }

    const updates = [];
    const inserts = [];

    for (let index = 0; index < targetBlocks.length; index += 1) {
        const block = targetBlocks[index];
        const nextMarkdown = normalizeBlockMarkdown(block.markdown);
        if (currentMap.has(block.id)) {
            const currentMarkdown = normalizeBlockMarkdown(currentMap.get(block.id).markdown);
            if (currentMarkdown !== nextMarkdown) {
                updates.push({
                    id: block.id,
                    type: block.type,
                    subType: block.subType,
                    beforeChars: currentMarkdown.length,
                    afterChars: nextMarkdown.length,
                    markdown: nextMarkdown
                });
            }
            continue;
        }

        if (!nextMarkdown.trim()) {
            continue;
        }

        let previousRef = '';
        for (let i = index - 1; i >= 0; i -= 1) {
            const prevId = targetBlocks[i]?.id;
            if (prevId) {
                previousRef = prevId;
                break;
            }
        }

        let nextRef = '';
        for (let i = index + 1; i < targetBlocks.length; i += 1) {
            const nextId = targetBlocks[i]?.id;
            if (nextId) {
                nextRef = nextId;
                break;
            }
        }

        const parentHint =
            (block.parentId && isLikelyBlockId(block.parentId) ? block.parentId : '') ||
            (previousRef && knownParentMap.get(previousRef) ? knownParentMap.get(previousRef) : '') ||
            (nextRef && knownParentMap.get(nextRef) ? knownParentMap.get(nextRef) : '') ||
            docId;

        inserts.push({
            tempId: block.id,
            type: block.type,
            subType: block.subType,
            markdown: nextMarkdown,
            chars: nextMarkdown.length,
            previousRef,
            nextRef,
            parentHint
        });

        if (isLikelyBlockId(parentHint)) {
            knownParentMap.set(block.id, parentHint);
        }
    }

    return {
        action: 'apply_patch',
        docId,
        constraints: {
            allowReorder: true,
            allowMiddleInsert: true,
            allowTailInsert: true
        },
        summary: {
            currentBlockCount: currentBlocks.length,
            targetBlockCount: targetBlocks.length,
            updateCount: updates.length,
            deleteCount: deleteIds.length,
            insertCount: inserts.length,
            moveCount: moves.length
        },
        operations: {
            moves,
            updates,
            deleteIds,
            inserts
        }
    };
}

/**
 * 从 insert/append API 返回中提取新块ID
 * @param {Object|Array} apiResult - API返回
 * @returns {string} 新块ID
 */
function extractInsertedBlockId(apiResult) {
    const queue = [apiResult];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }

        if (typeof current === 'object') {
            if (typeof current.id === 'string' && isLikelyBlockId(current.id)) {
                return current.id;
            }
            if (typeof current.blockID === 'string' && isLikelyBlockId(current.blockID)) {
                return current.blockID;
            }
            if (typeof current.blockId === 'string' && isLikelyBlockId(current.blockId)) {
                return current.blockId;
            }

            for (const value of Object.values(current)) {
                if (Array.isArray(value)) {
                    queue.push(...value);
                } else if (value && typeof value === 'object') {
                    queue.push(value);
                }
            }
        }
    }

    return '';
}

/**
 * 解析锚点引用ID（支持临时ID映射）
 * @param {string} refId - 引用ID
 * @param {Map<string, string>} tempIdMap - 临时ID映射
 * @returns {string} 可用ID
 */
function resolveRefId(refId, tempIdMap) {
    if (!refId) {
        return '';
    }

    if (tempIdMap.has(refId)) {
        return tempIdMap.get(refId);
    }

    return refId;
}

/**
 * 执行 apply-patch 计划
 * @param {Object} plan - 计划
 * @returns {Promise<Object>} 执行结果
 */
async function executeApplyPatchPlan(plan) {
    ensureWriteEnabled();
    await ensureDocumentReadBeforeWrite(plan.docId, 'applyPatchToDocument');

    const preknownIds = new Set();
    for (const id of plan.operations.deleteIds || []) {
        preknownIds.add(id);
    }
    for (const item of plan.operations.moves || []) {
        if (item?.id) {
            preknownIds.add(item.id);
        }
        if (item?.previousRef && item.previousRef !== plan.docId) {
            preknownIds.add(item.previousRef);
        }
        if (item?.parentHint && item.parentHint !== plan.docId) {
            preknownIds.add(item.parentHint);
        }
    }
    for (const item of plan.operations.updates || []) {
        if (item?.id) {
            preknownIds.add(item.id);
        }
    }
    for (const item of plan.operations.inserts || []) {
        if (item?.previousRef && item.previousRef !== plan.docId) {
            preknownIds.add(item.previousRef);
        }
        if (item?.nextRef && item.nextRef !== plan.docId) {
            preknownIds.add(item.nextRef);
        }
        if (item?.parentHint && item.parentHint !== plan.docId) {
            preknownIds.add(item.parentHint);
        }
    }

    for (const id of preknownIds) {
        if (isLikelyBlockId(id)) {
            cacheBlockRoot(id, plan.docId);
        }
    }
    cacheBlockRoot(plan.docId, plan.docId);

    const deleted = [];
    for (const id of [...plan.operations.deleteIds].reverse()) {
        const result = await deleteBlock(id);
        deleted.push({ id, result });
    }

    const moved = [];
    for (const item of plan.operations.moves) {
        let previousID = item.previousRef || '';
        if (previousID === plan.docId) {
            previousID = '';
        }
        const parentID = previousID ? '' : (item.parentHint || plan.docId);

        const result = await moveBlock(item.id, {
            previousID,
            parentID
        });

        moved.push({
            id: item.id,
            previousID,
            parentID,
            result
        });
    }

    const updated = [];
    for (const item of plan.operations.updates) {
        const result = await updateBlock(item.id, item.markdown);
        updated.push({ id: item.id, result });
    }

    const inserted = [];
    const tempIdMap = new Map();
    for (const item of plan.operations.inserts) {
        const previousID = resolveRefId(item.previousRef, tempIdMap);
        const nextID = resolveRefId(item.nextRef, tempIdMap);
        const parentID = resolveRefId(item.parentHint, tempIdMap) || plan.docId;

        const anchors = {};
        if (isLikelyBlockId(previousID)) {
            anchors.previousID = previousID;
        } else if (isLikelyBlockId(nextID)) {
            anchors.nextID = nextID;
        } else if (isLikelyBlockId(parentID)) {
            anchors.parentID = parentID;
        } else {
            anchors.parentID = plan.docId;
        }

        const result = await insertBlock(item.markdown, anchors);
        const newId = extractInsertedBlockId(result);
        if (newId) {
            tempIdMap.set(item.tempId, newId);
        }

        inserted.push({
            tempId: item.tempId,
            newId,
            anchors,
            result
        });
    }

    await refreshDocumentVersion(plan.docId);

    return {
        deletedCount: deleted.length,
        movedCount: moved.length,
        updatedCount: updated.length,
        insertedCount: inserted.length,
        deleted,
        moved,
        updated,
        inserted
    };
}

/**
 * 根据 PMF 对文档应用补丁
 * @param {string} docId - 文档ID
 * @param {string} patchableMarkdown - PMF文本
 * @returns {Promise<Object>} 结果
 */
async function applyPatchToDocument(docId, patchableMarkdown) {
    const plan = await buildApplyPatchPlan(docId, patchableMarkdown);
    const execution = await executeApplyPatchPlan(plan);
    return {
        plan,
        execution
    };
}
