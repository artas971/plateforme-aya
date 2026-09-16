const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const AUDIO_A_TRAITER_DIR = path.join(ROOT_DIR, 'audio_a_traiter');
const REPONSED_DIR = path.join(ROOT_DIR, 'fichiers_reponse_a_envoyer');
const MESSAGE_FOR_JOHN_DIR = path.join(ROOT_DIR, 'message pour john');
const CHAT_DB_FILE = path.join(ROOT_DIR, 'chat_db.json');
const CHAT_STATUS_FILE = path.join(ROOT_DIR, 'chat_status.json');
const CHAT_ARCHIVE_FILE = path.join(ROOT_DIR, 'chat_archives.json');

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Multer Storage Configuration pour les audios du chat
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
    return new Promise((resolve, reject) => {
        exec(command, { cwd: ROOT_DIR, env: process.env }, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
}

function getChatMessages() {
    if (!fs.existsSync(CHAT_DB_FILE)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(CHAT_DB_FILE, 'utf8'));
        return data.messages || [];
    } catch (e) {
        return [];
    }
}

function saveChatMessages(messages) {
    try {
        fs.writeFileSync(CHAT_DB_FILE, JSON.stringify({ messages }, null, 2), 'utf8');
    } catch (e) {
        console.error("Error saving chat_db.json:", e);
    }
}

function purge24hEphemeralChat() {
    const now = Date.now();
    let messages = getChatMessages();
    let updated = false;

    const activeMessages = [];
    messages.forEach(msg => {
        if (now - msg.timestamp > TWENTY_FOUR_HOURS_MS) {
            updated = true;
            if (msg.audioFile) {
                const mp3Path = path.join(REPONSED_DIR, msg.audioFile);
                if (fs.existsSync(mp3Path)) {
                    try {
                        fs.unlinkSync(mp3Path);
                        console.log(`[Purge Éphémère 24h] Fichier audio supprimé du disque : ${msg.audioFile}`);
                    } catch (e) {}
                }
            }
        } else {
            activeMessages.push(msg);
        }
    });

    if (updated) {
        saveChatMessages(activeMessages);
    }
    return activeMessages;
}

function getChatStatus() {
    if (!fs.existsSync(CHAT_STATUS_FILE)) return { disabled: false };
    try {
        return JSON.parse(fs.readFileSync(CHAT_STATUS_FILE, 'utf8'));
    } catch (e) {
        return { disabled: false };
    }
}

function saveChatStatus(status) {
    try {
        fs.writeFileSync(CHAT_STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
    } catch (e) {
        console.error("Error saving chat_status.json:", e);
    }
}

// -----------------------------------------------------------------------------
// ROUTES /api/chat/*
// -----------------------------------------------------------------------------

router.get('/status', (req, res) => {
    try {
        const status = getChatStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/toggle-status', (req, res) => {
    try {
        const status = getChatStatus();
        status.disabled = !status.disabled;
        saveChatStatus(status);
        console.log(`[Admin Chat Toggle] Chat ${status.disabled ? 'désactivé' : 'activé'} par l'admin`);
        res.json({ success: true, disabled: status.disabled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/reset', (req, res) => {
    try {
        saveChatMessages([]);
        console.log(`[Admin Chat Reset] Conversation totalement réinitialisée par l'admin`);
        res.json({ success: true, message: 'Conversation réinitialisée et effacée avec succès.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/archive', (req, res) => {
    try {
        const messages = getChatMessages();
        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const archivePayload = {
            archiveId: `archive_${Date.now()}`,
            archivedAt: new Date().toISOString(),
            messagesCount: messages.length,
            messages: messages
        };

        const jsonPath = path.join(MESSAGE_FOR_JOHN_DIR, `archive_chat_${timestampStr}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(archivePayload, null, 2), 'utf8');

        let archives = [];
        if (fs.existsSync(CHAT_ARCHIVE_FILE)) {
            try {
                archives = JSON.parse(fs.readFileSync(CHAT_ARCHIVE_FILE, 'utf8'));
            } catch (e) {}
        }
        archives.push(archivePayload);
        fs.writeFileSync(CHAT_ARCHIVE_FILE, JSON.stringify(archives, null, 2), 'utf8');

        console.log(`[Admin Chat Archive] Conversation archivée (${messages.length} messages) : ${jsonPath}`);
        res.json({ success: true, archivedCount: messages.length, file: path.basename(jsonPath) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/messages', (req, res) => {
    try {
        const status = getChatStatus();
        const messages = purge24hEphemeralChat();
        res.json({ messages, disabled: status.disabled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/send', async (req, res) => {
    try {
        const status = getChatStatus();
        if (status.disabled) {
            return res.status(403).json({ error: "Le chat est actuellement désactivé par l'administrateur." });
        }

        const { text, sender, userLang } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ error: 'Texte requis' });

        const isFrenchSender = (userLang === 'fr');
        let originalText = text.trim();
        let translatedText = "";
        let audioFile = "";
        let audioUrl = "";

        if (isFrenchSender) {
            fs.writeFileSync(path.join(ROOT_DIR, 'input_payload.json'), JSON.stringify({
                text_fr: originalText,
                voice: 'ar-JO-SanaNeural'
            }), 'utf8');

            await runPython(`py translate_fr_to_ar.py`);
            const resultPath = path.join(ROOT_DIR, 'reponse_result.json');
            if (fs.existsSync(resultPath)) {
                const data = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
                translatedText = data.arabic_translation;
                audioFile = data.audio_file;
                audioUrl = `/fichiers_reponse_a_envoyer/${audioFile}`;
            }
        } else {
            fs.writeFileSync(path.join(ROOT_DIR, 'input_ar_payload.json'), JSON.stringify({
                text_ar: originalText,
                voice: 'fr-FR-VivienneMultilingualNeural'
            }), 'utf8');

            await runPython(`py translate_ar_to_fr.py`);
            const resultPath = path.join(ROOT_DIR, 'reponse_fr_result.json');
            if (fs.existsSync(resultPath)) {
                const data = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
                translatedText = data.french_translation;
                audioFile = data.audio_file;
                audioUrl = `/fichiers_reponse_a_envoyer/${audioFile}`;
            }
        }

        const newMessage = {
            id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            sender: sender || (isFrenchSender ? 'John' : 'Aya'),
            userLang: isFrenchSender ? 'fr' : 'ar',
            originalText: originalText,
            translatedText: translatedText,
            audioFile: audioFile,
            audioUrl: audioUrl,
            timestamp: Date.now(),
            expiresAt: Date.now() + TWENTY_FOUR_HOURS_MS
        };

        const messages = purge24hEphemeralChat();
        messages.push(newMessage);
        saveChatMessages(messages);

        res.json({ success: true, message: newMessage });
    } catch (err) {
        console.error("Chat send error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/send-audio', upload.single('audio'), async (req, res) => {
    try {
        const status = getChatStatus();
        if (status.disabled) {
            return res.status(403).json({ error: "Le chat est actuellement désactivé par l'administrateur." });
        }

        if (!req.file) return res.status(400).json({ error: "Aucun fichier audio reçu" });

        const audioFilePath = req.file.path;
        const userLang = req.body.userLang || 'ar';
        const sender = req.body.sender || (userLang === 'fr' ? 'John' : 'Aya');
        const isFrenchSender = (userLang === 'fr');
        const targetLang = isFrenchSender ? 'ar' : 'fr';

        await runPython(`py process_single_file.py "${audioFilePath}" "${targetLang}"`);

        const outPath = path.join(ROOT_DIR, 'single_process_out.json');
        if (fs.existsSync(outPath)) {
            const data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
            let originalText = isFrenchSender ? data.french_translation : data.arabic_text;
            let translatedText = isFrenchSender ? data.arabic_text : data.french_translation;
            let audioUrl = data.french_audio_url;

            const newMessage = {
                id: `chat_rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                sender: sender,
                userLang: userLang,
                originalText: originalText,
                translatedText: translatedText,
                audioFile: path.basename(audioUrl),
                audioUrl: audioUrl,
                timestamp: Date.now(),
                expiresAt: Date.now() + TWENTY_FOUR_HOURS_MS
            };

            const messages = purge24hEphemeralChat();
            messages.push(newMessage);
            saveChatMessages(messages);

            return res.json({ success: true, message: newMessage });
        }
        res.status(500).json({ error: "Erreur lors du traitement audio du chat" });
    } catch (err) {
        console.error("Chat send audio error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
