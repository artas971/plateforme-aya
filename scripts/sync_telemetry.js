#!/usr/bin/env node
/**
 * Outil de Synchronisation Distante de Télémétrie - Plateforme Aya
 * 
 * Rôles :
 * - Rapatrie de manière sécurisée les journaux JSONL depuis le serveur distant (Hetzner ou dev)
 * - Utilise le jeton secret machine-to-machine X-Aya-Agent-Token
 * - Stream direct sans surcharge RAM vers le dossier local telemetry_data/
 * - Option --analyze pour déclencher immédiatement l'analyse statistique d'Hugo
 * 
 * Usage CLI :
 *   node scripts/sync_telemetry.js [--date YYYY-MM-DD] [--eventType <type>] [--limit <n>] [--analyze]
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { computeStatistics, generateDailyDigest } = require('../services/telemetryAnalyzer');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(ROOT_DIR, 'telemetry_data');

/**
 * Parse les arguments de ligne de commande
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {
        url: process.env.AYA_REMOTE_URL || 'http://localhost:3000',
        token: process.env.AYA_TELEMETRY_SECRET || 'aya_secret_telemetry_token_2026',
        date: new Date().toISOString().split('T')[0],
        eventType: null,
        limit: null,
        outDir: DEFAULT_OUT_DIR,
        analyze: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--url' && args[i + 1]) parsed.url = args[++i];
        else if (arg === '--token' && args[i + 1]) parsed.token = args[++i];
        else if (arg === '--date' && args[i + 1]) parsed.date = args[++i];
        else if (arg === '--eventType' && args[i + 1]) parsed.eventType = args[++i];
        else if (arg === '--limit' && args[i + 1]) parsed.limit = parseInt(args[++i], 10);
        else if (arg === '--outDir' && args[i + 1]) parsed.outDir = path.resolve(args[++i]);
        else if (arg === '--analyze') parsed.analyze = true;
        else if (arg === '--help' || arg === '-h') {
            console.log(`
Usage: node scripts/sync_telemetry.js [options]

Options:
  --url <url>            URL du serveur Aya (défaut: http://localhost:3000 ou $AYA_REMOTE_URL)
  --token <secret>       Clé secrète de télémétrie (défaut: $AYA_TELEMETRY_SECRET)
  --date <YYYY-MM-DD>    Date cible du journal à rapatrier (défaut: aujourd'hui)
  --eventType <type>     Filtrer par type d'événement (ex: vocab_card_generation, video_generation)
  --limit <nombre>       Plafonner le nombre de lignes exportées
  --outDir <dossier>     Répertoire local de sauvegarde (défaut: telemetry_data/)
  --analyze              Déclencher la synthèse de l'Agent Hugo dès réception
            `);
            process.exit(0);
        }
    }

    return parsed;
}

/**
 * Fonction de synchronisation téléchargeant le flux JSONL
 */
async function syncTelemetry(options = {}) {
    const urlStr = options.url || process.env.AYA_REMOTE_URL || 'http://localhost:3000';
    const token = options.token || process.env.AYA_TELEMETRY_SECRET || 'aya_secret_telemetry_token_2026';
    const date = options.date || new Date().toISOString().split('T')[0];
    const eventType = options.eventType || null;
    const limit = options.limit || null;
    const outDir = options.outDir || DEFAULT_OUT_DIR;

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    // Construction de l'URL avec les filtres
    const baseUrl = new URL('/api/admin/telemetry/export', urlStr);
    baseUrl.searchParams.set('date', date);
    if (eventType) baseUrl.searchParams.set('eventType', eventType);
    if (limit) baseUrl.searchParams.set('limit', String(limit));

    const filename = `events-${date}${eventType ? '-' + eventType : ''}.jsonl`;
    const targetFilePath = path.join(outDir, filename);

    return new Promise((resolve, reject) => {
        const client = baseUrl.protocol === 'https:' ? https : http;
        const reqOptions = {
            method: 'GET',
            headers: {
                'X-Aya-Agent-Token': token,
                'Accept': 'application/x-ndjson, text/plain'
            }
        };

        console.log(`[SYNC TELEMETRY] 🛰️ Rapatriement distant depuis : ${baseUrl.origin}${baseUrl.pathname}?date=${date}...`);
        
        const req = client.request(baseUrl.toString(), reqOptions, (res) => {
            if (res.statusCode !== 200) {
                let errBody = '';
                res.on('data', chunk => errBody += chunk);
                res.on('end', () => {
                    reject(new Error(`Échec HTTP ${res.statusCode} : ${errBody || res.statusMessage}`));
                });
                return;
            }

            const writeStream = fs.createWriteStream(targetFilePath, { encoding: 'utf8' });
            let bytesCount = 0;

            res.on('data', chunk => {
                bytesCount += chunk.length;
            });

            res.pipe(writeStream);

            writeStream.on('finish', () => {
                console.log(`[SYNC TELEMETRY] ✅ Fichier synchronisé avec succès : ${targetFilePath} (${(bytesCount / 1024).toFixed(2)} Ko)`);
                resolve({
                    success: true,
                    filePath: targetFilePath,
                    bytesCount,
                    date,
                    eventType
                });
            });

            writeStream.on('error', (writeErr) => {
                reject(writeErr);
            });
        });

        req.on('error', (reqErr) => {
            reject(reqErr);
        });

        req.end();
    });
}

// Exécution directe en mode CLI
if (require.main === module) {
    const config = parseArgs();

    syncTelemetry(config)
        .then(async (result) => {
            if (config.analyze) {
                console.log('\n🧠 [AGENT HUGO] Analyse immédiate des données rapatriées...\n');
                const fileContent = fs.readFileSync(result.filePath, 'utf8');
                const lines = fileContent.split('\n').filter(Boolean);
                const events = [];
                for (const line of lines) {
                    try { events.push(JSON.parse(line)); } catch (e) {}
                }
                const stats = computeStatistics(events);
                const report = generateDailyDigest(stats, { date: config.date });
                console.log(report);
            }
        })
        .catch((err) => {
            console.error('\n❌ [SYNC ERROR]', err.message);
            process.exit(1);
        });
}

module.exports = {
    syncTelemetry
};
