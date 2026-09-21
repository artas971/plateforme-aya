const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { isDbConnected } = require('../config/database');
const { sendVerificationEmail } = require('../services/emailService');

// Mode Fallback Autonome (JSON local si MongoDB n'est pas actif)
const DATA_DIR = path.join(__dirname, '../data');
const FALLBACK_USERS_FILE = path.join(DATA_DIR, 'users.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FALLBACK_USERS_FILE)) {
    fs.writeFileSync(FALLBACK_USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

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

// Liste officielle des 5 testeurs historiques habilités
const AUTHORIZED_TESTERS = [
    { id: 'anais', name: 'Anaïs' },
    { id: 'aya', name: 'Aya' },
    { id: 'soso', name: 'Soso' },
    { id: 'steve', name: 'Steve' },
    { id: 'john', name: 'John' }
];

const ACCESS_CODE = process.env.AYA_ACCESS_CODE || 'Gaza2026';

/**
 * Normalise un pseudonyme au format TikTok (@pseudo)
 */
function normalizeUsername(raw) {
    if (!raw) return '';
    const cleaned = String(raw).trim().toLowerCase();
    return cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
}

/**
 * Middleware de sécurité : Verrouille l'accès aux utilisateurs non connectés
 */
function requireAuth(req, res, next) {
    // 1. Routes publiques ouvertes (authentification, inscription, validation, ressources statiques)
    const publicPaths = [
        '/login',
        '/register',
        '/logout',
        '/verify',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/session',
        '/api/auth/testers',
        '/api/auth/check-username',
        '/api/auth/check-email',
        '/api/auth/verify',
        '/api/auth/resend-verification',
        '/api/tiktok/auth/callback'
    ];

    if (publicPaths.includes(req.path)) {
        return next();
    }

    // 2. Fichiers statiques autorisés pour le rendu de la page login/register
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
            error: "Accès restreint aux utilisateurs connectés. Veuillez vous connecter.",
            requireAuth: true
        });
    }

    // Navigation Web ➔ Redirection automatique vers /login
    return res.redirect('/login');
}

/**
 * GET /api/auth/testers : Liste des testeurs pour le sas de test
 */
router.get(['/testers', '/api/auth/testers'], (req, res) => {
    return res.json({
        success: true,
        testers: AUTHORIZED_TESTERS
    });
});

/**
 * GET /api/auth/check-username : Débruitage frontend pour vérifier la disponibilité du @pseudo
 */
