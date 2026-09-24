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

const {
    chatEventBus,
    getMessageById,
    getFilteredMessages,
    createMessage,
    updateMessage,
    deleteMessageById,
    resetAllChat,
    purgeFallback24h,
    getFallbackMessages,
    saveFallbackMessages
} = require('../services/chatStorageService');

function getChatMessages() {
    return getFallbackMessages();
}

function saveChatMessages(messages) {
    saveFallbackMessages(messages);
}

function purge24hEphemeralChat() {
    return purgeFallback24h();
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

router.post('/reset', async (req, res) => {
    try {
        if (!isUserAdmin(req)) {
            return res.status(403).json({ error: "Accès refusé. Action réservée aux administrateurs." });
        }

        await resetAllChat();
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

router.post('/delete-message', async (req, res) => {
    try {
        if (!isUserAdmin(req)) {
            return res.status(403).json({ error: "Accès refusé. Action réservée aux administrateurs." });
        }

        const { messageId } = req.body;
        if (!messageId) {
            return res.status(400).json({ error: "Identifiant de message (messageId) requis" });
        }

        const target = await getMessageById(messageId);
        if (!target) {
            return res.status(404).json({ error: "Message introuvable ou déjà supprimé." });
        }

        await deleteMessageById(messageId);
        console.log(`[Admin Modération] Message ${messageId} supprimé avec succès par l'administrateur`);
        res.json({ success: true, deletedId: messageId });
    } catch (err) {
        console.error("Delete message error:", err);
        res.status(500).json({ error: err.message });
    }
});

function containsArabic(str) {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str);
}

/**
 * Cache LRU en Mémoire pour Traductions Récurrentes du Chat (TICKET-17)
 * Capacité : 1 000 entrées | TTL : 12 heures | Zéro-Latence (0 ms)
 */
class ChatTranslationLRUCache {
    constructor(maxSize = 1000, ttlMs = 12 * 60 * 60 * 1000) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
        this.cache = new Map();
    }

    _key(text) {
        return (text || '').trim().toLowerCase();
    }

    get(text) {
        const key = this._key(text);
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        // Rafraîchir la position LRU
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }

    set(text, data) {
        const key = this._key(text);
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + this.ttlMs
        });
    }
}

const chatTranslationCache = new ChatTranslationLRUCache(1000, 12 * 3600 * 1000);

/**
 * Traduction Bidirectionnelle Automatique (Thomas & Nadine)
 * Détecte la langue source du texte.
 * - Français -> Arabe Palestinien (Ammiya de Gaza)
 * - Arabe -> Français fluide et naturel
 * Cascade de modèles Gemini pour résilience 429/quota + Cache LRU (TICKET-17)
 */
