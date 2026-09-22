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
    const formattedCmd = formatPythonCommand(command);
    return new Promise((resolve, reject) => {
        exec(formattedCmd, { cwd: ROOT_DIR, env: process.env }, (error, stdout, stderr) => {
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

function isUserAdmin(req) {
    const sessionUser = req.session?.user;
    if (!sessionUser) return false;
    const adminEmails = (process.env.ADMIN_EMAIL || 'artas971@gmail.com')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
    const userEmail = (sessionUser.email || '').trim().toLowerCase();
    const userRole = (sessionUser.role || '').trim().toLowerCase();
    const userName = (sessionUser.username || sessionUser.name || '').trim().toLowerCase();

    return userRole === 'admin' || userName === 'john' || (userEmail && adminEmails.includes(userEmail));
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
        if (!isUserAdmin(req)) {
            return res.status(403).json({ error: "Accès refusé. Action réservée aux administrateurs." });
        }
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
        if (!isUserAdmin(req)) {
            return res.status(403).json({ error: "Accès refusé. Action réservée aux administrateurs." });
        }

        // Nettoyage des fichiers audio associés sur le disque
        const currentMessages = getChatMessages();
        currentMessages.forEach(msg => {
            if (msg.audioFile) {
                const mp3Path = path.join(REPONSED_DIR, msg.audioFile);
                if (fs.existsSync(mp3Path)) {
                    try {
                        fs.unlinkSync(mp3Path);
                        console.log(`[Admin Chat Reset] Audio supprimé : ${msg.audioFile}`);
                    } catch (e) {}
                }
            }
        });

        saveChatMessages([]);
        console.log(`[Admin Chat Reset] Conversation totalement réinitialisée et effacée par l'admin`);
        res.json({ success: true, message: 'Conversation réinitialisée et effacée avec succès pour tous les utilisateurs.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/archive', (req, res) => {
    try {
        if (!isUserAdmin(req)) {
            return res.status(403).json({ error: "Accès refusé. Action réservée aux administrateurs." });
        }
        const messages = getChatMessages();
        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        const archivePayload = {
            archiveId: `archive_${Date.now()}`,
            archivedAt: new Date().toISOString(),
            messagesCount: messages.length,
            messages: messages
        };

        if (!fs.existsSync(MESSAGE_FOR_JOHN_DIR)) {
            fs.mkdirSync(MESSAGE_FOR_JOHN_DIR, { recursive: true });
        }
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

router.post('/delete-message', (req, res) => {
    try {
        if (!isUserAdmin(req)) {
            return res.status(403).json({ error: "Accès refusé. Action réservée aux administrateurs." });
        }

        const { messageId } = req.body;
        if (!messageId) {
            return res.status(400).json({ error: "Identifiant de message (messageId) requis" });
        }

        let messages = getChatMessages();
        const msgIndex = messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) {
            return res.status(404).json({ error: "Message introuvable ou déjà supprimé." });
        }

        const deletedMsg = messages[msgIndex];
        if (deletedMsg.audioFile) {
            const mp3Path = path.join(REPONSED_DIR, deletedMsg.audioFile);
            if (fs.existsSync(mp3Path)) {
                try {
                    fs.unlinkSync(mp3Path);
                    console.log(`[Admin Modération] Audio supprimé du disque : ${deletedMsg.audioFile}`);
                } catch (e) {}
            }
        }

        messages.splice(msgIndex, 1);
        saveChatMessages(messages);

        console.log(`[Admin Modération] Message ${messageId} supprimé avec succès par l'administrateur`);
        res.json({ success: true, deletedId: messageId, remainingCount: messages.length });
    } catch (err) {
        console.error("Delete message error:", err);
        res.status(500).json({ error: err.message });
    }
});

function containsArabic(str) {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str);
}

/**
 * Traduction Bidirectionnelle Automatique (Thomas & Nadine)
 * Détecte la langue source du texte.
 * - Français -> Arabe Palestinien (Ammiya de Gaza)
 * - Arabe -> Français fluide et naturel
 * Cascade de modèles Gemini pour résilience 429/quota
 */
async function translateChatBidirectional(text) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const systemPrompt = `Tu es le traducteur expert du chat d'urgence de la plateforme Aya.
Détecte la langue source du texte. Si le texte est en Français, traduis-le en Arabe Palestinien (Ammiya de Gaza). Si le texte est en Arabe, traduis-le en Français fluide et naturel. Ne répète jamais le texte source.

Tu dois impérativement répondre au format JSON strict avec exactement ces deux champs :
{
  "detected_lang": "fr" ou "ar",
  "translated_text": "traduction ici"
}`;

    if (geminiKey) {
        const models = [
            'gemini-2.5-flash',
            'gemini-flash-latest',
            'gemini-flash-lite-latest',
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite',
            'gemini-pro-latest'
        ];

        for (const model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: 'user',
                                parts: [{ text: `Texte à analyser et traduire :\n${text}` }]
                            }
                        ],
                        systemInstruction: {
                            parts: [{ text: systemPrompt }]
                        },
                        generationConfig: {
                            responseMimeType: 'application/json',
                            temperature: 0.2
                        }
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    if (response.status === 429 || response.status === 503 || errText.includes('RESOURCE_EXHAUSTED')) {
                        console.warn(`⚠️ [Chat Quota] Modèle ${model} indisponible (${response.status}), bascule sur modèle de secours...`);
                        continue;
                    }
                    console.warn(`[Chat IA Warning] ${model} HTTP ${response.status}: ${errText.substring(0, 120)}`);
                    continue;
                }

                const data = await response.json();
                const candidate = data.candidates && data.candidates[0];
                const contentPart = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
                const textResponse = contentPart ? contentPart.text : '';

                if (textResponse) {
                    const cleanJson = textResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
                    const parsed = JSON.parse(cleanJson);
                    const detected_lang = (parsed.detected_lang === 'ar' || parsed.detected_lang === 'fr') 
                        ? parsed.detected_lang 
                        : (containsArabic(text) ? 'ar' : 'fr');
                    const translated_text = (parsed.translated_text || '').trim();

                    console.log(`[Chat IA Succès] Modèle: ${model} | Langue: ${detected_lang} -> ${translated_text.substring(0, 40)}...`);
                    return {
                        detected_lang,
                        translated_text,
                        model_used: model
                    };
                }
            } catch (err) {
                console.warn(`⚠️ [Chat IA Exception] Modèle ${model} : ${err.message}`);
            }
        }
    }

    // Fallback de secours rapide si tous les quotas Gemini sont temporairement épuisés
    console.warn("⚠️ [Chat IA Fallback] Utilisation du secours rapide pour la traduction.");
    const isAr = containsArabic(text);
    const target = isAr ? 'fr' : 'ar';
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=` + encodeURIComponent(text.substring(0, 1500));
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await res.json();
        let translated = '';
        if (data && Array.isArray(data[0])) {
            translated = data[0].map(chunk => chunk[0]).join('');
        }
        if (translated) {
            return {
                detected_lang: isAr ? 'ar' : 'fr',
                translated_text: translated,
                model_used: 'gtx-fallback'
            };
        }
    } catch (e) {
        console.warn("[Fallback gtx error]:", e.message);
    }

    return {
        detected_lang: isAr ? 'ar' : 'fr',
        translated_text: text,
        model_used: 'fallback-emergency'
    };
}

router.get('/messages', (req, res) => {
    try {
        const status = getChatStatus();
        const allMessages = purge24hEphemeralChat();

        // Récupération de l'utilisateur en session ou query fallback
        const sessionUser = req.session?.user;
        const currentName = (sessionUser?.name || sessionUser?.username || req.query.user || '').trim().toLowerCase();
        const isAdmin = isUserAdmin(req);

        // Filtrage sécurisé : on ne renvoie un message privé que si l'utilisateur est concerné (expéditeur ou destinataire) ou admin
        const visibleMessages = allMessages.filter(msg => {
            if (!msg.recipient || msg.recipient === 'all') return true;
            if (isAdmin) return true;
            if (!currentName) return false;
            const senderLower = (msg.sender || '').toLowerCase();
            const recipientLower = (msg.recipient || '').toLowerCase();
            return senderLower === currentName || recipientLower === currentName;
        });

        res.json({ messages: visibleMessages, disabled: status.disabled, isAdmin: !!isAdmin });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Étape 1 : Envoi Instantané Non-Bloquant (< 5ms) avec Traitement Asynchrone en Arrière-plan
router.post('/send', async (req, res) => {
    try {
        const status = getChatStatus();
        if (status.disabled) {
            return res.status(403).json({ error: "Le chat est actuellement désactivé par l'administrateur." });
        }

        const { text, sender, recipient, replyTo, userLang } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ error: 'Texte requis' });

        const originalText = text.trim();

        // Détection ultra-rapide locale de la langue par regex (0 ms)
        const isAr = containsArabic(originalText);
        const quickDetectedLang = isAr ? 'ar' : (userLang === 'ar' ? 'ar' : 'fr');

        const defaultSender = quickDetectedLang === 'fr' ? 'John' : 'Aya';
        const finalSender = (sender && sender.trim() && sender !== 'Utilisateur' && sender !== 'آية') 
            ? sender.trim() 
            : defaultSender;

        const targetRecipient = (recipient && recipient !== 'all') ? recipient.trim() : 'all';

        const newMessage = {
            id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            sender: finalSender,
            recipient: targetRecipient,
            replyTo: replyTo && replyTo.text ? {
                id: replyTo.id || null,
                sender: replyTo.sender || 'Inconnu',
                text: String(replyTo.text).substring(0, 300)
            } : null,
            userLang: quickDetectedLang,
            originalText: originalText,
            translatedText: '',
            translationStatus: 'translating',
            status: 'sent',
            audioFile: null,
            audioUrl: null,
            audioStatus: 'pending',
            ai_model_used: null,
            timestamp: Date.now(),
            expiresAt: Date.now() + TWENTY_FOUR_HOURS_MS
        };

        const messages = purge24hEphemeralChat();
        messages.push(newMessage);
        saveChatMessages(messages);

        console.log(`[Chat Send Immédiat] ID: ${newMessage.id} | De: ${newMessage.sender} -> Dest: ${newMessage.recipient} (Envoi immédiat sans blocage)`);

        // Réponse instantanée au client sans bloquer sur l'API externe (< 5ms)
        res.json({ success: true, message: newMessage });

        // Traitement asynchrone découplé en arrière-plan : Traduction Gemini & Vocalisation
        setImmediate(async () => {
            try {
                const result = await translateChatBidirectional(originalText);
                const currentMsgs = getChatMessages();
                const idx = currentMsgs.findIndex(m => m.id === newMessage.id);
                if (idx !== -1) {
                    currentMsgs[idx].translatedText = result.translated_text || '';
                    currentMsgs[idx].userLang = result.detected_lang || quickDetectedLang;
                    currentMsgs[idx].translationStatus = 'ready';
                    currentMsgs[idx].ai_model_used = result.model_used;
                    saveChatMessages(currentMsgs);
                    console.log(`[Chat Traduction Async Terminée] ID: ${newMessage.id} -> ${result.translated_text.substring(0, 30)}...`);
                }
            } catch (asyncErr) {
                console.warn(`[Chat Traduction Async Warning] ID: ${newMessage.id} :`, asyncErr.message);
                const currentMsgs = getChatMessages();
                const idx = currentMsgs.findIndex(m => m.id === newMessage.id);
                if (idx !== -1) {
                    currentMsgs[idx].translationStatus = 'error';
                    saveChatMessages(currentMsgs);
                }
            }
        });
    } catch (err) {
        console.error("Chat send error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Étape 2 : Génération Audio TTS Asynchrone Découplée (Arrière-plan)
router.post('/tts', async (req, res) => {
    try {
        const { messageId } = req.body;
        if (!messageId) {
            return res.status(400).json({ error: "messageId requis" });
        }

        const messages = getChatMessages();
        const msgIndex = messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) {
            return res.status(404).json({ error: "Message introuvable" });
        }

        const msg = messages[msgIndex];

        // Si l'audio existe déjà sur disque
        if (msg.audioUrl && msg.audioFile && fs.existsSync(path.join(REPONSED_DIR, msg.audioFile))) {
            return res.json({ success: true, messageId: msg.id, audioUrl: msg.audioUrl });
        }

        // Détermination de la voix et du texte à vocaliser
        // Le but est de vocaliser le texte traduit pour le destinataire :
        // Si la source était le Français (userLang === 'fr'), la traduction est en Arabe Palestinien -> voix ar-JO-SanaNeural
        // Si la source était l'Arabe (userLang === 'ar'), la traduction est en Français -> voix fr-FR-VivienneMultilingualNeural
        const isFrenchSource = (msg.userLang === 'fr');
        const voice = isFrenchSource ? 'ar-JO-SanaNeural' : 'fr-FR-VivienneMultilingualNeural';
        const textToSpeak = msg.translatedText;

        if (!textToSpeak || !textToSpeak.trim()) {
            return res.status(202).json({ 
                success: false, 
                pending: true, 
                message: "La traduction automatique est en cours de finalisation..." 
            });
        }

        if (!fs.existsSync(REPONSED_DIR)) {
            fs.mkdirSync(REPONSED_DIR, { recursive: true });
        }

        const audioFileName = `chat_tts_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp3`;
        const outputMp3Path = path.join(REPONSED_DIR, audioFileName);

        const payloadPath = path.join(ROOT_DIR, `temp_chat_tts_${Date.now()}.json`);
        fs.writeFileSync(payloadPath, JSON.stringify({
            text: textToSpeak,
            voice: voice,
            output_path: outputMp3Path
        }), 'utf8');

        try {
            await runPython(`py generate_tts_quick.py "${payloadPath}"`);
        } finally {
            if (fs.existsSync(payloadPath)) {
                try { fs.unlinkSync(payloadPath); } catch (e) {}
            }
        }

        if (fs.existsSync(outputMp3Path)) {
            msg.audioFile = audioFileName;
            msg.audioUrl = `/fichiers_reponse_a_envoyer/${audioFileName}`;
            msg.audioStatus = 'ready';
            messages[msgIndex] = msg;
            saveChatMessages(messages);

            console.log(`[Chat TTS Généré] ID: ${msg.id} -> ${audioFileName}`);
            return res.json({ success: true, messageId: msg.id, audioUrl: msg.audioUrl });
        } else {
            return res.status(500).json({ error: "Échec de génération du fichier audio TTS" });
        }
    } catch (err) {
        console.error("Chat TTS error:", err);
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

        let replyTo = null;
        if (req.body.replyTo) {
            try {
                const parsed = typeof req.body.replyTo === 'string' ? JSON.parse(req.body.replyTo) : req.body.replyTo;
                if (parsed && parsed.text) {
                    replyTo = {
                        id: parsed.id || null,
                        sender: parsed.sender || 'Inconnu',
                        text: String(parsed.text).substring(0, 300)
                    };
                }
            } catch (e) {
                // ignore json parse error
            }
        }
        const recipient = (req.body.recipient && req.body.recipient !== 'all') ? req.body.recipient.trim() : 'all';

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
                recipient: recipient,
                replyTo: replyTo,
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
