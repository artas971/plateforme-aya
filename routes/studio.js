const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { execSync } = require('child_process');
const { getPythonBin } = require('../utils/runtime');
const { recordEvent } = require('../services/telemetryService');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPONSED_DIR = path.join(ROOT_DIR, 'fichiers_reponse_a_envoyer');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(REPONSED_DIR, { recursive: true });

// Configuration de stockage Multer pour le Studio V3
const studioStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const uploadStudio = multer({ storage: studioStorage });

// Servir l'interface graphique du Studio
router.get(['/studio', '/studio.html', '/aya_studio.html', '/aya_studio'], (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'public', 'studio.html'));
});

// Route de téléchargement direct de livrables avec en-têtes MIME explicites
router.get('/download/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(REPONSED_DIR, filename);

    if (fs.existsSync(filePath)) {
        const ext = path.extname(filename).toLowerCase();
        let mime = 'application/octet-stream';
        if (ext === '.mp4') mime = 'video/mp4';
        else if (ext === '.ass' || ext === '.txt') mime = 'text/plain; charset=utf-8';
        else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
        else if (ext === '.png') mime = 'image/png';
        else if (ext === '.mp3') mime = 'audio/mpeg';

        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.download(filePath, filename);
    } else {
        return res.status(404).json({ error: "Fichier non trouvé sur le disque." });
    }
});

// ROUTE STUDIO V3 : CYCLE DE VIE DES FICHIERS & VERROUILLAGE PRODUCTION
router.post('/api/generate_v3_studio', uploadStudio.fields([{ name: 'media_file' }, { name: 'bg_file' }]), (req, res) => {
    let mediaPath = '';
    let bgPath = '';
    let uploadedBg = false;

    try {
        console.log("[Studio Backend] Réception d'une nouvelle demande de génération vidéo...");
        const mediaFiles = req.files['media_file'];
        if (!mediaFiles || mediaFiles.length === 0) {
            return res.status(400).json({ status: "error", message: "Fichier média source requis." });
        }

        mediaPath = path.resolve(mediaFiles[0].path);
        
        const body = req.body || {};
        const bgTheme = body.bg_theme || 'bg_palestine';
        const presetBgPath = path.join(ROOT_DIR, 'public', 'assets', 'backgrounds', `${bgTheme}.jpg`);
        const defaultPalestine = path.join(ROOT_DIR, 'public', 'assets', 'backgrounds', 'bg_palestine.jpg');

        if (req.files['bg_file'] && req.files['bg_file'].length > 0) {
            bgPath = path.resolve(req.files['bg_file'][0].path);
            uploadedBg = true;
        } else if (fs.existsSync(presetBgPath)) {
            bgPath = presetBgPath;
        } else if (fs.existsSync(defaultPalestine)) {
            bgPath = defaultPalestine;
        } else {
            bgPath = path.join(ROOT_DIR, 'john_creasy_signature_bg.jpg');
        }

        let mode = body.mode || "VOSTFR";
        let sourceLang = body.source_lang || "auto";
        let targetLang = body.target_lang || "fr";

        if (mode === "VOSTFR_GEO") {
            mode = "VOSTFR";
            sourceLang = "ar_geo";
        } else if (mode === "VOSTFR_HEB") {
            mode = "VOSTFR";
            sourceLang = "he";
        } else if (targetLang === "ar" || mode === "VOAR") {
            mode = "VOAR";
        }
        const title = (body.title || "SOSO NOUS PARLE DU DRAME SURVENU LE 18 AOÛT").replace(/"/g, '\\"');
        const titleColor = body.title_color || "#D8D0BE";
        const subColor = body.sub_color || "#FFFF00";
        const titleMargin = body.title_margin || "380";
        const subMargin = body.sub_margin || "950";
        const showHeader = body.show_header || "true";
        const headerText = (body.header_text || "PALESTINIAN ECHO").replace(/"/g, '\\"');
        const headerColor = body.header_color || "#CE1126";

        const projectUUID = body.project_uuid || (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
        const finalFileName = `video_${projectUUID}_1080x1920.mp4`;
        const pyScript = path.join(ROOT_DIR, 'run_studio_v3_full_pipeline.py');
        const pythonBin = getPythonBin();

        const cmd = `${pythonBin} "${pyScript}" "${mediaPath}" "${bgPath}" "${mode}" "${title}" "${titleColor}" "${subColor}" "${titleMargin}" "${subMargin}" "${showHeader}" "${headerText}" "${headerColor}" "${projectUUID}" "${sourceLang}"`;

        console.log("[Thomas] Exécution de :", cmd);
        const videoStart = process.hrtime.bigint();
        execSync(cmd, { cwd: ROOT_DIR, env: process.env });
        const videoElapsedMs = Number(process.hrtime.bigint() - videoStart) / 1e6;

        const finalMp4Path = path.join(REPONSED_DIR, finalFileName);

        if (!fs.existsSync(finalMp4Path) || fs.statSync(finalMp4Path).size === 0) {
            console.error("[Thomas] ERREUR : Le fichier MP4 n'a pas été trouvé après exécution.");
            return res.status(500).json({ status: "error", message: "Le pipeline a échoué silencieusement. Vidéo introuvable." });
        }

        const mp4Size = fs.statSync(finalMp4Path).size;

        // Enregistrement Télémétrie Vidéo TikTok V3
        if (req.telemetryData) req.telemetryData.isCustomRecorded = true;
        recordEvent({
            traceId: req.traceId,
            eventType: 'video_generation',
            userId: req.session?.user?.id || req.session?.user?.username || 'anon',
            http: {
                method: 'POST',
                route: '/api/generate_v3_studio',
                statusCode: 200,
                clientIp: req.ip
            },
            metrics: {
                totalDurationMs: videoElapsedMs,
                breakdownMs: {
                    mediaEncodeMs: videoElapsedMs
                },
                payloadSizeBytes: mp4Size
            },
            technicalDetails: {
                projectUUID,
                mode,
                finalFileName
            }
        });

        return res.json({
            success: true,
            message: "Vidéo générée avec succès !",
            mp4_url: `/download/${finalFileName}`,
            project_uuid: projectUUID
        });

    } catch (error) {
        console.error("[Thomas] CRASH DU SCRIPT PYTHON :", error.message);
        return res.status(500).json({ status: "error", message: "Le script Python a planté (Voir logs serveur)." });
    } finally {
        if (mediaPath && fs.existsSync(mediaPath)) {
            try {
                fs.unlinkSync(mediaPath);
                console.log(`[Lucky Archiviste] Fichier temporaire audio supprimé : ${mediaPath}`);
            } catch (e) {
                console.error(`[Lucky Archiviste] Erreur nettoyage audio : ${e.message}`);
            }
        }
        if (uploadedBg && bgPath && fs.existsSync(bgPath)) {
            try {
                fs.unlinkSync(bgPath);
                console.log(`[Lucky Archiviste] Fichier temporaire image supprimé : ${bgPath}`);
            } catch (e) {
                console.error(`[Lucky Archiviste] Erreur nettoyage image : ${e.message}`);
            }
        }
    }
});

module.exports = router;
