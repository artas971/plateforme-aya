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

// Routeur de paiement et webhooks Stripe (/api/payment/packs, /checkout, /webhook)
app.use(paymentRouter);

// Page de connexion publique (redirection vers / si déjà connecté)
app.get('/login', (req, res) => {
    if (req.session && req.session.user && req.session.user.authenticated) {
        return res.redirect('/');
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

// Routes de pages protégées
app.get('/', requireAuth, (req, res) => {
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

app.use('/api/chat', chatRouter);
app.use(studioRouter);
app.use(audioRouter);
app.use('/api/drive', driveRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/posts', postsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);
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
