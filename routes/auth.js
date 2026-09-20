const express = require('express');
const router = express.Router();
const path = require('path');

// Liste officielle des 5 testeurs habilités
const AUTHORIZED_TESTERS = [
    { id: 'anais', name: 'Anaïs' },
    { id: 'aya', name: 'Aya' },
    { id: 'soso', name: 'Soso' },
    { id: 'steve', name: 'Steve' },
    { id: 'john', name: 'John' }
];

const ACCESS_CODE = process.env.AYA_ACCESS_CODE || 'Gaza2026';

/**
 * Middleware de sécurité : Verrouille l'accès aux utilisateurs non connectés
 */
function requireAuth(req, res, next) {
    // 1. Routes publiques ouvertes (authentification, ressources statiques, callback OAuth2)
    const publicPaths = ['/login', '/logout', '/api/auth/login', '/api/auth/session', '/api/auth/testers', '/api/tiktok/auth/callback'];
    if (publicPaths.includes(req.path)) {
        return next();
    }

    // 2. Fichiers statiques autorisés pour le rendu de la page login
    const publicExts = ['.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
    const isAsset = publicExts.some(ext => req.path.toLowerCase().endsWith(ext));
    if (isAsset) {
        return next();
    }

    // 3. Vérification de la session active
    if (req.session && req.session.user && req.session.user.authenticated) {
        return next();
    }

    // 4. Si non connecté :
    // Appel API ➔ Code 401 JSON
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({
            success: false,
            error: "Accès restreint aux testeurs habilités. Veuillez vous connecter.",
            requireAuth: true
        });
    }

    // Navigation Web ➔ Redirection automatique vers /login
    return res.redirect('/login');
}

/**
 * GET /api/auth/testers : Liste des testeurs pour le menu déroulant
 */
router.get(['/testers', '/api/auth/testers'], (req, res) => {
    return res.json({
        success: true,
        testers: AUTHORIZED_TESTERS
    });
});

/**
 * POST /api/auth/login : Sas d'authentification
 */
router.post(['/login', '/api/auth/login'], (req, res) => {
    try {
        const { tester_id, access_code } = req.body;

        if (!tester_id || !access_code) {
            return res.status(400).json({
                success: false,
                error: "Veuillez sélectionner votre nom et saisir le code d'accès."
            });
        }

        // Recherche du testeur dans la liste
        const matched = AUTHORIZED_TESTERS.find(t =>
            t.id.toLowerCase() === tester_id.trim().toLowerCase() ||
            t.name.toLowerCase() === tester_id.trim().toLowerCase()
        );

        if (!matched) {
            return res.status(403).json({
                success: false,
                error: "Identité non autorisée. Seuls Anaïs, Aya, Soso, Steve et John sont habilités."
            });
        }

        // Vérification du code d'accès global
        const expectedCode = (process.env.AYA_ACCESS_CODE || 'Gaza2026').trim();
        if (access_code.trim() !== expectedCode) {
            return res.status(401).json({
                success: false,
                error: "Code d'accès invalide. Vérifiez vos identifiants de test."
            });
        }

        // Enregistrement en session Express
        req.session.user = {
            id: matched.id,
            username: matched.id,
            name: matched.name,
            role: (matched.id.toLowerCase() === 'john' ? 'admin' : 'testeur'),
            authenticated: true,
            loginAt: new Date().toISOString()
        };

        console.log(`[AUTH] 👤 Connexion réussie pour le testeur : ${matched.name} (${matched.id})`);

        return res.json({
            success: true,
            user: req.session.user
        });
    } catch (err) {
        console.error('[AUTH LOGIN ERROR]', err);
        return res.status(500).json({
            success: false,
            error: `Erreur interne d'authentification : ${err.message}`
        });
    }
});

/**
 * GET /api/auth/session : Vérifier la session active en direct
 */
router.get(['/session', '/api/auth/session'], (req, res) => {
    if (req.session && req.session.user && req.session.user.authenticated) {
        return res.json({
            authenticated: true,
            user: req.session.user
        });
    }
    return res.json({
        authenticated: false,
        user: null
    });
});

/**
 * ALL /logout & /api/auth/logout : Détruit la session et déconnecte l'utilisateur
 */
router.all(['/logout', '/api/auth/logout'], (req, res) => {
    const userName = req.session?.user?.name || 'Visiteur';
    if (req.session) {
        req.session.destroy((err) => {
            if (err) console.error('[AUTH LOGOUT ERROR]', err);
            console.log(`[AUTH] 🚪 Déconnexion effectuée pour : ${userName}`);
            res.clearCookie('connect.sid');
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.json({ success: true, message: "Déconnecté avec succès." });
            }
            return res.redirect('/login');
        });
    } else {
        return res.redirect('/login');
    }
});

module.exports = {
    authRouter: router,
    requireAuth,
    AUTHORIZED_TESTERS
};
