/**
 * Service de Gestion et d'Historique des Transactions Financières - Aya Studio
 * Gère l'enregistrement et l'agrégation des transactions Stripe & PayPal
 * Compatible Dual-Mode : MongoDB Mongoose & Fallback Local JSON
 */

const fs = require('fs');
const path = require('path');
const { Transaction, isDbConnected } = require('../models');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FALLBACK_TX_FILE = path.join(DATA_DIR, 'transactions.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readFallbackTransactions() {
    try {
        ensureDataDir();
        if (!fs.existsSync(FALLBACK_TX_FILE)) return [];
        const raw = fs.readFileSync(FALLBACK_TX_FILE, 'utf-8');
        return JSON.parse(raw || '[]');
    } catch (e) {
        console.error('[TRANSACTION SERVICE] ❌ Erreur lecture transactions fallback :', e.message);
        return [];
    }
}

function saveFallbackTransactions(txs) {
    try {
        ensureDataDir();
        fs.writeFileSync(FALLBACK_TX_FILE, JSON.stringify(txs, null, 2), 'utf-8');
    } catch (e) {
        console.error('[TRANSACTION SERVICE] ❌ Erreur écriture transactions fallback :', e.message);
    }
}

/**
 * Enregistre une transaction validée (ex: webhook Stripe réussi)
 * @param {Object} txData
 */
async function recordTransaction(txData) {
    const record = {
        id: txData.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        userId: txData.userId || null,
        username: txData.username || 'Anonyme',
        email: txData.email || null,
        packId: txData.packId || 'pack_unknown',
        credits: parseInt(txData.credits, 10) || 0,
        amount: parseFloat(txData.amount) || 0,
        currency: (txData.currency || 'EUR').toUpperCase(),
        provider: txData.provider || 'stripe',
        providerTransactionId: txData.providerTransactionId || null,
        status: txData.status || 'succeeded',
        createdAt: txData.createdAt || new Date().toISOString()
    };

    // 1. Persistance MongoDB (si disponible)
    if (isDbConnected()) {
        try {
            await Transaction.create({
                user: (record.userId && record.userId.length === 24) ? record.userId : null,
                donorEmail: record.email,
                donorName: record.username,
                provider: record.provider === 'paypal' ? 'paypal' : 'stripe',
                type: 'subscription', // type subscription / achat de packs
                amount: record.amount,
                currency: record.currency,
                status: record.status,
                paymentMethod: 'card',
                providerTransactionId: record.providerTransactionId,
                metadata: new Map([
                    ['packId', record.packId],
                    ['credits', String(record.credits)],
                    ['username', record.username]
                ])
            });
            console.log(`[TRANSACTION SERVICE] 💾 Transaction enregistrée dans MongoDB [${record.id}]`);
        } catch (dbErr) {
            console.warn(`[TRANSACTION SERVICE] ⚠️ Impossible d'insérer dans MongoDB (${dbErr.message}), enregistrement fallback.`);
        }
    }

    // 2. Persistance Fallback JSON (systématique pour redondance)
    const list = readFallbackTransactions();
    // Éviter les doublons par providerTransactionId si fourni
    if (record.providerTransactionId) {
        const exists = list.some(t => t.providerTransactionId === record.providerTransactionId);
        if (exists) {
            console.log(`[TRANSACTION SERVICE] ℹ️ Transaction ${record.providerTransactionId} déjà répertoriée.`);
            return record;
        }
    }
    list.unshift(record);
    saveFallbackTransactions(list);
    console.log(`[TRANSACTION SERVICE] ✅ Transaction ${record.id} enregistrée (${record.amount}€, ${record.credits} crédits pour ${record.username})`);
    return record;
}

/**
 * Récupère les transactions récentes
 * @param {number} limit
 */
async function getTransactions(limit = 100) {
    if (isDbConnected()) {
        try {
            const mongoTxs = await Transaction.find({ status: 'succeeded' })
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();

            if (mongoTxs && mongoTxs.length > 0) {
                return mongoTxs.map(t => ({
                    id: t._id.toString(),
                    username: t.donorName || (t.metadata && t.metadata.get ? t.metadata.get('username') : 'Utilisateur'),
                    email: t.donorEmail,
                    amount: t.amount,
                    currency: t.currency,
                    credits: t.metadata && t.metadata.get ? parseInt(t.metadata.get('credits'), 10) || 0 : 0,
                    packId: t.metadata && t.metadata.get ? t.metadata.get('packId') : 'pack_unknown',
                    provider: t.provider,
                    providerTransactionId: t.providerTransactionId,
                    status: t.status,
                    createdAt: t.createdAt
                }));
            }
        } catch (e) {
            console.warn('[TRANSACTION SERVICE] ⚠️ Lecture Mongo échouée, fallback JSON :', e.message);
        }
    }

    const list = readFallbackTransactions();
    return list.slice(0, limit);
}

/**
 * Calcule les indicateurs financiers globaux (CA Brut, Crédits vendus, Répartition des packs)
 */
async function getFinancialKPIs() {
    const txs = await getTransactions(1000);
    const successfulTxs = txs.filter(t => t.status === 'succeeded');

    let totalRevenueEur = 0;
    let totalCreditsSold = 0;
    const packsSold = {
        pack_1: 0,
        pack_5: 0,
        pack_25: 0,
        other: 0
    };

    for (const tx of successfulTxs) {
        totalRevenueEur += (parseFloat(tx.amount) || 0);
        totalCreditsSold += (parseInt(tx.credits, 10) || 0);

        if (tx.packId === 'pack_1') packsSold.pack_1++;
        else if (tx.packId === 'pack_5') packsSold.pack_5++;
        else if (tx.packId === 'pack_25') packsSold.pack_25++;
        else packsSold.other++;
    }

    return {
        totalRevenueEur: Math.round(totalRevenueEur * 100) / 100,
        totalCreditsSold,
        packsSold,
        totalTransactions: successfulTxs.length
    };
}

module.exports = {
    recordTransaction,
    getTransactions,
    getFinancialKPIs,
    readFallbackTransactions,
    saveFallbackTransactions
};
