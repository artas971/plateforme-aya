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
        // Préfixe timestamp + nettoyage uniquement des caractères interdits par les OS (garde espaces et accents)
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, ext).replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80);
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
const { downloadTelegramMedia } = require('../services/telegramDownloader');

// 2. POST /api/traduction/process : Réception du média (Upload ou Lien Telegram) et déclenchement de la traduction / sous-titrage avec Streaming Temps Réel
router.post('/api/traduction/process', upload.single('media'), async (req, res) => {
    try {
        const b = req.body || {};
        const telegramUrl = (b.telegram_url || '').trim();
        if (!req.file && !telegramUrl) {
            return res.status(400).json({
                success: false,
                code: "NO_MEDIA_PROVIDED",
                message: "Veuillez sélectionner un fichier média ou renseigner un lien Telegram public valide.",
                error: "Veuillez sélectionner un fichier média ou renseigner un lien Telegram public valide."
            });
        }

        const targetLang = (b.target_lang || 'fr').toLowerCase();
        const sourceLang = (b.source_lang || 'auto').toLowerCase();
        const subColor = b.sub_color || '#FFFF00';
        const subPosition = b.sub_position || '950';
        const forceReprocess = b.force_reprocess === 'true' || b.force_reprocess === true;
        const generateTiktokPack = b.generate_tiktok_pack === 'true' || b.generate_tiktok_pack === true;
        const bgTheme = b.bg_theme || 'bg_palestine';
        const expressMode = b.express_mode === 'true' || b.express_mode === true;
        const scriptPath = path.join(ROOT_DIR, 'process_traduction.py');

        // Configuration des en-têtes HTTP pour Chunked Streaming direct
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        let mediaPath = '';
        let originalName = '';
        let fileSizeMb = '0.00';

        if (req.file) {
            mediaPath = req.file.path;
            originalName = req.file.originalname;
            fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(2);
            res.write(`[PROGRESS] 2% - Média reçu sur le serveur. Initialisation du processus Python...\n`);
        } else {
            res.write(`[PROGRESS] 5% - Lien Telegram reçu (${telegramUrl}). Connexion et analyse...\n`);
            try {
                const targetDir = path.join(ROOT_DIR, 'audio_a_traiter');
                const dlResult = await downloadTelegramMedia(telegramUrl, targetDir, (pct, msg) => {
                    res.write(`[PROGRESS] ${pct}% - ${msg}\n`);
                });
                mediaPath = dlResult.filePath;
                originalName = dlResult.filename;
                fileSizeMb = (dlResult.size / (1024 * 1024)).toFixed(2);
                res.write(`[PROGRESS] 40% - Fichier Telegram importé (${fileSizeMb} Mo via ${dlResult.method}). Lancement de l'analyse acoustique...\n`);
            } catch (dlErr) {
                console.error("[Telegram Import Error]:", dlErr);
                const isMediaTooBig = dlErr.code === 'MEDIA_TOO_BIG' || (dlErr.message && dlErr.message.includes('MEDIA_TOO_BIG'));
                const errCode = isMediaTooBig ? "MEDIA_TOO_BIG" : "TELEGRAM_ERROR";
                const errorMsg = isMediaTooBig 
                    ? "Cette vidéo Telegram est trop lourde pour un import automatique. Enregistrez-la depuis Telegram et glissez-la directement ici (jusqu'à 500 Mo)."
                    : "Impossible de récupérer ce média depuis Telegram. Vérifiez le lien ou téléchargez-le manuellement.";

                res.write(`[PROGRESS] 100% - Erreur Telegram : ${errorMsg}\n`);
                res.write(`---JSON_OUTPUT_START---\n${JSON.stringify({ 
                    success: false, 
                    code: errCode,
                    message: errorMsg,
                    error: errorMsg
                })}\n---JSON_OUTPUT_END---\n`);
                return res.end();
            }
        }

        console.log('====================================================');
        console.log('[TRADUCTION PROCESS] Lancement du pipeline (Streaming) :');
        console.log(`  - Mode traitement   : ${expressMode ? '⚡ EXPRESS (Texte Markdown < 5s)' : '🎬 COMPLET (Vidéo & Sous-titres)'}`);
        console.log(`  - Source média      : ${telegramUrl ? `✈️ Télégram (${telegramUrl})` : '📁 Upload Direct'}`);
        console.log(`  - Fichier           : ${originalName}`);
        console.log(`  - Chemin local      : ${mediaPath}`);
        console.log(`  - Taille            : ${fileSizeMb} Mo`);
        console.log(`  - Langue d'origine  : ${sourceLang}`);
        console.log(`  - Langue cible      : ${targetLang === 'ar' ? 'Arabe (VOAR)' : 'Français (VOSTFR)'}`);
        console.log(`  - Couleur sous-titre: ${subColor}`);
        console.log(`  - Position (MarginV): ${subPosition}`);
        console.log(`  - Thème fond (Audio): ${bgTheme}`);
        console.log(`  - Bypass Cache      : ${forceReprocess ? 'OUI (Forcé)' : 'NON (Cache actif)'}`);
        console.log(`  - Pack TikTok       : ${generateTiktokPack ? 'OUI (Couverture & Copywriting)' : 'NON'}`);
        console.log('====================================================');

        const pyProcess = spawn('py', [
            scriptPath,
            mediaPath,
            targetLang,
            subColor,
            subPosition,
            sourceLang,
            String(forceReprocess),
            String(generateTiktokPack),
            String(bgTheme),
            String(expressMode)
        ], { cwd: ROOT_DIR });

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
            res.write(`\n---JSON_OUTPUT_START---\n${JSON.stringify({
                success: false,
                code: "PROCESS_SPAWN_ERROR",
                message: "Le moteur de traitement n'a pas pu démarrer sur le serveur.",
                error: "Le moteur de traitement n'a pas pu démarrer sur le serveur."
            })}\n---JSON_OUTPUT_END---\n`);
            res.end();
        });

        pyProcess.on('close', async (code) => {
            console.log(`[TRADUCTION PROCESS] Script Python terminé avec le code : ${code}`);

            // Téléversement conditionnel Google Drive vers 03_TERMINE si configuré
            try {
                const jsonMatch = stdoutData.match(/---JSON_OUTPUT_START---([\s\S]*?)---JSON_OUTPUT_END---/);
                if (jsonMatch) {
                    const finalData = JSON.parse(jsonMatch[1].trim());
                    if (finalData && finalData.success) {
                        const { uploadDeliverablesToDrive } = require('../services/driveWorker');
                        if (typeof uploadDeliverablesToDrive === 'function') {
                            res.write(`[PROGRESS] 100% - Synchronisation avec Google Drive (03_TERMINE)...\n`);
                            await uploadDeliverablesToDrive({
                                mp4Filename: finalData.mp4_filename,
                                assFilename: finalData.ass_filename,
                                coverFilename: finalData.cover_filename,
                                descFilename: finalData.desc_filename
                            });
                        }
                    }
                }
            } catch (syncErr) {
                console.warn('[DRIVE SYNC WARNING] Téléversement silencieux vers Drive ignoré :', syncErr.message);
            }

            // Si pour une raison quelconque le bloc JSON final n'a pas été émis par Python
            if (!stdoutData.includes('---JSON_OUTPUT_START---')) {
                const fallbackRes = {
                    success: code === 0,
                    code: code === 0 ? null : "PROCESS_FAILED",
                    message: code === 0 ? null : "Une anomalie s'est produite lors de la génération des sous-titres.",
                    error: code === 0 ? null : "Une anomalie s'est produite lors de la génération des sous-titres."
                };
                res.write(`\n---JSON_OUTPUT_START---\n${JSON.stringify(fallbackRes)}\n---JSON_OUTPUT_END---\n`);
            }

            res.end();
        });

    } catch (err) {
        console.error('[TRADUCTION ERROR]', err);
        const errPayload = {
            success: false,
            code: "SERVER_ERROR",
            message: "Une erreur interne temporaire est survenue sur le serveur.",
            error: "Une erreur interne temporaire est survenue sur le serveur."
        };
        if (!res.headersSent) {
            res.status(500).json(errPayload);
        } else {
            res.write(`\n---JSON_OUTPUT_START---\n${JSON.stringify(errPayload)}\n---JSON_OUTPUT_END---\n`);
            res.end();
        }
    }
});

module.exports = router;
