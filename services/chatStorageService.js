/**
 * Service de Persistance et d'Événements du Chat (Plateforme Aya)
 * Tickets GitHub : #24 (TICKET-06) & #25 (TICKET-07)
 * 
 * - Persistance primaire : MongoDB (Modèle ChatMessage avec index TTL 24h et compound index)
 * - Persistance de repli (Fallback) : chat_db.json
 * - Bus d'événements temps réel : ChatEventBus (EventEmitter) pour le Server-Sent Events (SSE)
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { ChatMessage, isDbConnected } = require('../models');

const ROOT_DIR = path.resolve(__dirname, '..');
const CHAT_DB_FILE = path.join(ROOT_DIR, 'chat_db.json');
const REPONSED_DIR = path.join(ROOT_DIR, 'fichiers_reponse_a_envoyer');
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Bus d'événements global pour le streaming Server-Sent Events (SSE)
class ChatEventBusEmitter extends EventEmitter {}
const chatEventBus = new ChatEventBusEmitter();
chatEventBus.setMaxListeners(200); // Support jusqu'à 200 auditeurs simultanés sans avertissement

// --- Gestion du fichier de repli (JSON Fallback) ---

function getFallbackMessages() {
    if (!fs.existsSync(CHAT_DB_FILE)) return [];
    try {
        const raw = fs.readFileSync(CHAT_DB_FILE, 'utf8');
        const data = JSON.parse(raw);
        return data.messages || [];
    } catch (e) {
        console.error('Erreur lecture fallback chat_db.json:', e.message);
        return [];
    }
}

function saveFallbackMessages(messages) {
    try {
        fs.writeFileSync(CHAT_DB_FILE, JSON.stringify({ messages }, null, 2), 'utf8');
    } catch (e) {
        console.error('Erreur écriture fallback chat_db.json:', e.message);
    }
}

function purgeFallback24h() {
    const now = Date.now();
    let messages = getFallbackMessages();
    let updated = false;

    const activeMessages = messages.filter(msg => {
        const isExpired = (now - (msg.timestamp || 0)) > TWENTY_FOUR_HOURS_MS;
        if (isExpired) {
            updated = true;
            if (msg.audioFile) {
                try {
                    const audioPath = path.join(REPONSED_DIR, msg.audioFile);
                    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                } catch (err) {}
            }
            return false;
        }
        return true;
    });

    if (updated) {
        saveFallbackMessages(activeMessages);
    }
    return activeMessages;
}

// --- Fonctions Unifiées de Stockage (MongoDB + Fallback) ---

/**
 * Récupère un message par son identifiant unique
 */
async function getMessageById(messageId) {
    if (isDbConnected()) {
        try {
            const doc = await ChatMessage.findOne({ id: messageId }).lean();
            if (doc) return doc;
        } catch (e) {
            console.warn(`[CHAT DB] Erreur getMessageById Mongo (${e.message}), fallback JSON`);
        }
    }
    const msgs = getFallbackMessages();
    return msgs.find(m => m.id === messageId) || null;
}

/**
 * Récupère les messages filtrés selon l'utilisateur authentifié
 * (Respect strict de la confidentialité des DMs - TICKET-02 & TICKET-06)
 */
async function getFilteredMessages(authenticatedUser, isAdmin) {
    if (isDbConnected()) {
        try {
            let filter = {};
            if (!isAdmin) {
                if (authenticatedUser) {
                    const userRegex = new RegExp(`^${authenticatedUser}$`, 'i');
                    filter = {
                        $or: [
                            { recipient: 'all' },
                            { recipient: null },
                            { recipient: '' },
                            { recipient: userRegex },
                            { sender: userRegex }
                        ]
                    };
                } else {
                    // Visiteur non authentifié : uniquement les messages publics
                    filter = {
                        $or: [
                            { recipient: 'all' },
                            { recipient: null },
                            { recipient: '' }
                        ]
                    };
                }
            }

            const docs = await ChatMessage.find(filter)
                .sort({ timestamp: 1 })
                .lean();

            return docs;
        } catch (e) {
            console.warn(`[CHAT DB] Erreur find Mongo (${e.message}), bascule sur fallback JSON`);
        }
    }

    // Fallback JSON local
    const all = purgeFallback24h();
    return all.filter(msg => {
        if (!msg.recipient || msg.recipient === 'all') return true;
        if (isAdmin) return true;
        if (!authenticatedUser) return false;
        return (msg.sender && msg.sender.toLowerCase() === authenticatedUser.toLowerCase()) ||
               (msg.recipient && msg.recipient.toLowerCase() === authenticatedUser.toLowerCase());
    });
}

