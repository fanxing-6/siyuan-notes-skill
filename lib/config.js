const fs = require('fs');
const path = require('path');

function normalizeInt(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, parsed));
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

function hasNonEmptyEnvValue(env, key) {
    return Object.prototype.hasOwnProperty.call(env, key) && String(env[key] || '').trim() !== '';
}

function isDebugModeEnabled(env = process.env, argv = process.argv) {
    return env.DEBUG === 'true' || argv.includes('--debug');
}

function loadEnvFile(skillDir, env = process.env, argv = process.argv) {
    try {
        const envPath = path.join(skillDir, '.env');
        if (!fs.existsSync(envPath)) {
            if (isDebugModeEnabled(env, argv)) {
                console.log('⚠️  未找到.env文件:', envPath);
            }
            return;
        }

        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                return;
            }

            const [key, ...valueParts] = trimmedLine.split('=');
            if (!key || valueParts.length === 0) {
                return;
            }

            const envKey = key.trim().replace(/^export\s+/, '');
            const value = stripOptionalWrappingQuotes(valueParts.join('=').trim());
            if (!envKey) {
                return;
            }

            if (!(envKey in env)) {
                env[envKey] = value;
            }
        });

        if (isDebugModeEnabled(env, argv)) {
            console.log('✅ 已加载.env配置文件:', envPath);
        }
    } catch (error) {
        if (isDebugModeEnabled(env, argv)) {
            console.log('⚠️  .env文件加载失败:', error.message);
        }
    }
}

function normalizeBasePath(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed || trimmed === '/') {
        return '';
    }

    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

function resolveServerConfig(env = process.env) {
    const explicitHost = String(env.SIYUAN_HOST || '').trim();
    const explicitPort = String(env.SIYUAN_PORT || '').trim();
    const explicitUseHttps = hasNonEmptyEnvValue(env, 'SIYUAN_USE_HTTPS');
    const explicitBasePath = hasNonEmptyEnvValue(env, 'SIYUAN_BASE_PATH');

    let host = explicitHost;
    let port = explicitPort;
    let useHttps = explicitUseHttps ? env.SIYUAN_USE_HTTPS === 'true' : false;
    let basePath = explicitBasePath ? normalizeBasePath(env.SIYUAN_BASE_PATH) : '';

    if (!host) {
        host = 'localhost';
    }

    return {
        host,
        port,
        useHttps,
        basePath
    };
}

function buildApiBaseUrl({ host, port, useHttps, basePath }) {
    return `${useHttps ? 'https' : 'http'}://${host}${port ? `:${port}` : ''}${normalizeBasePath(basePath)}`;
}

function buildRuntimeConfig(skillDir, env = process.env, argv = process.argv) {
    loadEnvFile(skillDir, env, argv);

    const debugMode = isDebugModeEnabled(env, argv);
    const serverConfig = resolveServerConfig(env);

    return {
        DEBUG_MODE: debugMode,
        SIYUAN_HOST: serverConfig.host,
        SIYUAN_PORT: serverConfig.port,
        SIYUAN_USE_HTTPS: serverConfig.useHttps,
        SIYUAN_BASE_PATH: serverConfig.basePath,
        SIYUAN_API_TOKEN: String(env.SIYUAN_API_TOKEN || '').trim(),
        SIYUAN_BASIC_AUTH_USER: String(env.SIYUAN_BASIC_AUTH_USER || '').trim(),
        SIYUAN_BASIC_AUTH_PASS: String(env.SIYUAN_BASIC_AUTH_PASS || '').trim(),
        SIYUAN_ALLOW_TOKEN_IN_QUERY: env.SIYUAN_ALLOW_TOKEN_IN_QUERY === 'true',
        SIYUAN_ENABLE_WRITE: env.SIYUAN_ENABLE_WRITE === 'true',
        SIYUAN_REQUIRE_READ_BEFORE_WRITE: env.SIYUAN_REQUIRE_READ_BEFORE_WRITE !== 'false',
        SIYUAN_READ_GUARD_TTL_SECONDS: normalizeInt(env.SIYUAN_READ_GUARD_TTL_SECONDS, 3600, 30, 604800),
        SIYUAN_READ_GUARD_WRITE_GRACE_MS: normalizeInt(env.SIYUAN_READ_GUARD_WRITE_GRACE_MS, 8000, 1000, 60000),
        SIYUAN_LIST_DOCUMENTS_LIMIT: normalizeInt(env.SIYUAN_LIST_DOCUMENTS_LIMIT, 200, 1, 2000),
        SIYUAN_BLOCK_ROOT_CACHE_MAX: normalizeInt(env.SIYUAN_BLOCK_ROOT_CACHE_MAX, 5000, 100, 50000),
        READ_GUARD_CACHE_FILE: path.join(skillDir, '.siyuan-read-guard-cache.json'),
        OPEN_DOC_CHAR_LIMIT: normalizeInt(env.SIYUAN_OPEN_DOC_CHAR_LIMIT, 15000, 1000, 1000000),
        OPEN_DOC_BLOCK_PAGE_SIZE: normalizeInt(env.SIYUAN_OPEN_DOC_BLOCK_PAGE_SIZE, 50, 5, 10000),
        API_BASE_URL: buildApiBaseUrl(serverConfig)
    };
}

module.exports = {
    normalizeInt,
    buildRuntimeConfig
};
