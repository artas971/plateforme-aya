/**
 * Service Central de Télémétrie & Observabilité - Plateforme Aya
 * 
 * Architecture Non-Bloquante & Dual-Mode :
 * 1. Ring Buffer en mémoire vive (Micro-Batching 5s / 50 événements)
 * 2. Persistance locale Append-Only JSONL rotative (data/telemetry/events-YYYY-MM-DD.jsonl)
 * 3. Miroir MongoDB avec index TTL 7 jours (collection telemetry_metrics)
 * 4. Anonymisation stricte RGPD (Zéro PII, Hachage HMAC-SHA256, Masquage IP)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isDbConnected, TelemetryMetric } = require('../models');

const ROOT_DIR = path.resolve(__dirname, '..');
const TELEMETRY_DIR = path.join(ROOT_DIR, 'data', 'telemetry');

// Création récursive sécurisée du répertoire de télémétrie
if (!fs.existsSync(TELEMETRY_DIR)) {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
}

// Paramètres de Micro-Batching & Garde-fous mémoire
const BATCH_FLUSH_INTERVAL_MS = 5000; // Flush toutes les 5 secondes
const BATCH_MAX_SIZE = 50;           // Ou dès 50 événements accumulés
const MAX_QUEUE_CAPACITY = 5000;     // Plafond anti-OOM (Drop oldest si saturation)
const RECENT_BUFFER_SIZE = 100;      // Ring buffer pour diagnostic instantané

let metricsQueue = [];
let recentEventsBuffer = [];
let flushTimer = null;
let totalRecordedCounter = 0;
let totalFlushedCounter = 0;
let droppedEventsCounter = 0;

/**
 * Sel cryptographique d'anonymisation (issu du .env ou fallback persistant)
 */
function getTelemetrySalt() {
    return process.env.AYA_TELEMETRY_SALT || process.env.AYA_TELEMETRY_SECRET || 'aya_salt_telemetry_palestine_2026';
}

/**
 * Anonymisation irréversible des identifiants utilisateurs (Conformité RGPD absolue)
 * u_12345 -> u_a8f9c10b2e
 */
function anonymizeUser(rawUser) {
    if (!rawUser || rawUser === 'anon' || rawUser === 'unknown') {
        return 'anon';
    }
    const str = String(rawUser).trim().toLowerCase();
    const hash = crypto.createHmac('sha256', getTelemetrySalt()).update(str).digest('hex');
    return `u_${hash.slice(0, 10)}`;
}

/**
 * Anonymisation des adresses IP (Masquage du sous-réseau)
 */
function anonymizeIp(ip) {
    if (!ip) return null;
    const cleanIp = String(ip).replace('::ffff:', '').trim();
    if (cleanIp === '127.0.0.1' || cleanIp === '::1') return '127.0.0.1';
    
    // IPv4 : remplacement du dernier octet par 0/24
    if (cleanIp.includes('.')) {
        const parts = cleanIp.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        }
    }
    // IPv6 : conservation du préfixe /48
    if (cleanIp.includes(':')) {
        const parts = cleanIp.split(':');
        return `${parts.slice(0, 3).join(':')}::/48`;
    }
    return 'anonymized';
}

/**
 * Retourne le chemin du fichier JSONL rotatif du jour
 * Ex: data/telemetry/events-2026-09-25.jsonl
 */
function getTodayLogFilePath() {
    const today = new Date().toISOString().split('T')[0];
    return path.join(TELEMETRY_DIR, `events-${today}.jsonl`);
}

/**
 * Capture l'état instantané des ressources système
 */
function getSystemStateSnapshot() {
    const mem = process.memoryUsage();
    return {
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        rssMemoryMb: Math.round(mem.rss / (1024 * 1024)),
        uptimeSeconds: Math.floor(process.uptime()),
        activeSseClients: global.__activeSseClientsCount || 0
    };
}

/**
 * Effectue le flush d'un micro-batch d'événements de manière totalement asynchrone
 */
async function flushBatch() {
    if (metricsQueue.length === 0) return;

    // Prélèvement atomique du lot sans bloquer la boucle d'événements
    const batch = metricsQueue.splice(0, metricsQueue.length);
    if (batch.length === 0) return;

    totalFlushedCounter += batch.length;
    const logFilePath = getTodayLogFilePath();

    // 1. Étage Primaire : Écriture Append-Only dans le fichier JSONL rotatif
    const lines = batch.map(event => JSON.stringify(event)).join('\n') + '\n';
    try {
        await fs.promises.appendFile(logFilePath, lines, 'utf8');
    } catch (err) {
        console.error('[TELEMETRY] ❌ Erreur écriture JSONL local :', err.message);
    }

    // 2. Étage Secondaire : Insertion asynchrone dans MongoDB (si connecté)
    if (isDbConnected() && TelemetryMetric) {
        try {
            TelemetryMetric.insertMany(batch, { ordered: false })
                .catch((mongoErr) => {
                    // Erreur silencieuse : le fichier JSONL fait foi, aucune interruption applicative
                    if (process.env.DEBUG_TELEMETRY === 'true') {
                        console.warn('[TELEMETRY] ⚠️ Warning insertion MongoDB :', mongoErr.message);
                    }
                });
        } catch (e) {
            // Protection anti-crash
        }
    }
}

