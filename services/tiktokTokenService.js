/**
 * Service de Gestion & Rotation des Jetons TikTok (Agent Victor)
 * Gère la persistance sécurisée, le déchiffrement et le renouvellement transparent des tokens.
 */

const { isDbConnected } = require('../config/database');
const TikTokAccount = require('../models/TikTokAccount');
const { encryptToken, decryptToken } = require('./tiktokCryptoService');
const https = require('https');
const querystring = require('querystring');

// Cache mémoire de secours si MongoDB local n'est pas actif
const memoryFallbackStore = new Map();

/**
 * Enregistre ou met à jour le compte TikTok associé à un utilisateur avec chiffrement AES-256-GCM.
 */
async function saveTikTokAccount(userId, tokenPayload, profilePayload = {}) {
    if (!userId) throw new Error("[VICTOR] userId requis pour sauvegarder le compte TikTok");
    
    const accessToken = tokenPayload.access_token || tokenPayload.accessToken;
    const refreshToken = tokenPayload.refresh_token || tokenPayload.refreshToken;
    const openId = tokenPayload.open_id || tokenPayload.openId || profilePayload.open_id;
    const expiresIn = Number(tokenPayload.expires_in || tokenPayload.expiresIn || 86400);
    const refreshExpiresIn = Number(tokenPayload.refresh_expires_in || tokenPayload.refreshExpiresIn || 31536000);
    const scope = tokenPayload.scope || '';

    const encAccess = encryptToken(accessToken);
    const encRefresh = encryptToken(refreshToken);

    const now = Date.now();
    const expiresAt = new Date(now + expiresIn * 1000);
    const refreshExpiresAt = new Date(now + refreshExpiresIn * 1000);

    const accountData = {
        userId,
        openId: openId || 'unknown_open_id',
        unionId: profilePayload.union_id || null,
        displayName: profilePayload.display_name || profilePayload.displayName || 'Utilisateur TikTok',
        avatarUrl: profilePayload.avatar_url || profilePayload.avatarUrl || '',
        scope,
        accessTokenEncrypted: encAccess.encrypted,
        accessTokenIV: encAccess.iv,
        accessTokenTag: encAccess.authTag,
        refreshTokenEncrypted: encRefresh.encrypted,
        refreshTokenIV: encRefresh.iv,
        refreshTokenTag: encRefresh.authTag,
        expiresAt,
        refreshExpiresAt,
        connectedAt: new Date()
    };

    // 1. Sauvegarde en mémoire vive immédiate
    memoryFallbackStore.set(userId, { ...accountData, rawAccessToken: accessToken, rawRefreshToken: refreshToken });

    // 2. Sauvegarde MongoDB si la base est connectée
    if (isDbConnected()) {
        try {
            await TikTokAccount.findOneAndUpdate(
                { userId },
                accountData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(`[VICTOR SECURITY] 🛡️ Compte TikTok sauvegardé avec succès en base MongoDB (AES-256-GCM) pour l'utilisateur : ${userId}`);
        } catch (dbErr) {
            console.error(`[VICTOR WARNING] Échec écriture MongoDB, persistance mémoire assurée :`, dbErr.message);
        }
    } else {
        console.log(`[VICTOR SECURITY] ℹ️ MongoDB non connecté : jetons TikTok chiffrés et conservés en mémoire pour ${userId}`);
    }

    return {
        success: true,
        displayName: accountData.displayName,
        openId: accountData.openId,
        expiresAt: accountData.expiresAt
    };
}

/**
 * Récupère le compte TikTok brut depuis MongoDB ou le store mémoire.
 */
async function getRawTikTokAccount(userId) {
    if (!userId) return null;
    if (isDbConnected()) {
        try {
            const acc = await TikTokAccount.findOne({ userId });
            if (acc) return acc.toObject();
        } catch (err) {
            console.warn(`[VICTOR WARNING] Erreur lecture MongoDB :`, err.message);
        }
    }
    return memoryFallbackStore.get(userId) || null;
}

/**
 * Renvoie le statut de connexion TikTok pour un utilisateur.
 */
async function getTikTokAccountStatus(userId) {
    const acc = await getRawTikTokAccount(userId);
    if (!acc) {
        return { connected: false };
    }

    const isExpired = acc.expiresAt ? new Date(acc.expiresAt).getTime() < Date.now() : true;
    return {
        connected: true,
        displayName: acc.displayName || 'Compte TikTok',
        avatarUrl: acc.avatarUrl || '',
        openId: acc.openId,
        expiresAt: acc.expiresAt,
        isExpired
    };
}

/**
 * Renouvelle un access_token expiré via l'API TikTok (grant_type=refresh_token).
 */
function requestTokenRefresh(refreshToken) {
    return new Promise((resolve, reject) => {
        const clientKey = process.env.TIKTOK_CLIENT_KEY;
        const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

        const postData = querystring.stringify({
            client_key: clientKey,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });

        const req = https.request({
            hostname: 'open.tiktokapis.com',
            port: 443,
            path: '/v2/oauth/token/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'Cache-Control': 'no-cache'
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    const tokenData = parsed.data || parsed;
                    if (tokenData && tokenData.access_token) {
                        resolve(tokenData);
                    } else {
                        reject(new Error(`Réponse TikTok invalide lors du refresh : ${body}`));
                    }
                } catch (e) {
                    reject(new Error(`Échec parsing refresh TikTok : ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * Récupère un jeton d'accès TikTok valide et déchiffré, en déclenchant un rafraîchissement transparent si nécessaire.
 */
async function getValidTikTokToken(userId) {
    const acc = await getRawTikTokAccount(userId);
    if (!acc) {
        throw new Error("Aucun compte TikTok relié à cet utilisateur");
    }

    // Déchiffrement de l'access token
    let accessToken = null;
    let refreshToken = null;

    try {
        accessToken = decryptToken(acc.accessTokenEncrypted, acc.accessTokenIV, acc.accessTokenTag);
        refreshToken = decryptToken(acc.refreshTokenEncrypted, acc.refreshTokenIV, acc.refreshTokenTag);
    } catch (decErr) {
        // Fallback si présent en mémoire brute
        accessToken = acc.rawAccessToken;
        refreshToken = acc.rawRefreshToken;
    }

    if (!accessToken) {
        throw new Error("Impossible de déchiffrer le jeton d'accès TikTok");
    }

    // Vérification de validité (marge de sécurité de 5 minutes)
    const now = Date.now();
    const expiresAt = new Date(acc.expiresAt).getTime();
    const needsRefresh = (expiresAt - now) < (5 * 60 * 1000);

    if (needsRefresh && refreshToken) {
        console.log(`[VICTOR TOKEN REFRESH] 🔄 Access Token arrivant à expiration pour ${userId}, renouvellement via refresh_token...`);
        try {
            const refreshed = await requestTokenRefresh(refreshToken);
            await saveTikTokAccount(userId, refreshed, {
                display_name: acc.displayName,
                avatar_url: acc.avatarUrl,
                open_id: acc.openId
            });
            accessToken = refreshed.access_token;
            console.log(`[VICTOR TOKEN REFRESH] ✅ Jeton renouvelé et rechiffré avec succès pour ${userId}`);
        } catch (rfErr) {
            console.warn(`[VICTOR WARNING] Échec du renouvellement automatique : ${rfErr.message}. Utilisation du token existant.`);
        }
    }

    return {
        accessToken,
        openId: acc.openId,
        displayName: acc.displayName,
        avatarUrl: acc.avatarUrl
    };
}

/**
 * Supprime le compte TikTok d'un utilisateur (déconnexion / révocation).
 */
async function disconnectTikTokAccount(userId) {
    memoryFallbackStore.delete(userId);
    if (isDbConnected()) {
        try {
            await TikTokAccount.deleteOne({ userId });
            console.log(`[VICTOR SECURITY] 🗑️ Identifiants TikTok supprimés de la base pour l'utilisateur : ${userId}`);
        } catch (err) {
            console.error(`[VICTOR ERROR] Erreur suppression TikTok MongoDB :`, err.message);
        }
    }
    return { success: true };
}

module.exports = {
    saveTikTokAccount,
    getTikTokAccountStatus,
    getValidTikTokToken,
    disconnectTikTokAccount
};
