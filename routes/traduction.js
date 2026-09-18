const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const ROOT_DIR = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Configuration de stockage Multer (limite 500 Mo)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Préfixe timestamp + assainissement et limitation de longueur (anti-dépassement Windows MAX_PATH)
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, ext).replace(/[^\w.-]/g, '_').slice(0, 60);
        cb(null, `${Date.now()}_${base}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 Mo max
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = [
            // Audio
            '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus',
            // Vidéo
            '.mp4', '.mov', '.mkv', '.avi', '.webm'
        ];

        if (allowedExtensions.includes(ext) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error(`Format non supporté (${ext}). Seuls les fichiers audio et vidéo sont acceptés.`));
        }
    }
});

// 1. GET /traduction : Afficher l'interface web de traduction
router.get('/traduction', (req, res) => {
    const pagePath = path.join(ROOT_DIR, 'public', 'traduction.html');
    if (fs.existsSync(pagePath)) {
        res.sendFile(pagePath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="UTF-8"><title>Aya - Traduction & Sous-titrage</title></head>
            <body style="background:#121212;color:#eee;font-family:sans-serif;padding:40px;text-align:center;">
                <h1>Aya Traduction & Sous-titrage Vidéo</h1>
                <p>La route backend est prête. L'interface <code>public/traduction.html</code> sera créée à l'Étape 2.</p>
            </body>
            </html>
        `);
    }
});

const { spawn } = require('child_process');

// 2. POST /api/traduction/process : Réception du média et déclenchement de la traduction / sous-titrage avec Streaming Temps Réel
router.post('/api/traduction/process', upload.single('media'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "Aucun fichier média reçu sous le champ 'media'."
            });
        }

        const targetLang = (req.body.target_lang || 'fr').toLowerCase();
        const sourceLang = (req.body.source_lang || 'auto').toLowerCase();
        const subColor = req.body.sub_color || '#FFFF00';
        const subPosition = req.body.sub_position || '950';
        const forceReprocess = req.body.force_reprocess === 'true' || req.body.force_reprocess === true;
        const mediaPath = req.file.path;
        const scriptPath = path.join(ROOT_DIR, 'process_traduction.py');

        console.log('====================================================');
        console.log('[TRADUCTION PROCESS] Lancement du pipeline (Streaming) :');
        console.log(`  - Fichier source    : ${req.file.originalname}`);
        console.log(`  - Chemin local      : ${mediaPath}`);
        console.log(`  - Taille            : ${(req.file.size / (1024 * 1024)).toFixed(2)} Mo`);
        console.log(`  - Langue d'origine  : ${sourceLang}`);
        console.log(`  - Langue cible      : ${targetLang === 'ar' ? 'Arabe (VOAR)' : 'Français (VOSTFR)'}`);
        console.log(`  - Couleur sous-titre: ${subColor}`);
        console.log(`  - Position (MarginV): ${subPosition}`);
        console.log(`  - Bypass Cache      : ${forceReprocess ? 'OUI (Forcé)' : 'NON (Cache actif)'}`);
        console.log('====================================================');

        // Configuration des en-têtes HTTP pour Chunked Streaming direct
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Envoi du premier chunk de connexion
        res.write(`[PROGRESS] 2% - Média reçu sur le serveur. Initialisation du processus Python...\n`);

        const pyProcess = spawn('py', [scriptPath, mediaPath, targetLang, subColor, subPosition, sourceLang, String(forceReprocess)], { cwd: ROOT_DIR });

        let stdoutData = '';
        let stderrData = '';

        pyProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdoutData += chunk;
            res.write(chunk);
        });

        pyProcess.stderr.on('data', (data) => {
            const errChunk = data.toString();
            stderrData += errChunk;
            console.error('[TRADUCTION PY STDERR]', errChunk.trim());
        });

        pyProcess.on('error', (err) => {
            console.error('[TRADUCTION SPAWN ERROR]', err);
            res.write(`\n---JSON_OUTPUT_START---\n{"success": false, "error": "Échec lancement script Python: ${err.message}"}\n---JSON_OUTPUT_END---\n`);
            res.end();
        });

        pyProcess.on('close', (code) => {
            console.log(`[TRADUCTION PROCESS] Script Python terminé avec le code : ${code}`);

            // Si pour une raison quelconque le bloc JSON final n'a pas été émis par Python
            if (!stdoutData.includes('---JSON_OUTPUT_START---')) {
                const fallbackRes = {
                    success: code === 0,
                    error: code === 0 ? null : (stderrData.trim() || `Le script s'est arrêté avec le code d'erreur ${code}`)
                };
                res.write(`\n---JSON_OUTPUT_START---\n${JSON.stringify(fallbackRes)}\n---JSON_OUTPUT_END---\n`);
            }

            res.end();
        });

    } catch (err) {
        console.error('[TRADUCTION ERROR]', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.write(`\n---JSON_OUTPUT_START---\n{"success": false, "error": "${err.message}"}\n---JSON_OUTPUT_END---\n`);
            res.end();
        }
    }
});

module.exports = router;
