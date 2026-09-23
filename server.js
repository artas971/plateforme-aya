require('dotenv').config();

// Protection Anti-Crash Globale (Exceptions non rattrapées et rejets asynchrones)
process.on('uncaughtException', (err) => {
    console.error('[SERVER GLOBAL UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[SERVER GLOBAL UNHANDLED REJECTION]', reason);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories Setup
const AUDIO_A_TRAITER_DIR = path.join(__dirname, 'audio_a_traiter');
const REPONSED_DIR = path.join(__dirname, 'fichiers_reponse_a_envoyer');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const MESSAGE_FOR_JOHN_DIR = path.join(__dirname, 'message pour john');

fs.mkdirSync(AUDIO_A_TRAITER_DIR, { recursive: true });
fs.mkdirSync(REPONSED_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(MESSAGE_FOR_JOHN_DIR, { recursive: true });

// Cloudflare / Remote Tunnel Reminder Bypass
app.use((req, res, next) => {
    res.setHeader('Bypass-Tunnel-Reminder', 'true');
    res.setHeader('bypass-tunnel-reminder', 'true');
    res.cookie('bypass-tunnel-reminder', 'true', { path: '/' });
    next();
});

// Middlewares Globaux & Limites de taille
app.use(cors());
app.use(express.json({ 
    limit: '50mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session Express (Authentification des Testeurs Habilités)
const session = require('express-session');
const { authRouter, requireAuth } = require('./routes/auth');
const paymentRouter = require('./routes/payment');

app.use(session({
    secret: process.env.SESSION_SECRET || 'aya_secret_key_palestine_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 heures
        httpOnly: true,
        secure: false
    }
}));

// Routeur d'authentification publique (/api/auth/login, /api/auth/session, /logout)
app.use(authRouter);

// =========================================================================
// SYSTÈME DE PRÉSENCE & UTILISATEURS CONNECTÉS EN DIRECT
// =========================================================================
const activeUsers = new Map(); // key: userId/username, value: { id, username, name, role, lastSeen }
const PRESENCE_TIMEOUT_MS = 90 * 1000; // 90s d'inactivité

// Middleware de détection de présence pour toute session active
app.use((req, res, next) => {
    if (req.session && req.session.user && req.session.user.authenticated) {
        const u = req.session.user;
        const key = String(u.id || u.username || 'unknown').toLowerCase();
        activeUsers.set(key, {
            id: key,
            username: u.username || key,
            name: u.name || u.username || 'Utilisateur',
            role: u.role || 'testeur',
            lastSeen: Date.now()
        });
    }
    next();
});

// Endpoint public/session : Nombre de personnes connectées en temps réel
app.get('/api/presence', (req, res) => {
    const now = Date.now();
    for (const [key, user] of activeUsers.entries()) {
        if (now - user.lastSeen > PRESENCE_TIMEOUT_MS) {
            activeUsers.delete(key);
        }
    }
    if (req.session && req.session.user && req.session.user.authenticated) {
        const u = req.session.user;
        const key = String(u.id || u.username || 'unknown').toLowerCase();
        activeUsers.set(key, {
            id: key,
            username: u.username || key,
            name: u.name || u.username || 'Utilisateur',
            role: u.role || 'testeur',
            lastSeen: now
        });
    }
    const userList = Array.from(activeUsers.values()).map(u => ({
        username: u.username,
        name: u.name,
        role: u.role
    }));
    const count = Math.max(activeUsers.size, req.session?.user?.authenticated ? 1 : 0);
    return res.json({
        success: true,
        count,
        users: userList
    });
});

// Routeur de paiement et webhooks Stripe (/api/payment/packs, /checkout, /webhook)
app.use(paymentRouter);

// Page de connexion publique (redirection vers /chat-en-direct si déjà connecté)
app.get('/login', (req, res) => {
    if (req.session && req.session.user && req.session.user.authenticated) {
        return res.redirect('/chat-en-direct');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Pages légales & RGPD publiques (accessibles sans session : conformité Stripe, RGPD et visiteurs)
app.get(['/cgu', '/cgu.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cgu.html'));
});

app.get(['/confidentialite', '/confidentialite.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'confidentialite.html'));
});

// Page de réinitialisation de mot de passe publique (accessible via le lien reçu par e-mail)
app.get(['/reset-password', '/reset-password.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Middleware d'Autorisation Administrateur Strict (Tour de Contrôle)
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user || !req.session.user.authenticated) {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.status(401).json({ success: false, error: "Authentification requise." });
        }
        return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl || '/admin'));
    }

    const adminEmails = (process.env.ADMIN_EMAIL || 'artas971@gmail.com')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);

    const userEmail = (req.session.user.email || '').trim().toLowerCase();
    const userRole = (req.session.user.role || '').trim().toLowerCase();

    if (adminEmails.includes(userEmail) || userRole === 'admin') {
        return next();
    }

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(403).json({ success: false, error: "Accès refusé. Réservé à l'administrateur." });
    }

    return res.status(403).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>403 - Accès Réservé | Aya Studio</title>
            <style>
                body { background: #080d1a; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
                .card { background: #0f172a; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 16px; padding: 2.5rem; max-width: 480px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
                .icon { font-size: 3rem; margin-bottom: 1rem; }
                h1 { color: #ef4444; margin: 0 0 0.75rem 0; font-size: 1.6rem; font-weight: 700; }
                p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }
                .btn { display: inline-flex; align-items: center; gap: 0.5rem; background: #10b981; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 600; }
                .btn:hover { background: #059669; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">⛔</div>
                <h1>Accès Réservé (403)</h1>
                <p>Cette tour de contrôle est strictement réservée à l'administrateur de la plateforme Aya Studio. Le compte <strong>${req.session.user.email || 'actuel'}</strong> n'a pas les autorisations nécessaires.</p>
                <a href="/profil" class="btn">← Retour à mon Espace</a>
            </div>
        </body>
        </html>
    `);
}

// Page d'administration & Tour de Contrôle (Interception AVANT express.static pour étanchéité totale)
app.get(['/admin', '/admin.html'], requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Redirection canonique de index.html et chat.html vers /chat-en-direct (Interception AVANT express.static)
app.get(['/index.html', '/chat.html', '/chat-en-direct.html'], (req, res) => {
    return res.redirect('/chat-en-direct');
});

// Fichiers Statiques (avec index: false pour que '/' passe obligatoirement par requireAuth)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/media', express.static(__dirname));
app.use('/audio_a_traiter', express.static(AUDIO_A_TRAITER_DIR));
app.use('/fichiers_reponse_a_envoyer', express.static(REPONSED_DIR));
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(REPONSED_DIR, filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath, filename);
    } else {
        res.status(404).send('Fichier introuvable');
    }
});
app.use('/download', express.static(REPONSED_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// Racine / et Landing Page : Vitrine publique si visiteur anonyme, redirection automatique vers /chat-en-direct si connecté
app.get(['/', '/landing', '/landing.html'], (req, res) => {
    if (req.session && req.session.user && req.session.user.authenticated) {
        return res.redirect('/chat-en-direct');
    }
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Route canonique du Chat temps réel protégée (/chat-en-direct)
app.get(['/chat-en-direct', '/chat'], requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(['/traducteur', '/traducteur.html'], requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'traducteur.html'));
});

app.get('/communaute', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'communaute.html'));
});

app.get('/moderation', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'moderation.html'));
});

app.get(['/profil', '/profil.html'], requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profil.html'));
});

// Verrouillage de sécurité global : toutes les routes applicatives et API suivantes nécessitent d'être connecté
app.use(requireAuth);

// Montage des Routeurs Modulaires Protégés
const chatRouter = require('./routes/chat');
const studioRouter = require('./routes/studio');
const audioRouter = require('./routes/audio');
const driveRouter = require('./routes/drive');
const traductionRouter = require('./routes/traduction');
const agentsRouter = require('./routes/agents');
const feedbackRouter = require('./routes/feedback');
const postsRouter = require('./routes/posts');
const adminRouter = require('./routes/admin');
const tiktokRouter = require('./routes/tiktok');
const userRouter = require('./routes/user');
const premiumRouter = require('./routes/premium');

app.use('/api/chat', chatRouter);
app.use(studioRouter);
app.use(audioRouter);
app.use('/api/drive', driveRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/posts', postsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);
app.use('/api/premium', premiumRouter);
app.use(traductionRouter);
app.use(tiktokRouter);

// Démarrage du Serveur & Connexion Base de Données
const { connectDB } = require('./config/database');

app.listen(PORT, async () => {
    const activeEnv = (process.env.NODE_ENV || 'development').toUpperCase();
    const execProfile = (process.env.AYA_EXEC_PROFILE || (activeEnv === 'PRODUCTION' ? 'cloud_vps_safe' : 'local_high_perf')).toUpperCase();
    console.log(`Server running on http://localhost:3000 (Architecture modulaire : Chat, Studio, Audio, Drive & Traduction actifs)`);
    console.log(`[AYA ENVIRONMENT] 🌐 Mode: ${activeEnv} | Profil: ${execProfile} | PythonEnv: ${(process.env.PYTHON_ENV || 'local').toUpperCase()}`);
    
    // Statut Configuration TikTok API (Phase 3A)
    const tiktokKey = process.env.TIKTOK_CLIENT_KEY ? `${process.env.TIKTOK_CLIENT_KEY.slice(0, 6)}...` : 'NON DÉFINIE';
    const tiktokCallback = process.env.TIKTOK_CALLBACK_URL || '(En attente Ngrok / Prod)';
    const hasEncKey = !!process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
    console.log(`[TIKTOK CONFIG] 📱 Client Key: ${tiktokKey} | Callback: ${tiktokCallback} | Chiffrement AES-256: ${hasEncKey ? 'Actif (256-bit)' : 'Manquant'}`);
    
    // Initialisation Base de Données MongoDB (Phase 2 - Issue #12)
    await connectDB();

    // Démarrage du Worker autonome Google Drive (Ticket 5)
    const { startDriveWorker } = require('./services/driveWorker');
    startDriveWorker();
});
