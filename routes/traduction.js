const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const ROOT_DIR = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/**
 * Assainit un nom de fichier pour éliminer définitivement tout risque de Mojibake :
 * 1. Dé-diacritise (supprime les accents : "rôle" -> "role")
 * 2. Retire les caractères spéciaux (ne conserve que l'alphanumérique, espaces, tirets)
 * 3. Tronque à 50 caractères max sans couper au milieu d'un mot.
 */
function sanitizeFileName(origName, maxLength = 50) {
    if (!origName) return 'media';
    let name = origName;

    // Détection et redressement préventif d'un encodage Latin-1 mal interprété
    try {
        if (/[\xC2-\xF4][\x80-\xBF]/.test(name)) {
            // Séquence UTF-8 valide
        } else {
            const decoded = Buffer.from(name, 'latin1').toString('utf8');
            if (decoded && !decoded.includes('\uFFFD') && decoded.length < name.length) {
                name = decoded;
            }
        }
    } catch (e) {}

    // Supprime les accents
    name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Ne conserve que lettres, chiffres, espaces et tirets
    name = name.replace(/[^a-zA-Z0-9\s\-]/g, ' ');
    // Nettoie les espaces multiples
    name = name.replace(/\s+/g, ' ').trim();

    if (!name) return 'media';

    // Tronquage propre à 50 caractères max sans couper au milieu d'un mot
    if (name.length > maxLength) {
        let truncated = name.slice(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 15) {
            name = truncated.slice(0, lastSpace).trim();
        } else {
            name = truncated.trim();
        }
    }

    return name || 'media';
}

// Configuration de stockage Multer (limite 500 Mo)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const rawBase = path.basename(file.originalname, ext);
        const cleanBase = sanitizeFileName(rawBase, 50);
        cb(null, `${Date.now()}_${cleanBase}${ext}`);
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

/**
 * Nettoyage du Cache / Garbage Collection (Max) :
 * Supprime définitivement le fichier média source (brut uploadé ou téléchargé via Telegram)
 * et les extractions audio temporaires (.wav) du dossier de travail.
 * Garantit un environnement stérile et empêche tout recyclage d'ancien média.
 */
function cleanupTemporaryMedia(mediaPath) {
    if (!mediaPath) return;

    try {
        if (fs.existsSync(mediaPath)) {
            fs.unlinkSync(mediaPath);
            console.log(`[GARBAGE COLLECTION] 🗑️ Média source supprimé définitivement : ${path.basename(mediaPath)}`);
        }
    } catch (unlinkErr) {
        console.warn(`[GARBAGE COLLECTION WARNING] Impossible de supprimer le média source (${mediaPath}) :`, unlinkErr.message);
    }

    // Nettoyage des extractions audio temporaires (.wav) résiduelles dans le dossier de travail
    try {
        const mediaDir = path.dirname(mediaPath);
        if (fs.existsSync(mediaDir)) {
            const files = fs.readdirSync(mediaDir);
            for (const file of files) {
                const lower = file.toLowerCase();
                if (lower.endsWith('.wav') || lower.endsWith('_temp.wav') || lower.startsWith('temp_')) {
                    try {
                        fs.unlinkSync(path.join(mediaDir, file));
                        console.log(`[GARBAGE COLLECTION] 🗑️ Fichier audio temporaire purgé : ${file}`);
                    } catch (e) {}
                }
            }
        }
    } catch (dirErr) {
        console.warn(`[GARBAGE COLLECTION WARNING] Erreur inspection répertoire temporaire :`, dirErr.message);
    }
}
const { performance } = require('perf_hooks');

/**
 * Génère le Rapport d'Audit des Performances formaté (Agent Alexandre).
 * Structure les métriques collectées par Max (Node.js) et le moteur Python (Thomas, Jade, Nadine, Lionel).
 */
