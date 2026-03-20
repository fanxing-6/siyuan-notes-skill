/**
 * 思源笔记查询工具
 * 提供SQL查询、文档搜索、笔记本管理等功能
 * 基于思源笔记SQL查询系统规范
 */

const fs = require('fs');
const path = require('path');
const { createCliHandlers, printCliUsage } = require('./cli');
const { buildRuntimeConfig, normalizeInt } = require('./lib/config');
const { createQueryServices } = require('./lib/query-services');
const { checkSkillVersion: checkSkillVersionImpl } = require('./lib/version-utils');
const {
    normalizeMarkdown,
    stripKramdownIAL,
    parseBlocksFromKramdown,
    renderPatchableMarkdown,
    normalizeBlockMarkdown,
    parsePatchableMarkdown,
    isSameStringArray
} = require('./lib/pmf-utils');
const {
    strftime,
    truncateText,
    formatSiyuanTime,
    formatResults,
    formatStructuredResults,
    generateEmbedBlock
} = require('./format-utils');

// 系统边界检查：确保 Node 18+ 的内置 fetch 可用
if (typeof globalThis.fetch === 'undefined') {
    throw new Error('此 skill 需要 Node.js 18+ 的内置 fetch。当前 Node 版本: ' + process.version);
}

const {
    DEBUG_MODE,
    SIYUAN_HOST,
    SIYUAN_PORT,
    SIYUAN_USE_HTTPS,
    SIYUAN_BASE_PATH,
    SIYUAN_API_TOKEN,
    SIYUAN_BASIC_AUTH_USER,
    SIYUAN_BASIC_AUTH_PASS,
    SIYUAN_ALLOW_TOKEN_IN_QUERY,
    SIYUAN_ENABLE_WRITE,
    SIYUAN_REQUIRE_READ_BEFORE_WRITE,
    SIYUAN_READ_GUARD_TTL_SECONDS,
    SIYUAN_READ_GUARD_WRITE_GRACE_MS,
    SIYUAN_LIST_DOCUMENTS_LIMIT,
    SIYUAN_BLOCK_ROOT_CACHE_MAX,
    SIYUAN_WORKNOTEBOOKS,
    SIYUAN_CONFIRMED_WORKNOTEBOOKS,
    READ_GUARD_CACHE_FILE,
    OPEN_DOC_CHAR_LIMIT,
    OPEN_DOC_BLOCK_PAGE_SIZE,
    API_BASE_URL
} = buildRuntimeConfig(__dirname, process.env, process.argv);

/** API端点配置 */
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
    RENAME_DOC: '/api/filetree/renameDoc',
    ASSET_UPLOAD: '/api/asset/upload',
    AV_RENDER: '/api/av/renderAttributeView',
    AV_GET: '/api/av/getAttributeView',
    AV_KEYS: '/api/av/getAttributeViewKeys',
    AV_KEYS_BY_AV_ID: '/api/av/getAttributeViewKeysByAvID',
    AV_KEYS_BY_ID: '/api/av/getAttributeViewKeysByID',
    AV_PRIMARY_KEYS: '/api/av/getAttributeViewPrimaryKeyValues',
    AV_SET_CELL: '/api/av/setAttributeViewBlockAttr',
    AV_BATCH_SET_CELLS: '/api/av/batchSetAttributeViewBlockAttrs',
    AV_ADD_KEY: '/api/av/addAttributeViewKey',
    AV_REMOVE_KEY: '/api/av/removeAttributeViewKey',
    AV_SORT_KEY: '/api/av/sortAttributeViewKey',
    AV_SORT_VIEW_KEY: '/api/av/sortAttributeViewViewKey',
    AV_ADD_ROWS: '/api/av/addAttributeViewBlocks',
    AV_REMOVE_ROWS: '/api/av/removeAttributeViewBlocks',
    AV_CHANGE_LAYOUT: '/api/av/changeAttrViewLayout',
    AV_SET_VIEW: '/api/av/setDatabaseBlockView',
    AV_DUPLICATE: '/api/av/duplicateAttributeViewBlock',
    AV_APPEND_DETACHED_ROWS: '/api/av/appendAttributeViewDetachedBlocksWithValues',
    AV_GET_DEFAULT_VALUES: '/api/av/getAttributeViewAddingBlockDefaultValues',
    AV_FILTER_SORT: '/api/av/getAttributeViewFilterSort',
    AV_SEARCH: '/api/av/searchAttributeView',
    AV_SEARCH_RELATION_KEY: '/api/av/searchAttributeViewRelationKey',
    AV_SEARCH_ROLLUP_DEST_KEYS: '/api/av/searchAttributeViewRollupDestKeys',
    AV_ITEM_IDS_BY_BOUND_IDS: '/api/av/getAttributeViewItemIDsByBoundIDs',
    AV_BOUND_BLOCK_IDS_BY_ITEM_IDS: '/api/av/getAttributeViewBoundBlockIDsByItemIDs',
    AV_MIRROR_BLOCKS: '/api/av/getMirrorDatabaseBlocks',
    AV_RENDER_IMAGES: '/api/av/getCurrentAttrViewImages',
    AV_SET_GROUP: '/api/av/setAttrViewGroup',
    AV_BATCH_REPLACE_BLOCKS: '/api/av/batchReplaceAttributeViewBlocks'
    ,
    TRANSACTIONS: '/api/transactions'
};

if (DEBUG_MODE) {
    console.log(`📡 服务器地址: ${API_BASE_URL}`);
    if (SIYUAN_BASE_PATH) {
        console.log(`🛣️  API Base Path: ${SIYUAN_BASE_PATH}`);
    }
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

function isWorkdirGateEnabled() {
    return Array.isArray(SIYUAN_WORKNOTEBOOKS) && SIYUAN_WORKNOTEBOOKS.length > 0;
}

function getEffectiveWorkNotebookNames() {
    if (!isWorkdirGateEnabled()) {
        return [];
    }
    const confirmed = Array.isArray(SIYUAN_CONFIRMED_WORKNOTEBOOKS) ? SIYUAN_CONFIRMED_WORKNOTEBOOKS : [];
    return [...new Set([...SIYUAN_WORKNOTEBOOKS, ...confirmed].map((item) => String(item || '').trim()).filter(Boolean))];
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
        updatedAt: resolvedUpdated,
        lastWriteAt: 0
    };
    saveReadGuardCache();
}

/**
 * 确认文档已读后才允许写入（含乐观锁版本检查）
 * @param {string} docId - 文档ID
 * @param {string} operation - 操作名
 */
async function ensureDocumentReadBeforeWrite(docId, operation = 'write') {
    await ensureDocumentAccessAllowed(docId, operation, 'write');
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
                const lastWriteAt = Number(meta.lastWriteAt || 0);
                const inRecentWriteWindow = lastWriteAt > 0 && (Date.now() - lastWriteAt) <= SIYUAN_READ_GUARD_WRITE_GRACE_MS;
                if (inRecentWriteWindow) {
                    meta.updatedAt = retryUpdated;
                    meta.ts = Date.now();
                    saveReadGuardCache();
                    return;
                }
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
        const rows = await executeSiyuanQueryRaw(`
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
    await ensureBlockAccessAllowed(blockId, operation, 'write');
    if (!SIYUAN_REQUIRE_READ_BEFORE_WRITE) {
        return;
    }

    assertNonEmptyString(blockId, 'blockId');
    if (!isLikelyBlockId(blockId)) {
        throw new Error(`blockId 格式不正确: ${blockId}`);
    }

    const rootDocId = await getRootDocIdByBlockId(blockId);
    await ensureDocumentReadBeforeWrite(rootDocId, operation);
    return rootDocId;
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

    loadReadGuardCache();
    pruneExpiredReadMarks();

    const meta = readGuardCache.docs[docId];
    if (!meta) {
        return;
    }

    const writeStamp = Date.now();
    meta.lastWriteAt = writeStamp;
    meta.ts = writeStamp;
    saveReadGuardCache();

    try {
        const baselineUpdated = meta.updatedAt || '';
        let candidateUpdated = baselineUpdated;
        let stableCount = 0;

        // 短轮询等待 updated 稳定，避免连续写入时过长阻塞
        for (let i = 0; i < 8; i++) {
            const currentMeta = await getDocumentMeta(docId);
            const currentUpdated = currentMeta?.updated || '';
            if (currentUpdated) {
                if (currentUpdated === candidateUpdated) {
                    stableCount += 1;
                    if (stableCount >= 2) {
                        break;
                    }
                } else {
                    candidateUpdated = currentUpdated;
                    stableCount = 1;
                }
            }

            if (i < 7) {
                await new Promise(r => setTimeout(r, 80));
            }
        }

        meta.updatedAt = candidateUpdated || baselineUpdated;
        meta.lastWriteAt = writeStamp;
        meta.ts = Date.now();
        saveReadGuardCache();
    } catch (error) {
        meta.lastWriteAt = writeStamp;
        meta.ts = Date.now();
        saveReadGuardCache();
        if (DEBUG_MODE) {
            console.log(`⚠️  refreshDocumentVersion(${docId}) 失败: ${error.message}`);
        }
    }
}

/**
 * 检查环境配置是否完整
 * @returns {boolean} 配置是否完整
 */
function checkEnvironmentConfig() {
    if (!SIYUAN_API_TOKEN || SIYUAN_API_TOKEN.trim() === '') {
        console.error(`
❌ 错误: 未配置思源笔记 API token

请按以下步骤配置:

1. 打开思源笔记
2. 进入 设置 → 关于
3. 在该页面中找到并原样复制这两块内容:

【在浏览器上使用】
请把“在浏览器上使用”下面的整段原文完整复制出来。
如果里面有多条地址，请全部复制。

【API token】
请把“API token”下面的整段原文完整复制出来。
界面里通常会显示类似:

API token
调用 API 时需要通过该 token 进行鉴权
HTTP 请求标头 Authorization: token <YOUR_API_TOKEN>

4. 创建 .env 文件并填入配置:

cp .env.example .env

然后编辑 .env 文件，填入你的配置:

# 基础配置
SIYUAN_HOST=你的服务器地址
SIYUAN_PORT=端口号 (HTTPS且无特殊端口可留空)
SIYUAN_USE_HTTPS=true (如果使用HTTPS)
SIYUAN_BASE_PATH=/可选子路径
SIYUAN_API_TOKEN=你的实际_API_token

# 可选：HTTP Basic Auth (如果启用了Basic Auth)
SIYUAN_BASIC_AUTH_USER=用户名
SIYUAN_BASIC_AUTH_PASS=密码
# 若网关仅支持 URL token（有泄漏风险），可设置:
SIYUAN_ALLOW_TOKEN_IN_QUERY=true

# 示例配置 (本地)
SIYUAN_HOST=localhost
SIYUAN_PORT=6806
SIYUAN_USE_HTTPS=false
SIYUAN_API_TOKEN=<YOUR_API_TOKEN>

# 示例配置 (远程服务器+HTTPS+Basic Auth)
SIYUAN_HOST=note.example.com
SIYUAN_PORT=
SIYUAN_USE_HTTPS=true
SIYUAN_API_TOKEN=<YOUR_API_TOKEN>
SIYUAN_BASIC_AUTH_USER=username
SIYUAN_BASIC_AUTH_PASS=password
# SIYUAN_ALLOW_TOKEN_IN_QUERY=true

配置完成后重新运行命令。
        `);
        return false;
    }
    return true;
}

async function checkSkillVersion() {
    return await checkSkillVersionImpl(__dirname);
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

async function requestSiyuanMultipartApi(apiPath, formData, options = {}) {
    const {
        requireAuth = true
    } = options;

    if (requireAuth && !checkEnvironmentConfig()) {
        throw new Error('环境配置不完整');
    }

    const headers = {};
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
        console.log(`📨 请求: ${apiPath} (${authMode}, multipart)`);
    }

    try {
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers,
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.code !== 0) {
            throw new Error(`思源API错误: ${result.msg || '未知错误'}`);
        }

        return result.data;
    } catch (error) {
        if (error.name === 'FetchError' || error.code === 'ECONNREFUSED' || String(error.message).includes('fetch failed')) {
            throw new Error(`无法连接到思源笔记: ${error.message}. 请确认思源笔记正在运行且地址端口可达`);
        }

        if (error.message.includes('思源API错误') || error.message.includes('HTTP')) {
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
async function executeSiyuanQueryRaw(sqlQuery) {
    const data = await requestSiyuanApi(API_ENDPOINTS.SQL_QUERY, { stmt: sqlQuery }, { requireAuth: true });
    return Array.isArray(data) ? data : [];
}

async function executeSiyuanQuery(sqlQuery) {
    if (isWorkdirGateEnabled()) {
        throw new Error(
            '工作笔记本门禁: 已设置 SIYUAN_WORKNOTEBOOKS 时，不允许直接执行全局 SQL 查询。\n' +
            '请改用受门禁保护的高层命令；若用户明确确认需要跨工作笔记本 SQL，请先临时设置 SIYUAN_CONFIRMED_WORKNOTEBOOKS 后再操作。'
        );
    }
    return await executeSiyuanQueryRaw(sqlQuery);
}

let notebookMetaCache = {
    ts: 0,
    notebooks: null
};

async function listNotebooksRaw() {
    const now = Date.now();
    if (notebookMetaCache.notebooks && (now - notebookMetaCache.ts) < 3000) {
        return notebookMetaCache.notebooks;
    }

    const data = await requestSiyuanApi(API_ENDPOINTS.NOTEBOOKS, {}, { requireAuth: true });
    let notebooks = [];
    if (Array.isArray(data)) {
        notebooks = data;
    } else if (data && Array.isArray(data.notebooks)) {
        notebooks = data.notebooks;
    }

    notebookMetaCache = {
        ts: now,
        notebooks
    };
    return notebooks;
}

async function notebookMatchesWorkNotebookName(targetNotebookName, notebookId) {
    const target = String(targetNotebookName || '').trim();
    if (!target || !notebookId) {
        return false;
    }

    const notebooks = await listNotebooksRaw();
    const notebook = notebooks.find((item) => item.id === notebookId);
    return notebook?.name === target;
}

async function isNotebookHPathAllowed(notebookId, hpathValue = '/') {
    if (!isWorkdirGateEnabled()) {
        return true;
    }

    const notebookNames = getEffectiveWorkNotebookNames();
    for (const notebookName of notebookNames) {
        if (await notebookMatchesWorkNotebookName(notebookName, notebookId)) {
            return true;
        }
    }

    return false;
}

async function buildNotebookLabel(notebookId) {
    const notebooks = await listNotebooksRaw();
    const notebook = notebooks.find((item) => item.id === notebookId);
    return notebook ? `${notebook.name} (${notebook.id})` : notebookId;
}

async function buildWorkdirGateMessage({ operation, accessType, notebookId, hpath }) {
    const notebookLabel = await buildNotebookLabel(notebookId);
    return [
        `工作笔记本门禁: 当前 ${accessType === 'write' ? '写入' : '读取'} 操作 ${operation} 试图访问未授权工作笔记本。`,
        `目标笔记本: ${notebookLabel}`,
        `目标目录: ${String(hpath || '/').trim() || '/'}`,
        '请先向用户明确确认是否允许访问该笔记本。',
        '若用户确认，可在本次命令前临时设置 SIYUAN_CONFIRMED_WORKNOTEBOOKS 后重试，格式与 SIYUAN_WORKNOTEBOOKS 相同。'
    ].join('\n');
}

async function ensureNotebookHPathAllowed(notebookId, hpathValue = '/', operation = 'read', accessType = 'read') {
    if (!isWorkdirGateEnabled()) {
        return;
    }

    assertNonEmptyString(notebookId, 'notebookId');
    const allowed = await isNotebookHPathAllowed(notebookId, hpathValue);
    if (allowed) {
        return;
    }

    throw new Error(await buildWorkdirGateMessage({
        operation,
        accessType,
        notebookId,
        hpath: hpathValue
    }));
}

async function getDocumentNotebookAndHPathByPath(notebookId, docPath) {
    const rows = await executeSiyuanQueryRaw(`
        SELECT id, box, hpath
        FROM blocks
        WHERE type = 'd'
        AND box = '${escapeSqlValue(notebookId)}'
        AND path = '${escapeSqlValue(docPath)}'
        LIMIT 1
    `);
    const row = rows[0] || {};
    return {
        notebook: row.box || notebookId,
        hpath: row.hpath || '/'
    };
}

async function ensureDocumentAccessAllowed(docId, operation = 'read', accessType = 'read') {
    if (!isWorkdirGateEnabled()) {
        return;
    }

    assertNonEmptyString(docId, 'docId');
    const pathInfo = await getPathByID(docId);
    const hpath = await getHPathByID(docId);
    await ensureNotebookHPathAllowed(pathInfo.notebook, hpath || '/', operation, accessType);
}

async function ensureBlockAccessAllowed(blockId, operation = 'read', accessType = 'read') {
    if (!isWorkdirGateEnabled()) {
        return;
    }

    assertNonEmptyString(blockId, 'blockId');
    const rootDocId = await getRootDocIdByBlockId(blockId);
    await ensureDocumentAccessAllowed(rootDocId, operation, accessType);
}

async function resolveRowWorkdirMeta(row) {
    if (!row || typeof row !== 'object') {
        return null;
    }

    const notebookId = String(row.box || row.notebook || '').trim();
    const hpath = String(row.hpath || '').trim();
    if (notebookId && hpath) {
        return {
            notebookId,
            hpath
        };
    }

    const docId = isLikelyBlockId(row.type === 'd' ? row.id : row.root_id)
        ? (row.type === 'd' ? row.id : row.root_id)
        : '';
    if (!docId) {
        return null;
    }

    const pathInfo = await getPathByID(docId);
    return {
        notebookId: pathInfo.notebook,
        hpath: await getHPathByID(docId)
    };
}

async function filterRowsByWorkdir(rows) {
    if (!isWorkdirGateEnabled() || !Array.isArray(rows)) {
        return rows;
    }

    const filtered = [];
    for (const row of rows) {
        const meta = await resolveRowWorkdirMeta(row);
        if (!meta) {
            continue;
        }
        if (await isNotebookHPathAllowed(meta.notebookId, meta.hpath || '/')) {
            filtered.push(row);
        }
    }
    return filtered;
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
    let scopeHPath = normalizedPath;
    if (normalizedPath !== '/' && normalizedPath.endsWith('.sy')) {
        const scope = await getDocumentNotebookAndHPathByPath(notebook, normalizedPath);
        scopeHPath = scope.hpath || '/';
    }
    await ensureNotebookHPathAllowed(notebook, scopeHPath, 'listDocsByPath', 'read');

    const data = await requestSiyuanApi(API_ENDPOINTS.LIST_DOCS_BY_PATH, {
        notebook,
        path: normalizedPath,
        maxListCount: 0
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
    await ensureDocumentAccessAllowed(docId, 'getDocumentTreeByID', 'read');

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

    const rawData = await requestSiyuanApi(API_ENDPOINTS.MOVE_DOCS_BY_ID, {
        fromIDs,
        toID
    }, { requireAuth: true });
    return normalizeGeneralWriteResult('moveDocsByID', {
        fromIDs,
        toID
    }, rawData, {
        movedDocIds: [...fromIDs]
    });
}

/**
 * 生成按ID移动文档计划
 * @param {string} toID - 目标父文档ID或笔记本ID
 * @param {Array<string>} fromIDs - 源文档ID数组
 * @returns {Promise<Object>} 移动计划
 */
async function planMoveDocsByID(toID, fromIDs) {
    const target = await resolveMoveTarget(toID);
    if (target.kind === 'doc') {
        await ensureDocumentAccessAllowed(target.id, 'planMoveDocsByID(target)', 'write');
    } else {
        await ensureNotebookHPathAllowed(target.notebook, '/', 'planMoveDocsByID(target)', 'write');
    }
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
        await ensureDocumentAccessAllowed(id, 'planMoveDocsByID(source)', 'write');

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
        success: true,
        state: 'applied',
        operation: 'moveDocsByID',
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
    const notebooks = await listNotebooksRaw();
    if (!isWorkdirGateEnabled()) {
        return notebooks;
    }

    const filtered = [];
    for (const notebook of notebooks) {
        if (await isNotebookHPathAllowed(notebook.id, '/')) {
            filtered.push(notebook);
        }
    }
    return filtered;
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
    await ensureNotebookHPathAllowed(notebook, pathValue, 'createDocWithMd', 'write');

    const rawData = await requestSiyuanApi(API_ENDPOINTS.CREATE_DOC_WITH_MD, {
        notebook,
        path: pathValue,
        markdown
    }, { requireAuth: true });
    return normalizeGeneralWriteResult('createDocWithMd', {
        notebook,
        path: pathValue,
        markdownLength: String(markdown || '').length
    }, rawData, {
        docId: typeof rawData === 'string' ? rawData : '',
        created: true
    });
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
    const scope = await getDocumentNotebookAndHPathByPath(notebook, docPath);
    await ensureNotebookHPathAllowed(scope.notebook, scope.hpath, 'renameDoc', 'write');

    const rawData = await requestSiyuanApi(API_ENDPOINTS.RENAME_DOC, {
        notebook,
        path: docPath,
        title
    }, { requireAuth: true });
    return normalizeGeneralWriteResult('renameDoc', {
        notebook,
        path: docPath,
        title
    }, rawData, {
        renamed: true
    });
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
    await ensureBlockAccessAllowed(id, 'getChildBlocks', 'read');
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
    const rows = await executeSiyuanQueryRaw(`
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
    await ensureBlockAccessAllowed(parentID, 'appendBlock', 'write');
    await ensureBlockReadBeforeWrite(parentID, 'appendBlock');
    const rawData = await requestSiyuanApi(API_ENDPOINTS.APPEND_BLOCK, {
        parentID,
        dataType: 'markdown',
        data: markdown
    }, { requireAuth: true });
    const insertedBlockId = extractInsertedBlockId(rawData);
    return normalizeGeneralWriteResult('appendBlock', {
        parentID,
        dataType: 'markdown',
        markdownLength: markdown.length
    }, rawData, {
        insertedBlockId,
        insertedBlockIds: insertedBlockId ? [insertedBlockId] : []
    });
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
        await ensureBlockAccessAllowed(anchorId, 'insertBlock', 'write');
        await ensureBlockReadBeforeWrite(anchorId, 'insertBlock');
    }

    const rawData = await requestSiyuanApi(API_ENDPOINTS.INSERT_BLOCK, {
        dataType: 'markdown',
        data: markdown,
        parentID,
        previousID,
        nextID
    }, { requireAuth: true });
    const insertedBlockId = extractInsertedBlockId(rawData);
    return normalizeGeneralWriteResult('insertBlock', {
        dataType: 'markdown',
        markdownLength: markdown.length,
        parentID,
        previousID,
        nextID
    }, rawData, {
        insertedBlockId,
        insertedBlockIds: insertedBlockId ? [insertedBlockId] : []
    });
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
    await ensureBlockAccessAllowed(id, 'moveBlock', 'write');
    await ensureBlockReadBeforeWrite(id, 'moveBlock');

    const parentID = typeof anchors.parentID === 'string' ? anchors.parentID.trim() : '';
    const previousID = typeof anchors.previousID === 'string' ? anchors.previousID.trim() : '';

    if (!parentID && !previousID) {
        throw new Error('moveBlock 需要 parentID 或 previousID 作为锚点');
    }

    const rawData = await requestSiyuanApi(API_ENDPOINTS.MOVE_BLOCK, {
        id,
        parentID,
        previousID
    }, { requireAuth: true });
    return normalizeGeneralWriteResult('moveBlock', {
        id,
        parentID,
        previousID
    }, rawData, {
        movedBlockId: id
    });
}

