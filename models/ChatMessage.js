const mongoose = require('mongoose');

/**
 * Modèle Mongoose pour les Messages Éphémères du Chat (Ticket #24 - TICKET-06)
 * - Index TTL automatique de 24h (86400s) sur createdAt
 * - Index composé { recipient: 1, sender: 1 } pour l'isolation ultra-rapide des DMs
 * - Index { timestamp: 1 } pour le tri chronologique
 */
const ChatMessageSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    sender: {
        type: String,
        required: true,
        trim: true
    },
    recipient: {
        type: String,
        default: 'all',
        trim: true
    },
    replyTo: {
        id: { type: String, default: null },
        sender: { type: String, default: null },
        text: { type: String, default: null }
    },
    userLang: {
        type: String,
        enum: ['fr', 'ar', 'auto'],
        default: 'fr'
    },
    originalText: {
        type: String,
        required: true,
        trim: true
    },
    translatedText: {
        type: String,
        default: '',
        trim: true
    },
    translationStatus: {
        type: String,
        enum: ['translating', 'done', 'error'],
        default: 'translating'
    },
    status: {
        type: String,
        default: 'sent'
    },
    audioFile: {
        type: String,
        default: null
    },
    audioUrl: {
        type: String,
        default: null
    },
    audioStatus: {
        type: String,
        enum: ['none', 'pending', 'ready', 'error'],
        default: 'pending'
    },
    ai_model_used: {
        type: String,
        default: null
    },
    timestamp: {
        type: Number,
        default: () => Date.now(),
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false,
    versionKey: false
});

// 1. Index TTL automatique 24h (86400 secondes) pour l'épuration sans cron
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

// 2. Index composé pour requêtes ultra-rapides sur les DMs et salons publics
ChatMessageSchema.index({ recipient: 1, sender: 1 });

const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);

module.exports = ChatMessage;