async function translateChatBidirectional(text) {
    // 1. Vérification Cache LRU (0 ms)
    const cached = chatTranslationCache.get(text);
    if (cached) {
        console.log(`[Chat IA Cache HIT] (0 ms) "${text.substring(0, 30)}..." -> "${cached.translated_text.substring(0, 30)}..."`);
        return cached;
    }

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
                    const result = {
                        detected_lang,
                        translated_text,
                        model_used: model
                    };
                    chatTranslationCache.set(text, result);
                    return result;
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
            const fallbackResult = {
                detected_lang: isAr ? 'ar' : 'fr',
                translated_text: translated,
                model_used: 'gtx-fallback'
            };
            chatTranslationCache.set(text, fallbackResult);
            return fallbackResult;
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

router.get('/messages', async (req, res) => {
    try {
        const status = getChatStatus();
        const sessionUser = req.session?.user;
        const currentName = (sessionUser && sessionUser.authenticated)
            ? String(sessionUser.name || sessionUser.username || '').trim()
            : null;
        const isAdmin = isUserAdmin(req);

        const visibleMessages = await getFilteredMessages(currentName, isAdmin);

        res.json({ messages: visibleMessages, disabled: status.disabled, isAdmin: !!isAdmin });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/chat/stream
 * Flux Server-Sent Events (SSE) Zéro-Polling (Ticket #25 - TICKET-07)
 */
router.get('/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    res.write(': connected\n\n');

    const sessionUser = req.session?.user;
    const currentName = (sessionUser && sessionUser.authenticated)
        ? String(sessionUser.name || sessionUser.username || '').trim().toLowerCase()
        : null;
    const isAdmin = isUserAdmin(req);

    function canUserSeeMessage(msg) {
        if (!msg.recipient || msg.recipient === 'all') return true;
        if (isAdmin) return true;
        if (!currentName) return false;
        const senderLower = (msg.sender || '').toLowerCase();
        const recipientLower = (msg.recipient || '').toLowerCase();
        return senderLower === currentName || recipientLower === currentName;
    }

    const onNewMessage = (msg) => {
        if (canUserSeeMessage(msg)) {
            res.write(`event: new_message\ndata: ${JSON.stringify(msg)}\n\n`);
        }
    };

    const onUpdateMessage = (msg) => {
        if (canUserSeeMessage(msg)) {
            res.write(`event: update_message\ndata: ${JSON.stringify(msg)}\n\n`);
        }
    };

    const onDeleteMessage = (data) => {
        res.write(`event: delete_message\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const onResetChat = (data) => {
        res.write(`event: reset_chat\ndata: ${JSON.stringify(data)}\n\n`);
    };

    chatEventBus.on('new_message', onNewMessage);
    chatEventBus.on('update_message', onUpdateMessage);
    chatEventBus.on('delete_message', onDeleteMessage);
    chatEventBus.on('reset_chat', onResetChat);

    const heartbeat = setInterval(() => {
        try {
            res.write(': heartbeat\n\n');
        } catch (e) {
            clearInterval(heartbeat);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        chatEventBus.removeListener('new_message', onNewMessage);
        chatEventBus.removeListener('update_message', onUpdateMessage);
        chatEventBus.removeListener('delete_message', onDeleteMessage);
        chatEventBus.removeListener('reset_chat', onResetChat);
    });
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

        // Priorité stricte à l'identité authentifiée en session pour éviter toute usurpation d'expéditeur
        const sessionUser = req.session?.user;
        const authenticatedSender = (sessionUser && sessionUser.authenticated)
            ? String(sessionUser.name || sessionUser.username || '').trim()
            : null;

        const defaultSender = quickDetectedLang === 'fr' ? 'John' : 'Aya';
        const finalSender = authenticatedSender || ((sender && sender.trim() && sender !== 'Utilisateur' && sender !== 'آية') 
            ? sender.trim() 
            : defaultSender);

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

        await createMessage(newMessage);

        console.log(`[Chat Send Immédiat] ID: ${newMessage.id} | De: ${newMessage.sender} -> Dest: ${newMessage.recipient} (Envoi immédiat sans blocage)`);

        // Réponse instantanée au client sans bloquer sur l'API externe (< 5ms)
        res.json({ success: true, message: newMessage });

        // Traitement asynchrone découplé en arrière-plan : Traduction Gemini & Vocalisation
        setImmediate(async () => {
            try {
                const result = await translateChatBidirectional(originalText);
                await updateMessage(newMessage.id, {
                    translatedText: result.translated_text || '',
                    userLang: result.detected_lang || quickDetectedLang,
                    translationStatus: 'ready',
                    ai_model_used: result.model_used
                });
                console.log(`[Chat Traduction Async Terminée] ID: ${newMessage.id} -> ${(result.translated_text || '').substring(0, 30)}...`);
            } catch (asyncErr) {
                console.warn(`[Chat Traduction Async Warning] ID: ${newMessage.id} :`, asyncErr.message);
                await updateMessage(newMessage.id, {
                    translationStatus: 'error'
                });
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

        const msg = await getMessageById(messageId);
        if (!msg) {
            return res.status(404).json({ error: "Message introuvable" });
        }

        // Si l'audio existe déjà sur disque
        if (msg.audioUrl && msg.audioFile && fs.existsSync(path.join(REPONSED_DIR, msg.audioFile))) {
            return res.json({ success: true, messageId: msg.id, audioUrl: msg.audioUrl });
        }

        // Détermination de la voix et du texte à vocaliser
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
            await runPython(`generate_tts_quick.py "${payloadPath}"`);
        } finally {
            if (fs.existsSync(payloadPath)) {
                try { fs.unlinkSync(payloadPath); } catch (e) {}
            }
        }

        if (fs.existsSync(outputMp3Path)) {
            await updateMessage(msg.id, {
                audioFile: audioFileName,
                audioUrl: `/fichiers_reponse_a_envoyer/${audioFileName}`,
                audioStatus: 'ready'
            });

            console.log(`[Chat TTS Généré] ID: ${msg.id} -> ${audioFileName}`);
            return res.json({ success: true, messageId: msg.id, audioUrl: `/fichiers_reponse_a_envoyer/${audioFileName}` });
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
        const sessionUser = req.session?.user;
        const authenticatedSender = (sessionUser && sessionUser.authenticated)
            ? String(sessionUser.name || sessionUser.username || '').trim()
            : null;
        const sender = authenticatedSender || req.body.sender || (userLang === 'fr' ? 'John' : 'Aya');
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

        try {
            await runPython(`process_single_file.py "${audioFilePath}" "${targetLang}"`);
        } finally {
            // Nettoyage immédiat du fichier audio temporaire téléversé par Multer (protection anti-saturation disque)
            try {
                if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
            } catch (e) {}
        }

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
                audioStatus: 'ready',
                timestamp: Date.now(),
                expiresAt: Date.now() + TWENTY_FOUR_HOURS_MS
            };

            await createMessage(newMessage);
            return res.json({ success: true, message: newMessage });
        }
        res.status(500).json({ error: "Erreur lors du traitement audio du chat" });
    } catch (err) {
        console.error("Chat send audio error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