function formatAlexandreAuditReport({ metrics = {}, totalDurationS = 0, mediaName = '', mediaDuration = 0, targetLang = 'fr' }) {
    const lines = [];
    lines.push('================================================================================');
    lines.push("📊 RAPPORT D'AUDIT DES PERFORMANCES - PIPELINE AYA (AGENT ALEXANDRE)");
    lines.push('================================================================================');
    lines.push(`Média analysé       : ${mediaName || 'Inconnu'}`);
    lines.push(`Durée du média      : ${mediaDuration > 0 ? mediaDuration.toFixed(1) + 's' : 'N/A'}`);
    lines.push(`Langue cible        : ${targetLang === 'ar' ? 'Arabe (VOAR)' : 'Français (VOSTFR)'}`);
    lines.push(`Temps total pipeline: ${totalDurationS.toFixed(2)}s`);
    const activeEnv = (process.env.PYTHON_ENV || process.env.NODE_ENV || 'local').toUpperCase();
    const execProfile = metrics['execution_profile']?.details || (process.env.AYA_EXEC_PROFILE ? process.env.AYA_EXEC_PROFILE.toUpperCase() : (activeEnv === 'PRODUCTION' ? 'CLOUD_VPS_SAFE' : 'LOCAL_HIGH_PERF'));
    lines.push(`Profil d'exécution  : ${execProfile} [${activeEnv}]`);
    lines.push('--------------------------------------------------------------------------------');
    lines.push('DÉTAIL CHRONOMÉTRIQUE PAR AGENT & TÂCHE :');
    lines.push('--------------------------------------------------------------------------------');

    const taskDefinitions = [
        { key: 'max_request_init', agent: 'Max', tool: 'Node.js', label: 'Réception & Traitement initial requête' },
        { key: 'thomas_probe_silences', agent: 'Thomas', tool: 'FFmpeg', label: 'Analyse acoustique & Détection silences' },
        { key: 'thomas_chirp2_transcribe', agent: 'Thomas', tool: 'Chirp 2', label: 'Transcription Google Cloud Chirp 2' },
        { key: 'thomas_whisper_transcribe', agent: 'Thomas', tool: 'Whisper', label: 'Transcription Faster-Whisper (locale)' },
        { key: 'jade_gemini_translation', agent: 'Jade', tool: 'Gemini', label: 'Normalisation, Traduction & Déduplication' },
        { key: 'nadine_titre_semantique', agent: 'Nadine', tool: 'Gemini', label: 'Titre Sémantique Éclair (Synchrone)' },
        { key: 'lionel_couverture_9_16', agent: 'Lionel', tool: 'Pillow', label: 'Génération Couverture 9:16' },
        { key: 'lionel_ass_styling', agent: 'Lionel', tool: 'Python', label: 'Stylisation & Génération fichier .ASS' },
        { key: 'thomas_ffmpeg_encode', agent: 'Thomas', tool: 'FFmpeg', label: 'Incrustation & Encodage Vidéo Final' },
        { key: 'nadine_description_tiktok_async', agent: 'Nadine', tool: 'Gemini', label: 'Smart Description TikTok (Asynchrone)' },
        { key: 'max_drive_backup', agent: 'Max', tool: 'Drive API', label: 'Sauvegarde Master Drive Centralisée' }
    ];

    const tasksRecorded = [];

    for (const def of taskDefinitions) {
        const item = metrics[def.key];
        if (item) {
            const t = Number(item.t_exec_s || 0);
            const status = item.status || 'OK';
            const details = item.details ? ` (${item.details})` : '';
            const isAsync = def.key === 'nadine_description_tiktok_async';
            const asyncTag = isAsync ? ' [Async]' : '';
            const line = `• [${def.agent}] ${def.label.padEnd(42, ' ')} : ${t.toFixed(2).padStart(6, ' ')}s [${status}]${asyncTag}${details}`;
            lines.push(line);
            if (!isAsync) {
                tasksRecorded.push({ ...def, t_exec_s: t, details: item.details });
            }
        }
    }

    lines.push('--------------------------------------------------------------------------------');
    lines.push("ANALYSE DIAGNOSTIQUE & GOULOTS D'ÉTRANGLEMENT (AGENT ALEXANDRE) :");
    lines.push('--------------------------------------------------------------------------------');

    tasksRecorded.sort((a, b) => b.t_exec_s - a.t_exec_s);

    if (tasksRecorded.length > 0 && totalDurationS > 0) {
        const top1 = tasksRecorded[0];
        const pct1 = Math.round((top1.t_exec_s / totalDurationS) * 100);
        lines.push(`🚨 Goulot n°1 : [${top1.agent}] ${top1.label} -> ${top1.t_exec_s.toFixed(2)}s (${pct1}% du temps total)`);

        if (tasksRecorded.length > 1) {
            const top2 = tasksRecorded[1];
            const pct2 = Math.round((top2.t_exec_s / totalDurationS) * 100);
            lines.push(`⚠️  Goulot n°2 : [${top2.agent}] ${top2.label} -> ${top2.t_exec_s.toFixed(2)}s (${pct2}% du temps total)`);
        }
    }

    lines.push('');
    lines.push('💡 RECOMMANDATIONS TECH LEAD ALEXANDRE :');
    
    const whisperTime = metrics['thomas_whisper_transcribe']?.t_exec_s || 0;
    const ffmpegTime = metrics['thomas_ffmpeg_encode']?.t_exec_s || 0;
    const geminiTime = metrics['jade_gemini_translation']?.t_exec_s || 0;
    const driveTime = metrics['max_drive_backup']?.t_exec_s || 0;

    let recIdx = 1;
    if (ffmpegTime > 30) {
        lines.push(`${recIdx}. [Encodage FFmpeg] Thomas utilise libx264 software sur CPU. Activer l'accélération matérielle NVENC (h264_nvenc) ou QSV réduirait ce temps de ~70%.`);
        recIdx++;
    } else if (ffmpegTime > 0) {
        lines.push(`${recIdx}. [Encodage FFmpeg] Temps d'encodage satisfaisant (${ffmpegTime.toFixed(2)}s avec preset 'veryfast').`);
        recIdx++;
    }

    if (whisperTime > 20) {
        lines.push(`${recIdx}. [Transcription Whisper] Whisper s'exécute sur CPU standard (int8). Le passage sur CUDA/GPU ou modèle 'tiny' sur short-form accélérerait la phase de 3x à 5x.`);
        recIdx++;
    } else if (whisperTime > 0) {
        lines.push(`${recIdx}. [Transcription Whisper] Vitesse d'analyse acoustique satisfaisante (${whisperTime.toFixed(2)}s).`);
        recIdx++;
    }

    if (geminiTime > 10) {
        lines.push(`${recIdx}. [API Gemini Jade] Latence réseau / inférence élevée (${geminiTime.toFixed(2)}s). Vérifier le quota ou privilégier gemini-2.5-flash.`);
        recIdx++;
    }

    if (driveTime > 10) {
        lines.push(`${recIdx}. [Google Drive Max] Upload Drive ralenti (${driveTime.toFixed(2)}s). Possibilité de basculer l'upload en tâche d'arrière-plan post-réponse.`);
        recIdx++;
    }

    lines.push('================================================================================');
    return lines.join('\n');
}

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
const { getPythonBin, killProcessTree, spawnNice } = require('../utils/runtime');
const { downloadTelegramMedia } = require('../services/telegramDownloader');
const {
    acquireUserLock,
    releaseUserLock,
    reserveCredit,
    commitCredit,
    rollbackCredit,
    getUserWallet
} = require('../services/walletService');
const {
    recordVideoGeneration,
    updateVideoDriveInfo
} = require('../services/videoHistoryService');

