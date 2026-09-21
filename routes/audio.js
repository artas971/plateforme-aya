const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');
const { formatPythonCommand } = require('../utils/runtime');

const ROOT_DIR = path.resolve(__dirname, '..');
const AUDIO_A_TRAITER_DIR = path.join(ROOT_DIR, 'audio_a_traiter');
const REPONSED_DIR = path.join(ROOT_DIR, 'fichiers_reponse_a_envoyer');
const MESSAGE_FOR_JOHN_DIR = path.join(ROOT_DIR, 'message pour john');
const USERS_FILE = path.join(ROOT_DIR, 'users.json');

fs.mkdirSync(AUDIO_A_TRAITER_DIR, { recursive: true });
fs.mkdirSync(REPONSED_DIR, { recursive: true });
fs.mkdirSync(MESSAGE_FOR_JOHN_DIR, { recursive: true });

const MAX_HISTORY_FILES = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Configuration de stockage Multer générique pour les fichiers audio reçus
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, AUDIO_A_TRAITER_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.webm';
        const safeName = `rec_micro_${Date.now()}${ext}`;
        cb(null, safeName);
    }
});
const upload = multer({ storage });

function runPython(command) {
    const formattedCmd = formatPythonCommand(command);
    return new Promise((resolve, reject) => {
        exec(formattedCmd, { cwd: ROOT_DIR, env: process.env }, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
}

function getUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        return data.users || [];
    } catch (e) {
        return [];
    }
}

function enforceMax10RollingRetention() {
    if (!fs.existsSync(REPONSED_DIR)) return;
    try {
        const files = fs.readdirSync(REPONSED_DIR);
        const mp3Files = files.filter(f => f.endsWith('.mp3')).map(f => {
            const fpath = path.join(REPONSED_DIR, f);
            const stats = fs.statSync(fpath);
            return { filename: f, path: fpath, mtime: stats.mtimeMs };
        });

        mp3Files.sort((a, b) => b.mtime - a.mtime);

        if (mp3Files.length > MAX_HISTORY_FILES) {
            const filesToDelete = mp3Files.slice(MAX_HISTORY_FILES);
            filesToDelete.forEach(item => {
                try {
                    fs.unlinkSync(item.path);
                    console.log(`[Règle Max 10 Fichiers] Supprimé le 11e fichier le plus ancien : ${item.filename}`);
                } catch (e) {}
            });
        }
    } catch (e) {
        console.error("Error in retention:", e);
    }
}

function cleanupOldFiles() {
    enforceMax10RollingRetention();
    const now = Date.now();
    const dirsToClean = [REPONSED_DIR, ROOT_DIR];

    dirsToClean.forEach(dir => {
        if (!fs.existsSync(dir)) return;
        try {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                if (file.endsWith('_temp.wav') || file === 'single_process_out.json') {
                    const filePath = path.join(dir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        if (now - stats.mtimeMs > ONE_HOUR_MS) {
                            fs.unlinkSync(filePath);
                            console.log(`[Auto-Cleanup 1h] Supprimé : ${file}`);
                        }
                    } catch (e) {}
                }
            });
        } catch (e) {}
    });
}

cleanupOldFiles();
setInterval(cleanupOldFiles, 5 * 60 * 1000);

const KNOWN_DATA = {
    "soso demande.ogg": {
        title: "soso demande.ogg (Demande de virement 50)",
        duration: "59 sec",
        arabic_text: "أخي... لأن أختي وطن معي... فبستأذنك إذا بتقدر تبعث لي الخمسين. وعنّا إحنا بغزة محفظة إلكترونية، حتى لو كانت بعيدة عني، أنا بقدر أبعث لها المبلغ عن طريق المحفظة الإلكترونية، وإحنا نتعامل معها حالياً بغزة موجودة عند الكل. فلما تحول لي المبلغ، بحول لها إياه عن طريق المحفظة الإلكترونية... وكان في 150 وعطت وطن 50... فلما أحول لها المبلغ وأبعث لك إيصال، خليها تحكي إنه وصلها المبلغ، لأنه ما بدي تضل تبعث رسائل على الخاص.",
        french_translation: "« Mon frère, comme ma sœur Watan est avec moi, je te demande si tu peux m'envoyer 50. Nous avons ici à Gaza un portefeuille électronique (e-wallet / paiement mobile). Même si elle se trouve loin de moi, je peux lui transférer la somme directement via ce portefeuille électronique. C'est le moyen que tout le monde utilise à Gaza actuellement. Dès que tu me transfères la somme, je lui envoie par le portefeuille électronique... Il y avait 150 et elle a donné 50 à Watan. Dès que je lui aurai fait le virement et que je t'aurai envoyé le reçu, je lui demanderai de confirmer qu'elle a bien reçu l'argent, afin qu'elle n'ait plus besoin de continuer à envoyer des messages en privé. »",
        french_audio_url: "/fichiers_reponse_a_envoyer/traduction_soso_demande.mp3",
        phonetic: "Akhi... li'an ukhti Watan ma'i... fa basta'zinak iza btiqdar tib'ath li 50...",
        vocab: [
            { ar: "محفظة إلكترونية", fr: "Portefeuille électronique / E-wallet" },
            { ar: "بتقدر تبعث لي", fr: "Tu peux m'envoyer" },
            { ar: "على الخاص", fr: "En privé (messages)" }
        ]
    }
};

