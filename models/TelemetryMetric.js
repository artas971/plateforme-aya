const mongoose = require('mongoose');

/**
 * Modèle Mongoose pour les Métriques de Télémétrie & Observabilité (Phase 1)
 * - Index TTL natif WiredTiger : suppression automatique au bout de 7 jours (604800s)
 * - Index composé { eventType: 1, createdAt: -1 } pour l'interrogation rapide par Hugo et Alexandre
 * - Index { traceId: 1 } pour la corrélation chirurgicale d'un incident
 */
const TelemetryMetricSchema = new mongoose.Schema({
    traceId: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    epochMs: {
        type: Number,
        required: true
    },
    eventType: {
        type: String,
        required: true,
        index: true,
        enum: [
            'video_generation',
            'vocab_card_generation',
            'audio_synthesis_unit',
            'shami_translation',
            'chat_sse_broadcast',
            'api_request',
            'http_request'
        ]
    },
    environment: {
        type: String,
        default: 'DEVELOPMENT'
    },
    execProfile: {
        type: String,
        default: 'CLOUD_VPS_SAFE'
    },
    anonymizedUser: {
        type: String,
        default: 'anon',
        index: true
    },
    http: {
        method: { type: String, default: null },
        route: { type: String, default: null },
        statusCode: { type: Number, default: 200 },
        clientIpAnonymized: { type: String, default: null }
    },
    metrics: {
        totalDurationMs: { type: Number, required: true },
        breakdownMs: {
            aiProcessingMs: { type: Number, default: 0 },
            mediaRenderMs: { type: Number, default: 0 },
            audioSynthesisMs: { type: Number, default: 0 },
            mediaEncodeMs: { type: Number, default: 0 },
            otherIoMs: { type: Number, default: 0 }
        },
        payloadSizeBytes: { type: Number, default: 0 },
        cacheHit: { type: Boolean, default: false }
    },
    technicalDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    systemState: {
        heapUsedMb: { type: Number, default: 0 },
        rssMemoryMb: { type: Number, default: 0 },
        activeSseClients: { type: Number, default: 0 }
    },
    error: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 604800 // TTL 7 jours (7 * 24 * 3600 secondes)
    }
}, {
    timestamps: false,
    versionKey: false
});

// Index composés pour optimiser les requêtes d'agrégation d'Hugo
TelemetryMetricSchema.index({ eventType: 1, createdAt: -1 });
TelemetryMetricSchema.index({ "http.statusCode": 1, createdAt: -1 });

const TelemetryMetric = mongoose.model('TelemetryMetric', TelemetryMetricSchema);

module.exports = TelemetryMetric;
