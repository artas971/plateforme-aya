/**
 * Script de Génération de Refresh Token OAuth2 Google Drive
 * Plateforme Aya - Max (Backend) & Victor (Sécurité)
 * 
 * Usage :
 * node generate_drive_token.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const readline = require('readline');
const { google } = require('googleapis');

const ENV_PATH = path.resolve(__dirname, '.env');
const PORT = 8085;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

// Scopes requis pour téléverser et organiser les fichiers
const SCOPES = ['https://www.googleapis.com/auth/drive'];

function loadEnvFile() {
    const env = {};
    if (fs.existsSync(ENV_PATH)) {
        const content = fs.readFileSync(ENV_PATH, 'utf8');
        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    let val = trimmed.slice(eqIdx + 1).trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    env[key] = val;
                }
            }
        });
    }
    return env;
}

function updateEnvFile(key, value) {
    if (!fs.existsSync(ENV_PATH)) {
        fs.writeFileSync(ENV_PATH, `${key}=${value}\n`, 'utf8');
        return;
    }
    let content = fs.readFileSync(ENV_PATH, 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
    } else {
        if (!content.endsWith('\n')) content += '\n';
        content += `${key}=${value}\n`;
    }
    fs.writeFileSync(ENV_PATH, content, 'utf8');
}

function promptUser(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(query, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    console.log('================================================================');
    console.log('🔑 GÉNÉRATEUR DE REFRESH TOKEN GOOGLE DRIVE (MIGRATION OAUTH2)');
    console.log('================================================================\n');

    const env = loadEnvFile();
    let clientId = process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET;

    if (!clientId) {
        console.log('ℹ️ GOOGLE_CLIENT_ID non trouvé dans .env.');
        clientId = await promptUser('👉 Entrez votre Google Client ID : ');
    } else {
        console.log(`✅ Google Client ID détecté : ${clientId.slice(0, 16)}...`);
    }

    if (!clientSecret) {
        console.log('ℹ️ GOOGLE_CLIENT_SECRET non trouvé dans .env.');
        clientSecret = await promptUser('👉 Entrez votre Google Client Secret : ');
    } else {
        console.log(`✅ Google Client Secret détecté : ${clientSecret.slice(0, 6)}...`);
    }

    if (!clientId || !clientSecret) {
        console.error('❌ Erreur : Client ID et Client Secret sont obligatoires pour continuer.');
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        REDIRECT_URI
    );

    // Force prompt=consent pour s'assurer que Google retourne toujours un Refresh Token
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES
    });

    console.log('\n----------------------------------------------------------------');
    console.log('📌 ÉTAPE 1 : AUTORISATION DANS LE NAVIGATEUR');
    console.log('----------------------------------------------------------------');
    console.log('1. Vérifiez que votre console Google Cloud a bien ce Redirect URI autorisé :');
    console.log(`   🔗 ${REDIRECT_URI}\n`);
    console.log('2. Ouvrez l\'URL suivante dans votre navigateur (connectez-vous avec votre compte Google personnel) :');
    console.log(`\n👉 ${authUrl}\n`);
    console.log('En attente de la redirection automatique ou de la saisie manuelle...');
    console.log('(Un serveur local temporaire écoute sur le port 8085)');

    let serverResolved = false;

    // Démarre un serveur local temporaire pour capturer le code automatiquement
    const server = http.createServer(async (req, res) => {
        try {
            const reqUrl = url.parse(req.url, true);
            if (reqUrl.pathname === '/oauth2callback') {
                const code = reqUrl.query.code;
                const error = reqUrl.query.error;

                if (error) {
                    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`<h1>❌ Erreur d'autorisation : ${error}</h1>`);
                    console.error(`\n❌ Erreur reçue lors de la redirection : ${error}`);
                    return;
                }

                if (code) {
                    serverResolved = true;
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
                        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                            <h1 style="color: #10B981;">✅ Autorisation Google Drive réussie !</h1>
                            <p style="font-size: 1.1rem;">Votre Refresh Token a été capturé avec succès.</p>
                            <p style="color: #64748b;">Vous pouvez fermer cet onglet et revenir à votre terminal.</p>
                        </div>
                    `);

                    await handleCode(oauth2Client, code, clientId, clientSecret);
                    server.close();
                }
            }
        } catch (err) {
            console.error('Erreur serveur de capture :', err.message);
        }
    });

    server.listen(PORT, async () => {
        // En parallèle, proposer la saisie manuelle si le serveur local n'est pas atteignable
        const fallbackCode = await promptUser('\n💡 [Optionnel] Si la redirection automatique ne fonctionne pas, collez le code ou l\'URL finale ici : ');
        if (!serverResolved && fallbackCode) {
            let extractedCode = fallbackCode;
            if (fallbackCode.includes('code=')) {
                const match = fallbackCode.match(/[?&]code=([^&]+)/);
                if (match) extractedCode = decodeURIComponent(match[1]);
            }
            server.close();
            await handleCode(oauth2Client, extractedCode, clientId, clientSecret);
        }
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.warn(`⚠️ Port ${PORT} déjà utilisé. Veuillez utiliser le mode manuel ci-dessous.`);
        }
    });
}

async function handleCode(oauth2Client, code, clientId, clientSecret) {
    try {
        console.log('\n⏳ Échange du code d\'autorisation contre le Refresh Token...');
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
            console.warn('\n⚠️ Attention : Aucun Refresh Token n\'a été renvoyé.');
            console.warn('Cela arrive si l\'accès avait déjà été autorisé auparavant.');
            console.warn('Solution : Révoquez l\'accès à l\'application sur https://myaccount.google.com/permissions et relancez le script.');
            if (tokens.access_token) {
                console.log('Access token obtenu (expire bientôt).');
            }
            process.exit(0);
        }

        console.log('\n================================================================');
        console.log('🎉 REFRESH TOKEN OAUTH2 OBTENU AVEC SUCCÈS !');
        console.log('================================================================');
        console.log(`\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);

        // Test de validation immédiate de quota
        oauth2Client.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        try {
            const about = await drive.about.get({ fields: 'user, storageQuota' });
            const userEmail = about.data.user?.emailAddress || 'Inconnu';
            const quotaTotalGb = about.data.storageQuota?.limit ? (about.data.storageQuota.limit / (1024 ** 3)).toFixed(2) : 'Illimité';
            const quotaUsedGb = about.data.storageQuota?.usage ? (about.data.storageQuota.usage / (1024 ** 3)).toFixed(2) : '0';
            console.log(`👤 Compte Google validé : ${userEmail}`);
            console.log(`💾 Quota Drive personnel : ${quotaUsedGb} Go utilisés sur ${quotaTotalGb} Go`);
            console.log('🚀 Fini la restriction de 0 octet ! Les uploads fonctionneront directement.\n');
        } catch (aboutErr) {
            console.warn('Note quota :', aboutErr.message);
        }

        // Sauvegarde dans .env
        updateEnvFile('GOOGLE_CLIENT_ID', clientId);
        updateEnvFile('GOOGLE_CLIENT_SECRET', clientSecret);
        updateEnvFile('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);
        updateEnvFile('GOOGLE_REDIRECT_URI', REDIRECT_URI);
        console.log('✅ Les variables suivantes ont été enregistrées automatiquement dans votre fichier .env :');
        console.log('   - GOOGLE_CLIENT_ID');
        console.log('   - GOOGLE_CLIENT_SECRET');
        console.log('   - GOOGLE_REFRESH_TOKEN');
        console.log('   - GOOGLE_REDIRECT_URI\n');
        console.log('Vous pouvez désormais redémarrer votre serveur et lancer vos traductions !');
        process.exit(0);

    } catch (err) {
        console.error('❌ Échec lors de la récupération du token :', err.message);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Erreur fatale :', err);
    process.exit(1);
});