function normalizeMarkdownLineEndings(markdown) {
    return String(markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isMarkdownBlankLine(line) {
    return String(line || '').trim().length === 0;
}

function isDisplayMathFenceLine(trimmedLine) {
    return /^\$\$\s*$/.test(String(trimmedLine || ''));
}

function isBracketMathOpenLine(trimmedLine) {
    return /^\\\[\s*$/.test(String(trimmedLine || ''));
}

function isBracketMathCloseLine(trimmedLine) {
    return /^\\\]\s*$/.test(String(trimmedLine || ''));
}

function isHeadingLine(trimmedLine) {
    return /^#{1,6}\s+/.test(String(trimmedLine || ''));
}

function isHorizontalRuleLine(trimmedLine) {
    return /^([-*_]\s*){3,}$/.test(String(trimmedLine || ''));
}

function isBlockquoteLine(trimmedLine) {
    return /^>\s?/.test(String(trimmedLine || ''));
}

function isListStartLine(line) {
    return /^\s*(?:[-*+]\s+\[[ xX-]\]\s+|[-*+]\s+|\d+[.)]\s+)/.test(String(line || ''));
}

function isListContinuationLine(line) {
    return /^\s{2,}\S/.test(String(line || ''));
}

function getFenceMarker(line) {
    const trimmed = String(line || '').trimStart();
    const match = trimmed.match(/^(`{3,}|~{3,})/);
    if (!match) {
        return null;
    }
    const marker = match[1];
    return {
        char: marker[0],
        size: marker.length
    };
}

function isFenceCloseLine(line, marker) {
    if (!marker) {
        return false;
    }
    const trimmed = String(line || '').trimStart();
    const regex = new RegExp(`^${marker.char}{${marker.size},}\\s*$`);
    return regex.test(trimmed);
}

function isTableDividerLine(trimmedLine) {
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(String(trimmedLine || ''));
}

function isTableRowLine(trimmedLine) {
    return /^\|?.*\|.*\|?$/.test(String(trimmedLine || ''));
}

function isTableStart(lines, index) {
    const current = String(lines[index] || '').trim();
    const next = String(lines[index + 1] || '').trim();
    return isTableRowLine(current) && isTableDividerLine(next);
}

function isBlockStarter(lines, index) {
    const line = String(lines[index] || '');
    const trimmed = line.trim();
    return !!getFenceMarker(line)
        || isDisplayMathFenceLine(trimmed)
        || isBracketMathOpenLine(trimmed)
        || isHeadingLine(trimmed)
        || isHorizontalRuleLine(trimmed)
        || isBlockquoteLine(trimmed)
        || isListStartLine(line)
        || isTableStart(lines, index);
}

/**
 * 将 Markdown 拆分为可安全写入的块序列
 * 目标：避免 updateBlock 一次写入隐式生成多个块导致刷新后丢失
 * @param {string} markdown - 原始Markdown
 * @returns {Array<string>} 块级Markdown列表
 */
function splitMarkdownIntoWritableBlocks(markdown) {
    const lines = normalizeMarkdownLineEndings(markdown).split('\n');
    const blocks = [];
    let i = 0;

    const pushBlock = (blockLines) => {
        const text = blockLines.join('\n').replace(/^\n+|\n+$/g, '');
        if (text.trim().length > 0) {
            blocks.push(text);
        }
    };

    while (i < lines.length) {
        while (i < lines.length && isMarkdownBlankLine(lines[i])) {
            i += 1;
        }
        if (i >= lines.length) {
            break;
        }

        const line = lines[i];
        const trimmed = line.trim();

        const fenceMarker = getFenceMarker(line);
        if (fenceMarker) {
            const block = [line];
            i += 1;
            while (i < lines.length) {
                block.push(lines[i]);
                if (isFenceCloseLine(lines[i], fenceMarker)) {
                    i += 1;
                    break;
                }
                i += 1;
            }
            pushBlock(block);
            continue;
        }

        if (isDisplayMathFenceLine(trimmed)) {
            const block = [line];
            i += 1;
            while (i < lines.length) {
                block.push(lines[i]);
                if (isDisplayMathFenceLine(String(lines[i] || '').trim())) {
                    i += 1;
                    break;
                }
                i += 1;
            }
            pushBlock(block);
            continue;
        }

        if (isBracketMathOpenLine(trimmed)) {
            const block = [line];
            i += 1;
            while (i < lines.length) {
                block.push(lines[i]);
                if (isBracketMathCloseLine(String(lines[i] || '').trim())) {
                    i += 1;
                    break;
                }
                i += 1;
            }
            pushBlock(block);
            continue;
        }

        if (isHeadingLine(trimmed) || isHorizontalRuleLine(trimmed)) {
            pushBlock([line]);
            i += 1;
            continue;
        }

        if (isTableStart(lines, i)) {
            const block = [lines[i], lines[i + 1]];
            i += 2;
            while (i < lines.length) {
                const current = String(lines[i] || '').trim();
                if (!current || !isTableRowLine(current)) {
                    break;
                }
                block.push(lines[i]);
                i += 1;
            }
            pushBlock(block);
            continue;
        }

        if (isListStartLine(line)) {
            const block = [line];
            i += 1;
            while (i < lines.length) {
                if (isMarkdownBlankLine(lines[i])) {
                    break;
                }
                if (!isListStartLine(lines[i]) && !isListContinuationLine(lines[i])) {
                    break;
                }
                block.push(lines[i]);
                i += 1;
            }
            pushBlock(block);
            continue;
        }

        if (isBlockquoteLine(trimmed)) {
            const block = [line];
            i += 1;
            while (i < lines.length) {
                const currentTrimmed = String(lines[i] || '').trim();
                if (!currentTrimmed || !isBlockquoteLine(currentTrimmed)) {
                    break;
                }
                block.push(lines[i]);
                i += 1;
            }
            pushBlock(block);
            continue;
        }

        const paragraph = [line];
        i += 1;
        while (i < lines.length) {
            if (isMarkdownBlankLine(lines[i])) {
                break;
            }
            if (isBlockStarter(lines, i)) {
                break;
            }
            paragraph.push(lines[i]);
            i += 1;
        }
        pushBlock(paragraph);
    }

    return blocks;
}

function inferWritableBlockType(markdown) {
    const htmlDerived = (() => {
        const firstLine = String(markdown || '').trim();
        if (!firstLine) {
            return null;
        }

        if (/^\{\{[\s\S]+\}\}$/.test(firstLine)) {
            return { type: 'query_embed', subType: '' };
        }
        if (/^<div\b[^>]*\bdata-type=["']NodeAttributeView["'][^>]*>/i.test(firstLine) || /^<div\b[^>]*\bdata-av-type=["'][^"']+["'][^>]*>/i.test(firstLine)) {
            return { type: 'av', subType: '' };
        }
        if (/^<iframe\b[^>]*\bdata-subtype=["']widget["'][^>]*>/i.test(firstLine) || /^<iframe\b[^>]*\bsrc=["']\/widgets\//i.test(firstLine)) {
            return { type: 'widget', subType: '' };
        }
        if (/^<iframe\b/i.test(firstLine)) {
            return { type: 'iframe', subType: '' };
        }
        if (/^<video\b/i.test(firstLine)) {
            return { type: 'video', subType: '' };
        }
        if (/^<audio\b/i.test(firstLine)) {
            return { type: 'audio', subType: '' };
        }
        if (/^<[a-z][\w:-]*\b/i.test(firstLine)) {
            return { type: 'html', subType: '' };
        }
        return null;
    })();
    if (htmlDerived) {
        return htmlDerived;
    }

    const match = String(markdown || '').trim().match(/^>\s*\[!([A-Z][A-Z0-9_-]*)\](?:\s+.*)?$/im);
    if (match) {
        return {
            type: 'callout',
            subType: String(match[1] || '').toUpperCase()
        };
    }

    const text = normalizeMarkdownLineEndings(markdown).trim();
    if (!text) {
        return { type: '', subType: '' };
    }
    const lines = text.split('\n');
    const firstLine = String(lines[0] || '').trim();
    const secondLine = String(lines[1] || '').trim();

    if (getFenceMarker(firstLine)) {
        return { type: 'c', subType: '' };
    }
    if (isDisplayMathFenceLine(firstLine)) {
        return { type: 'm', subType: '' };
    }
    if (isHeadingLine(firstLine)) {
        const level = firstLine.match(/^(#{1,6})\s+/)?.[1]?.length || 1;
        return { type: 'h', subType: `h${level}` };
    }
    if (isListStartLine(lines[0] || '')) {
        if (/^\s*[-*+]\s+\[[ xX-]\]\s+/.test(String(lines[0] || ''))) {
            return { type: 'l', subType: 't' };
        }
        if (/^\s*[-*+]\s+/.test(String(lines[0] || ''))) {
            return { type: 'l', subType: 'u' };
        }
        return { type: 'l', subType: 'o' };
    }
    if (isBlockquoteLine(firstLine)) {
        return { type: 'b', subType: '' };
    }
    if (isTableRowLine(firstLine) && isTableDividerLine(secondLine)) {
        return { type: 't', subType: '' };
    }
    if (/^[-*_]{3,}\s*$/.test(firstLine) && lines.length === 1) {
        return { type: 'tb', subType: '' };
    }
    return { type: 'p', subType: '' };
}

async function getBlockSnapshotById(id) {
    const safeId = escapeSqlValue(id);
    const rows = await executeSiyuanQueryRaw(`
        SELECT id, type, subtype, root_id, parent_id, markdown
        FROM blocks
        WHERE id = '${safeId}'
        LIMIT 1
    `);
    if (!rows || rows.length === 0) {
        return null;
    }
    return rows[0];
}

async function verifyPersistedBlock({ blockId, rootDocId, expectedType, expectedSubType, context }) {
    let lastError = '';
    for (let attempt = 0; attempt < 30; attempt += 1) {
        const snapshot = await getBlockSnapshotById(blockId);
        if (!snapshot) {
            lastError = `[${context}] 写后校验失败: 块 ${blockId} 未持久化到数据库`;
        } else if (isLikelyBlockId(rootDocId) && snapshot.root_id && snapshot.root_id !== rootDocId && snapshot.id !== rootDocId) {
            lastError = `[${context}] 写后校验失败: 块 ${blockId} root_id=${snapshot.root_id}，预期=${rootDocId}`;
        } else if (expectedType && snapshot.type !== expectedType) {
            lastError = `[${context}] 写后校验失败: 块 ${blockId} 类型=${snapshot.type}，预期=${expectedType}`;
        } else if (expectedSubType && snapshot.subtype !== expectedSubType) {
            lastError = `[${context}] 写后校验失败: 块 ${blockId} subtype=${snapshot.subtype || ''}，预期=${expectedSubType}`;
        } else {
            return;
        }

        if (attempt < 29) {
            await new Promise((resolve) => setTimeout(resolve, 150));
        }
    }

    throw new Error(lastError || `[${context}] 写后校验失败: 块 ${blockId} 状态异常`);
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

    const normalizedMarkdown = normalizeMarkdownLineEndings(markdown);
    const writableBlocks = splitMarkdownIntoWritableBlocks(normalizedMarkdown);
    if (writableBlocks.length === 0) {
        throw new Error('markdown 不能为空');
    }

    const rootDocId = await ensureBlockReadBeforeWrite(id, 'updateBlock');
    const targetType = await getBlockTypeById(id);

    if (targetType === 'd') {
        const rawData = await requestSiyuanApi(API_ENDPOINTS.UPDATE_BLOCK, {
            id,
            dataType: 'markdown',
            data: normalizedMarkdown
        }, { requireAuth: true });
        await refreshDocumentVersion(rootDocId);
        return {
            success: true,
            state: 'applied',
            operation: 'updateBlock',
            mode: 'document-root-update',
            request: {
                id,
                dataType: 'markdown',
                markdownLength: normalizedMarkdown.length
            },
            touchedDocIds: [rootDocId],
            message: '目标为文档根块，已交由思源内核一次性重建文档内容',
            rawData,
            rawResultType: Array.isArray(rawData) ? 'transaction_array' : (rawData === null ? 'empty' : typeof rawData),
            result: normalizeGeneralWriteResult('updateBlock', {
                id,
                dataType: 'markdown',
                markdownLength: normalizedMarkdown.length
            }, rawData, {
                updatedBlockId: id
            })
        };
    }

    if (writableBlocks.length === 1) {
        const expectedBlockInfo = inferWritableBlockType(writableBlocks[0]);
        const rawData = await requestSiyuanApi(API_ENDPOINTS.UPDATE_BLOCK, {
            id,
            dataType: 'markdown',
            data: writableBlocks[0]
        }, { requireAuth: true });
        await refreshDocumentVersion(rootDocId);
        await verifyPersistedBlock({
            blockId: id,
            rootDocId,
            expectedType: expectedBlockInfo.type,
            expectedSubType: expectedBlockInfo.subType,
            context: 'updateBlock-single'
        });
        return normalizeGeneralWriteResult('updateBlock', {
            id,
            dataType: 'markdown',
            markdownLength: writableBlocks[0].length
        }, rawData, {
            mode: 'single-block-update',
            updatedBlockId: id,
            touchedDocIds: [rootDocId],
            expectedType: expectedBlockInfo.type,
            expectedSubType: expectedBlockInfo.subType
        });
    }

    // 多块内容不直接走单块 update，改为“更新首块 + 顺序插入剩余块”
    const firstBlock = writableBlocks[0];
    const firstBlockInfo = inferWritableBlockType(firstBlock);
    const updateRawData = await requestSiyuanApi(API_ENDPOINTS.UPDATE_BLOCK, {
        id,
        dataType: 'markdown',
        data: firstBlock
    }, { requireAuth: true });
    await refreshDocumentVersion(rootDocId);
    await verifyPersistedBlock({
        blockId: id,
        rootDocId,
        expectedType: firstBlockInfo.type,
        expectedSubType: firstBlockInfo.subType,
        context: 'updateBlock-structured-first'
    });

    let anchorId = id;
    const inserted = [];
    for (let index = 1; index < writableBlocks.length; index += 1) {
        const blockMarkdown = writableBlocks[index];
        const blockInfo = inferWritableBlockType(blockMarkdown);
        const insertResult = await insertBlock(blockMarkdown, { previousID: anchorId });
        const insertedId = extractInsertedBlockId(insertResult);
        if (!insertedId) {
            throw new Error(`updateBlock 多块写入失败: 第 ${index + 1} 块插入后未返回有效块ID`);
        }
        cacheBlockRoot(insertedId, rootDocId);
        await refreshDocumentVersion(rootDocId);
        await verifyPersistedBlock({
            blockId: insertedId,
            rootDocId,
            expectedType: blockInfo.type,
            expectedSubType: blockInfo.subType,
            context: `updateBlock-structured-insert-${index + 1}`
        });

        inserted.push({
            id: insertedId,
            expectedType: blockInfo.type,
            expectedSubType: blockInfo.subType,
            result: insertResult
        });
        anchorId = insertedId;
    }

    return {
        mode: 'structured-update',
        message: '检测到多块 Markdown，已自动切换为安全拆块写入（首块 update + 后续 insert）',
        success: true,
        state: 'applied',
        operation: 'updateBlock',
        request: {
            id,
            dataType: 'markdown',
            markdownLength: normalizedMarkdown.length
        },
        touchedDocIds: [rootDocId],
        summary: {
            inputBlockCount: writableBlocks.length,
            updatedId: id,
            insertedCount: inserted.length
        },
        updated: {
            id,
            result: normalizeGeneralWriteResult('updateBlock', {
                id,
                dataType: 'markdown',
                markdownLength: firstBlock.length
            }, updateRawData, {
                updatedBlockId: id,
                expectedType: firstBlockInfo.type,
                expectedSubType: firstBlockInfo.subType
            })
        },
        inserted
    };
}

/**
 * 删除块
 * @param {string} id - 块ID
 * @returns {Promise<Object>} API返回
 */
async function deleteBlock(id) {
    ensureWriteEnabled();
    assertNonEmptyString(id, 'id');
    const rootDocId = await ensureBlockReadBeforeWrite(id, 'deleteBlock');
    const rawData = await requestSiyuanApi(API_ENDPOINTS.DELETE_BLOCK, { id }, { requireAuth: true });
    await refreshDocumentVersion(rootDocId);
    return normalizeGeneralWriteResult('deleteBlock', {
        id
    }, rawData, {
        deletedBlockId: id,
        touchedDocIds: [rootDocId]
    });
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
 * 读取标题块的章节子块 ID 列表（只读 helper，不涉及写入逻辑）
 * @param {string} headingBlockId - 标题块ID
 * @returns {Promise<{headingBlockId: string, rootDocId: string, headingSubtype: string, childBlocks: Array, childBlockIds: string[]}>}
 */
async function getSectionChildBlockIds(headingBlockId) {
    assertNonEmptyString(headingBlockId, 'headingBlockId');
    if (!isLikelyBlockId(headingBlockId)) {
        throw new Error('headingBlockId 格式不正确');
    }

    const dbType = await getBlockTypeById(headingBlockId);
    if (!dbType) {
        throw new Error('未找到目标块，请确认 headingBlockId 是否存在');
    }
    if (dbType !== 'h') {
        throw new Error(`目标块不是标题块(type=${dbType})，open-section 仅支持标题块`);
    }

    const rootDocId = await getRootDocIdByBlockId(headingBlockId);

    // 获取标题的 subtype (h1-h6)
    const safeId = escapeSqlValue(headingBlockId);
    const rows = await executeSiyuanQueryRaw(`SELECT subtype FROM blocks WHERE id = '${safeId}' LIMIT 1`);
    const headingSubtype = rows?.[0]?.subtype || '';

    const childBlocks = await getChildBlocks(headingBlockId);
    const normalizedChildBlocks = childBlocks
        .map((item) => ({
            id: item?.id || '',
            type: item?.type || '',
            subType: item?.subType || ''
        }))
        .filter((item) => item.id);
    const childBlockIds = normalizedChildBlocks.map((item) => item.id);

    return {
        headingBlockId,
        rootDocId,
        headingSubtype,
        childBlocks: normalizedChildBlocks,
        childBlockIds
    };
}

/**
 * 限流并发映射
 * @param {Array} items - 输入数组
 * @param {number} concurrency - 最大并发数
 * @param {Function} mapper - 映射函数
 * @returns {Promise<Array>} 映射结果
 */
async function mapWithConcurrency(items, concurrency, mapper) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    const parsed = Number.parseInt(concurrency, 10);
    const safeConcurrency = Number.isNaN(parsed)
        ? 1
        : Math.max(1, Math.min(parsed, items.length));

    const results = new Array(items.length);
    let currentIndex = 0;

    async function worker() {
        while (true) {
            const index = currentIndex;
            currentIndex += 1;
            if (index >= items.length) {
                return;
            }
            results[index] = await mapper(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
    return results;
}

/**
 * 打开标题章节的内容视图
 * @param {string} headingBlockId - 标题块ID
 * @param {string} view - readable|patchable
 * @returns {Promise<string>} 渲染后的文本
 */
async function openSection(headingBlockId, view = 'readable') {
    await ensureBlockAccessAllowed(headingBlockId, 'openSection', 'read');
    const section = await getSectionChildBlockIds(headingBlockId);
    await markDocumentRead(section.rootDocId, 'openSection');

    if (view === 'patchable') {
        // 限流并发获取所有子块的 kramdown，避免大章节瞬时打满请求
        const allIds = [section.headingBlockId, ...section.childBlockIds];
        const kramdownResults = await mapWithConcurrency(allIds, 8, (id) => getBlockKramdown(id));
        const headingParsed = parseBlocksFromKramdown(kramdownResults[0], {}, {
            [section.headingBlockId]: {
                type: 'h',
                subType: section.headingSubtype
            }
        });
        const blocks = [];
        for (let i = 1; i < kramdownResults.length; i++) {
            const child = section.childBlocks[i - 1];
            blocks.push(...parseBlocksFromKramdown(kramdownResults[i], {}, child ? {
                [child.id]: {
                    type: child.type,
                    subType: child.subType
                }
            } : {}));
        }

        const meta = await getDocumentMeta(section.rootDocId);
        const allBlocks = [...headingParsed, ...blocks];
        const lines = [];
        const updatedPart = meta.updated ? ` updated=${meta.updated}` : '';
        lines.push(`<!-- @siyuan:doc id=${section.rootDocId} hpath=${JSON.stringify(meta.hpath || '')} view=patchable pmf=v1 partial=true section=${section.headingBlockId}${updatedPart} -->`);
        lines.push('');
        for (const block of allBlocks) {
            const subTypePart = block.subType ? ` subType=${block.subType}` : '';
            const parentPart = block.parentId ? ` parent=${block.parentId}` : '';
            lines.push(`<!-- @siyuan:block id=${block.id} type=${block.type}${subTypePart}${parentPart} -->`);
            lines.push(block.markdown);
            lines.push('');
        }
        return lines.join('\n').trim();
    }

    // readable 视图：限流并发获取所有块的 kramdown
    const allIds = [section.headingBlockId, ...section.childBlockIds];
    const kramdownResults = await mapWithConcurrency(allIds, 8, (id) => getBlockKramdown(id));
    const headingMd = stripKramdownIAL(kramdownResults[0]);
    const childMdParts = kramdownResults.slice(1).map(k => stripKramdownIAL(k));

    const meta = await getDocumentMeta(section.rootDocId);
    const lines = [];
    lines.push('---');
    lines.push('siyuan:');
    lines.push(`  doc_id: ${section.rootDocId}`);
    lines.push(`  section_id: ${section.headingBlockId}`);
    lines.push(`  hpath: ${JSON.stringify(meta.hpath || '')}`);
    lines.push('  view: readable');
    lines.push('  scope: section');
    lines.push(`  child_blocks: ${section.childBlockIds.length}`);
    lines.push(`  exported_at: ${new Date().toISOString()}`);
    lines.push('---');
    lines.push('');
    lines.push(headingMd);
    lines.push('');
    if (childMdParts.length > 0) {
        lines.push(childMdParts.join('\n\n'));
    } else {
        lines.push('_该章节下没有子块_');
    }

    return lines.join('\n');
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
        success: true,
        state: 'applied',
        operation: 'replaceSection',
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
        success: true,
        state: 'applied',
        operation: 'appendMarkdownToBlock',
        action: 'append_block',
        parentBlockId,
        parentType,
        touchedDocIds: [rootDocId],
        execution: {
            appended: true,
            result
        }
    };
}

const baseQueryServices = createQueryServices({
    executeSiyuanQuery: executeSiyuanQueryRaw,
    escapeSqlValue,
    normalizeInt,
    assertNonEmptyString,
    strftime,
    listDocumentsLimit: SIYUAN_LIST_DOCUMENTS_LIMIT
});

async function searchNotes(keyword, limit = 20, blockType = null) {
    return await filterRowsByWorkdir(await baseQueryServices.searchNotes(keyword, limit, blockType));
}

async function searchInDocument(docId, keyword, limit = 20) {
    await ensureDocumentAccessAllowed(docId, 'searchInDocument', 'read');
    return await baseQueryServices.searchInDocument(docId, keyword, limit);
}

async function listDocuments(notebookId = null, limit = SIYUAN_LIST_DOCUMENTS_LIMIT) {
    if (notebookId) {
        await ensureNotebookHPathAllowed(notebookId, '/', 'listDocuments', 'read');
    }
    return await filterRowsByWorkdir(await baseQueryServices.listDocuments(notebookId, limit));
}

async function searchByTag(tag, limit = 20) {
    return await filterRowsByWorkdir(await baseQueryServices.searchByTag(tag, limit));
}

async function getBacklinks(defBlockId, limit = 999) {
    await ensureBlockAccessAllowed(defBlockId, 'getBacklinks', 'read');
    return await filterRowsByWorkdir(await baseQueryServices.getBacklinks(defBlockId, limit));
}

async function searchTasks(status = '[ ]', days = 7, limit = 50) {
    return await filterRowsByWorkdir(await baseQueryServices.searchTasks(status, days, limit));
}

async function getDailyNotes(startDate, endDate) {
    return await filterRowsByWorkdir(await baseQueryServices.getDailyNotes(startDate, endDate));
}

async function searchByAttribute(attrName, attrValue = null, limit = 20) {
    return await filterRowsByWorkdir(await baseQueryServices.searchByAttribute(attrName, attrValue, limit));
}

async function getBookmarks(bookmarkName = null) {
    return await filterRowsByWorkdir(await baseQueryServices.getBookmarks(bookmarkName));
}

async function getRandomHeading(rootId) {
    await ensureDocumentAccessAllowed(rootId, 'getRandomHeading', 'read');
    return await baseQueryServices.getRandomHeading(rootId);
}

async function getRecentBlocks(days = 7, orderBy = 'updated', blockType = null, limit = 50) {
    return await filterRowsByWorkdir(await baseQueryServices.getRecentBlocks(days, orderBy, blockType, limit));
}

async function getUnreferencedDocuments(notebookId, limit = 128) {
    await ensureNotebookHPathAllowed(notebookId, '/', 'getUnreferencedDocuments', 'read');
    return await filterRowsByWorkdir(await baseQueryServices.getUnreferencedDocuments(notebookId, limit));
}

async function queryDocumentBlockRows(rootId) {
    assertNonEmptyString(rootId, 'rootId');
    const safeRootId = escapeSqlValue(rootId);
    return await executeSiyuanQueryRaw(`
        SELECT id, content, markdown, type, subtype, created, updated, parent_id, ial
        FROM blocks
        WHERE root_id = '${safeRootId}'
    `);
}

async function getDocumentBlocksInTreeOrder(rootId) {
    assertNonEmptyString(rootId, 'rootId');
    const [kramdown, rows] = await Promise.all([
        getBlockKramdown(rootId),
        queryDocumentBlockRows(rootId)
    ]);

    const rowMap = new Map();
    const parentIdMap = {};
    const blockMetaMap = {};

    for (const row of rows) {
        if (!row || !row.id) {
            continue;
        }

        rowMap.set(row.id, row);
        parentIdMap[row.id] = row.parent_id || '';
        blockMetaMap[row.id] = {
            type: row.type || '',
            subType: row.subtype || '',
            parentId: row.parent_id || ''
        };
    }

    const orderedBlocks = parseBlocksFromKramdown(kramdown, parentIdMap, blockMetaMap);
    return orderedBlocks
        .filter((block) => rowMap.has(block.id))
        .map((block) => {
            const row = rowMap.get(block.id) || {};
            return {
                id: block.id,
                content: row.content || '',
                markdown: block.markdown,
                type: block.type || row.type || '',
                subType: block.subType || row.subtype || '',
                subtype: block.subType || row.subtype || '',
                created: row.created || '',
                updated: row.updated || '',
                parentId: block.parentId || row.parent_id || '',
                parent_id: block.parentId || row.parent_id || '',
                ial: row.ial || '',
                root_id: rootId
            };
        });
}

async function getDocumentHeadings(rootId, headingType = null) {
    await ensureDocumentAccessAllowed(rootId, 'getDocumentHeadings', 'read');
    const blocks = await getDocumentBlocksInTreeOrder(rootId);
    return blocks.filter((block) => {
        if (block.type !== 'h') {
            return false;
        }
        if (headingType && block.subtype !== headingType) {
            return false;
        }
        return true;
    });
}

async function getDocumentBlocks(rootId, blockType = null) {
    await ensureDocumentAccessAllowed(rootId, 'getDocumentBlocks', 'read');
    const blocks = await getDocumentBlocksInTreeOrder(rootId);
    if (!blockType) {
        return blocks;
    }

    return blocks.filter((block) => block.type === blockType);
}

const ATTRIBUTE_VIEW_API_SPECS = {
    renderAttributeView: { path: API_ENDPOINTS.AV_RENDER, write: false },
    getAttributeView: { path: API_ENDPOINTS.AV_GET, write: false },
    getAttributeViewKeys: { path: API_ENDPOINTS.AV_KEYS, write: false },
    getAttributeViewKeysByAvID: { path: API_ENDPOINTS.AV_KEYS_BY_AV_ID, write: false },
    getAttributeViewKeysByID: { path: API_ENDPOINTS.AV_KEYS_BY_ID, write: false },
    getAttributeViewPrimaryKeyValues: { path: API_ENDPOINTS.AV_PRIMARY_KEYS, write: false },
    getAttributeViewAddingBlockDefaultValues: { path: API_ENDPOINTS.AV_GET_DEFAULT_VALUES, write: false },
    getAttributeViewFilterSort: { path: API_ENDPOINTS.AV_FILTER_SORT, write: false },
    searchAttributeView: { path: API_ENDPOINTS.AV_SEARCH, write: false },
    searchAttributeViewRelationKey: { path: API_ENDPOINTS.AV_SEARCH_RELATION_KEY, write: false },
    searchAttributeViewRollupDestKeys: { path: API_ENDPOINTS.AV_SEARCH_ROLLUP_DEST_KEYS, write: false },
    getAttributeViewItemIDsByBoundIDs: { path: API_ENDPOINTS.AV_ITEM_IDS_BY_BOUND_IDS, write: false },
    getAttributeViewBoundBlockIDsByItemIDs: { path: API_ENDPOINTS.AV_BOUND_BLOCK_IDS_BY_ITEM_IDS, write: false },
    getMirrorDatabaseBlocks: { path: API_ENDPOINTS.AV_MIRROR_BLOCKS, write: false },
    getCurrentAttrViewImages: { path: API_ENDPOINTS.AV_RENDER_IMAGES, write: false },
    setAttributeViewBlockAttr: { path: API_ENDPOINTS.AV_SET_CELL, write: true },
    batchSetAttributeViewBlockAttrs: { path: API_ENDPOINTS.AV_BATCH_SET_CELLS, write: true },
    addAttributeViewKey: { path: API_ENDPOINTS.AV_ADD_KEY, write: true },
    removeAttributeViewKey: { path: API_ENDPOINTS.AV_REMOVE_KEY, write: true },
    sortAttributeViewKey: { path: API_ENDPOINTS.AV_SORT_KEY, write: true },
    sortAttributeViewViewKey: { path: API_ENDPOINTS.AV_SORT_VIEW_KEY, write: true },
    addAttributeViewBlocks: { path: API_ENDPOINTS.AV_ADD_ROWS, write: true },
    removeAttributeViewBlocks: { path: API_ENDPOINTS.AV_REMOVE_ROWS, write: true },
    changeAttrViewLayout: { path: API_ENDPOINTS.AV_CHANGE_LAYOUT, write: true },
    setDatabaseBlockView: { path: API_ENDPOINTS.AV_SET_VIEW, write: true },
    duplicateAttributeViewBlock: { path: API_ENDPOINTS.AV_DUPLICATE, write: true },
    appendAttributeViewDetachedBlocksWithValues: { path: API_ENDPOINTS.AV_APPEND_DETACHED_ROWS, write: true },
    setAttrViewGroup: { path: API_ENDPOINTS.AV_SET_GROUP, write: true },
    batchReplaceAttributeViewBlocks: { path: API_ENDPOINTS.AV_BATCH_REPLACE_BLOCKS, write: true }
};

async function resolveAttributeViewHostBlocks(avID) {
    assertNonEmptyString(avID, 'avID');
    const marker = escapeSqlValue(`data-av-id="${avID}"`);
    const rows = await executeSiyuanQueryRaw(`
        SELECT id, root_id, box, path, hpath, updated
        FROM blocks
        WHERE type = 'av'
        AND instr(markdown, '${marker}') > 0
        ORDER BY updated DESC
    `);

    return rows
        .filter((row) => row && row.id && row.root_id)
        .map((row) => ({
            blockId: row.id,
            rootDocId: row.root_id,
            box: row.box || '',
            path: row.path || '',
            hpath: row.hpath || '',
            updated: row.updated || ''
        }));
}

async function collectAttributeViewWriteDocIds(payload, operationName) {
    ensureWriteEnabled();
    const docIds = new Set();

    const addDocId = (docId) => {
        if (isLikelyBlockId(docId)) {
            docIds.add(docId);
        }
    };

    if (payload && typeof payload.avID === 'string' && payload.avID.trim()) {
        const hosts = await resolveAttributeViewHostBlocks(payload.avID.trim());
        if (hosts.length === 0) {
            throw new Error(`未找到属性视图对应的数据库块: ${payload.avID}`);
        }

        for (const host of hosts) {
            const rootDocId = await ensureBlockReadBeforeWrite(host.blockId, operationName);
            addDocId(rootDocId);
        }
    }

    for (const key of ['blockID', 'id']) {
        const value = payload && typeof payload[key] === 'string' ? payload[key].trim() : '';
        if (!value || !isLikelyBlockId(value)) {
            continue;
        }

        const rootDocId = await ensureBlockReadBeforeWrite(value, operationName);
        addDocId(rootDocId);
    }

    return Array.from(docIds);
}

function getAttributeViewIdForOperation(operationName, payload = {}) {
    if (typeof payload.avID === 'string' && payload.avID.trim()) {
        return payload.avID.trim();
    }

    const idBasedOperations = new Set([
        'renderAttributeView',
        'getAttributeView',
        'getAttributeViewKeys',
        'getAttributeViewPrimaryKeyValues'
    ]);
    if (idBasedOperations.has(operationName) && typeof payload.id === 'string' && payload.id.trim()) {
        return payload.id.trim();
    }

    return '';
}

async function ensureAttributeViewAccessAllowed(operationName, payload = {}, accessType = 'read') {
    if (!isWorkdirGateEnabled()) {
        return;
    }

    const avID = getAttributeViewIdForOperation(operationName, payload);
    if (!avID) {
        if (typeof payload.blockID === 'string' && payload.blockID.trim()) {
            await ensureBlockAccessAllowed(payload.blockID.trim(), `av/${operationName}`, accessType);
        }
        if (typeof payload.id === 'string' && payload.id.trim() && isLikelyBlockId(payload.id.trim())) {
            await ensureBlockAccessAllowed(payload.id.trim(), `av/${operationName}`, accessType);
        }
        return;
    }

    const hosts = await resolveAttributeViewHostBlocks(avID);
    if (hosts.length === 0) {
        return;
    }
    for (const host of hosts) {
        await ensureBlockAccessAllowed(host.blockId, `av/${operationName}`, accessType);
    }
}

async function callAttributeViewApi(operationName, payload = {}) {
    const spec = ATTRIBUTE_VIEW_API_SPECS[operationName];
    if (!spec) {
        throw new Error(`不支持的属性视图操作: ${operationName}`);
    }

    const safePayload = payload && typeof payload === 'object' ? payload : {};
    await ensureAttributeViewAccessAllowed(operationName, safePayload, spec.write ? 'write' : 'read');
    let touchedDocIds = [];
    if (spec.write) {
        touchedDocIds = await collectAttributeViewWriteDocIds(safePayload, `av/${operationName}`);
        if (typeof safePayload.avID === 'string' && safePayload.avID.trim()) {
            await requestSiyuanApi(API_ENDPOINTS.AV_RENDER, {
                id: safePayload.avID.trim(),
                createIfNotExist: true
            }, { requireAuth: true });
        }
    }

    const data = await requestSiyuanApi(spec.path, safePayload, { requireAuth: true });

    if (spec.write) {
        for (const docId of touchedDocIds) {
            await refreshDocumentVersion(docId);
        }
        return normalizeAttributeViewWriteResult(operationName, safePayload, data, touchedDocIds);
    }

    return data;
}

function summarizeAttributeViewPayload(payload = {}) {
    if (!payload || typeof payload !== 'object') {
        return {};
    }

    const summary = {};
    const stringKeys = [
        'avID', 'id', 'blockID', 'keyID', 'itemID', 'viewID', 'groupID',
        'targetGroupID', 'previousID', 'nextID', 'layoutType'
    ];
    for (const key of stringKeys) {
        if (typeof payload[key] === 'string' && payload[key].trim()) {
            summary[key] = payload[key].trim();
        }
    }

    if (Array.isArray(payload.srcs)) {
        summary.srcCount = payload.srcs.length;
    }
    if (Array.isArray(payload.srcIDs)) {
        summary.srcIDCount = payload.srcIDs.length;
    }
    if (Array.isArray(payload.values)) {
        summary.valueCount = payload.values.length;
    }
    if (Array.isArray(payload.transactions)) {
        summary.transactionCount = payload.transactions.length;
    }
    if (payload.removeRelationDest === true) {
        summary.removeRelationDest = true;
    }
    if (payload.ignoreDefaultFill === true) {
        summary.ignoreDefaultFill = true;
    }
    if (typeof payload.pageSize === 'number') {
        summary.pageSize = payload.pageSize;
    }
    if (typeof payload.page === 'number') {
        summary.page = payload.page;
    }
    if (typeof payload.query === 'string' && payload.query.trim()) {
        summary.query = payload.query;
    }
    return summary;
}

function normalizeAttributeViewWriteResult(operationName, payload, data, touchedDocIds = []) {
    const base = {
        success: true,
        state: 'applied',
        operation: operationName,
        request: summarizeAttributeViewPayload(payload),
        touchedDocIds: Array.isArray(touchedDocIds) ? touchedDocIds : []
    };

    if (typeof data === 'undefined' || data === null) {
        return {
            ...base,
            data: null,
            resultType: 'empty'
        };
    }

    if (Array.isArray(data)) {
        return {
            ...base,
            data,
            resultType: 'array',
            resultCount: data.length
        };
    }

    if (typeof data === 'object') {
        return {
            ...base,
            ...data,
            data,
            resultType: 'object'
        };
    }

    return {
        ...base,
        data,
        resultType: typeof data
    };
}

function extractTransactionOperations(apiResult) {
    if (!Array.isArray(apiResult)) {
        return [];
    }

    const operations = [];
    for (const tx of apiResult) {
        if (!tx || typeof tx !== 'object') {
            continue;
        }
        const doOperations = Array.isArray(tx.doOperations) ? tx.doOperations : [];
        for (const op of doOperations) {
            if (op && typeof op === 'object') {
                operations.push(op);
            }
        }
    }
    return operations;
}

function summarizeWriteRequest(fields = {}) {
    const summary = {};
    for (const [key, value] of Object.entries(fields || {})) {
        if (typeof value === 'undefined' || value === null) {
            continue;
        }
        if (typeof value === 'string') {
            if (!value.trim()) {
                continue;
            }
            summary[key] = value;
            continue;
        }
        if (Array.isArray(value)) {
            summary[key] = value;
            continue;
        }
        if (typeof value === 'object') {
            summary[key] = value;
            continue;
        }
        summary[key] = value;
    }
    return summary;
}

function normalizeGeneralWriteResult(operation, request, rawData, extra = {}) {
    const operations = extractTransactionOperations(rawData);
    return {
        success: true,
        state: 'applied',
        operation,
        request: summarizeWriteRequest(request),
        rawData,
        rawResultType: Array.isArray(rawData) ? 'transaction_array' : (rawData === null ? 'empty' : typeof rawData),
        transactionCount: Array.isArray(rawData) ? rawData.length : 0,
        operationCount: operations.length,
        ...extra
    };
}

function createSyntheticNodeId(prefix = 'node') {
    const now = new Date();
    const pad = (value, width = 2) => String(value).padStart(width, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = Math.random().toString(36).slice(2, 9);
    return `${timestamp}-${String(prefix || 'id').slice(0, 3)}${rand.slice(0, 4)}`;
}

async function collectTransactionWriteDocIds(transactions) {
    ensureWriteEnabled();
    const docIds = new Set();
    const avIdsToResolve = new Set();
    const blockIdsToResolve = new Set();

    for (const tx of transactions) {
        const ops = Array.isArray(tx?.doOperations) ? tx.doOperations : [];
        for (const op of ops) {
            if (!op || typeof op !== 'object') {
                continue;
            }

            if (typeof op.avID === 'string' && op.avID.trim()) {
                avIdsToResolve.add(op.avID.trim());
            }
            if (op.action === 'updateAttrViewColRelation' && typeof op.id === 'string' && op.id.trim()) {
                avIdsToResolve.add(op.id.trim());
            }
            if (typeof op.blockID === 'string' && op.blockID.trim()) {
                blockIdsToResolve.add(op.blockID.trim());
            }
            if (op.action === 'doUpdateUpdated' && typeof op.id === 'string' && op.id.trim()) {
                blockIdsToResolve.add(op.id.trim());
            }
        }
    }

    for (const avID of avIdsToResolve) {
        const hosts = await resolveAttributeViewHostBlocks(avID);
        if (hosts.length === 0) {
            throw new Error(`未找到属性视图对应的数据库块: ${avID}`);
        }
        for (const host of hosts) {
            const rootDocId = await ensureBlockReadBeforeWrite(host.blockId, 'transactions/attrview');
            if (isLikelyBlockId(rootDocId)) {
                docIds.add(rootDocId);
            }
        }
    }

    for (const blockId of blockIdsToResolve) {
        if (!isLikelyBlockId(blockId)) {
            continue;
        }
        try {
            const rootDocId = await ensureBlockReadBeforeWrite(blockId, 'transactions/block');
            if (isLikelyBlockId(rootDocId)) {
                docIds.add(rootDocId);
            }
        } catch (_) {
            // Ignore non-block IDs that happen to match the pattern but are not persisted blocks.
        }
    }

    return Array.from(docIds);
}

async function performTransactions(transactions, options = {}) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
        throw new Error('transactions 不能为空');
    }

    const touchedDocIds = await collectTransactionWriteDocIds(transactions);
    const reqId = Date.now();
    const data = await requestSiyuanApi(API_ENDPOINTS.TRANSACTIONS, {
        session: options.session || 'siyuan-notes-skill',
        app: options.app || 'siyuan-notes-skill',
        reqId,
        transactions
    }, { requireAuth: true });

    for (const docId of touchedDocIds) {
        await refreshDocumentVersion(docId);
    }

    return data;
}

async function addAttributeViewRows(payload = {}) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('payload 必须是对象');
    }
    if (!Array.isArray(payload.srcs) || payload.srcs.length === 0) {
        throw new Error('srcs 不能为空');
    }

    const detachedSrcs = payload.srcs.filter((src) => src && src.isDetached !== false);
    const attachedSrcs = payload.srcs.filter((src) => src && src.isDetached === false);
    const calls = [];

    if (detachedSrcs.length > 0) {
        calls.push(await callAttributeViewApi('addAttributeViewBlocks', {
            ...payload,
            srcs: detachedSrcs
        }));
    }

    for (const src of attachedSrcs) {
        calls.push(await callAttributeViewApi('addAttributeViewBlocks', {
            ...payload,
            srcs: [src]
        }));
    }

    return {
        mode: attachedSrcs.length > 1 ? 'split-attached-rows' : 'single-call',
        detachedCount: detachedSrcs.length,
        attachedCount: attachedSrcs.length,
        calls
    };
}

async function addAttributeViewRelationKey(options = {}) {
    const {
        sourceAvID,
        keyID = createSyntheticNodeId('rel'),
        name,
        targetAvID,
        twoWay = false,
        backRelationKeyID = createSyntheticNodeId('rel'),
        backRelationName = '',
        keyIcon = '',
        previousKeyID = ''
    } = options;

    assertNonEmptyString(sourceAvID, 'sourceAvID');
    assertNonEmptyString(name, 'name');
    assertNonEmptyString(targetAvID, 'targetAvID');

    await callAttributeViewApi('addAttributeViewKey', {
        avID: sourceAvID,
        keyID,
        keyName: name,
        keyType: 'relation',
        keyIcon,
        previousKeyID
    });

    const transactions = [{
        doOperations: [{
            action: 'updateAttrViewColRelation',
            avID: sourceAvID,
            keyID,
            id: targetAvID,
            backRelationKeyID: twoWay ? backRelationKeyID : createSyntheticNodeId('rel'),
            isTwoWay: !!twoWay,
            name: backRelationName,
            format: name
        }]
    }];

    await performTransactions(transactions);
    return {
        keyID,
        backRelationKeyID: twoWay ? backRelationKeyID : '',
        transactions
    };
}

async function addAttributeViewRollupKey(options = {}) {
    const {
        avID,
        keyID = createSyntheticNodeId('rol'),
        name,
        relationKeyID,
        targetKeyID,
        calcOperator = ''
    } = options;

    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(name, 'name');
    assertNonEmptyString(relationKeyID, 'relationKeyID');
    assertNonEmptyString(targetKeyID, 'targetKeyID');

    await callAttributeViewApi('addAttributeViewKey', {
        avID,
        keyID,
        keyName: name,
        keyType: 'rollup',
        keyIcon: '',
        previousKeyID: ''
    });

    const data = {};
    if (calcOperator) {
        data.calc = { operator: calcOperator };
    }
    const transactions = [{
        doOperations: [{
            action: 'updateAttrViewColRollup',
            id: keyID,
            avID,
            parentID: relationKeyID,
            keyID: targetKeyID,
            data
        }]
    }];

    await performTransactions(transactions);
    return {
        keyID,
        transactions
    };
}

function flattenAttributeViewRows(view) {
    const rows = [];
    if (Array.isArray(view?.rows)) {
        rows.push(...view.rows);
    }
    if (Array.isArray(view?.groups)) {
        for (const group of view.groups) {
            rows.push(...flattenAttributeViewRows(group));
        }
    }
    return rows;
}

async function getAttributeViewRowAndCell(avID, keyID, itemID) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(keyID, 'keyID');
    assertNonEmptyString(itemID, 'itemID');

    const rendered = await callAttributeViewApi('renderAttributeView', {
        id: avID,
        pageSize: -1
    });
    const rows = flattenAttributeViewRows(rendered.view);
    const row = rows.find((candidate) => candidate && candidate.id === itemID);
    if (!row) {
        throw new Error(`未找到属性视图行: ${itemID}`);
    }

    const cell = (row.cells || []).find((candidate) => candidate?.value?.keyID === keyID);
    if (!cell || !cell.value) {
        throw new Error(`未找到属性视图单元格: row=${itemID}, key=${keyID}`);
    }

    return {
        rendered,
        row,
        cell
    };
}

function normalizeAttributeViewTextValue(value) {
    return String(value ?? '');
}

function buildAttributeViewTextCellValue(baseValue, keyID, itemID, text) {
    const value = JSON.parse(JSON.stringify(baseValue || {}));
    value.type = 'text';
    value.keyID = keyID;
    value.blockID = itemID;
    value.text = {
        content: normalizeAttributeViewTextValue(text)
    };
    return value;
}

function buildAttributeViewNumberCellValue(baseValue, keyID, itemID, numberValue, { clear = false } = {}) {
    const value = JSON.parse(JSON.stringify(baseValue || {}));
    value.type = 'number';
    value.keyID = keyID;
    value.blockID = itemID;
    if (clear) {
        value.number = {
            content: 0,
            isNotEmpty: false
        };
        return value;
    }

    const parsed = typeof numberValue === 'number' ? numberValue : Number(String(numberValue || '').trim());
    if (!Number.isFinite(parsed)) {
        throw new Error(`无效数字: ${numberValue}`);
    }

    value.number = {
        content: parsed,
        isNotEmpty: true
    };
    return value;
}

function parseAttributeViewDateInput(input) {
    const raw = String(input || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
    if (!match) {
        throw new Error(`无效日期格式: ${input}，支持 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm[:ss]`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4] || 0);
    const minute = Number(match[5] || 0);
    const second = Number(match[6] || 0);
    const date = new Date(year, month - 1, day, hour, minute, second, 0);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute ||
        date.getSeconds() !== second
    ) {
        throw new Error(`无效日期值: ${input}`);
    }

    return {
        millis: date.getTime(),
        isNotTime: typeof match[4] === 'undefined'
    };
}

function buildAttributeViewDateCellValue(baseValue, keyID, itemID, dateInput, { clear = false } = {}) {
    const value = JSON.parse(JSON.stringify(baseValue || {}));
    value.type = 'date';
    value.keyID = keyID;
    value.blockID = itemID;
    if (clear) {
        value.date = {
            content: 0,
            isNotEmpty: false,
            content2: 0,
            isNotEmpty2: false,
            hasEndDate: false,
            isNotTime: true,
            formattedContent: ''
        };
        return value;
    }

    const normalized = parseAttributeViewDateInput(dateInput);
    value.date = {
        content: normalized.millis,
        isNotEmpty: true,
        content2: 0,
        isNotEmpty2: false,
        hasEndDate: false,
        isNotTime: normalized.isNotTime,
        formattedContent: ''
    };
    return value;
}

function buildAttributeViewSelectCellValue(baseValue, keyID, itemID, optionName, { color = '1', clear = false } = {}) {
    const value = JSON.parse(JSON.stringify(baseValue || {}));
    value.type = 'select';
    value.keyID = keyID;
    value.blockID = itemID;
    if (clear) {
        value.mSelect = [];
        return value;
    }

    const normalizedName = String(optionName || '').trim();
    if (!normalizedName) {
        throw new Error('select 值不能为空');
    }

    value.mSelect = [{
        content: normalizedName,
        color: String(color || '1')
    }];
    return value;
}

function cloneJsonValue(value) {
    if (typeof value === 'undefined') {
        return undefined;
    }
    return JSON.parse(JSON.stringify(value));
}

function parseBooleanLike(value, fieldName = '布尔值') {
    if (typeof value === 'boolean') {
        return value;
    }

    const raw = String(value ?? '').trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on', 'checked', '是'].includes(raw)) {
        return true;
    }
    if (['false', '0', 'no', 'n', 'off', 'unchecked', '否'].includes(raw)) {
        return false;
    }
    throw new Error(`${fieldName} 必须是 true/false`);
}

function normalizeAttributeViewColumnOption(option, { defaultColor = '1' } = {}) {
    if (typeof option === 'string') {
        const name = option.trim();
        if (!name) {
            throw new Error('选项名不能为空');
        }
        return {
            name,
            color: String(defaultColor || '1')
        };
    }

    if (!option || typeof option !== 'object') {
        throw new Error('选项必须是字符串或对象');
    }

    const name = String(option.name ?? option.content ?? '').trim();
    if (!name) {
        throw new Error('选项名不能为空');
    }

    const normalized = {
        name,
        color: String(option.color ?? defaultColor ?? '1')
    };
    const desc = String(option.desc ?? '').trim();
    if (desc) {
        normalized.desc = desc;
    }
    return normalized;
}

function normalizeAttributeViewSelectValues(options, { defaultColor = '1' } = {}) {
    if (!Array.isArray(options)) {
        throw new Error('options 必须是数组');
    }

    const normalized = [];
    const seen = new Set();
    for (const option of options) {
        const normalizedOption = normalizeAttributeViewColumnOption(option, { defaultColor });
        if (seen.has(normalizedOption.name)) {
            continue;
        }
        seen.add(normalizedOption.name);
        normalized.push({
            content: normalizedOption.name,
            color: normalizedOption.color
        });
    }
    return normalized;
}

function buildAttributeViewCheckboxCellValue(baseValue, keyID, itemID, checked) {
    const value = cloneJsonValue(baseValue || {});
    value.type = 'checkbox';
    value.keyID = keyID;
    value.blockID = itemID;
    value.checkbox = {
        checked: parseBooleanLike(checked, 'checkbox')
    };
    return value;
}

function buildAttributeViewMultiSelectCellValue(baseValue, keyID, itemID, options, { clear = false, defaultColor = '1' } = {}) {
    const value = cloneJsonValue(baseValue || {});
    value.type = 'mSelect';
    value.keyID = keyID;
    value.blockID = itemID;
    if (clear) {
        value.mSelect = [];
        return value;
    }

    const normalized = normalizeAttributeViewSelectValues(options, { defaultColor });
    if (normalized.length === 0) {
        throw new Error('mSelect 值不能为空');
    }
    value.mSelect = normalized;
    return value;
}

function buildAttributeViewStringCellValue(type, fieldName, baseValue, keyID, itemID, content) {
    const value = cloneJsonValue(baseValue || {});
    value.type = type;
    value.keyID = keyID;
    value.blockID = itemID;
    value[fieldName] = {
        content: String(content ?? '')
    };
    return value;
}

function inferAssetEntryType(assetPath) {
    const ext = path.extname(String(assetPath || '')).toLowerCase();
    if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(ext)) {
        return 'image';
    }
    return 'file';
}

async function resolveAssetCellEntries(sources, options = {}) {
    if (!Array.isArray(sources) || sources.length === 0) {
        throw new Error('sources 不能为空');
    }

    const entries = [];
    const uploadedPaths = [];
    for (const rawSource of sources) {
        const source = String(rawSource || '').trim();
        if (!source) {
            continue;
        }

        const resolvedPath = path.resolve(source);
        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
            const upload = await uploadAssets([resolvedPath], {
                assetsDirPath: options.assetsDirPath || '',
                skipIfDuplicated: !!options.skipIfDuplicated
            });
            const assetPath = Object.values(upload.succMap || {}).map((item) => String(item || '').trim()).find(Boolean);
            if (!assetPath) {
                throw new Error(`资源上传成功但未返回路径: ${resolvedPath}`);
            }
            uploadedPaths.push(assetPath);
            entries.push({
                content: assetPath,
                name: path.basename(assetPath),
                type: inferAssetEntryType(assetPath)
            });
            continue;
        }

        entries.push({
            content: source,
            name: path.basename(source),
            type: inferAssetEntryType(source)
        });
    }

    if (entries.length === 0) {
        throw new Error('未解析到任何资源');
    }

    return {
        entries,
        uploadedPaths
    };
}

function buildAttributeViewAssetCellValue(baseValue, keyID, itemID, assets, { clear = false } = {}) {
    const value = cloneJsonValue(baseValue || {});
    value.type = 'mAsset';
    value.keyID = keyID;
    value.blockID = itemID;
    if (clear) {
        value.mAsset = [];
        return value;
    }

    if (!Array.isArray(assets) || assets.length === 0) {
        throw new Error('assets 不能为空');
    }

    value.mAsset = assets.map((asset) => ({
        content: String(asset.content || '').trim(),
        name: String(asset.name || path.basename(String(asset.content || '')) || '').trim(),
        type: asset.type === 'image' ? 'image' : 'file'
    })).filter((asset) => asset.content && asset.name);
    if (value.mAsset.length === 0) {
        throw new Error('assets 不能为空');
    }
    return value;
}

async function getBlockCellSourceInfo(blockId) {
    assertNonEmptyString(blockId, 'blockId');
    const rows = await executeSiyuanQueryRaw(`
        SELECT id, content
        FROM blocks
        WHERE id = '${escapeSqlValue(blockId)}'
        LIMIT 1
    `);
    if (!rows.length) {
        throw new Error(`未找到目标块: ${blockId}`);
    }

    return {
        id: rows[0].id,
        content: rows[0].content || ''
    };
}

function buildAttributeViewBlockCellValue(baseValue, keyID, itemID, blockInfo, { clear = false } = {}) {
    const value = cloneJsonValue(baseValue || {});
    value.type = 'block';
    value.keyID = keyID;
    value.blockID = itemID;
    if (clear) {
        value.block = {
            id: '',
            content: ''
        };
        return value;
    }

    value.block = {
        id: String(blockInfo?.id || '').trim(),
        content: String(blockInfo?.content || '')
    };
    if (blockInfo?.icon) {
        value.block.icon = String(blockInfo.icon);
    }
    return value;
}

async function getAttributeViewDefinition(avID) {
    assertNonEmptyString(avID, 'avID');
    const data = await callAttributeViewApi('getAttributeView', { id: avID });
    const attributeView = data?.av || data;
    if (!attributeView || typeof attributeView !== 'object') {
        throw new Error(`未找到属性视图定义: ${avID}`);
    }
    return attributeView;
}

async function getAttributeViewKeyDetails(avID, keyID) {
    assertNonEmptyString(keyID, 'keyID');
    const attributeView = await getAttributeViewDefinition(avID);
    const keyValues = Array.isArray(attributeView.keyValues) ? attributeView.keyValues : [];
    const keyValue = keyValues.find((item) => item?.key?.id === keyID);
    if (!keyValue?.key) {
        throw new Error(`未找到属性视图字段: ${keyID}`);
    }
    return {
        attributeView,
        keyValue,
        key: keyValue.key
    };
}

async function getAttributeViewViewDetails(avID, viewID) {
    assertNonEmptyString(viewID, 'viewID');
    const attributeView = await getAttributeViewDefinition(avID);
    const views = Array.isArray(attributeView.views) ? attributeView.views : [];
    const view = views.find((item) => item?.id === viewID);
    if (!view) {
        throw new Error(`未找到属性视图视图: ${viewID}`);
    }
    return {
        attributeView,
        view
    };
}

async function discoverAttributeViewsInDocument(docId) {
    assertNonEmptyString(docId, 'docId');
    await ensureDocumentAccessAllowed(docId, 'discoverAttributeViewsInDocument', 'read');
    const blocks = await getDocumentBlocks(docId);
    const results = [];
    for (const block of blocks) {
        if (!block || block.type !== 'av') {
            continue;
        }
        const markdown = String(block.markdown || '');
        const avID = /data-av-id="([^"]+)"/.exec(markdown)?.[1] || '';
        if (!avID) {
            continue;
        }
        results.push({
            docId,
            blockId: block.id,
            avID,
            markdown
        });
    }
    return results;
}

async function resolvePrimaryAttributeViewBlockID(avID) {
    const hosts = await resolveAttributeViewHostBlocks(avID);
    if (hosts.length === 0) {
        throw new Error(`未找到属性视图对应的数据库块: ${avID}`);
    }
    return hosts[0].blockId;
}

async function resolveAttributeViewBlockContext(avID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    let blockID = String(options.blockID || '').trim();
    if (!blockID) {
        blockID = await resolvePrimaryAttributeViewBlockID(avID);
    }

    const viewID = String(options.viewID || '').trim();
    if (viewID) {
        await callAttributeViewApi('setDatabaseBlockView', {
            id: blockID,
            avID,
            viewID
        });
    }

    return {
        blockID,
        viewID
    };
}

function normalizeCardSize(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === '0' || raw === 'small') {
        return 0;
    }
    if (raw === '1' || raw === 'medium') {
        return 1;
    }
    if (raw === '2' || raw === 'large') {
        return 2;
    }
    throw new Error(`无效卡片尺寸: ${value}`);
}

function normalizeCardAspectRatio(value) {
    const raw = String(value || '').trim();
    const map = new Map([
        ['16:9', 0],
        ['9:16', 1],
        ['4:3', 2],
        ['3:4', 3],
        ['3:2', 4],
        ['2:3', 5],
        ['1:1', 6],
        ['0', 0],
        ['1', 1],
        ['2', 2],
        ['3', 3],
        ['4', 4],
        ['5', 5],
        ['6', 6]
    ]);
    if (!map.has(raw)) {
        throw new Error(`无效卡片比例: ${value}`);
    }
    return map.get(raw);
}

function normalizeCoverFrom(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['0', 'none'].includes(raw)) {
        return 0;
    }
    if (['1', 'content-image', 'image', 'contentimage'].includes(raw)) {
        return 1;
    }
    if (['2', 'asset', 'asset-field', 'assetfield'].includes(raw)) {
        return 2;
    }
    if (['3', 'content-block', 'block', 'contentblock'].includes(raw)) {
        return 3;
    }
    throw new Error(`无效封面来源: ${value}`);
}

async function getAttributeViewCellBaseValue(avID, keyID, itemID) {
    const { key } = await getAttributeViewKeyDetails(avID, keyID);
    try {
        const { cell } = await getAttributeViewRowAndCell(avID, keyID, itemID);
        return {
            key,
            value: cloneJsonValue(cell.value || {})
        };
    } catch (error) {
        if (
            error &&
            typeof error.message === 'string' &&
            (error.message.startsWith('未找到属性视图行:') || error.message.startsWith('未找到属性视图单元格:'))
        ) {
            return {
                key,
                value: {
                    keyID,
                    blockID: itemID,
                    type: key.type
                }
            };
        }
        throw error;
    }
}

async function setAttributeViewTextCell(avID, keyID, itemID, text) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const value = buildAttributeViewTextCellValue(baseValue, keyID, itemID, text);
    return await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
}

async function setAttributeViewNumberCell(avID, keyID, itemID, numberValue, options = {}) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const value = buildAttributeViewNumberCellValue(baseValue, keyID, itemID, numberValue, options);
    return await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
}

async function setAttributeViewDateCell(avID, keyID, itemID, dateInput, options = {}) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const value = buildAttributeViewDateCellValue(baseValue, keyID, itemID, dateInput, options);
    return await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
}

async function setAttributeViewSelectCell(avID, keyID, itemID, optionName, options = {}) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const value = buildAttributeViewSelectCellValue(baseValue, keyID, itemID, optionName, options);
    return await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
}

async function addAttributeViewDocRows(avID, docIds, options = {}) {
    assertNonEmptyString(avID, 'avID');
    if (!Array.isArray(docIds) || docIds.length === 0) {
        throw new Error('docIds 不能为空');
    }

    const uniqueDocIds = [...new Set(docIds.map((item) => String(item || '').trim()).filter(Boolean))];
    if (uniqueDocIds.length === 0) {
        throw new Error('docIds 不能为空');
    }

    const safeIds = uniqueDocIds.map((id) => `'${escapeSqlValue(id)}'`).join(', ');
    const rows = await executeSiyuanQueryRaw(`
        SELECT id, type
        FROM blocks
        WHERE id IN (${safeIds})
    `);
    const typeMap = new Map(rows.map((row) => [row.id, row.type]));
    for (const docId of uniqueDocIds) {
        if (typeMap.get(docId) !== 'd') {
            throw new Error(`目标不是文档块或不存在: ${docId}`);
        }
    }

    let blockID = String(options.blockID || '').trim();
    if (!blockID) {
        const hosts = await resolveAttributeViewHostBlocks(avID);
        if (hosts.length === 0) {
            throw new Error(`未找到属性视图对应的数据库块: ${avID}`);
        }
        blockID = hosts[0].blockId;
    }

    const srcs = uniqueDocIds.map((docId) => ({
        itemID: createSyntheticNodeId('row'),
        id: docId,
        isDetached: false
    }));

    return await addAttributeViewRows({
        avID,
        blockID,
        viewID: options.viewID || '',
        groupID: options.groupID || '',
        previousID: options.previousID || '',
        ignoreDefaultFill: !!options.ignoreDefaultFill,
        srcs
    });
}

async function setAttributeViewRelationCell(options = {}) {
    const {
        avID,
        keyID,
        itemID,
        targetAvID,
        targetRowIDs
    } = options;

    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(keyID, 'keyID');
    assertNonEmptyString(itemID, 'itemID');
    assertNonEmptyString(targetAvID, 'targetAvID');
    if (!Array.isArray(targetRowIDs) || targetRowIDs.length === 0) {
        throw new Error('targetRowIDs 不能为空');
    }

    const rendered = await callAttributeViewApi('renderAttributeView', {
        id: targetAvID,
        pageSize: -1
    });
    const rows = flattenAttributeViewRows(rendered.view);
    const rowMap = new Map(rows.map((row) => [row.id, row]));
    const blockIDs = [];
    const contents = [];

    for (const rowID of targetRowIDs) {
        const row = rowMap.get(rowID);
        if (!row) {
            throw new Error(`未找到关系目标行: ${rowID}`);
        }
        const blockCell = (row.cells || []).find((cell) => cell.valueType === 'block');
        if (!blockCell || !blockCell.value) {
            throw new Error(`关系目标行缺少主键块单元格: ${rowID}`);
        }
        blockIDs.push(rowID);
        contents.push({
            type: 'block',
            block: {
                id: blockCell.value.block?.id,
                content: blockCell.value.block?.content || ''
            },
            isDetached: !!blockCell.value.isDetached
        });
    }

    return await callAttributeViewApi('setAttributeViewBlockAttr', {
        avID,
        keyID,
        itemID,
        value: {
            type: 'relation',
            relation: {
                blockIDs,
                contents
            }
        }
    });
}

async function clearAttributeViewRelationCell(avID, keyID, itemID) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(keyID, 'keyID');
    assertNonEmptyString(itemID, 'itemID');
    return await callAttributeViewApi('setAttributeViewBlockAttr', {
        avID,
        keyID,
        itemID,
        value: {
            type: 'relation',
            relation: {
                blockIDs: [],
                contents: []
            }
        }
    });
}

async function setAttributeViewCheckboxCell(avID, keyID, itemID, checked) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const value = buildAttributeViewCheckboxCellValue(baseValue, keyID, itemID, checked);
    return await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
}

async function setAttributeViewMultiSelectCell(avID, keyID, itemID, optionValues, options = {}) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const value = buildAttributeViewMultiSelectCellValue(baseValue, keyID, itemID, optionValues, options);
    return await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
}

async function setAttributeViewUrlCell(avID, keyID, itemID, urlValue) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const value = buildAttributeViewStringCellValue('url', 'url', baseValue, keyID, itemID, urlValue);
    return await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
}

async function setAttributeViewEmailCell(avID, keyID, itemID, emailValue) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const value = buildAttributeViewStringCellValue('email', 'email', baseValue, keyID, itemID, emailValue);
    return await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
}

async function setAttributeViewPhoneCell(avID, keyID, itemID, phoneValue) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const value = buildAttributeViewStringCellValue('phone', 'phone', baseValue, keyID, itemID, phoneValue);
    return await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
}

async function setAttributeViewTemplateCell(avID, keyID, templateValue) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(keyID, 'keyID');
    await performTransactions([{
        doOperations: [{
            action: 'updateAttrViewColTemplate',
            avID,
            id: keyID,
            data: String(templateValue || ''),
            type: 'template'
        }]
    }]);
    return {
        avID,
        keyID,
        template: String(templateValue || '')
    };
}

async function setAttributeViewAssetCell(avID, keyID, itemID, sources, options = {}) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const resolved = options.clear ? { entries: [], uploadedPaths: [] } : await resolveAssetCellEntries(sources, options);
    const value = buildAttributeViewAssetCellValue(baseValue, keyID, itemID, resolved.entries, options);
    const result = await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
    return {
        result,
        uploadedPaths: resolved.uploadedPaths,
        assets: resolved.entries
    };
}

async function setAttributeViewBlockCell(avID, keyID, itemID, sourceBlockID, options = {}) {
    const { value: baseValue } = await getAttributeViewCellBaseValue(avID, keyID, itemID);
    const blockInfo = options.clear
        ? null
        : {
            ...(await getBlockCellSourceInfo(sourceBlockID)),
            ...(options.content ? { content: String(options.content) } : {})
        };
    const value = buildAttributeViewBlockCellValue(baseValue, keyID, itemID, blockInfo, options);
    return await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
}

async function addAttributeViewOption(avID, keyID, option) {
    const { key } = await getAttributeViewKeyDetails(avID, keyID);
    if (!['select', 'mSelect'].includes(key.type)) {
        throw new Error(`字段 ${keyID} 不是 select/mSelect: ${key.type}`);
    }

    const existing = Array.isArray(key.options) ? cloneJsonValue(key.options) : [];
    const normalized = normalizeAttributeViewColumnOption(option, {
        defaultColor: String((existing.length % 14) + 1)
    });
    if (existing.some((item) => item?.name === normalized.name)) {
        throw new Error(`选项已存在: ${normalized.name}`);
    }

    existing.push(normalized);
    await performTransactions([{
        doOperations: [{
            action: 'updateAttrViewColOptions',
            avID,
            id: keyID,
            data: existing
        }]
    }]);
    return {
        keyID,
        option: normalized,
        options: existing
    };
}

async function updateAttributeViewOption(avID, keyID, oldName, option) {
    const { key } = await getAttributeViewKeyDetails(avID, keyID);
    if (!['select', 'mSelect'].includes(key.type)) {
        throw new Error(`字段 ${keyID} 不是 select/mSelect: ${key.type}`);
    }

    assertNonEmptyString(oldName, 'oldName');
    const normalized = normalizeAttributeViewColumnOption(option);
    await performTransactions([{
        doOperations: [{
            action: 'updateAttrViewColOption',
            avID,
            id: keyID,
            data: {
                oldName,
                newName: normalized.name,
                newColor: normalized.color,
                newDesc: normalized.desc || ''
            }
        }]
    }]);
    return {
        keyID,
        oldName,
        option: normalized
    };
}

async function removeAttributeViewOption(avID, keyID, optionName) {
    const { key } = await getAttributeViewKeyDetails(avID, keyID);
    if (!['select', 'mSelect'].includes(key.type)) {
        throw new Error(`字段 ${keyID} 不是 select/mSelect: ${key.type}`);
    }

    assertNonEmptyString(optionName, 'optionName');
    await performTransactions([{
        doOperations: [{
            action: 'removeAttrViewColOption',
            avID,
            id: keyID,
            data: optionName
        }]
    }]);
    return {
        keyID,
        optionName
    };
}

async function updateAttributeViewRelationKey(options = {}) {
    const {
        avID,
        keyID,
        targetAvID = '',
        twoWay,
        backRelationKeyID = '',
        backRelationName = '',
        columnName = ''
    } = options;

    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(keyID, 'keyID');
    const { key } = await getAttributeViewKeyDetails(avID, keyID);
    if (key.type !== 'relation') {
        throw new Error(`字段 ${keyID} 不是 relation: ${key.type}`);
    }

    const currentRelation = key.relation || {};
    const resolvedTargetAvID = String(targetAvID || currentRelation.avID || '').trim();
    if (!resolvedTargetAvID) {
        throw new Error(`relation 字段 ${keyID} 缺少目标属性视图`);
    }

    const operation = {
        action: 'updateAttrViewColRelation',
        avID,
        keyID,
        id: resolvedTargetAvID,
        backRelationKeyID: String(backRelationKeyID || currentRelation.backKeyID || createSyntheticNodeId('rel')),
        isTwoWay: typeof twoWay === 'boolean' ? twoWay : !!currentRelation.isTwoWay,
        name: String(backRelationName || ''),
        format: String(columnName || key.name || '')
    };

    await performTransactions([{ doOperations: [operation] }]);
    return operation;
}

async function updateAttributeViewRollupKey(options = {}) {
    const {
        avID,
        keyID,
        relationKeyID = '',
        targetKeyID = '',
        calcOperator = '',
        clearCalc = false
    } = options;

    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(keyID, 'keyID');
    const { key } = await getAttributeViewKeyDetails(avID, keyID);
    if (key.type !== 'rollup') {
        throw new Error(`字段 ${keyID} 不是 rollup: ${key.type}`);
    }

    const currentRollup = key.rollup || {};
    const parentID = String(relationKeyID || currentRollup.relationKeyID || '').trim();
    const destKeyID = String(targetKeyID || currentRollup.keyID || '').trim();
    if (!parentID || !destKeyID) {
        throw new Error(`rollup 字段 ${keyID} 缺少 relationKeyID 或 targetKeyID`);
    }

    const data = {};
    if (!clearCalc) {
        const currentOperator = currentRollup.calc?.operator || '';
        const operator = String(calcOperator || currentOperator || '').trim();
        if (operator) {
            data.calc = { operator };
        }
    }

    const operation = {
        action: 'updateAttrViewColRollup',
        avID,
        id: keyID,
        parentID,
        keyID: destKeyID,
        data
    };
    await performTransactions([{ doOperations: [operation] }]);
    return operation;
}

async function getAttributeViewFilterSortState(avID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const payload = {
        id: avID,
        blockID
    };
    return await callAttributeViewApi('getAttributeViewFilterSort', payload);
}

async function setAttributeViewFilters(avID, filters, options = {}) {
    assertNonEmptyString(avID, 'avID');
    if (!Array.isArray(filters)) {
        throw new Error('filters 必须是数组');
    }
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewFilters',
            avID,
            blockID,
            data: filters
        }]
    }]);
    return { avID, blockID, filters };
}

async function setAttributeViewSorts(avID, sorts, options = {}) {
    assertNonEmptyString(avID, 'avID');
    if (!Array.isArray(sorts)) {
        throw new Error('sorts 必须是数组');
    }
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewSorts',
            avID,
            blockID,
            data: sorts
        }]
    }]);
    return { avID, blockID, sorts };
}

async function setAttributeViewGroup(avID, group, options = {}) {
    assertNonEmptyString(avID, 'avID');
    if (!group || typeof group !== 'object') {
        throw new Error('group 必须是对象');
    }
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    return await callAttributeViewApi('setAttrViewGroup', {
        avID,
        blockID,
        group
    });
}

async function resolveAttributeViewGroupContext(avID, groupID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(groupID, 'groupID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const rendered = await callAttributeViewApi('renderAttributeView', {
        id: avID,
        blockID,
        pageSize: -1
    });
    const groups = Array.isArray(rendered?.view?.groups) ? rendered.view.groups : [];
    const group = groups.find((item) => item && item.id === groupID);
    if (!group) {
        throw new Error(`未找到属性视图分组: ${groupID}`);
    }
    return {
        blockID,
        rendered,
        groups,
        group
    };
}

async function removeAttributeViewGroup(avID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    await performTransactions([{
        doOperations: [{
            action: 'removeAttrViewGroup',
            avID,
            blockID
        }]
    }]);
    return { avID, blockID };
}

async function hideAttributeViewGroup(avID, groupID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(groupID, 'groupID');
    const { blockID } = await resolveAttributeViewGroupContext(avID, groupID, options);
    const hidden = options.hidden === true;
    await performTransactions([{
        doOperations: [{
            action: 'hideAttrViewGroup',
            avID,
            blockID,
            id: groupID,
            data: hidden ? 2 : 0
        }]
    }]);
    return { avID, blockID, groupID, hidden };
}

async function hideAllAttributeViewGroups(avID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const hidden = options.hidden !== false;
    await performTransactions([{
        doOperations: [{
            action: 'hideAttrViewAllGroups',
            avID,
            blockID,
            data: hidden
        }]
    }]);
    return { avID, blockID, hidden };
}

async function sortAttributeViewGroup(avID, groupID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(groupID, 'groupID');
    const { blockID, groups } = await resolveAttributeViewGroupContext(avID, groupID, options);
    const previousID = String(options.previousID || '');
    if (previousID && !groups.some((group) => group && group.id === previousID)) {
        throw new Error(`未找到前置分组: ${previousID}`);
    }
    await performTransactions([{
        doOperations: [{
            action: 'sortAttrViewGroup',
            avID,
            blockID,
            id: groupID,
            previousID
        }]
    }]);
    return {
        avID,
        blockID,
        groupID,
        previousID
    };
}

async function foldAttributeViewGroup(avID, groupID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(groupID, 'groupID');
    const { blockID } = await resolveAttributeViewGroupContext(avID, groupID, options);
    const folded = options.folded !== false;
    await performTransactions([{
        doOperations: [{
            action: 'foldAttrViewGroup',
            avID,
            blockID,
            id: groupID,
            data: folded
        }]
    }]);
    return { avID, blockID, groupID, folded };
}

async function addAttributeViewView(avID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const blockID = String(options.blockID || '').trim() || await resolvePrimaryAttributeViewBlockID(avID);
    const viewID = String(options.viewID || createSyntheticNodeId('view')).trim();
    const layout = String(options.layout || '').trim();
    const operation = {
        action: 'addAttrViewView',
        avID,
        id: viewID,
        blockID
    };
    if (layout) {
        operation.layout = layout;
    }
    await performTransactions([{ doOperations: [operation] }]);
    return {
        avID,
        blockID,
        viewID,
        layout: layout || 'table'
    };
}

async function removeAttributeViewView(avID, viewID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(viewID, 'viewID');
    const blockID = String(options.blockID || '').trim() || await resolvePrimaryAttributeViewBlockID(avID);
    await callAttributeViewApi('setDatabaseBlockView', {
        id: blockID,
        avID,
        viewID
    });
    await performTransactions([{
        doOperations: [{
            action: 'removeAttrViewView',
            avID,
            id: viewID,
            blockID
        }]
    }]);
    return { avID, blockID, viewID };
}

async function renameAttributeViewView(avID, viewID, name) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(viewID, 'viewID');
    assertNonEmptyString(name, 'name');
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewViewName',
            avID,
            id: viewID,
            data: name
        }]
    }]);
    return { avID, viewID, name };
}

async function setAttributeViewViewIcon(avID, viewID, icon) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(viewID, 'viewID');
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewViewIcon',
            avID,
            id: viewID,
            data: String(icon || '')
        }]
    }]);
    return { avID, viewID, icon: String(icon || '') };
}

async function setAttributeViewViewDesc(avID, viewID, desc) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(viewID, 'viewID');
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewViewDesc',
            avID,
            id: viewID,
            data: String(desc || '')
        }]
    }]);
    return { avID, viewID, desc: String(desc || '') };
}

async function duplicateAttributeViewView(avID, sourceViewID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(sourceViewID, 'sourceViewID');
    const blockID = String(options.blockID || '').trim() || await resolvePrimaryAttributeViewBlockID(avID);
    const viewID = String(options.viewID || createSyntheticNodeId('view')).trim();
    await performTransactions([{
        doOperations: [{
            action: 'duplicateAttrViewView',
            avID,
            previousID: sourceViewID,
            id: viewID,
            blockID
        }]
    }]);
    return { avID, blockID, sourceViewID, viewID };
}

async function sortAttributeViewView(avID, viewID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(viewID, 'viewID');
    const operation = {
        action: 'sortAttrViewView',
        avID,
        id: viewID,
        previousID: String(options.previousID || '')
    };
    if (options.unRefresh) {
        operation.data = 'unRefresh';
    }
    await performTransactions([{ doOperations: [operation] }]);
    return operation;
}

async function setAttributeViewPageSize(avID, pageSize, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const size = Number(pageSize);
    if (!Number.isFinite(size) || size < 1) {
        throw new Error(`无效 pageSize: ${pageSize}`);
    }
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewPageSize',
            avID,
            blockID,
            data: size
        }]
    }]);
    return { avID, blockID, pageSize: size };
}

async function hideAttributeViewName(avID, hidden, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const value = parseBooleanLike(hidden, 'hidden');
    await performTransactions([{
        doOperations: [{
            action: 'hideAttrViewName',
            avID,
            blockID,
            viewID: String(options.viewID || ''),
            data: value
        }]
    }]);
    return { avID, blockID, hidden: value };
}

async function setAttributeViewShowIcon(avID, show, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const value = parseBooleanLike(show, 'showIcon');
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewShowIcon',
            avID,
            blockID,
            viewID: String(options.viewID || ''),
            data: value
        }]
    }]);
    return { avID, blockID, show: value };
}

async function setAttributeViewWrapField(avID, wrap, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const value = parseBooleanLike(wrap, 'wrapField');
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewWrapField',
            avID,
            blockID,
            viewID: String(options.viewID || ''),
            data: value
        }]
    }]);
    return { avID, blockID, wrap: value };
}

async function setAttributeViewFitImage(avID, enabled, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const value = parseBooleanLike(enabled, 'fitImage');
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewFitImage',
            avID,
            blockID,
            viewID: String(options.viewID || ''),
            data: value
        }]
    }]);
    return { avID, blockID, fitImage: value };
}

async function setAttributeViewDisplayFieldName(avID, enabled, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const value = parseBooleanLike(enabled, 'displayFieldName');
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewDisplayFieldName',
            avID,
            blockID,
            data: value
        }]
    }]);
    return { avID, blockID, displayFieldName: value };
}

async function setAttributeViewFillColBackgroundColor(avID, enabled, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const value = parseBooleanLike(enabled, 'fillColBackgroundColor');
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewFillColBackgroundColor',
            avID,
            blockID,
            viewID: String(options.viewID || ''),
            data: value
        }]
    }]);
    return { avID, blockID, fillColBackgroundColor: value };
}

async function setAttributeViewCardSize(avID, cardSize, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const value = normalizeCardSize(cardSize);
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewCardSize',
            avID,
            blockID,
            viewID: String(options.viewID || ''),
            data: value
        }]
    }]);
    return { avID, blockID, cardSize: value };
}

async function setAttributeViewCardAspectRatio(avID, ratio, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const value = normalizeCardAspectRatio(ratio);
    await performTransactions([{
        doOperations: [{
            action: 'setAttrViewCardAspectRatio',
            avID,
            blockID,
            viewID: String(options.viewID || ''),
            data: value
        }]
    }]);
    return { avID, blockID, cardAspectRatio: value };
}

async function setAttributeViewCoverFrom(avID, coverFrom, options = {}) {
    assertNonEmptyString(avID, 'avID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const mode = normalizeCoverFrom(coverFrom);
    const operations = [{
        action: 'setAttrViewCoverFrom',
        avID,
        blockID,
        data: mode
    }];
    if (mode === 2) {
        assertNonEmptyString(String(options.assetKeyID || ''), 'assetKeyID');
        operations.push({
            action: 'setAttrViewCoverFromAssetKeyID',
            avID,
            blockID,
            keyID: String(options.assetKeyID || '').trim()
        });
    }
    await performTransactions([{ doOperations: operations }]);
    return {
        avID,
        blockID,
        coverFrom: mode,
        assetKeyID: String(options.assetKeyID || '').trim()
    };
}

async function sortAttributeViewRow(avID, itemID, options = {}) {
    assertNonEmptyString(avID, 'avID');
    assertNonEmptyString(itemID, 'itemID');
    const { blockID } = await resolveAttributeViewBlockContext(avID, options);
    const operation = {
        action: 'sortAttrViewRow',
        avID,
        blockID,
        id: itemID,
        previousID: String(options.previousID || ''),
        groupID: String(options.groupID || ''),
        targetGroupID: String(options.targetGroupID || '')
    };
    await performTransactions([{ doOperations: [operation] }]);
    return operation;
}

async function addAttributeViewBlockRows(avID, blockIds, options = {}) {
    assertNonEmptyString(avID, 'avID');
    if (!Array.isArray(blockIds) || blockIds.length === 0) {
        throw new Error('blockIds 不能为空');
    }

    const uniqueBlockIds = [...new Set(blockIds.map((item) => String(item || '').trim()).filter(Boolean))];
    if (uniqueBlockIds.length === 0) {
        throw new Error('blockIds 不能为空');
    }

    const safeIds = uniqueBlockIds.map((id) => `'${escapeSqlValue(id)}'`).join(', ');
    const rows = await executeSiyuanQueryRaw(`
        SELECT id
        FROM blocks
        WHERE id IN (${safeIds})
    `);
    const existingIds = new Set(rows.map((row) => row.id));
    for (const blockId of uniqueBlockIds) {
        if (!existingIds.has(blockId)) {
            throw new Error(`目标块不存在: ${blockId}`);
        }
    }

    let blockID = String(options.blockID || '').trim();
    if (!blockID) {
        blockID = await resolvePrimaryAttributeViewBlockID(avID);
    }

    const srcs = uniqueBlockIds.map((blockId) => ({
        itemID: createSyntheticNodeId('row'),
        id: blockId,
        isDetached: false
    }));
    return await addAttributeViewRows({
        avID,
        blockID,
        viewID: options.viewID || '',
        groupID: options.groupID || '',
        previousID: options.previousID || '',
        ignoreDefaultFill: !!options.ignoreDefaultFill,
        srcs
    });
}

async function uploadAssets(filePaths, options = {}) {
    ensureWriteEnabled();
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        throw new Error('filePaths 不能为空');
    }

    const formData = new FormData();
    if (options.assetsDirPath) {
        formData.append('assetsDirPath', String(options.assetsDirPath));
    }
    if (options.docBlockId) {
        formData.append('id', String(options.docBlockId));
    }
    if (options.skipIfDuplicated) {
        formData.append('skipIfDuplicated', 'true');
    }

    for (const rawPath of filePaths) {
        const resolvedPath = path.resolve(String(rawPath || ''));
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`文件不存在: ${resolvedPath}`);
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) {
            throw new Error(`仅支持上传文件: ${resolvedPath}`);
        }

        const buffer = fs.readFileSync(resolvedPath);
        const fileName = path.basename(resolvedPath);
        formData.append('file[]', new Blob([buffer]), fileName);
    }

    const data = await requestSiyuanMultipartApi(API_ENDPOINTS.ASSET_UPLOAD, formData, { requireAuth: true });
    return {
        errFiles: Array.isArray(data?.errFiles) ? data.errFiles : [],
        succMap: data?.succMap && typeof data.succMap === 'object' ? data.succMap : {}
    };
}

function buildAssetInsertSnippet(assetPath, mode = 'auto') {
    const safePath = String(assetPath || '').trim();
    if (!safePath) {
        return '';
    }

    const fileName = path.basename(safePath);
    const ext = path.extname(fileName).toLowerCase();
    if (mode === 'pdf') {
        return `<iframe sandbox="allow-forms allow-presentation allow-same-origin allow-scripts allow-modals allow-popups" src="${safePath}" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>`;
    }
    if (mode === 'iframe') {
        return `<iframe sandbox="allow-forms allow-presentation allow-same-origin allow-scripts allow-modals allow-popups" src="${safePath}" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>`;
    }
    if (mode === 'link') {
        return `[${fileName}](${safePath})`;
    }

    if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(ext)) {
        return `![](${safePath})`;
    }
    if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(ext)) {
        return `<video controls="controls" src="${safePath}"></video>`;
    }
    if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(ext)) {
        return `<audio controls="controls" src="${safePath}"></audio>`;
    }
    if (/\.(pdf)$/i.test(ext) && mode === 'auto') {
        return `[${fileName}](${safePath})`;
    }
    return `[${fileName}](${safePath})`;
}

async function uploadAndInsertAssets(filePaths, anchors = {}, options = {}) {
    const anchorId = anchors.parentID || anchors.previousID || anchors.nextID || '';
    if (!anchorId) {
        throw new Error('uploadAndInsertAssets 需要锚点(parentID/previousID/nextID)');
    }

    const upload = await uploadAssets(filePaths, {
        assetsDirPath: options.assetsDirPath || '',
        docBlockId: anchorId,
        skipIfDuplicated: !!options.skipIfDuplicated
    });

    const insertedAssetPaths = Object.values(upload.succMap || {}).map((value) => String(value || '').trim()).filter(Boolean);
    if (insertedAssetPaths.length === 0) {
        throw new Error('上传完成，但没有可插入的资源路径');
    }

    const markdown = insertedAssetPaths
        .map((assetPath) => buildAssetInsertSnippet(assetPath, options.mode || 'auto'))
        .filter(Boolean)
        .join('\n\n');

    const insertResult = anchors.parentID && !anchors.previousID && !anchors.nextID
        ? await appendMarkdownToBlock(anchors.parentID, markdown)
        : await insertBlock(markdown, anchors);
    return {
        upload,
        markdown,
        insert: insertResult
    };
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
        const result = await executeSiyuanQueryRaw('SELECT 1 as test');
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
    stripCommandFlags,
    formatResults,
    searchNotes,
    searchInDocument,
    searchNotesMarkdown,
    openDocument,
    openSection,
    listNotebooks,
    getDocumentChildren,
    getDocumentTree,
    renderDocumentTreeMarkdown,
    getDocumentTreeByID,
    analyzeSubdocMovePlan,
    reorganizeSubdocsByID,
    appendMarkdownToBlock,
    insertBlock,
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
    checkSkillVersion,
    createDocWithMd,
    renameDoc,
    discoverAttributeViewsInDocument,
    getPathByID,
    updateBlock,
    deleteBlock,
    callAttributeViewApi,
    addAttributeViewRows,
    addAttributeViewRelationKey,
    addAttributeViewRollupKey,
    setAttributeViewTextCell,
    setAttributeViewNumberCell,
    setAttributeViewDateCell,
    setAttributeViewSelectCell,
    setAttributeViewCheckboxCell,
    setAttributeViewMultiSelectCell,
    setAttributeViewUrlCell,
    setAttributeViewEmailCell,
    setAttributeViewPhoneCell,
    setAttributeViewTemplateCell,
    setAttributeViewAssetCell,
    setAttributeViewBlockCell,
    addAttributeViewDocRows,
    setAttributeViewRelationCell,
    clearAttributeViewRelationCell,
    addAttributeViewOption,
    updateAttributeViewOption,
    removeAttributeViewOption,
    updateAttributeViewRelationKey,
    updateAttributeViewRollupKey,
    getAttributeViewFilterSortState,
    setAttributeViewFilters,
    setAttributeViewSorts,
    setAttributeViewGroup,
    removeAttributeViewGroup,
    hideAttributeViewGroup,
    hideAllAttributeViewGroups,
    sortAttributeViewGroup,
    foldAttributeViewGroup,
    addAttributeViewView,
    removeAttributeViewView,
    renameAttributeViewView,
    setAttributeViewViewIcon,
    setAttributeViewViewDesc,
    duplicateAttributeViewView,
    sortAttributeViewView,
    setAttributeViewPageSize,
    hideAttributeViewName,
    setAttributeViewShowIcon,
    setAttributeViewWrapField,
    setAttributeViewFitImage,
    setAttributeViewDisplayFieldName,
    setAttributeViewFillColBackgroundColor,
    setAttributeViewCardSize,
    setAttributeViewCardAspectRatio,
    setAttributeViewCoverFrom,
    sortAttributeViewRow,
    addAttributeViewBlockRows,
    uploadAssets,
    uploadAndInsertAssets
});

/**
 * 主函数 - 命令行入口
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    // 除了check/version/version-check命令，其他命令都需要检查环境配置
    if (args.length > 0 && command !== 'check' && command !== 'version' && command !== 'version-check' && !checkEnvironmentConfig()) {
        process.exitCode = 1;
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
            process.exitCode = 1;
            return;
        }

        await handler(args);
    } catch (error) {
        console.error('执行失败:', error.message);
        process.exitCode = 1;
    }
}

// 导出函数供其他模块使用
module.exports = {
    executeSiyuanQuery,
    getSystemVersion,
    checkSkillVersion,
    listNotebooks,
    createDocWithMd,
    renameDoc,
    discoverAttributeViewsInDocument,
    getChildBlocks,
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
    planMoveDocsByID,
    reorganizeSubdocsByID,
    analyzeSubdocMovePlan,
    deleteBlock,
    appendMarkdownToBlock,
    insertBlock,
    openSection,
    replaceSection,
    searchNotes,
    searchInDocument,
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
    callAttributeViewApi,
    addAttributeViewRows,
    addAttributeViewRelationKey,
    addAttributeViewRollupKey,
    setAttributeViewTextCell,
    setAttributeViewNumberCell,
    setAttributeViewDateCell,
    setAttributeViewSelectCell,
    setAttributeViewCheckboxCell,
    setAttributeViewMultiSelectCell,
    setAttributeViewUrlCell,
    setAttributeViewEmailCell,
    setAttributeViewPhoneCell,
    setAttributeViewTemplateCell,
    setAttributeViewAssetCell,
    setAttributeViewBlockCell,
    addAttributeViewDocRows,
    setAttributeViewRelationCell,
    clearAttributeViewRelationCell,
    addAttributeViewOption,
    updateAttributeViewOption,
    removeAttributeViewOption,
    updateAttributeViewRelationKey,
    updateAttributeViewRollupKey,
    getAttributeViewFilterSortState,
    setAttributeViewFilters,
    setAttributeViewSorts,
    setAttributeViewGroup,
    removeAttributeViewGroup,
    hideAttributeViewGroup,
    hideAllAttributeViewGroups,
    sortAttributeViewGroup,
    foldAttributeViewGroup,
    addAttributeViewView,
    removeAttributeViewView,
    renameAttributeViewView,
    setAttributeViewViewIcon,
    setAttributeViewViewDesc,
    duplicateAttributeViewView,
    sortAttributeViewView,
    setAttributeViewPageSize,
    hideAttributeViewName,
    setAttributeViewShowIcon,
    setAttributeViewWrapField,
    setAttributeViewFitImage,
    setAttributeViewDisplayFieldName,
    setAttributeViewFillColBackgroundColor,
    setAttributeViewCardSize,
    setAttributeViewCardAspectRatio,
    setAttributeViewCoverFrom,
    sortAttributeViewRow,
    addAttributeViewBlockRows,
    uploadAssets,
    uploadAndInsertAssets,
    openDocument,
    renderPatchableMarkdown,
    parsePatchableMarkdown,
    applyPatchToDocument,
    parseBlocksFromKramdown,
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
 * 安全获取文档基础元信息
 * @param {string} docId - 文档ID
 * @returns {Promise<Object>} 文档信息
 */
async function getDocumentMeta(docId) {
    const safeDocId = escapeSqlValue(docId);
    const rows = await executeSiyuanQueryRaw(`
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
 * 读取文档Readable视图（支持自动截断）
 * @param {string} docId - 文档ID
 * @param {Object} [options] - 选项
 * @param {number} [options.limitChars] - 字符数限制
 * @returns {Promise<string>} Markdown视图
 */
async function openDocumentReadableView(docId, options = {}) {
    const limitChars = normalizeInt(options.limitChars, OPEN_DOC_CHAR_LIMIT, 1000, 1000000);
    await ensureDocumentAccessAllowed(docId, 'openDocumentReadableView', 'read');

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
    const totalChars = body.length;
    const needsTruncation = !options.full && totalChars > limitChars;

    let shownBody = body;
    let shownChars = totalChars;
    if (needsTruncation) {
        // 按行截断；若首行超长则字符级兜底，保证 shownChars 不超过 limitChars
        const bodyLines = body.split('\n');
        const truncatedLines = [];
        let charCount = 0;
        for (const line of bodyLines) {
            const separator = truncatedLines.length > 0 ? 1 : 0;
            const projectedCount = charCount + separator + line.length;
            if (projectedCount > limitChars) {
                if (truncatedLines.length === 0) {
                    truncatedLines.push(line.slice(0, limitChars));
                    charCount = limitChars;
                }
                break;
            }
            truncatedLines.push(line);
            charCount = projectedCount;
        }
        shownBody = truncatedLines.join('\n');
        if (shownBody.length > limitChars) {
            shownBody = shownBody.slice(0, limitChars);
        }
        shownChars = shownBody.length;
    }

    const lines = [];
    lines.push('---');
    lines.push('siyuan:');
    lines.push(`  doc_id: ${docId}`);
    lines.push(`  hpath: ${JSON.stringify(hpath || '')}`);
    lines.push('  view: readable');
    lines.push('  source: exportMdContent');
    if (needsTruncation) {
        lines.push('  truncated: true');
        lines.push(`  total_chars: ${totalChars}`);
        lines.push(`  shown_chars: ${shownChars}`);
    }
    lines.push(`  exported_at: ${new Date().toISOString()}`);
    lines.push('---');
    lines.push('');
    lines.push(shownBody || '_文档内容为空_');

    if (needsTruncation) {
        // 追加标题大纲和导航提示
        const headings = await getDocumentHeadings(docId);
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('> **文档已截断**（已显示 ' + shownChars + ' / ' + totalChars + ' 字符）');
        lines.push('>');
        lines.push('> 使用 `open-section <标题块ID>` 读取具体章节，或 `search-in-doc ' + docId + ' <关键词>` 定位内容。');
        if (headings.length > 0) {
            lines.push('');
            lines.push('## 文档标题大纲');
            lines.push('');
            for (const h of headings) {
                const level = h.subtype || 'h1';
                const indent = '  '.repeat(Math.max(0, parseInt(level.replace('h', ''), 10) - 1));
                lines.push(`${indent}- ${h.content || '(无标题)'} \`${h.id}\``);
            }
        }
    }

    return lines.join('\n');
}

/**
 * 读取文档Patchable视图（支持分页）
 * @param {string} docId - 文档ID
 * @param {Object} [options] - 选项
 * @param {string} [options.cursor] - 起始块ID
 * @param {number} [options.limitBlocks] - 每页块数限制
 * @returns {Promise<string>} patchable markdown
 */
async function openDocumentPatchableView(docId, options = {}) {
    const limitBlocks = normalizeInt(options.limitBlocks, OPEN_DOC_BLOCK_PAGE_SIZE, 5, 10000);
    const cursor = typeof options.cursor === 'string' ? options.cursor.trim() : '';
    await ensureDocumentAccessAllowed(docId, 'openDocumentPatchableView', 'read');

    const [meta, allBlocks] = await Promise.all([
        getDocumentMeta(docId),
        getDocumentBlocksInTreeOrder(docId)
    ]);
    await markDocumentRead(docId, 'openDocumentPatchableView', meta?.updated || '');

    if (!meta.hpath) {
        meta.hpath = await getHPathByID(docId);
    }

    const totalBlocks = allBlocks.length;

    // 确定起始位置
    let startIndex = 0;
    if (cursor) {
        const cursorIndex = allBlocks.findIndex(b => b.id === cursor);
        if (cursorIndex === -1) {
            throw new Error(`cursor 块ID未在文档中找到: ${cursor}`);
        }
        startIndex = cursorIndex;
    }

    const paginationActive = !options.full && (startIndex > 0 || totalBlocks > limitBlocks);
    const endIndex = options.full ? totalBlocks : Math.min(startIndex + limitBlocks, totalBlocks);
    const pageBlocks = options.full ? allBlocks : allBlocks.slice(startIndex, endIndex);
    const hasMore = !options.full && endIndex < totalBlocks;
    const nextCursor = hasMore ? allBlocks[endIndex].id : '';

    if (options.full || !paginationActive) {
        // 完整输出（小文档 / --full 模式）
        return renderPatchableMarkdown({ docId, meta, blocks: allBlocks });
    }

    // 分页输出：标记 partial=true，apply-patch 将拒绝此类 PMF
    const lines = [];
    const updatedPart = meta.updated ? ` updated=${meta.updated}` : '';
    const nextCursorPart = nextCursor ? ` next_cursor=${nextCursor}` : '';
    lines.push(`<!-- @siyuan:doc id=${docId} hpath=${JSON.stringify(meta.hpath || '')} view=patchable pmf=v1 partial=true total_blocks=${totalBlocks} shown_blocks=${pageBlocks.length}${nextCursorPart}${updatedPart} -->`);
    lines.push('');

    for (const block of pageBlocks) {
        const subTypePart = block.subType ? ` subType=${block.subType}` : '';
        const parentPart = block.parentId ? ` parent=${block.parentId}` : '';
        lines.push(`<!-- @siyuan:block id=${block.id} type=${block.type}${subTypePart}${parentPart} -->`);
        lines.push(block.markdown);
        lines.push('');
    }

    if (hasMore) {
        lines.push('');
        lines.push(`> **分页提示**：本页显示 ${pageBlocks.length} / ${totalBlocks} 块。`);
        lines.push(`> 使用 \`open-doc ${docId} patchable --cursor ${nextCursor}\` 查看下一页。`);
        lines.push('>');
        lines.push('> **注意**：分页 PMF（partial=true）不能用于 apply-patch。如需编辑，请用 `open-section` 或 `update-block`。');

        // 追加标题大纲
        const headings = await getDocumentHeadings(docId);
        if (headings.length > 0) {
            lines.push('');
            lines.push('## 文档标题大纲');
            lines.push('');
            for (const h of headings) {
                const level = h.subtype || 'h1';
                const indent = '  '.repeat(Math.max(0, parseInt(level.replace('h', ''), 10) - 1));
                lines.push(`${indent}- ${h.content || '(无标题)'} \`${h.id}\``);
            }
        }
    }

    return lines.join('\n').trim();
}

/**
 * 按视图类型读取文档
 * @param {string} docId - 文档ID
 * @param {string} view - readable/patchable
 * @param {Object} [options] - 选项
 * @param {string} [options.cursor] - 起始块ID（仅 patchable）
 * @param {number} [options.limitChars] - 字符数限制（仅 readable）
 * @param {number} [options.limitBlocks] - 每页块数限制（仅 patchable）
 * @returns {Promise<string>} Markdown视图
 */
async function openDocument(docId, view = 'readable', options = {}) {
    if (view === 'patchable') {
        return await openDocumentPatchableView(docId, options);
    }

    return await openDocumentReadableView(docId, options);
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

    // 拒绝分页/部分 PMF，避免误删未包含的块
    if (parsedTarget.doc.partial === 'true') {
        throw new Error(
            'apply-patch 拒绝 partial PMF（分页或章节导出的 PMF 不包含完整文档块，' +
            '缺失的块会被视为删除）。请改用 update-block 编辑单块，或 open-section + replace-section 编辑章节。'
        );
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

    const currentPmf = await openDocumentPatchableView(docId, { full: true });
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
    if (apiResult && typeof apiResult === 'object') {
        if (typeof apiResult.insertedBlockId === 'string' && isLikelyBlockId(apiResult.insertedBlockId)) {
            return apiResult.insertedBlockId;
        }
        if (Array.isArray(apiResult.insertedBlockIds)) {
            const firstId = apiResult.insertedBlockIds.find((id) => typeof id === 'string' && isLikelyBlockId(id));
            if (firstId) {
                return firstId;
            }
        }
        if ('rawData' in apiResult) {
            return extractInsertedBlockId(apiResult.rawData);
        }
    }

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
        success: true,
        state: 'applied',
        operation: 'applyPatchToDocument',
        plan,
        execution
    };
}
