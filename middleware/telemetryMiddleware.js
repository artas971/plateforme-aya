/**
 * Middleware Express d'Observabilité & Traçabilité - Plateforme Aya
 * 
 * Rôles :
 * - Exclusion immédiate des assets statiques, pings de santé (/health) et fichiers médias
 * - Injection d'un traceId unique (UUIDv4) dans req et dans l'en-tête HTTP 'X-Aya-Trace-Id'
 * - Mesure chronométrique nanoseconde via process.hrtime.bigint()
 * - Enregistrement passif non-bloquant sur l'événement 'finish' / 'close' de la réponse Express
 */

const crypto = require('crypto');
const { recordEvent } = require('../services/telemetryService');

function telemetryMiddleware(req, res, next) {
    // 1. Clause d'exclusion immédiate stricte (Consigne Thomas & Instruction Orchestrateur)
    // Évite de polluer les métriques avec les fichiers statiques, images, css, js et pings de santé
    if (req.path.startsWith('/public') || req.path === '/health' || req.path.endsWith('.ico')) {
        return next();
    }

    // Filtrage étendu des assets statiques et médias
    const lowerPath = req.path.toLowerCase();
    if (
        lowerPath.endsWith('.png') ||
        lowerPath.endsWith('.jpg') ||
        lowerPath.endsWith('.jpeg') ||
        lowerPath.endsWith('.webp') ||
        lowerPath.endsWith('.svg') ||
        lowerPath.endsWith('.css') ||
        lowerPath.endsWith('.js') ||
        lowerPath.endsWith('.map') ||
        lowerPath.endsWith('.woff') ||
        lowerPath.endsWith('.woff2') ||
        lowerPath.endsWith('.ttf') ||
        lowerPath.startsWith('/download') ||
        lowerPath.startsWith('/media') ||
        lowerPath.startsWith('/uploads') ||
        lowerPath.startsWith('/audio_a_traiter') ||
        lowerPath.startsWith('/fichiers_reponse_a_envoyer')
    ) {
        return next();
    }

    // 2. Génération et injection du Trace ID
    const traceId = crypto.randomUUID();
    req.traceId = traceId;
    res.setHeader('X-Aya-Trace-Id', traceId);

    // Initialisation du conteneur de métriques sur req pour enrichissement par les contrôleurs/services
    req.telemetryData = {
        traceId,
        eventType: null, // Si null, sera catégorisé automatiquement ('api_request' ou 'http_request')
        breakdownMs: {},
        technicalDetails: {},
        isCustomRecorded: false // Vrai si un service métier (ex: vocabulaire, studio) a déjà pushé la métrique
    };

    const startHr = process.hrtime.bigint();
    const startTime = Date.now();

    // 3. Écoute passive sur l'achèvement de la réponse HTTP
    let recorded = false;
    const finalizeTelemetry = () => {
        if (recorded) return;
        recorded = true;

        // Si le service métier a déjà enregistré un événement spécialisé (ex: vocab_card_generation), on évite le doublon
        if (req.telemetryData.isCustomRecorded) return;

        const durationMs = Number(process.hrtime.bigint() - startHr) / 1e6;

        // Extraction de la taille du payload
        let payloadSizeBytes = 0;
        const contentLength = res.getHeader('content-length');
        if (contentLength) {
            payloadSizeBytes = parseInt(contentLength, 10) || 0;
        }

        // Catégorisation de l'événement
        let eventType = req.telemetryData.eventType;
        if (!eventType) {
            if (req.path.startsWith('/api/')) {
                eventType = 'api_request';
            } else {
                eventType = 'http_request';
            }
        }

        // Extraction utilisateur anonymisé
        const user = req.session?.user;
        const rawUser = user?.id || user?._id || user?.username || user?.email || 'anon';

        // Envoi dans la file d'attente circulaire (In-Memory Micro-Batching)
        recordEvent({
            traceId,
            timestamp: new Date(startTime).toISOString(),
            epochMs: startTime,
            eventType,
            userId: rawUser,
            http: {
                method: req.method,
                route: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
                statusCode: res.statusCode,
                clientIp: req.ip || req.connection?.remoteAddress
            },
            metrics: {
                totalDurationMs: durationMs,
                breakdownMs: req.telemetryData.breakdownMs,
                payloadSizeBytes,
                cacheHit: Boolean(req.telemetryData.cacheHit)
            },
            technicalDetails: req.telemetryData.technicalDetails,
            error: res.statusCode >= 400 ? (req.telemetryData.error || `HTTP ${res.statusCode}`) : null
        });
    };

    res.once('finish', finalizeTelemetry);
    res.once('close', finalizeTelemetry);

    next();
}

module.exports = telemetryMiddleware;