/**
 * Enregistre un nouveau message et notifie le bus SSE
 */
async function createMessage(messageData) {
    const formatted = {
        ...messageData,
        createdAt: new Date(messageData.timestamp || Date.now())
    };

    // 1. Sauvegarde MongoDB si connecté
    if (isDbConnected()) {
        try {
            await ChatMessage.create(formatted);
        } catch (e) {
            console.error(`[CHAT DB] Échec insertion MongoDB :`, e.message);
        }
    }

    // 2. Toujours maintenir le fallback JSON synchronisé (résilience)
    try {
        const msgs = purgeFallback24h();
        msgs.push(messageData);
        saveFallbackMessages(msgs);
    } catch (e) {
        console.error(`[CHAT DB] Échec écriture fallback JSON :`, e.message);
    }

    // 3. Diffusion immédiate sur le bus temps réel SSE
    chatEventBus.emit('new_message', messageData);

    return messageData;
}

/**
 * Met à jour un message existant (traduction terminée, audio TTS prêt, etc.)
 */
async function updateMessage(messageId, updates) {
    let updatedDoc = null;

    if (isDbConnected()) {
        try {
            updatedDoc = await ChatMessage.findOneAndUpdate(
                { id: messageId },
                { $set: updates },
                { new: true }
            ).lean();
        } catch (e) {
            console.warn(`[CHAT DB] Erreur update Mongo :`, e.message);
        }
    }

    // Mise à jour fallback JSON
    const msgs = getFallbackMessages();
    const idx = msgs.findIndex(m => m.id === messageId);
    if (idx !== -1) {
        msgs[idx] = { ...msgs[idx], ...updates };
        saveFallbackMessages(msgs);
        if (!updatedDoc) updatedDoc = msgs[idx];
    }

    // Notification SSE pour mise à jour de la bulle
    if (updatedDoc) {
        chatEventBus.emit('update_message', updatedDoc);
    }

    return updatedDoc;
}

/**
 * Supprime un message par son ID
 */
async function deleteMessageById(messageId) {
    let target = await getMessageById(messageId);

    if (isDbConnected()) {
        try {
            await ChatMessage.deleteOne({ id: messageId });
        } catch (e) {
            console.warn(`[CHAT DB] Erreur delete Mongo :`, e.message);
        }
    }

    // Fallback JSON
    const msgs = getFallbackMessages();
    const idx = msgs.findIndex(m => m.id === messageId);
    if (idx !== -1) {
        if (!target) target = msgs[idx];
        msgs.splice(idx, 1);
        saveFallbackMessages(msgs);
    }

    // Suppression audio associé si existant
    if (target && target.audioFile) {
        try {
            const p = path.join(REPONSED_DIR, target.audioFile);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) {}
    }

    // Notification SSE de suppression
    chatEventBus.emit('delete_message', { id: messageId });

    return true;
}

/**
 * Réinitialisation complète du chat (Admin)
 */
async function resetAllChat() {
    if (isDbConnected()) {
        try {
            await ChatMessage.deleteMany({});
        } catch (e) {
            console.warn(`[CHAT DB] Erreur deleteMany Mongo :`, e.message);
        }
    }

    const msgs = getFallbackMessages();
    msgs.forEach(m => {
        if (m.audioFile) {
            try {
                const p = path.join(REPONSED_DIR, m.audioFile);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            } catch (e) {}
        }
    });

    saveFallbackMessages([]);
    chatEventBus.emit('reset_chat', { timestamp: Date.now() });
    return true;
}

module.exports = {
    chatEventBus,
    getMessageById,
    getFilteredMessages,
    createMessage,
    updateMessage,
    deleteMessageById,
    resetAllChat,
    getFallbackMessages,
    purgeFallback24h,
    saveFallbackMessages
};
