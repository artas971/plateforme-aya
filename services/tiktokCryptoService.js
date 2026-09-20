/**
 * Service de Chiffrement & Sécurité des Jetons TikTok (Agent Victor)
 * Chiffrement At-Rest AES-256-GCM avec Vecteur d'Initialisation (IV) aléatoire de 16 octets
 * et Tag d'Authentification GCM de 16 octets par valeur chiffrée.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;       // 128 bits
const TAG_LENGTH = 16;      // 128 bits

/**
 * Récupère et valide la clé de chiffrement maîtresse de 256 bits (32 octets).
 */
function getEncryptionKey() {
    const rawKey = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
    if (!rawKey) {
        throw new Error("[VICTOR SECURITY ERROR] La variable TIKTOK_TOKEN_ENCRYPTION_KEY est absente du fichier .env");
    }

    // Si la clé est au format hexadécimal (64 caractères = 32 octets)
    if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
        return Buffer.from(rawKey, 'hex');
    }

    // Si la clé fait exactement 32 caractères
    if (Buffer.byteLength(rawKey, 'utf8') === 32) {
        return Buffer.from(rawKey, 'utf8');
    }

    // Sinon, dérivation SHA-256 pour garantir exactement 32 octets
    return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Chiffre une chaîne en AES-256-GCM.
 * @param {string} plainText 
 * @returns {{ encrypted: string, iv: string, authTag: string }}
 */
function encryptToken(plainText) {
    if (!plainText) return null;
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

/**
 * Déchiffre une chaîne chiffrée en AES-256-GCM avec son IV et son AuthTag.
 * @param {string} encryptedHex 
 * @param {string} ivHex 
 * @param {string} authTagHex 
 * @returns {string}
 */
function decryptToken(encryptedHex, ivHex, authTagHex) {
    if (!encryptedHex || !ivHex || !authTagHex) return null;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

module.exports = {
    encryptToken,
    decryptToken
};
