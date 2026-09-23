const fs = require('fs');
const path = require('path');
const Card = require('../models/Card');
const { isDbConnected } = require('../config/database');

const DATA_DIR = path.join(__dirname, '../data');
const FALLBACK_CARDS_FILE = path.join(DATA_DIR, 'cards.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FALLBACK_CARDS_FILE)) {
    fs.writeFileSync(FALLBACK_CARDS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

function readFallbackCards() {
    try {
        if (!fs.existsSync(FALLBACK_CARDS_FILE)) return [];
        return JSON.parse(fs.readFileSync(FALLBACK_CARDS_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function saveFallbackCards(cards) {
    fs.writeFileSync(FALLBACK_CARDS_FILE, JSON.stringify(cards, null, 2), 'utf-8');
}

/**
 * Enregistre une nouvelle fiche de vocabulaire dans l'historique utilisateur
 */
async function recordCardGeneration(cardData) {
    const userId = cardData.userId || cardData.user;
    const username = cardData.username || 'Utilisateur';

    const safeData = {
        theme: cardData.theme || 'Général',
        level: cardData.level || 'debutant',
        titleFr: cardData.titleFr || 'FICHE VOCABULAIRE',
        titleAr: cardData.titleAr || 'بطاقة مفردات',
        imageUrl: cardData.imageUrl,
        imageFilename: cardData.imageFilename || (cardData.imageUrl ? path.basename(cardData.imageUrl) : null),
        audioUrl: cardData.audioUrl,
        audioFilename: cardData.audioFilename || (cardData.audioUrl ? path.basename(cardData.audioUrl) : null),
        words: Array.isArray(cardData.words) ? cardData.words : [],
        costCredits: Number(cardData.costCredits !== undefined ? cardData.costCredits : 1),
        status: cardData.status || 'completed'
    };

    // 1. Mode MongoDB Mongoose
    if (isDbConnected()) {
        try {
            const newCard = new Card({
                user: userId,
                username,
                ...safeData
            });
            await newCard.save();
            console.log(`[CARD HISTORY] 🎴 Fiche enregistrée en base MongoDB pour ${username} (ID: ${newCard._id})`);
            return newCard.toObject();
        } catch (err) {
            console.error('[CARD HISTORY ERROR MONGODB]', err.message);
        }
    }

    // 2. Mode Autonome JSON
    const cards = readFallbackCards();
    const fallbackCard = {
        id: cardData.cardId || `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user: userId,
        username,
        ...safeData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    cards.unshift(fallbackCard);
    saveFallbackCards(cards);
    console.log(`[CARD HISTORY (JSON)] 🎴 Fiche enregistrée dans data/cards.json pour ${username} (ID: ${fallbackCard.id})`);
    return fallbackCard;
}

/**
 * Récupère les fiches générées par un utilisateur
 */
async function getUserCards(userIdentifier, options = {}) {
    if (!userIdentifier) return { cards: [], total: 0 };
    const uid = String(userIdentifier).trim();
    const page = Math.max(1, parseInt(options.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(options.limit || '30', 10)));
    const skip = (page - 1) * limit;

    // 1. Mode MongoDB
    if (isDbConnected()) {
        try {
            const query = (uid.startsWith('@') || uid.includes('@'))
                ? { username: uid.toLowerCase() }
                : { user: uid };

            const total = await Card.countDocuments(query);
            const cards = await Card.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            return {
                cards: cards.map(c => ({ ...c, id: c._id.toString() })),
                total,
                page,
                limit
            };
        } catch (err) {
            console.error('[CARD HISTORY FETCH ERROR MONGODB]', err.message);
        }
    }

    // 2. Mode Autonome JSON
    const cards = readFallbackCards();
    const userCards = cards.filter(c =>
        String(c.user) === uid ||
        String(c.userId) === uid ||
        c.username?.toLowerCase() === uid.toLowerCase()
    );

    const paginated = userCards.slice(skip, skip + limit);
    return {
        cards: paginated,
        total: userCards.length,
        page,
        limit
    };
}

/**
 * Récupère une fiche par son identifiant unique
 */
async function getCardById(cardId) {
    if (!cardId) return null;
    const cid = String(cardId).trim();

    if (isDbConnected()) {
        try {
            const card = await Card.findById(cid).lean();
            if (card) return { ...card, id: card._id.toString() };
        } catch (e) {}
    }

    const cards = readFallbackCards();
    return cards.find(c => c.id === cid || String(c._id) === cid || c.cardId === cid) || null;
}

/**
 * Supprime une fiche de l'historique et nettoie les fichiers associés
 */
async function deleteUserCard(cardId, userIdentifier) {
    if (!cardId || !userIdentifier) return false;
    const cid = String(cardId).trim();
    const uid = String(userIdentifier).trim();

    let deletedCard = null;

    if (isDbConnected()) {
        try {
            const query = (uid.startsWith('@') || uid.includes('@'))
                ? { _id: cid, username: uid.toLowerCase() }
                : { _id: cid, user: uid };

            deletedCard = await Card.findOneAndDelete(query).lean();
        } catch (e) {
            console.error('[CARD DELETE ERROR MONGODB]', e.message);
        }
    } else {
        const cards = readFallbackCards();
        const index = cards.findIndex(c =>
            (c.id === cid || String(c._id) === cid || c.cardId === cid) &&
            (String(c.user) === uid || String(c.userId) === uid || c.username?.toLowerCase() === uid.toLowerCase())
        );

        if (index !== -1) {
            deletedCard = cards.splice(index, 1)[0];
            saveFallbackCards(cards);
        }
    }

    if (deletedCard) {
        // Nettoyage des fichiers physiques si présents dans uploads/cards
        const cleanupFile = (relUrl) => {
            if (!relUrl) return;
            const fullPath = path.join(__dirname, '..', relUrl.replace(/^\//, ''));
            if (fs.existsSync(fullPath)) {
                try {
                    fs.unlinkSync(fullPath);
                    console.log(`[CARD CLEANUP] 🗑️ Fichier supprimé : ${fullPath}`);
                } catch (e) {}
            }
        };

        cleanupFile(deletedCard.imageUrl);
        cleanupFile(deletedCard.audioUrl);
        return true;
    }

    return false;
}

module.exports = {
    recordCardGeneration,
    getUserCards,
    getCardById,
    deleteUserCard
};