router.get('/api/auth/check-username', async (req, res) => {
    try {
        const rawUsername = req.query.username;
        if (!rawUsername || !rawUsername.trim()) {
            return res.status(400).json({ success: false, available: false, error: "Pseudonyme requis." });
        }

        const username = normalizeUsername(rawUsername);

        // Validation du format type TikTok
        const usernameRegex = /^@[a-z0-9_.]{3,30}$/;
        if (!usernameRegex.test(username)) {
            return res.json({
                success: true,
                available: false,
                username,
                message: "Le pseudo doit comporter entre 3 et 30 caractères (lettres, chiffres, _ et .)"
            });
        }

        // Vérification d'unicité en base de données ou fallback local
        let existing = null;
        if (isDbConnected()) {
            existing = await User.findOne({ username });
        } else {
            const users = readFallbackUsers();
            existing = users.find(u => u.username === username);
        }

        if (existing) {
            return res.json({
                success: true,
                available: false,
                username,
                message: "Ce pseudonyme est déjà pris."
            });
        }

        return res.json({
            success: true,
            available: true,
            username,
            message: "Pseudonyme disponible !"
        });
    } catch (err) {
        console.error('[AUTH CHECK-USERNAME ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/auth/check-email : Débruitage frontend pour vérifier l'existence de l'e-mail
 */
router.get('/api/auth/check-email', async (req, res) => {
    try {
        const rawEmail = req.query.email;
        if (!rawEmail || !rawEmail.trim()) {
            return res.status(400).json({ success: false, available: false, error: "Adresse e-mail requise." });
        }

        const email = rawEmail.trim().toLowerCase();
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return res.json({
                success: true,
                available: false,
                email,
                message: "Format d'adresse e-mail invalide."
            });
        }

        let existing = null;
        if (isDbConnected()) {
            existing = await User.findOne({ email });
        } else {
            const users = readFallbackUsers();
            existing = users.find(u => u.email === email);
        }

        if (existing) {
            return res.json({
                success: true,
                available: false,
                email,
                message: "Cette adresse e-mail est déjà associée à un compte."
            });
        }

        return res.json({
            success: true,
            available: true,
            email,
            message: "Adresse e-mail disponible !"
        });
    } catch (err) {
        console.error('[AUTH CHECK-EMAIL ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/auth/register : Inscription utilisateur & envoi de l'e-mail de confirmation
 */
router.post('/api/auth/register', async (req, res) => {
    try {
        const { username: rawUsername, email: rawEmail, password, firstName, lastName, avatar } = req.body;

        // 1. Validations obligatoires
        if (!rawUsername || !rawUsername.trim()) {
            return res.status(400).json({ success: false, error: "Le pseudonyme est obligatoire." });
        }
        if (!rawEmail || !rawEmail.trim()) {
            return res.status(400).json({ success: false, error: "L'adresse e-mail est obligatoire." });
        }
        if (!password || password.length < 8) {
            return res.status(400).json({ success: false, error: "Le mot de passe doit comporter au moins 8 caractères." });
        }

        const username = normalizeUsername(rawUsername);
        const email = rawEmail.trim().toLowerCase();

        // 2. Contrôle du format du pseudonyme
        const usernameRegex = /^@[a-z0-9_.]{3,30}$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({
                success: false,
                error: "Format de pseudonyme invalide (3 à 30 caractères, lettres, chiffres, _ et .)"
            });
        }

        // 3. Contrôle du format de l'e-mail
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, error: "Format d'adresse e-mail invalide." });
        }

        // 4. Vérification d'unicité (Pseudonyme et E-mail)
        let existingUsername = null;
        let existingEmail = null;

        if (isDbConnected()) {
            existingUsername = await User.findOne({ username });
            existingEmail = await User.findOne({ email });
        } else {
            const users = readFallbackUsers();
            existingUsername = users.find(u => u.username === username);
            existingEmail = users.find(u => u.email === email);
        }

        if (existingUsername) {
            return res.status(409).json({ success: false, error: "Ce pseudonyme est déjà utilisé. Veuillez en choisir un autre." });
        }

        if (existingEmail) {
            return res.status(409).json({ success: false, error: "Cette adresse e-mail est déjà enregistrée. Veuillez vous connecter." });
        }

        // 5. Génération du token unique de vérification (valable 24 heures)
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

        // 6. Sauvegarde de l'utilisateur (MongoDB ou Mode Autonome JSON)
        let createdUser = null;

        if (isDbConnected()) {
            const newUser = new User({
                username,
                email,
                password, // Sera haché automatiquement par le hook pre('save') de User.js
                firstName: firstName ? firstName.trim() : '',
                lastName: lastName ? lastName.trim() : '',
                avatar: avatar || undefined,
                isVerified: false,
                verificationToken,
                verificationTokenExpires
            });

            await newUser.save();
            createdUser = newUser.toJSON();
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const fallbackUser = {
                id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                username,
                email,
                password: hashedPassword,
                firstName: firstName ? firstName.trim() : '',
                lastName: lastName ? lastName.trim() : '',
                name: `${firstName || ''} ${lastName || ''}`.trim() || username,
                avatar: avatar || User.DEFAULT_AVATAR_URL,
                role: 'contributeur',
                isVerified: false,
                verificationToken,
                verificationTokenExpires: verificationTokenExpires.toISOString(),
                createdAt: new Date().toISOString()
            };

            const users = readFallbackUsers();
            users.push(fallbackUser);
            saveFallbackUsers(users);

            const safeUser = { ...fallbackUser };
            delete safeUser.password;
            delete safeUser.verificationToken;
            delete safeUser.verificationTokenExpires;
            createdUser = safeUser;
        }

        console.log(`[AUTH REGISTER] 👤 Nouvel utilisateur enregistré : ${username} (${email}) - En attente de confirmation.`);

        // 7. Envoi de l'e-mail de confirmation (ou fallback console)
        const emailResult = await sendVerificationEmail({
            email,
            username,
            token: verificationToken,
            req
        });

        return res.status(201).json({
            success: true,
            message: "Inscription réussie ! Un lien de confirmation a été envoyé à votre adresse e-mail.",
            emailDelivery: emailResult.mode,
            user: createdUser
        });
    } catch (err) {
        console.error('[AUTH REGISTER ERROR]', err);
        return res.status(500).json({
            success: false,
            error: `Erreur lors de l'inscription : ${err.message}`
        });
    }
});

/**
 * GET /api/auth/verify : Interception et validation du token de confirmation d'e-mail
 */
router.get(['/verify', '/api/auth/verify'], async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.redirect('/login?verified=missing_token');
        }

        let verifiedUser = null;

        if (isDbConnected()) {
            const user = await User.findOne({
                verificationToken: token,
                verificationTokenExpires: { $gt: new Date() }
            }).select('+verificationToken +verificationTokenExpires');

            if (user) {
                user.isVerified = true;
                user.verificationToken = null;
                user.verificationTokenExpires = null;
                await user.save();
                verifiedUser = user;
            }
        } else {
            const users = readFallbackUsers();
            const user = users.find(u => u.verificationToken === token && new Date(u.verificationTokenExpires) > new Date());
            if (user) {
                user.isVerified = true;
                user.verificationToken = null;
                user.verificationTokenExpires = null;
                saveFallbackUsers(users);
                verifiedUser = user;
            }
        }

        if (!verifiedUser) {
            console.warn(`[AUTH VERIFY] ⚠️ Token de vérification invalide ou expiré : ${token}`);
            return res.redirect('/login?verified=expired');
        }

        console.log(`[AUTH VERIFY] ✅ E-mail confirmé avec succès pour l'utilisateur : ${verifiedUser.username} (${verifiedUser.email})`);

        // Redirection vers la page de connexion avec statut de succès
        return res.redirect(`/login?verified=success&username=${encodeURIComponent(verifiedUser.username)}`);
    } catch (err) {
        console.error('[AUTH VERIFY ERROR]', err);
        return res.redirect('/login?verified=error');
    }
});

