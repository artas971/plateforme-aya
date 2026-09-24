const express = require('express');
const router = express.Router();
const { 
    CREDIT_PACKS, 
    createCheckoutSession, 
    verifyWebhookEvent, 
    isStripeConfigured,
    getPayPalDonationUrl 
} = require('../services/stripeService');
const { addCredits } = require('../services/walletService');

/**
 * Middleware d'authentification interne pour les routes de paiement client
 */
function requireSessionUser(req, res, next) {
    if (!req.session || !req.session.user || !req.session.user.authenticated) {
        return res.status(401).json({
            success: false,
            error: "Veuillez vous connecter pour acheter des crédits."
        });
    }
    next();
}

/**
 * GET /api/payment/packs : Liste des packs de crédits et lien PayPal de solidarité
 */
router.get('/api/payment/packs', (req, res) => {
    res.json({
        success: true,
        packs: Object.values(CREDIT_PACKS),
        paypalUrl: getPayPalDonationUrl(),
        stripeConfigured: isStripeConfigured()
    });
});

/**
 * POST /api/payment/create-checkout-session : Initialise le paiement Stripe Checkout
 */
router.post('/api/payment/create-checkout-session', requireSessionUser, async (req, res) => {
    try {
        const { packId } = req.body;
        if (!packId) {
            return res.status(400).json({
                success: false,
                error: "Identifiant de pack manquant (pack_1, pack_5, pack_25)."
            });
        }

        const session = await createCheckoutSession(packId, req.session.user, req);

        console.log(`[STRIPE CHECKOUT] 🛒 Session initiée pour ${req.session.user.username} (Pack: ${packId}) -> ${session.sessionId}`);
        
        return res.json({
            success: true,
            url: session.url,
            sessionId: session.sessionId
        });
    } catch (err) {
        console.error('[STRIPE CHECKOUT ERROR]', err.message);
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }
});

/**
 * POST /api/payment/webhook : Réception sécurisée des événements de paiement Stripe
 * 
 * SÉCURITÉ :
 * 1. Ne requiert pas de session utilisateur (appelé de serveur à serveur par Stripe).
 * 2. Vérification cryptographique de la signature via le secret STRIPE_WEBHOOK_SECRET.
 * 3. Crédit atomique du portefeuille via walletService.addCredits().
 */
router.post('/api/payment/webhook', async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
        console.warn('[STRIPE WEBHOOK] ⚠️ Requête reçue sans en-tête stripe-signature.');
        return res.status(400).send('En-tête stripe-signature requis.');
    }

    let event;
    const rawBody = req.rawBody || req.body;

    try {
        event = verifyWebhookEvent(rawBody, signature);
    } catch (err) {
        console.error(`[STRIPE WEBHOOK] ❌ Signature invalide : ${err.message}`);
        return res.status(400).send(`Erreur de signature Webhook : ${err.message}`);
    }

    console.log(`[STRIPE WEBHOOK] 🔔 Événement reçu avec succès : ${event.type} [${event.id}]`);

    // Traitement de la finalisation de la commande
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata || {};

        const userId = session.client_reference_id || metadata.userId || metadata.username;
        const credits = parseInt(metadata.credits, 10);
        const packId = metadata.packId || 'pack_unknown';

        if (userId && !isNaN(credits) && credits > 0) {
            console.log(`[STRIPE WEBHOOK] 💳 Paiement validé pour ${userId} ! Ajout de +${credits} crédits (Pack: ${packId})...`);
            
            const result = await addCredits(userId, credits, `stripe_session_${session.id}`);
            
            if (result.success) {
                console.log(`[STRIPE WEBHOOK] ✅ Portefeuille de ${userId} crédité de +${credits} (Nouveau solde: ${result.credits}).`);
                
                // Enregistrement de la transaction financière pour la supervision admin
                try {
                    const { recordTransaction } = require('../services/transactionService');
                    const amountEur = session.amount_total ? (session.amount_total / 100) : (credits === 1 ? 0.99 : credits === 5 ? 2.99 : credits === 25 ? 9.99 : 0);
                    await recordTransaction({
                        userId: result.user?.id || result.user?._id || userId,
                        username: result.user?.username || userId,
                        email: result.user?.email || session.customer_details?.email || null,
                        packId,
                        credits,
                        amount: amountEur,
                        currency: (session.currency || 'EUR').toUpperCase(),
                        provider: 'stripe',
                        providerTransactionId: session.payment_intent || session.id,
                        status: 'succeeded'
                    });
                } catch (txErr) {
                    console.warn('[STRIPE WEBHOOK] ⚠️ Enregistrement transaction non-bloquant :', txErr.message);
                }
            } else {
                console.error(`[STRIPE WEBHOOK] ⚠️ Échec du crédit portefeuille pour ${userId} :`, result.reason);
            }
        } else {
            console.warn('[STRIPE WEBHOOK] ⚠️ Métadonnées incomplètes dans la session Stripe Checkout :', {
                client_reference_id: session.client_reference_id,
                metadata
            });
        }
    }

    // Répondre 200 OK à Stripe pour acquitter la réception
    res.json({ received: true });
});

/**
 * GET /api/payment/transactions : Récupère l'historique des achats de l'utilisateur connecté
 */
router.get('/api/payment/transactions', requireSessionUser, async (req, res) => {
    try {
        const { getUserTransactions } = require('../services/transactionService');
        const userId = req.session.user.id || req.session.user.username;
        const txs = await getUserTransactions(userId, 50);
        return res.json({ success: true, transactions: txs });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/impact/stats : Tableau de bord d'impact public pour la Palestine (Tickets #16 & #17)
 */
router.get('/api/impact/stats', async (req, res) => {
    try {
        const { getSolidarityImpactMetrics } = require('../services/financialMetricsService');
        const metrics = await getSolidarityImpactMetrics();
        return res.json(metrics);
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
