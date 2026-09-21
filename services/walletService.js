const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { isDbConnected } = require('../config/database');

const DATA_DIR = path.join(__dirname, '../data');
const FALLBACK_USERS_FILE = path.join(DATA_DIR, 'users.json');

// Verrou de concurrence d'exécution en mémoire (SEC-1)
// Empêche un même utilisateur de lancer plusieurs encodages vidéo simultanés
const activeUserJobs = new Set();

function acquireUserLock(userId) {
    const key = String(userId).trim();
    if (!key) return true;
    if (activeUserJobs.has(key)) {
        return false;
    }
    activeUserJobs.add(key);
    return true;
}

function releaseUserLock(userId) {
    const key = String(userId).trim();
    if (key) {
        activeUserJobs.delete(key);
    }
}

function isUserProcessing(userId) {
    const key = String(userId).trim();
    return activeUserJobs.has(key);
}

// Helpers de persistance autonome locale
function readFallbackUsers() {
    try {
        if (!fs.existsSync(FALLBACK_USERS_FILE)) return [];
        return JSON.parse(fs.readFileSync(FALLBACK_USERS_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function saveFallbackUsers(users) {
    fs.writeFileSync(FALLBACK_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * Phase 1 : Réservation atomique du crédit (Escrow / Séquestre)
 * Décrémente credits de 1 et incrémente creditsReserved de 1 de façon atomique.
 */
async function reserveCredit(userIdentifier) {
    if (!userIdentifier) {
        return { success: false, reason: "USER_REQUIRED", message: "Utilisateur non identifié." };
    }

    const uid = String(userIdentifier).trim();

    // Mode MongoDB Mongoose
    if (isDbConnected()) {
        try {
            const query = (uid.startsWith('@') || uid.includes('@')) 
                ? { $or: [{ username: uid }, { email: uid.toLowerCase() }] }
                : { _id: uid };

            const user = await User.findOneAndUpdate(
                { ...query, credits: { $gte: 1 } },
                { $inc: { credits: -1, creditsReserved: 1 } },
                { new: true }
            );

            if (!user) {
                // Vérifier si le compte existe pour distinguer solde insuffisant d'utilisateur inexistant
                const exists = await User.findOne(query);
                if (!exists) return { success: false, reason: "USER_NOT_FOUND", message: "Compte introuvable." };
                return { success: false, reason: "INSUFFICIENT_CREDITS", message: "Solde de crédits insuffisant (0 restant).", remainingCredits: exists.credits || 0 };
            }

            console.log(`[WALLET ESCROW] 🔒 Crédit réservé avec succès pour ${user.username} (Solde restant : ${user.credits}, En séquestre : ${user.creditsReserved})`);
            return {
                success: true,
                creditsRemaining: user.credits,
                creditsReserved: user.creditsReserved,
                userId: user._id.toString(),
                username: user.username
            };
        } catch (err) {
            console.error('[WALLET RESERVE ERROR MONGODB]', err);
            return { success: false, reason: "DB_ERROR", message: err.message };
        }
    }

    // Mode Autonome Local JSON (SAFE-1)
    const users = readFallbackUsers();
    const user = users.find(u => 
        u.id === uid || 
        u.username?.toLowerCase() === uid.toLowerCase() || 
        u.email?.toLowerCase() === uid.toLowerCase()
    );

    if (!user) {
        // Rétrocompatibilité : Testeur habilité historique sans compte JSON ?
        if (['anais', 'aya', 'soso', 'steve', 'john'].includes(uid.replace(/^@/, '').toLowerCase())) {
            return { success: true, creditsRemaining: 999, creditsReserved: 0, userId: uid, username: `@${uid.replace(/^@/, '')}` };
        }
        return { success: false, reason: "USER_NOT_FOUND", message: "Utilisateur introuvable." };
    }

    const currentCredits = user.credits !== undefined ? user.credits : 5;
    if (currentCredits < 1) {
        return { success: false, reason: "INSUFFICIENT_CREDITS", message: "Solde de crédits insuffisant.", remainingCredits: currentCredits };
    }

    user.credits = currentCredits - 1;
    user.creditsReserved = (user.creditsReserved || 0) + 1;
    saveFallbackUsers(users);

    console.log(`[WALLET ESCROW (JSON)] 🔒 Crédit réservé pour ${user.username} (Solde restant : ${user.credits}, En séquestre : ${user.creditsReserved})`);
    return {
        success: true,
        creditsRemaining: user.credits,
        creditsReserved: user.creditsReserved,
        userId: user.id,
        username: user.username
    };
}

/**
 * Phase 2A : Validation définitive du débit (Commit)
 * Appelé dès que le MP4 et les sous-titres ASS sont générés avec succès.
 */
async function commitCredit(userIdentifier, metadata = {}) {
    if (!userIdentifier) return false;
    const uid = String(userIdentifier).trim();

    if (isDbConnected()) {
        try {
            const query = (uid.startsWith('@') || uid.includes('@')) 
                ? { $or: [{ username: uid }, { email: uid.toLowerCase() }] }
                : { _id: uid };

            const user = await User.findOneAndUpdate(
                query,
                { $inc: { creditsReserved: -1 } },
                { new: true }
            );

            console.log(`[WALLET COMMIT] ✅ Débit définitif validé pour ${user?.username || uid}`);
            return true;
        } catch (err) {
            console.error('[WALLET COMMIT ERROR]', err);
            return false;
        }
    }

    // Mode Autonome JSON
    const users = readFallbackUsers();
    const user = users.find(u => 
        u.id === uid || 
        u.username?.toLowerCase() === uid.toLowerCase() || 
        u.email?.toLowerCase() === uid.toLowerCase()
    );

    if (user) {
        user.creditsReserved = Math.max(0, (user.creditsReserved || 1) - 1);
        saveFallbackUsers(users);
        console.log(`[WALLET COMMIT (JSON)] ✅ Débit définitif validé pour ${user.username}`);
        return true;
    }
    return false;
}

/**
 * Phase 2B : Restitution immédiate du crédit (Rollback)
 * Appelé si n'importe quelle étape du pipeline plante (FFmpeg, Python, crash réseau).
 */
async function rollbackCredit(userIdentifier, reason = "PIPELINE_ERROR") {
    if (!userIdentifier) return false;
    const uid = String(userIdentifier).trim();

    if (isDbConnected()) {
        try {
            const query = (uid.startsWith('@') || uid.includes('@')) 
                ? { $or: [{ username: uid }, { email: uid.toLowerCase() }] }
                : { _id: uid };

            const user = await User.findOneAndUpdate(
                query,
                { $inc: { credits: 1, creditsReserved: -1 } },
                { new: true }
            );

            console.log(`[WALLET ROLLBACK] 🔄 Crédit restitué à ${user?.username || uid} suite à : ${reason} (Solde : ${user?.credits})`);
            return true;
        } catch (err) {
            console.error('[WALLET ROLLBACK ERROR]', err);
            return false;
        }
    }

    // Mode Autonome JSON
    const users = readFallbackUsers();
    const user = users.find(u => 
        u.id === uid || 
        u.username?.toLowerCase() === uid.toLowerCase() || 
        u.email?.toLowerCase() === uid.toLowerCase()
    );

    if (user) {
        user.credits = (user.credits || 0) + 1;
        user.creditsReserved = Math.max(0, (user.creditsReserved || 1) - 1);
        saveFallbackUsers(users);
        console.log(`[WALLET ROLLBACK (JSON)] 🔄 Crédit restitué à ${user.username} (Solde : ${user.credits})`);
        return true;
    }
    return false;
}

/**
 * Récupère le solde actuel d'un utilisateur
 */
async function getUserWallet(userIdentifier) {
    if (!userIdentifier) return { credits: 0, creditsReserved: 0 };
    const uid = String(userIdentifier).trim();

    if (isDbConnected()) {
        try {
            const query = (uid.startsWith('@') || uid.includes('@')) 
                ? { $or: [{ username: uid }, { email: uid.toLowerCase() }] }
                : { _id: uid };

            const user = await User.findOne(query).select('credits creditsReserved username');
            if (user) {
                return {
                    credits: user.credits !== undefined ? user.credits : 5,
                    creditsReserved: user.creditsReserved || 0,
                    username: user.username
                };
            }
        } catch (e) {}
    }

    // Mode Autonome JSON
    const users = readFallbackUsers();
    const user = users.find(u => 
        u.id === uid || 
        u.username?.toLowerCase() === uid.toLowerCase() || 
        u.email?.toLowerCase() === uid.toLowerCase()
    );

    if (user) {
        return {
            credits: user.credits !== undefined ? user.credits : 5,
            creditsReserved: user.creditsReserved || 0,
            username: user.username
        };
    }

    // Testeurs historiques sans compte
    if (['anais', 'aya', 'soso', 'steve', 'john'].includes(uid.replace(/^@/, '').toLowerCase())) {
        return { credits: 999, creditsReserved: 0, username: `@${uid.replace(/^@/, '')}` };
    }

    return { credits: 0, creditsReserved: 0 };
}

/**
 * Crédite un compte utilisateur (ex: suite à un achat Stripe validé)
 * Fonctionne à la fois sur MongoDB et sur le fichier local de fallback.
 *
 * @param {string} userIdentifier - ID, username ou email de l'utilisateur
 * @param {number} amount - Nombre de crédits à ajouter (> 0)
 * @param {string} [reason='stripe_purchase'] - Contexte du rechargement
 * @returns {Promise<{success: boolean, credits: number, user?: object}>}
 */
async function addCredits(userIdentifier, amount, reason = 'stripe_purchase') {
    const qty = Math.max(1, parseInt(amount, 10) || 1);
    const uid = String(userIdentifier || '').trim();
    if (!uid) return { success: false, reason: "USER_REQUIRED" };

    if (isDbConnected()) {
        try {
            const query = (uid.startsWith('@') || uid.includes('@')) 
                ? { $or: [{ username: uid }, { email: uid.toLowerCase() }] }
                : { _id: uid };

            const user = await User.findOneAndUpdate(
                query,
                { $inc: { credits: qty } },
                { new: true }
            );

            if (user) {
                console.log(`[WALLET CREDIT] 💰 +${qty} crédits crédités pour ${user.username} (${reason}). Nouveau solde : ${user.credits}`);
                return { success: true, credits: user.credits, user: user.toJSON() };
            }
        } catch (err) {
            console.error('[WALLET CREDIT ERROR (MONGO)]', err);
        }
    }

    // Mode Autonome JSON
    const users = readFallbackUsers();
    const user = users.find(u => 
        u.id === uid || 
        u.username?.toLowerCase() === uid.toLowerCase() || 
        u.email?.toLowerCase() === uid.toLowerCase()
    );

    if (user) {
        const prev = user.credits || 0;
        user.credits = prev + qty;
        saveFallbackUsers(users);
        console.log(`[WALLET CREDIT (JSON)] 💰 +${qty} crédits crédités pour ${user.username} (${reason}). Nouveau solde : ${user.credits}`);
        return { success: true, credits: user.credits, user };
    }

    // Si c'est un des testeurs historiques autorisés sans entrée DB
    if (['anais', 'aya', 'soso', 'steve', 'john'].includes(uid.replace(/^@/, '').toLowerCase())) {
        return { success: true, credits: 999, user: { username: `@${uid.replace(/^@/, '')}` } };
    }

    return { success: false, reason: "USER_NOT_FOUND" };
}

module.exports = {
    acquireUserLock,
    releaseUserLock,
    isUserProcessing,
    reserveCredit,
    commitCredit,
    rollbackCredit,
    getUserWallet,
    addCredits
};
