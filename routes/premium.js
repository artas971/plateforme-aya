const express = require('express');
const router = express.Router();
const path = require('path');
const { requireAuth } = require('./auth');
const { reserveCredit, commitCredit, rollbackCredit, getUserWallet } = require('../services/walletService');
const vocabCardService = require('../services/vocabularyCardService');
const { recordCardGeneration, getUserCards, getCardById, deleteUserCard } = require('../services/cardHistoryService');

const VALID_LEVELS = ['debutant', 'intermediaire', 'avance'];

/**
 * POST /api/premium/vocabulary-card
 * Génère une fiche de vocabulaire 9:16 bilingue avec audio combiné
 * Protégé par requireAuth et sécurisé par séquestre atomique de crédit (Escrow)
 */
router.post('/vocabulary-card', requireAuth, async (req, res) => {
    const sessionUser = req.session?.user;
    if (!sessionUser || !sessionUser.authenticated) {
        return res.status(401).json({
            success: false,
            error: "Connexion requise pour accéder aux fonctionnalités Premium.",
            requireAuth: true
        });
    }

    const userId = sessionUser.id || sessionUser._id || sessionUser.username;
    const username = sessionUser.username || sessionUser.name || 'Utilisateur';

    // 1. Validation et assainissement des entrées
    let { theme, level, customWords } = req.body || {};

    const safeTheme = typeof theme === 'string' && theme.trim() ? theme.trim().slice(0, 100) : 'Vocabulaire du quotidien';
    const safeLevel = VALID_LEVELS.includes(String(level).toLowerCase()) ? String(level).toLowerCase() : 'debutant';

    let safeCustomWords = null;
    if (Array.isArray(customWords)) {
        safeCustomWords = customWords
            .map(w => (typeof w === 'string' ? w.trim() : ''))
            .filter(Boolean)
            .slice(0, 10);
        if (safeCustomWords.length === 0) safeCustomWords = null;
    }

    console.log(`[API VOCAB CARD] 📥 Requête reçue de ${username} (Thème: "${safeTheme}", Niveau: ${safeLevel})`);

    // 2. Vérification et Séquestre Atomique du Crédit (Escrow Phase 1)
    const reservation = await reserveCredit(userId);
    if (!reservation.success) {
        if (reservation.reason === 'INSUFFICIENT_CREDITS') {
            console.warn(`[API VOCAB CARD] ⛔ Solde insuffisant pour ${username} (Solde : ${reservation.remainingCredits || 0})`);
            return res.status(402).json({
                success: false,
                reason: "INSUFFICIENT_CREDITS",
                error: "Solde de crédits insuffisant. Veuillez recharger votre solde pour générer une fiche.",
                remainingCredits: reservation.remainingCredits !== undefined ? reservation.remainingCredits : 0,
                rechargeUrl: "/profil#packs"
            });
        }

        console.error(`[API VOCAB CARD] ⚠️ Échec réservation crédit pour ${username} :`, reservation.message);
        return res.status(400).json({
            success: false,
            error: reservation.message || "Impossible de vérifier votre solde de crédits."
        });
    }

    // 3. Exécution du Pipeline de Génération avec Rollback Garanti
    try {
        const cardResult = await vocabCardService.generateFullVocabularyCard({
            theme: safeTheme,
            level: safeLevel,
            customWords: safeCustomWords
        });

        // 4A. Validation Définitive du Débit (Commit Phase 2A)
        await commitCredit(userId, {
            cardId: cardResult.cardId,
            type: 'vocabulary_card'
        });

        // 5. Persistance dans l'Historique Utilisateur
        const savedCard = await recordCardGeneration({
            userId,
            username,
            cardId: cardResult.cardId,
            theme: cardResult.theme || safeTheme,
            level: safeLevel,
            titleFr: cardResult.titleFr,
            titleAr: cardResult.titleAr,
            imageUrl: cardResult.imageUrl,
            imageFilename: cardResult.imageFilename || path.basename(cardResult.imageUrl),
            audioUrl: cardResult.audioUrl,
            audioFilename: cardResult.audioFilename || path.basename(cardResult.audioUrl),
            words: cardResult.words,
            costCredits: 1
        });

        console.log(`[API VOCAB CARD] 🎉 Génération terminée avec succès pour ${username} (Fiche ID: ${cardResult.cardId})`);

        return res.status(200).json({
            success: true,
            message: "Fiche de vocabulaire générée avec succès.",
            card: savedCard,
            remainingCredits: reservation.creditsRemaining
        });

    } catch (err) {
        console.error(`[API VOCAB CARD ERROR] 💥 Erreur génération pour ${username} :`, err);

        // 4B. Restitution Immédiate du Crédit Séquestré (Rollback Phase 2B)
        await rollbackCredit(userId, "VOCAB_GENERATION_FAILED");

        return res.status(500).json({
            success: false,
            error: err.message || "Une erreur est survenue lors de la génération de la fiche.",
            creditRestored: true,
            message: "La génération a échoué en raison d'un problème technique. Votre crédit vous a été automatiquement restitué."
        });
    }
});

/**
 * GET /api/premium/vocabulary-cards
 * Liste des fiches générées par l'utilisateur connecté
 */
router.get('/vocabulary-cards', requireAuth, async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        const userId = sessionUser.id || sessionUser._id || sessionUser.username;

        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '30', 10);

        const result = await getUserCards(userId, { page, limit });

        return res.json({
            success: true,
            count: result.cards.length,
            total: result.total,
            page: result.page,
            limit: result.limit,
            cards: result.cards
        });
    } catch (err) {
        console.error('[API VOCAB CARDS LIST ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/premium/vocabulary-cards/:id
 * Détails d'une fiche spécifique
 */
router.get('/vocabulary-cards/:id', requireAuth, async (req, res) => {
    try {
        const cardId = req.params.id;
        const card = await getCardById(cardId);

        if (!card) {
            return res.status(404).json({ success: false, error: "Fiche introuvable." });
        }

        return res.json({ success: true, card });
    } catch (err) {
        console.error('[API VOCAB CARD GET ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/premium/vocabulary-cards/:id
 * Suppression d'une fiche de l'historique
 */
router.delete('/vocabulary-cards/:id', requireAuth, async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        const userId = sessionUser.id || sessionUser._id || sessionUser.username;
        const cardId = req.params.id;

        const deleted = await deleteUserCard(cardId, userId);
        if (deleted) {
            return res.json({ success: true, message: "Fiche supprimée avec succès." });
        } else {
            return res.status(404).json({ success: false, error: "Fiche introuvable ou non autorisée." });
        }
    } catch (err) {
        console.error('[API VOCAB CARD DELETE ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