// 2. POST /api/traduction/process : Réception du média (Upload ou Lien Telegram) et déclenchement de la traduction / sous-titrage avec Streaming Temps Réel
router.post('/api/traduction/process', upload.single('media'), async (req, res) => {
    const tReqStart = performance.now();
    const user = req.session?.user;
    const userId = user?.id || user?.username || 'anonymous';
    const username = user?.username || user?.name || 'Utilisateur';

    let hasLock = false;
    let creditReserved = false;
    let creditCommitted = false;
    let mediaPath = '';

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

        // 1. Verrou de Concurrence (SEC-1) : Empêche les requêtes parallèles d'un même utilisateur
        if (!acquireUserLock(userId)) {
            if (req.file) cleanupTemporaryMedia(req.file.path);
            return res.status(429).json({
                success: false,
                code: "CONCURRENT_JOB_RUNNING",
                message: "Un traitement vidéo est déjà en cours d'exécution pour votre compte. Veuillez patienter jusqu'à sa finalisation.",
                error: "Un traitement vidéo est déjà en cours d'exécution pour votre compte."
            });
        }
        hasLock = true;

        // 2. Réservation du Crédit (Phase 1 Escrow / Ticket 3) : Décrémente le solde et incrémente le séquestre
        const reserveRes = await reserveCredit(userId);
        if (!reserveRes.success) {
            releaseUserLock(userId);
            hasLock = false;
            if (req.file) cleanupTemporaryMedia(req.file.path);
            return res.status(402).json({
                success: false,
                code: "INSUFFICIENT_CREDITS",
                message: "Votre solde de crédits est insuffisant (0 crédit disponible). Veuillez recharger votre compte.",
                error: "Solde de crédits insuffisant.",
                remainingCredits: reserveRes.remainingCredits || 0
            });
        }
        creditReserved = true;

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
                console.error("[Telegram Import Error]:", dlErr.message);
                const errorMsg = "Le fichier Telegram est trop lourd (>20Mo) ou protégé. Veuillez le télécharger manuellement et l'uploader via la zone de dépôt.";

                if (creditReserved && !creditCommitted) {
                    await rollbackCredit(userId, "TELEGRAM_DOWNLOAD_FAILED");
                    creditReserved = false;
                }
                if (hasLock) {
                    releaseUserLock(userId);
                    hasLock = false;
                }

                res.write(`[PROGRESS] 100% - Erreur Téléchargement : ${errorMsg}\n`);
                res.write(`---JSON_OUTPUT_START---\n${JSON.stringify({ 
                    success: false, 
                    code: "MEDIA_TOO_BIG",
                    message: errorMsg,
                    error: errorMsg
                })}\n---JSON_OUTPUT_END---\n`);
                cleanupTemporaryMedia(mediaPath);
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
        // Titre original ou extrait du média (Upload, Telegram ou paramètre explicite)
        const rawTitle = (b.custom_title || b.title || originalName || path.basename(mediaPath, path.extname(mediaPath))).trim();
        // Pont Base64 anti-mojibake Windows pour transmission CLI
        const titleB64 = Buffer.from(rawTitle, 'utf-8').toString('base64');

        // Contexte utilisateur optionnel (Context Grounding pour Jade & Nadine)
        const userContext = (b.user_context || b.context || '').trim();

        console.log(`  - Titre (Pont B64)  : ${rawTitle} [${titleB64.slice(0, 16)}...]`);
        if (userContext) {
            console.log(`  - Contexte (Ground) : ${userContext.slice(0, 60)}...`);
        }
        console.log('====================================================');

        const pyArgs = [
            scriptPath,
            mediaPath,
            targetLang,
            subColor,
            subPosition,
            sourceLang,
            String(forceReprocess),
            String(generateTiktokPack),
            String(bgTheme),
            String(expressMode),
            '--title_b64',
            titleB64
        ];

        if (userContext) {
            pyArgs.push('--context_b64', Buffer.from(userContext, 'utf-8').toString('base64'));
            pyArgs.push('--context', userContext);
        }

        const tPySpawn = performance.now();
        const initDurationS = Number(((tPySpawn - tReqStart) / 1000).toFixed(2));

        const pyProcess = spawnNice(getPythonBin(), pyArgs, {
            cwd: ROOT_DIR,
            env: {
                ...process.env,
                NODE_ENV: process.env.NODE_ENV || 'development',
                PYTHON_ENV: process.env.PYTHON_ENV || 'local',
                AYA_EXEC_PROFILE: process.env.AYA_EXEC_PROFILE || (process.env.NODE_ENV === 'production' ? 'cloud_vps_safe' : 'local_high_perf'),
                PYTHONIOENCODING: 'utf-8',
                PYTHONUTF8: '1'
            }
        });

        if (pyProcess.stdout && typeof pyProcess.stdout.setEncoding === 'function') {
            pyProcess.stdout.setEncoding('utf8');
        }
        if (pyProcess.stderr && typeof pyProcess.stderr.setEncoding === 'function') {
            pyProcess.stderr.setEncoding('utf8');
        }

        let stdoutData = '';
        let stderrData = '';
        let jsonIntercepted = false;

        pyProcess.stdout.on('data', (data) => {
            const chunk = typeof data === 'string' ? data : data.toString('utf8');
            stdoutData += chunk;

            if (!jsonIntercepted) {
                const idx = chunk.indexOf('---JSON_OUTPUT_START---');
                if (idx !== -1) {
                    jsonIntercepted = true;
                    const pre = chunk.slice(0, idx);
                    if (pre.length > 0) res.write(pre);
                } else {
                    res.write(chunk);
                }
            }
        });

        pyProcess.stderr.on('data', (data) => {
            const errChunk = data.toString();
            stderrData += errChunk;
            console.error('[TRADUCTION PY STDERR]', errChunk.trim());
        });

        pyProcess.on('error', async (err) => {
            console.error('[TRADUCTION SPAWN ERROR]', err);
            if (creditReserved && !creditCommitted) {
                await rollbackCredit(userId, "PROCESS_SPAWN_ERROR");
                creditReserved = false;
            }
            if (hasLock) {
                releaseUserLock(userId);
                hasLock = false;
            }
            cleanupTemporaryMedia(mediaPath);
            res.write(`\n---JSON_OUTPUT_START---\n${JSON.stringify({
                success: false,
                code: "PROCESS_SPAWN_ERROR",
                message: "Le moteur de traitement n'a pas pu démarrer sur le serveur.",
                error: "Le moteur de traitement n'a pas pu démarrer sur le serveur."
            })}\n---JSON_OUTPUT_END---\n`);
            res.end();
        });

        let isCancelled = false;

        // Interception de l'annulation de la requête côté client (AbortController)
        req.on('close', async () => {
            if (!res.writableEnded) {
                isCancelled = true;
                console.log(`[TRADUCTION CANCEL] ⚠️ Connexion client interrompue (AbortController). Arrêt forcé du pipeline...`);
                if (creditReserved && !creditCommitted) {
                    await rollbackCredit(userId, "CLIENT_ABORT");
                    creditReserved = false;
                }
                if (hasLock) {
                    releaseUserLock(userId);
                    hasLock = false;
                }
                if (pyProcess && pyProcess.pid) {
                    killProcessTree(pyProcess.pid, 'TRADUCTION CANCEL');
                }
                cleanupTemporaryMedia(mediaPath);
            }
        });

        pyProcess.on('close', async (code) => {
            if (isCancelled) {
                console.log(`[TRADUCTION PROCESS] Processus annulé par l'utilisateur (code: ${code}). Aucun post-traitement.`);
                if (hasLock) {
                    releaseUserLock(userId);
                    hasLock = false;
                }
                cleanupTemporaryMedia(mediaPath);
                return;
            }
            console.log(`[TRADUCTION PROCESS] Script Python terminé avec le code : ${code}`);

            try {
                let finalData = null;
                const jsonMatch = stdoutData.match(/---JSON_OUTPUT_START---([\s\S]*?)---JSON_OUTPUT_END---/);
                if (jsonMatch) {
                    try {
                        finalData = JSON.parse(jsonMatch[1].trim());
                    } catch (parseErr) {
                        console.error('[TRADUCTION PARSE ERROR]', parseErr.message);
                    }
                }

                if (finalData && finalData.success) {
                    // ARCH-1 : Débit du crédit dès que les livrables locaux MP4/ASS sont générés
                    if (creditReserved && !creditCommitted) {
                        await commitCredit(userId);
                        creditCommitted = true;
                    }

                    // SAFE-1 & Ticket 1 : Enregistrement dans l'historique personnel
                    let recordedVideo = null;
                    try {
                        recordedVideo = await recordVideoGeneration({
                            userId,
                            username,
                            title: finalData.title || rawTitle || originalName,
                            originalMediaName: originalName || path.basename(mediaPath),
                            targetLang,
                            duration: Number(finalData.duration || 0),
                            fileSizeMb: Number(fileSizeMb || 0),
                            mp4Url: finalData.mp4_url || (finalData.mp4_filename ? `/download/${finalData.mp4_filename}` : null),
                            mp4Filename: finalData.mp4_filename || null,
                            assUrl: finalData.ass_url || (finalData.ass_filename ? `/download/${finalData.ass_filename}` : null),
                            assFilename: finalData.ass_filename || null,
                            coverUrl: finalData.cover_url || (finalData.cover_filename ? `/download/${finalData.cover_filename}` : null),
                            coverFilename: finalData.cover_filename || null,
                            descFilename: finalData.desc_filename || null,
                            contextSummary: finalData.context || userContext || "",
                            costCredits: 1,
                            status: 'completed',
                            drive: { status: 'pending' }
                        });
                    } catch (recErr) {
                        console.error('[VIDEO HISTORY RECORD ERROR]', recErr);
                    }

                    // Sauvegarde automatique et silencieuse sur Google Drive en tâche de fond (Zéro-Friction)
                    const clientName = req.session?.user?.name || req.session?.user?.username || b.client_name || 'Client';
                    const dateStr = new Date().toISOString().slice(0, 10);
                    const deliverablesToBackup = {
                        clientName,
                        dateStr,
                        files: {
                            mp4: finalData.mp4_filename,
                            ass: finalData.ass_filename,
                            cover: finalData.cover_filename,
                            desc: finalData.desc_filename
                        }
                    };

                    setImmediate(() => {
                        try {
                            const { backupDeliverablesForClient } = require('../services/driveService');
                            backupDeliverablesForClient(deliverablesToBackup)
                                .then(async (backupResult) => {
                                    const driveInfo = {
                                        status: (backupResult && backupResult.success) ? 'uploaded' : 'error',
                                        folderId: backupResult?.folderId || null,
                                        folderLink: backupResult?.folderLink || backupResult?.webViewLink || null,
                                        mp4FileId: backupResult?.uploads?.mp4?.id || null,
                                        assFileId: backupResult?.uploads?.ass?.id || null,
                                        uploadedAt: new Date(),
                                        errorReason: backupResult?.reason || null
                                    };
                                    const vidId = recordedVideo?._id || recordedVideo?.id;
                                    if (vidId) {
                                        await updateVideoDriveInfo(vidId, driveInfo);
                                    }
                                    if (backupResult && backupResult.success) {
                                        console.log(`[DRIVE SILENT BACKUP] ✅ Archivage serveur réussi en arrière-plan pour ${clientName} (${backupResult.folderLink || backupResult.webViewLink || 'OK'})`);
                                    } else {
                                        console.log(`[DRIVE SILENT BACKUP] ℹ️ Archivage en arrière-plan : ${backupResult?.reason || 'Non configuré'}`);
                                    }
                                })
                                .catch(async (driveErr) => {
                                    console.warn('[DRIVE SILENT BACKUP WARNING] Échec archivage en arrière-plan :', driveErr.message);
                                    const vidId = recordedVideo?._id || recordedVideo?.id;
                                    if (vidId) {
                                        await updateVideoDriveInfo(vidId, {
                                            status: 'error',
                                            errorReason: driveErr.message
                                        });
                                    }
                                });
                        } catch (driveErr) {
                            console.warn('[DRIVE SILENT BACKUP WARNING] driveService non disponible :', driveErr.message);
                        }
                    });

                    // Enrichir finalData avec le solde à jour du portefeuille et l'identifiant de la vidéo
                    const wallet = await getUserWallet(userId);
                    finalData.wallet = wallet;
                    if (recordedVideo) {
                        finalData.video_id = recordedVideo._id || recordedVideo.id;
                    }

                    // Télémétrie et Rapport d'Audit Alexandre
                    const tTotalEnd = performance.now();
                    const totalDurationS = Number(((tTotalEnd - tReqStart) / 1000).toFixed(2));

                    const alexandreMetrics = {
                        max_request_init: {
                            agent: "Max",
                            task: "max_request_init",
                            t_exec_s: initDurationS,
                            status: "OK",
                            details: `Taille: ${fileSizeMb} Mo`
                        },
                        ...(finalData.telemetry || {}),
                        max_drive_backup: {
                            agent: "Max",
                            task: "max_drive_backup",
                            t_exec_s: 0,
                            status: "ASYNC",
                            details: "Archivage automatique silencieux déclenché en tâche de fond"
                        }
                    };

                    const auditReport = formatAlexandreAuditReport({
                        metrics: alexandreMetrics,
                        totalDurationS,
                        mediaName: originalName || path.basename(mediaPath),
                        mediaDuration: Number(finalData.duration || 0),
                        targetLang
                    });

                    // Affichage obligatoire et structuré dans la console
                    console.log('\n' + auditReport + '\n');

                    finalData.telemetry = alexandreMetrics;
                    finalData.alexandre_report = auditReport;

                    // Envoi du JSON final enrichi vers le frontend
                    res.write(`\n---JSON_OUTPUT_START---\n${JSON.stringify(finalData)}\n---JSON_OUTPUT_END---\n`);
                } else {
                    // Échec métier : restitution immédiate du crédit séquestré (Rollback)
                    if (creditReserved && !creditCommitted) {
                        await rollbackCredit(userId, "PIPELINE_FAILED");
                        creditReserved = false;
                    }

                    if (finalData) {
                        res.write(`\n---JSON_OUTPUT_START---\n${JSON.stringify(finalData)}\n---JSON_OUTPUT_END---\n`);
                    } else {
                        const fallbackRes = {
                            success: code === 0,
                            code: code === 0 ? null : "PROCESS_FAILED",
                            message: code === 0 ? null : "Une anomalie s'est produite lors de la génération des sous-titres.",
                            error: code === 0 ? null : "Une anomalie s'est produite lors de la génération des sous-titres."
                        };
                        res.write(`\n---JSON_OUTPUT_START---\n${JSON.stringify(fallbackRes)}\n---JSON_OUTPUT_END---\n`);
                    }
                }
            } finally {
                if (hasLock) {
                    releaseUserLock(userId);
                    hasLock = false;
                }
                cleanupTemporaryMedia(mediaPath);
                res.end();
            }
        });

    } catch (err) {
        console.error('[TRADUCTION ERROR]', err);
        if (creditReserved && !creditCommitted) {
            await rollbackCredit(userId, "SERVER_ERROR");
            creditReserved = false;
        }
        if (hasLock) {
            releaseUserLock(userId);
            hasLock = false;
        }
        cleanupTemporaryMedia(mediaPath);
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

/**
 * POST /api/traduction/save-to-drive
 * Sauvegarde silencieuse des livrables de traduction dans l'espace Drive personnel du testeur
 */
router.post('/save-to-drive', async (req, res) => {
    try {
        const body = req.body || {};
        const { backupDeliverablesForClient } = require('../services/driveService');

        const clientName = req.session?.user?.name || req.session?.user?.username || body.clientName || 'Client';
        const dateStr = new Date().toISOString().slice(0, 10);
        const files = {
            mp4: body.mp4_filename || body.mp4Filename,
            ass: body.ass_filename || body.assFilename,
            cover: body.cover_filename || body.coverFilename,
            desc: body.desc_filename || body.descFilename
        };

        if (!files.mp4 && !files.ass && !files.cover && !files.desc) {
            return res.status(400).json({
                success: false,
                error: "Aucun livrable spécifié pour la sauvegarde sur Google Drive."
            });
        }

        console.log(`[DRIVE API] ☁️ Sauvegarde silencieuse demandée pour ${clientName} (${dateStr})...`);

        const result = await backupDeliverablesForClient({
            clientName,
            dateStr,
            files
        });

        if (result && result.success) {
            const driveLink = result.folderLink || result.webViewLink || '';
            return res.json({
                success: true,
                message: `Livrables sauvegardés avec succès dans le dossier personnel de ${clientName}.`,
                drive_link: driveLink,
                folderUrl: driveLink,
                webViewLink: result.webViewLink,
                uploads: result.uploads,
                uploaded_count: Object.keys(result.uploads || {}).length
            });
        } else {
            return res.status(500).json({
                success: false,
                error: result?.reason || "Échec de la sauvegarde sur Google Drive. Vérifiez la configuration ou les quotas.",
                details: result
            });
        }
    } catch (err) {
        console.error('[DRIVE API ERROR]', err);
        return res.status(500).json({
            success: false,
            error: err.message || "Erreur interne lors de la sauvegarde sur Google Drive."
        });
    }
});

module.exports = router;