/**
 * Enregistre un événement de métrique dans la file d'attente (Non-Bloquant)
 * @param {Object} eventData - Données conformes au schéma de télémétrie Aya
 */
function recordEvent(eventData = {}) {
    totalRecordedCounter++;

    // Garde-fous mémoire : éviction des plus anciens si queue saturée
    if (metricsQueue.length >= MAX_QUEUE_CAPACITY) {
        metricsQueue.shift();
        droppedEventsCounter++;
    }

    const now = new Date();
    const normalizedEvent = {
        traceId: eventData.traceId || crypto.randomUUID(),
        timestamp: eventData.timestamp || now.toISOString(),
        epochMs: eventData.epochMs || now.getTime(),
        eventType: eventData.eventType || 'api_request',
        environment: (process.env.NODE_ENV || 'development').toUpperCase(),
        execProfile: (process.env.AYA_EXEC_PROFILE || 'cloud_vps_safe').toUpperCase(),
        anonymizedUser: anonymizeUser(eventData.userId || eventData.anonymizedUser || eventData.username),
        http: {
            method: eventData.http?.method || eventData.method || null,
            route: eventData.http?.route || eventData.route || null,
            statusCode: Number(eventData.http?.statusCode || eventData.statusCode || 200),
            clientIpAnonymized: anonymizeIp(eventData.http?.clientIp || eventData.ip)
        },
        metrics: {
            totalDurationMs: parseFloat((eventData.metrics?.totalDurationMs ?? eventData.totalDurationMs ?? 0).toFixed(2)),
            breakdownMs: {
                aiProcessingMs: parseFloat((eventData.metrics?.breakdownMs?.aiProcessingMs ?? eventData.breakdownMs?.aiProcessingMs ?? 0).toFixed(2)),
                mediaRenderMs: parseFloat((eventData.metrics?.breakdownMs?.mediaRenderMs ?? eventData.breakdownMs?.mediaRenderMs ?? 0).toFixed(2)),
                audioSynthesisMs: parseFloat((eventData.metrics?.breakdownMs?.audioSynthesisMs ?? eventData.breakdownMs?.audioSynthesisMs ?? 0).toFixed(2)),
                mediaEncodeMs: parseFloat((eventData.metrics?.breakdownMs?.mediaEncodeMs ?? eventData.breakdownMs?.mediaEncodeMs ?? 0).toFixed(2)),
                otherIoMs: parseFloat((eventData.metrics?.breakdownMs?.otherIoMs ?? eventData.breakdownMs?.otherIoMs ?? 0).toFixed(2))
            },
            payloadSizeBytes: Number(eventData.metrics?.payloadSizeBytes ?? eventData.payloadSizeBytes ?? 0),
            cacheHit: Boolean(eventData.metrics?.cacheHit ?? eventData.cacheHit ?? false)
        },
        technicalDetails: eventData.technicalDetails || {},
        systemState: eventData.systemState || getSystemStateSnapshot(),
        error: eventData.error || null
    };

    metricsQueue.push(normalizedEvent);

    // Maintien du Ring Buffer en RAM pour diagnostic instantané
    recentEventsBuffer.push(normalizedEvent);
    if (recentEventsBuffer.length > RECENT_BUFFER_SIZE) {
        recentEventsBuffer.shift();
    }

    // Déclenchement anticipé du flush si le micro-batch atteint la taille maximale
    if (metricsQueue.length >= BATCH_MAX_SIZE) {
        setImmediate(flushBatch);
    }

    return normalizedEvent.traceId;
}

/**
 * Créateur de Traceur pour pipeline multi-étapes
 * Permet d'isoler chronométriquement les sous-opérations ($T_IA, $T_render, $T_audio, etc.)
 */
