/**
 * Service de Paiement & Monétisation Stripe - Plateforme Aya Studio
 * 
 * Gestion des packs de crédits, génération des sessions Stripe Checkout
 * et vérification cryptographique des webhooks d'encaissement.
 */

const CREDIT_PACKS = {
    pack_1: {
        id: 'pack_1',
        name: '1 Crédit Flash',
        credits: 1,
        priceCents: 99, // 0,99 €
        priceFormatted: '0,99 €',
        unitPrice: '0,99 € / vidéo',
        description: 'Dépannage immédiat pour 1 vidéo TikTok VOSTFR complète.',
        badge: null
    },
    pack_5: {
        id: 'pack_5',
        name: 'Pack 5 Crédits',
        credits: 5,
        priceCents: 299, // 2,99 €
        priceFormatted: '2,99 €',
        unitPrice: '~0,60 € / vidéo',
        description: 'Pack Découverte : 5 vidéos complètes avec sous-titrage Impact.',
        badge: 'Populaire',
        popular: true
    },
    pack_25: {
        id: 'pack_25',
        name: 'Pack 25 Crédits',
        credits: 25,
        priceCents: 999, // 9,99 €
        priceFormatted: '9,99 €',
        unitPrice: '~0,40 € / vidéo',
        description: 'Pack Créateur Pro : 25 vidéos complètes au meilleur tarif unitaire.',
        badge: 'Meilleur Tarif',
        bestValue: true
    }
};

/**
 * Initialise le client Stripe de façon dynamique
 */
function getStripeClient() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || !key.startsWith('sk_')) {
        return null;
    }
    const Stripe = require('stripe');
    return new Stripe(key);
}

/**
 * Vérifie si Stripe est configuré
 */
function isStripeConfigured() {
    const key = process.env.STRIPE_SECRET_KEY;
    return Boolean(key && key.startsWith('sk_'));
}

/**
 * Crée une session Stripe Checkout pour un utilisateur connecté
 *
 * @param {string} packId - 'pack_1' | 'pack_5' | 'pack_25'
 * @param {object} user - Objet utilisateur de session ({ id, username, email })
 * @param {object} req - Requête Express pour déduire le baseUrl
 * @returns {Promise<{url: string, sessionId: string}>}
 */
async function createCheckoutSession(packId, user, req) {
    const pack = CREDIT_PACKS[packId];
    if (!pack) {
        throw new Error(`Pack de crédits invalide : "${packId}". Choisissez parmi pack_1, pack_5, pack_25.`);
    }

    const stripe = getStripeClient();
    if (!stripe) {
        throw new Error("Stripe n'est pas encore configuré sur le serveur (STRIPE_SECRET_KEY manquante dans .env).");
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: `Aya Studio — ${pack.name}`,
                        description: pack.description,
                    },
                    unit_amount: pack.priceCents,
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        client_reference_id: String(user.id || user.username),
        customer_email: user.email || undefined,
        metadata: {
            userId: String(user.id || user.username),
            username: String(user.username || ''),
            packId: pack.id,
            credits: String(pack.credits)
        },
        success_url: `${baseUrl}/profil.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/profil.html?payment=cancelled`
    });

    return {
        url: session.url,
        sessionId: session.id
    };
}

/**
 * Vérifie la signature cryptographique d'un webhook Stripe
 *
 * @param {Buffer|string} rawBody - Corps brut de la requête HTTP
 * @param {string} signature - En-tête 'stripe-signature'
 * @returns {object} Événement Stripe vérifié
 */
function verifyWebhookEvent(rawBody, signature) {
    const stripe = getStripeClient();
    if (!stripe) {
        throw new Error("Stripe n'est pas configuré.");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET non défini dans .env.");
    }

    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/**
 * Lien PayPal pour les dons de solidarité (totalement séparé de Stripe)
 */
function getPayPalDonationUrl() {
    return process.env.PAYPAL_ME_URL || 'https://www.paypal.com/sosoxm2026@gmail.com';
}

module.exports = {
    CREDIT_PACKS,
    getStripeClient,
    isStripeConfigured,
    createCheckoutSession,
    verifyWebhookEvent,
    getPayPalDonationUrl
};