// -----------------------------------------------------------------------------
// ROUTES /api/* (AUDIO, VOCAL, TTS, AUTH)
// -----------------------------------------------------------------------------

router.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Identifiant et mot de passe requis" });
    }

    const users = getUsers();
    const found = users.find(u => u.username.toLowerCase() === username.toLowerCase().trim() && u.password === password.trim());

    if (found) {
        console.log(`[Connexion Réussie] Utilisateur connecté : ${found.username}`);
        return res.json({
            success: true,
            user: { username: found.username, name: found.name || found.username, role: found.role },
            token: `token_${found.username}_${Date.now()}`
        });
    }

    return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
});

router.post('/api/open-audio-folder', async (req, res) => {
    try {
        if (process.platform !== 'win32') {
            return res.json({
                success: true,
                headless: true,
                message: 'Dossier accessible sur le serveur. Explorateur graphique local indisponible sous Linux headless.'
            });
        }
        const { filename } = req.body;
        let targetPath = REPONSED_DIR;
        if (filename) {
            const filePath = path.join(REPONSED_DIR, filename);
            if (fs.existsSync(filePath)) targetPath = filePath;
        }

        const safePath = targetPath.replace(/"/g, '\\"');
        await runPython(`py open_explorer.py "${safePath}"`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/upload-microphone', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Aucun enregistrement audio reçu' });

        const filename = req.file.filename;
        console.log(`[Enregistrement Micro Recu] ${filename}`);

        const safeFilename = filename.replace(/"/g, '\\"');
        await runPython(`py process_single_file.py "${safeFilename}"`);
        enforceMax10RollingRetention();

        const outPath = path.join(ROOT_DIR, 'single_process_out.json');
        if (fs.existsSync(outPath)) {
            const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
            data.filename = filename;
            data.french_audio_url = `${data.french_audio_url}?t=${Date.now()}`;
            return res.json(data);
        }

        res.status(500).json({ error: 'Échec du traitement du micro' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/send-to-john', (req, res) => {
    try {
        const { target_type, content, filename, sender } = req.body;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const senderName = sender || 'utilisateur';

        if (target_type === 'audio') {
            let sourcePath = null;
            if (filename) {
                const path1 = path.join(AUDIO_A_TRAITER_DIR, filename);
                const path2 = path.join(REPONSED_DIR, filename);
                if (fs.existsSync(path1)) sourcePath = path1;
                else if (fs.existsSync(path2)) sourcePath = path2;
            }

            if (!sourcePath) {
                const files = fs.readdirSync(REPONSED_DIR).filter(f => f.endsWith('.mp3'));
                if (files.length > 0) {
                    files.sort((a, b) => fs.statSync(path.join(REPONSED_DIR, b)).mtimeMs - fs.statSync(path.join(REPONSED_DIR, a)).mtimeMs);
                    sourcePath = path.join(REPONSED_DIR, files[0]);
                }
            }

            if (sourcePath && fs.existsSync(sourcePath)) {
                const ext = path.extname(sourcePath);
                const destPath = path.join(MESSAGE_FOR_JOHN_DIR, `audio_message_de_${senderName}_${timestamp}${ext}`);
                fs.copyFileSync(sourcePath, destPath);
                console.log(`[Message pour John] Audio sauvegardé par ${senderName} : ${destPath}`);
                return res.json({ success: true, message: `Audio de ${senderName} envoyé dans le dossier Message pour John !`, dest: destPath });
            }
            return res.status(404).json({ error: 'Fichier audio non trouvé' });
        } else if (target_type === 'text') {
            if (!content) return res.status(400).json({ error: 'Texte requis' });
            const destPath = path.join(MESSAGE_FOR_JOHN_DIR, `texte_message_de_${senderName}_${timestamp}.txt`);
            fs.writeFileSync(destPath, content, 'utf8');
            console.log(`[Message pour John] Texte sauvegardé par ${senderName} : ${destPath}`);
            return res.json({ success: true, message: `Texte de ${senderName} envoyé dans le dossier Message pour John !`, dest: destPath });
        }

        res.status(400).json({ error: 'Type invalide' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/purge-audio', (req, res) => {
    try {
        const { filename } = req.body;
        if (filename) {
            const filePath = path.join(REPONSED_DIR, filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[Purge Immédiate] Supprimé : ${filename}`);
            }
        }
        const resultPath = path.join(ROOT_DIR, 'reponse_result.json');
        if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath);
        const resultFrPath = path.join(ROOT_DIR, 'reponse_fr_result.json');
        if (fs.existsSync(resultFrPath)) fs.unlinkSync(resultFrPath);

        enforceMax10RollingRetention();
        res.json({ success: true, message: 'Audio purgé avec succès' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/process-audio', async (req, res) => {
    try {
        const { filename, target_lang } = req.body;
        if (!filename) return res.status(400).json({ error: 'Nom de fichier requis' });

        const safeFilename = filename.replace(/"/g, '\\"');
        const targetLang = target_lang || 'fr';

        await runPython(`py process_single_file.py "${safeFilename}" "${targetLang}"`);
        enforceMax10RollingRetention();

        const outPath = path.join(ROOT_DIR, 'single_process_out.json');
        if (fs.existsSync(outPath)) {
            const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
            data.french_audio_url = `${data.french_audio_url}?t=${Date.now()}`;
            return res.json(data);
        }

        res.status(500).json({ error: 'Échec du traitement' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/video/generate-ass', async (req, res) => {
    try {
        const { filename, target_lang } = req.body;
        if (!filename) return res.status(400).json({ error: 'Nom de fichier vidéo requis' });

        const safeFilename = filename.replace(/"/g, '\\"');
        const targetLang = target_lang || 'fr';

        console.log(`[Génération Sous-Titres ASS] Fichier : ${filename}, Cible : ${targetLang}`);
        const stdout = await runPython(`py generate_ass_subtitles.py "${safeFilename}" "${targetLang}"`);
        
        try {
            const data = JSON.parse(stdout);
            if (data.error) return res.status(500).json({ error: data.error });
            return res.json(data);
        } catch (e) {
            return res.status(500).json({ error: 'Échec de l\'analyse des sous-titres ASS' });
        }
    } catch (err) {
        console.error("Generate ASS error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/video/burn-subtitles', async (req, res) => {
    try {
        const { video_filename, ass_filename, ass_content } = req.body;
        if (!video_filename) return res.status(400).json({ error: 'Nom de fichier vidéo requis' });

        const payloadPath = path.join(ROOT_DIR, 'burn_payload.json');
        fs.writeFileSync(payloadPath, JSON.stringify({
            video_filename: video_filename,
            ass_filename: ass_filename || '',
            ass_content: ass_content || ''
        }, null, 2), 'utf8');

        console.log(`[Incrustation Sous-Titres MP4] Incrustation en cours pour : ${video_filename}`);
        const stdout = await runPython(`py burn_ass_subtitles.py`);

        try {
            const data = JSON.parse(stdout);
            if (data.error) return res.status(500).json({ error: data.error });
            enforceMax10RollingRetention();
            return res.json(data);
        } catch (e) {
            return res.status(500).json({ error: 'Échec de l\'incrustation des sous-titres' });
        }
    } catch (err) {
        console.error("Burn subtitles error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/reply-to-aya', async (req, res) => {
    try {
        const { text_fr, voice } = req.body;
        if (!text_fr) return res.status(400).json({ error: 'Texte requis' });

        const selectedVoice = voice || 'ar-JO-SanaNeural';

        fs.writeFileSync(path.join(ROOT_DIR, 'input_payload.json'), JSON.stringify({
            text_fr: text_fr,
            voice: selectedVoice
        }), 'utf8');

        await runPython(`py translate_fr_to_ar.py`);
        enforceMax10RollingRetention();

        const resultPath = path.join(ROOT_DIR, 'reponse_result.json');
        if (fs.existsSync(resultPath)) {
            const data = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
            data.audio_url = `/fichiers_reponse_a_envoyer/${data.audio_file}?t=${Date.now()}`;
            return res.json(data);
        }
        res.status(500).json({ error: 'Échec de la génération audio' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/reply-in-french', async (req, res) => {
    try {
        const { text_ar, voice } = req.body;
        if (!text_ar) return res.status(400).json({ error: 'Texte en arabe requis' });

        const selectedVoice = voice || 'fr-FR-VivienneMultilingualNeural';

        fs.writeFileSync(path.join(ROOT_DIR, 'input_ar_payload.json'), JSON.stringify({
            text_ar: text_ar,
            voice: selectedVoice
        }), 'utf8');

        await runPython(`py translate_ar_to_fr.py`);
        enforceMax10RollingRetention();

        const resultPath = path.join(ROOT_DIR, 'reponse_fr_result.json');
        if (fs.existsSync(resultPath)) {
            const data = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
            data.audio_url = `/fichiers_reponse_a_envoyer/${data.audio_file}?t=${Date.now()}`;
            return res.json(data);
        }
        res.status(500).json({ error: 'Échec de la génération audio française' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/messages', (req, res) => {
    try {
        enforceMax10RollingRetention();
        const files = fs.readdirSync(AUDIO_A_TRAITER_DIR);
        const validExtensions = ['.mp4', '.mov', '.m4a', '.wav', '.mp3', '.ogg', '.opus', '.webm', '.mpeg', '.mpg', '.avi', '.mkv', '.flac', '.aac', '.wma', '.3gp', '.wmv'];
        const mediaFiles = files.filter(f => validExtensions.includes(path.extname(f).toLowerCase()) && !f.endsWith('_temp.wav'));

        const allAudios = mediaFiles.map(fname => {
            const fileUrl = `/audio_a_traiter/${encodeURIComponent(fname)}`;
            if (KNOWN_DATA[fname]) {
                return {
                    id: fname.replace(/[^a-zA-Z0-9]/g, '_'),
                    filename: fname,
                    media_url: fileUrl,
                    ...KNOWN_DATA[fname]
                };
            }
            return {
                id: fname.replace(/[^a-zA-Z0-9]/g, '_'),
                title: fname,
                filename: fname,
                media_url: fileUrl,
                duration: "Audio",
                arabic_text: "Fichier audio présent dans audio_a_traiter. Cliquez sur '✨ Générer la Note Vocale en Français' pour le traduire !",
                french_translation: "Prêt à être traduit.",
                french_audio_url: "",
                phonetic: "",
                vocab: []
            };
        });

        const replyPath = path.join(ROOT_DIR, 'reponse_result.json');
        let latestReply = null;
        if (fs.existsSync(replyPath)) {
            latestReply = JSON.parse(fs.readFileSync(replyPath, 'utf8'));
        }

        res.json({
            folder_path: AUDIO_A_TRAITER_DIR,
            audios: allAudios,
            sent_reply: latestReply ? {
                french_original: latestReply.french_original,
                arabic_translation: latestReply.arabic_translation,
                audio_url: `/fichiers_reponse_a_envoyer/${latestReply.audio_file}`
            } : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/upload', upload.single('file'), (req, res) => {
    res.json({ success: true, filename: req.file.filename });
});

router.post('/api/upload-and-translate', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

        const filePath = req.file.path;
        const filename = req.file.filename;
        const targetLang = req.body.target_lang || 'fr';

        console.log(`[Upload Direct & Traduction] Fichier ${filename} ajouté à audio_a_traiter. Cible : ${targetLang}`);

        if (targetLang === 'fr') {
            await runPython(`py process_single_file.py "${filePath}"`);
            const outPath = path.join(ROOT_DIR, 'single_process_out.json');
            if (fs.existsSync(outPath)) {
                const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
                return res.json({
                    success: true,
                    filename: filename,
                    target_lang: 'fr',
                    original_text: data.arabic_text,
                    translation: data.french_translation,
                    audio_url: data.french_audio_url
                });
            }
        } else {
            await runPython(`py process_single_file.py "${filePath}"`);
            const outPath = path.join(ROOT_DIR, 'single_process_out.json');
            let textToTranslate = "Bonjour";
            if (fs.existsSync(outPath)) {
                const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
                textToTranslate = data.french_translation || data.arabic_text || "Bonjour";
            }

            fs.writeFileSync(path.join(ROOT_DIR, 'input_payload.json'), JSON.stringify({
                text_fr: textToTranslate,
                voice: 'ar-JO-SanaNeural'
            }), 'utf8');

            await runPython(`py translate_fr_to_ar.py`);
            const resultPath = path.join(ROOT_DIR, 'reponse_result.json');
            if (fs.existsSync(resultPath)) {
                const data = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
                return res.json({
                    success: true,
                    filename: filename,
                    target_lang: 'ar',
                    original_text: textToTranslate,
                    translation: data.arabic_translation,
                    audio_url: `/fichiers_reponse_a_envoyer/${data.audio_file}?t=${Date.now()}`
                });
            }
        }
        res.status(500).json({ error: "Échec de la traduction du fichier" });
    } catch (err) {
        console.error("Upload & Translate error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
