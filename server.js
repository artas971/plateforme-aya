require('dotenv').config();
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Fichiers Statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(__dirname));
app.use('/audio_a_traiter', express.static(AUDIO_A_TRAITER_DIR));
app.use('/fichiers_reponse_a_envoyer', express.static(REPONSED_DIR));
app.use('/download', express.static(REPONSED_DIR));

// Montage des 5 Routeurs Modulaires
const chatRouter = require('./routes/chat');
const studioRouter = require('./routes/studio');
const audioRouter = require('./routes/audio');
const driveRouter = require('./routes/drive');
const traductionRouter = require('./routes/traduction');

app.use('/api/chat', chatRouter);
app.use(studioRouter);
app.use(audioRouter);
app.use('/api/drive', driveRouter);
app.use(traductionRouter);

// Démarrage du Serveur
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:3000 (Architecture modulaire : Chat, Studio, Audio, Drive & Traduction actifs)`);
    
    // Démarrage du Worker autonome Google Drive (Ticket 5)
    const { startDriveWorker } = require('./services/driveWorker');
    startDriveWorker();
});