/**
 * POST /api/auth/resend-verification : Renvoyer un e-mail d'activation si le token a expiré
 */
router.post('/api/auth/resend-verification', async (req, res) => {
    try {
        const { email: rawEmail } = req.body;
        if (!rawEmail || !rawEmail.trim()) {
            return res.status(400).json({ success: false, error: "Adresse e-mail requise." });
        }

        const email = rawEmail.trim().toLowerCase();
        let targetUser = null;
        let isAlreadyVerified = false;

        const newToken = crypto.randomBytes(32).toString('hex');
        const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        if (isDbConnected()) {
            const user = await User.findOne({ email }).select('+verificationToken +verificationTokenExpires');
            if (user) {
                if (user.isVerified) {
                    isAlreadyVerified = true;
                } else {
                    user.verificationToken = newToken;
                    user.verificationTokenExpires = newExpires;
                    await user.save();
                    targetUser = user;
                }
            }
        } else {
            const users = readFallbackUsers();
            const user = users.find(u => u.email === email);
            if (user) {
                if (user.isVerified) {
                    isAlreadyVerified = true;
                } else {
                    user.verificationToken = newToken;
                    user.verificationTokenExpires = newExpires.toISOString();
                    saveFallbackUsers(users);
                    targetUser = user;
                }
            }
        }

        if (isAlreadyVerified) {
            return res.json({ success: true, message: "Votre compte est déjà vérifié. Vous pouvez vous connecter." });
        }

        if (!targetUser) {
            return res.status(404).json({ success: false, error: "Aucun compte associé à cette adresse e-mail." });
        }

        await sendVerificationEmail({
            email: targetUser.email,
            username: targetUser.username,
            token: newToken,
            req
        });

        return res.json({
            success: true,
            message: "Un nouvel e-mail de confirmation a été envoyé."
        });
    } catch (err) {
        console.error('[AUTH RESEND-VERIFICATION ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/auth/login : Sas d'authentification unifié (Testeurs historiques + Comptes enregistrés)
 */
router.post(['/login', '/api/auth/login'], async (req, res) => {
    try {
        const { tester_id, access_code, identifier, password } = req.body;

        // MODE 1 : Connexion des Testeurs Historiques (rétrocompatibilité totale)
        if (tester_id && access_code) {
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

            const expectedCode = (process.env.AYA_ACCESS_CODE || 'Gaza2026').trim();
            if (access_code.trim() !== expectedCode) {
                return res.status(401).json({
                    success: false,
                    error: "Code d'accès invalide. Vérifiez vos identifiants de test."
                });
            }

            req.session.user = {
                id: matched.id,
                username: `@${matched.id}`,
                name: matched.name,
                role: (matched.id.toLowerCase() === 'john' ? 'admin' : 'testeur'),
                isVerified: true,
                authenticated: true,
                loginAt: new Date().toISOString()
            };

            console.log(`[AUTH] 👤 Connexion réussie pour le testeur historique : ${matched.name} (${matched.id})`);

            return res.json({
                success: true,
                user: req.session.user
            });
        }

        // MODE 2 : Connexion par Compte (@pseudo ou e-mail + mot de passe)
        if (identifier && password) {
            const cleanIdentifier = identifier.trim().toLowerCase();
            const isEmail = cleanIdentifier.includes('@') && cleanIdentifier.includes('.');
            const searchUsername = cleanIdentifier.startsWith('@') ? cleanIdentifier : `@${cleanIdentifier}`;

            let user = null;
            let isPasswordCorrect = false;

            if (isDbConnected()) {
                const query = isEmail ? { email: cleanIdentifier } : { username: searchUsername };
                user = await User.findOne(query).select('+password +verificationToken');
                if (user) {
                    isPasswordCorrect = await user.comparePassword(password);
                }
            } else {
                const users = readFallbackUsers();
                user = users.find(u => isEmail ? u.email === cleanIdentifier : u.username === searchUsername);
                if (user) {
                    isPasswordCorrect = await bcrypt.compare(password, user.password);
                }
            }

            if (!user || !isPasswordCorrect) {
                return res.status(401).json({
                    success: false,
                    error: "Identifiant ou mot de passe incorrect."
                });
            }

            // Vérification du statut de confirmation d'e-mail
            if (!user.isVerified) {
                return res.status(403).json({
                    success: false,
                    requireVerification: true,
                    email: user.email,
                    error: "Veuillez confirmer votre adresse e-mail avant de vous connecter. Vérifiez vos courriels ou demandez un renvoi du lien."
                });
            }

            // Connexion établie avec succès
            const userId = user._id ? user._id.toString() : (user.id || user.username);
            req.session.user = {
                id: userId,
                username: user.username,
                name: user.name || user.username,
                email: user.email,
                role: user.role || 'contributeur',
                avatar: user.avatar || User.DEFAULT_AVATAR_URL,
                isVerified: user.isVerified,
                authenticated: true,
                loginAt: new Date().toISOString()
            };

            console.log(`[AUTH] 👤 Connexion réussie pour l'utilisateur : ${user.username} (${user.email})`);

            return res.json({
                success: true,
                user: req.session.user
            });
        }

        // Si aucun mode valide n'est fourni
        return res.status(400).json({
            success: false,
            error: "Veuillez fournir vos identifiants de connexion (Pseudonyme/E-mail et Mot de passe)."
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
    const userName = req.session?.user?.name || req.session?.user?.username || 'Visiteur';
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