function createTrace(initialData = {}) {
    const traceId = initialData.traceId || crypto.randomUUID();
    const startHr = process.hrtime.bigint();
    const startTime = Date.now();

    const breakdown = {
        aiProcessingMs: 0,
        mediaRenderMs: 0,
        audioSynthesisMs: 0,
        mediaEncodeMs: 0,
        otherIoMs: 0
    };

    return {
        traceId,
        startTime,
        breakdown,

        /**
         * Enregistre manuellement une sous-durée
         */
        recordStep(stepKey, durationMs) {
            if (breakdown[stepKey] !== undefined) {
                breakdown[stepKey] += parseFloat(durationMs.toFixed(2));
            } else {
                breakdown[stepKey] = parseFloat(durationMs.toFixed(2));
            }
        },

        /**
         * Enrobe une fonction asynchrone pour mesurer sa durée exacte
         */
        async measureStep(stepKey, asyncFn) {
            const stepStart = process.hrtime.bigint();
            try {
                const result = await asyncFn();
                const elapsedMs = Number(process.hrtime.bigint() - stepStart) / 1e6;
                this.recordStep(stepKey, elapsedMs);
                return result;
            } catch (err) {
                const elapsedMs = Number(process.hrtime.bigint() - stepStart) / 1e6;
                this.recordStep(stepKey, elapsedMs);
                throw err;
            }
        },

        /**
         * Finalise et pousse la métrique complète dans le ring buffer
         */
        finish(finalData = {}) {
            const totalDurationMs = Number(process.hrtime.bigint() - startHr) / 1e6;

            const eventPayload = {
                traceId,
                timestamp: new Date(startTime).toISOString(),
                epochMs: startTime,
                eventType: finalData.eventType || initialData.eventType || 'api_request',
                userId: finalData.userId || initialData.userId,
                http: {
                    method: finalData.http?.method || initialData.http?.method,
                    route: finalData.http?.route || initialData.http?.route,
                    statusCode: finalData.http?.statusCode ?? initialData.http?.statusCode ?? 200,
                    clientIp: finalData.http?.clientIp || initialData.http?.clientIp
                },
                metrics: {
                    totalDurationMs,
                    breakdownMs: this.breakdown,
                    payloadSizeBytes: finalData.payloadSizeBytes ?? initialData.payloadSizeBytes ?? 0,
                    cacheHit: finalData.cacheHit ?? initialData.cacheHit ?? false
                },
                technicalDetails: {
                    ...(initialData.technicalDetails || {}),
                    ...(finalData.technicalDetails || {})
                },
                systemState: getSystemStateSnapshot(),
                error: finalData.error || null
            };

            return recordEvent(eventPayload);
        }
    };
}

/**
 * Démarre le worker de vidage périodique (toutes les 5 secondes)
 */
function startTelemetryWorker() {
    if (flushTimer) return;
    flushTimer = setInterval(() => {
        flushBatch().catch(() => {});
    }, BATCH_FLUSH_INTERVAL_MS);

    // Empêche le timer de bloquer l'arrêt propre de Node.js
    if (flushTimer.unref) {
        flushTimer.unref();
    }
    console.log('[TELEMETRY SERVICE] 🛰️ Worker d\'observabilité démarré (Flush: 5s / 50 événements, JSONL rotatif 7j)');
}

/**
 * Arrête le worker et vide immédiatement la file en attente
 */
async function stopTelemetryWorker() {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
    await flushBatch();
    console.log('[TELEMETRY SERVICE] 🛑 Worker d\'observabilité arrêté et file vidée avec succès.');
}

/**
 * Flush synchrone forcé (idéal pour les scripts de test et les hooks d'arrêt)
 */
async function flushNow() {
    await flushBatch();
}

/**
 * Retourne les statistiques d'exécution du service de télémétrie
 */
function getTelemetryStats() {
    return {
        queueLength: metricsQueue.length,
        totalRecorded: totalRecordedCounter,
        totalFlushed: totalFlushedCounter,
        droppedEvents: droppedEventsCounter,
        telemetryDir: TELEMETRY_DIR,
        todayFile: getTodayLogFilePath(),
        recentEventsCount: recentEventsBuffer.length,
        isDbConnected: isDbConnected()
    };
}

/**
 * Retourne les N derniers événements en mémoire vive
 */
function getRecentEvents(limit = 50) {
    const n = Math.min(limit, recentEventsBuffer.length);
    return recentEventsBuffer.slice(-n).reverse();
}

// Hook de nettoyage propre lors de l'arrêt du processus
process.on('SIGTERM', () => stopTelemetryWorker());
process.on('SIGINT', () => stopTelemetryWorker());

module.exports = {
    recordEvent,
    createTrace,
    startTelemetryWorker,
    stopTelemetryWorker,
    flushNow,
    getTelemetryStats,
    getRecentEvents,
    anonymizeUser,
    anonymizeIp,
    TELEMETRY_DIR
};
