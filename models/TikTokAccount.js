/**
 * Modèle Mongoose TikTokAccount (Agent Victor)
 * Stocke les profils et jetons d'accès TikTok chiffrés en base de données.
 */

const mongoose = require('mongoose');

const TikTokAccountSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    openId: {
        type: String,
        required: true,
        index: true
    },
    unionId: {
        type: String,
        default: null
    },
    displayName: {
        type: String,
        default: ''
    },
    avatarUrl: {
        type: String,
        default: ''
    },
    scope: {
        type: String,
        default: ''
    },
    // Chiffrement AES-256-GCM de l'Access Token
    accessTokenEncrypted: {
        type: String,
        required: true
    },
    accessTokenIV: {
        type: String,
        required: true
    },
    accessTokenTag: {
        type: String,
        required: true
    },
    // Chiffrement AES-256-GCM du Refresh Token
    refreshTokenEncrypted: {
        type: String,
        required: true
    },
    refreshTokenIV: {
        type: String,
        required: true
    },
    refreshTokenTag: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    refreshExpiresAt: {
        type: Date,
        required: true
    },
    connectedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('TikTokAccount', TikTokAccountSchema);
