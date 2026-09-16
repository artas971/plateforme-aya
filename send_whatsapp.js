const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

// Initialisation du client WhatsApp Web avec navigateur Edge
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
    puppeteer: {
        executablePath: fs.existsSync(EDGE_PATH) ? EDGE_PATH : undefined,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Récupération des arguments passés en ligne de commande ou fichier JSON
let inputPayload = null;
const payloadPath = path.join(__dirname, 'whatsapp_payload.json');

if (fs.existsSync(payloadPath)) {
    try {
        inputPayload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
    } catch (e) {
        console.error("Erreur de lecture de whatsapp_payload.json:", e);
    }
}

const targetContact = inputPayload?.recipient || process.argv[2];
const messageText = inputPayload?.text || process.argv[3];
const audioFilePath = inputPayload?.audioPath || process.argv[4];
const isInitOnly = process.argv.includes('--init');

client.on('qr', (qr) => {
    console.log('\n========================================');
    console.log('  SCANNER CE QR CODE AVEC WHATSAPP :');
    console.log('========================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\nAllez dans WhatsApp > Appareils connectés > Connecter un appareil.');
});

client.on('authenticated', () => {
    console.log('[WhatsApp] Authentification réussie !');
});

client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Échec d\'authentification :', msg);
});

client.on('ready', async () => {
    console.log('[WhatsApp] Client connecté et prêt !');

    if (isInitOnly) {
        console.log('[WhatsApp] Session initialisée avec succès.');
        process.exit(0);
    }

    if (!targetContact) {
        console.error('[WhatsApp] Aucun destinataire spécifié (nom ou numéro).');
        process.exit(1);
    }

    try {
        let chatId = null;
        const chats = await client.getChats();

        // 1. Chercher d'abord par nom exact de contact ou partie de nom
        const searchName = targetContact.toLowerCase().trim();
        const matchedChat = chats.find(c => c.name && c.name.toLowerCase().includes(searchName));

        if (matchedChat) {
            chatId = matchedChat.id._serialized;
            console.log(`[WhatsApp] Contact trouvé dans les discussions : ${matchedChat.name} (${chatId})`);
        } else {
            // 2. Si c'est un numéro de téléphone
            const cleanNum = targetContact.replace(/[^0-9]/g, '');
            if (cleanNum.length >= 8) {
                chatId = `${cleanNum}@c.us`;
                console.log(`[WhatsApp] Envoi direct vers le numéro : ${chatId}`);
            } else {
                console.error(`[WhatsApp] Impossible de trouver la discussion pour : "${targetContact}"`);
                process.exit(1);
            }
        }

        // Envoi du message texte si présent
        if (messageText) {
            await client.sendMessage(chatId, messageText);
            console.log(`[WhatsApp] Texte envoyé avec succès à ${targetContact} !`);
        }

        // Envoi du fichier audio (note vocale) si présent
        if (audioFilePath && fs.existsSync(audioFilePath)) {
            const media = MessageMedia.fromFilePath(audioFilePath);
            await client.sendMessage(chatId, media, { sendAudioAsVoice: true });
            console.log(`[WhatsApp] Vocal MP3 envoyé comme note vocale à ${targetContact} !`);
        }

        console.log('SUCCESS_WHATSAPP_SENT');
        setTimeout(() => process.exit(0), 2000);

    } catch (err) {
        console.error('[WhatsApp] Erreur lors de l\'envoi :', err);
        process.exit(1);
    }
});

client.initialize();
