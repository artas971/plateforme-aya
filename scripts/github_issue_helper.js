/**
 * Helper sécurisé pour commenter et fermer les issues GitHub
 * Usage : node scripts/github_issue_helper.js <issueNumber> <commentFileOrText> [close: boolean]
 */

const https = require('https');
const fs = require('fs');
require('dotenv').config();

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER || 'artas971';
const repo = process.env.GITHUB_REPO || 'plateforme-aya';

if (!token) {
    console.error('❌ GITHUB_TOKEN manquant dans .env');
    process.exit(1);
}

const issueNumber = process.argv[2];
const textOrFile = process.argv[3];
const shouldClose = process.argv[4] === 'true' || process.argv[4] === 'close';

if (!issueNumber) {
    console.error('Usage: node scripts/github_issue_helper.js <issueNumber> <commentFileOrText> [close]');
    process.exit(1);
}

let bodyText = textOrFile || '';
if (fs.existsSync(textOrFile)) {
    bodyText = fs.readFileSync(textOrFile, 'utf8');
}

function requestGithub(method, path, data) {
    return new Promise((resolve, reject) => {
        const payload = data ? JSON.stringify(data) : null;
        const options = {
            hostname: 'api.github.com',
            path: path,
            method: method,
            headers: {
                'User-Agent': 'Aya-DevOps-Steve-Alexandre',
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
        };

        if (payload) {
            options.headers['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = https.request(options, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(resBody)); } catch (e) { resolve(resBody); }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${resBody}`));
                }
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function main() {
    try {
        if (bodyText) {
            console.log(`💬 Publication du compte-rendu technique sur l'issue #${issueNumber}...`);
            await requestGithub('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body: bodyText });
            console.log(`✅ Commentaire publié avec succès.`);
        }

        if (shouldClose) {
            console.log(`🔒 Clôture officielle de l'issue #${issueNumber}...`);
            await requestGithub('PATCH', `/repos/${owner}/${repo}/issues/${issueNumber}`, { state: 'closed' });
            console.log(`✅ Issue #${issueNumber} clôturée avec succès.`);
        }
    } catch (e) {
        console.error('❌ Erreur GitHub API :', e.message);
        process.exit(1);
    }
}

main();
