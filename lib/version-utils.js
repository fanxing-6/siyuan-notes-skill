const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

function safeExec(command, skillDir) {
    try {
        return String(execSync(command, { cwd: skillDir, stdio: ['ignore', 'pipe', 'ignore'] })).trim();
    } catch (_) {
        return '';
    }
}

function readLocalSkillVersion(skillDir) {
    try {
        const pkgPath = path.join(skillDir, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return String(pkg.version || '').trim();
    } catch (_) {
        return '';
    }
}

function parseSemver(value) {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(value || '').trim());
    if (!match) {
        return null;
    }

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3])
    };
}

function compareSemver(a, b) {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'siyuan-notes-skill',
                Accept: 'application/vnd.github+json'
            }
        }, (res) => {
            let raw = '';
            res.on('data', (chunk) => {
                raw += chunk;
            });
            res.on('end', () => {
                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`HTTP ${res.statusCode || 'unknown'}`));
                    return;
                }

                try {
                    resolve(JSON.parse(raw));
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
    });
}

async function getLatestTagFromGithub(repo) {
    const releaseUrl = `https://api.github.com/repos/${repo}/releases/latest`;
    try {
        const release = await fetchJson(releaseUrl);
        if (release && release.tag_name) {
            return String(release.tag_name).trim();
        }
    } catch (_) {
        // Ignore and fall back to tags.
    }

    const tagsUrl = `https://api.github.com/repos/${repo}/tags?per_page=100`;
    const tags = await fetchJson(tagsUrl);
    if (!Array.isArray(tags) || tags.length === 0) {
        return '';
    }

    let best = null;
    for (const tag of tags) {
        const name = tag && tag.name ? String(tag.name).trim() : '';
        const semver = parseSemver(name);
        if (!semver) {
            continue;
        }

        if (!best || compareSemver(semver, best.semver) > 0) {
            best = { name, semver };
        }
    }

    return best ? best.name : '';
}

async function checkSkillVersion(skillDir, repo = 'fanxing-6/siyuan-notes-skill') {
    const localVersion = readLocalSkillVersion(skillDir) || 'unknown';
    const localSha = safeExec('git rev-parse --short HEAD', skillDir) || 'unknown';
    const localTag = safeExec('git describe --tags --exact-match', skillDir) || 'no-tag';

    let latestTag = '';
    let latestVersion = '';
    let status = 'unknown';
    let errorMessage = '';

    try {
        latestTag = await getLatestTagFromGithub(repo);
        latestVersion = latestTag.replace(/^v/, '');
        if (!latestTag) {
            status = 'unknown';
        } else {
            const localSemver = parseSemver(localVersion);
            const latestSemver = parseSemver(latestVersion);
            if (localSemver && latestSemver) {
                status = compareSemver(localSemver, latestSemver) >= 0 ? 'latest' : 'outdated';
            } else if (localVersion && latestVersion) {
                status = localVersion === latestVersion ? 'latest' : 'outdated';
            } else {
                status = 'unknown';
            }
        }
    } catch (error) {
        status = 'unknown';
        errorMessage = error.message || String(error);
    }

    return {
        localVersion,
        localSha,
        localTag,
        latestTag,
        latestVersion,
        status,
        error: errorMessage
    };
}

module.exports = {
    checkSkillVersion
};
