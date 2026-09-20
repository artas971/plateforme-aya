/**
 * Module de Sauvegarde Centralisée Google Drive Admin - Plateforme Aya
 * Ticket V1.1 : Sauvegarde Master Drive Centralisée (Service Account)
 * 
 * Directives d'ingénierie :
 * 1. Authentification directe backend via Google Service Account (credentials.json).
 *    Aucun flux OAuth2 par utilisateur.
 * 2. Logique d'arborescence :
 *    Dossier racine Admin (GOOGLE_DRIVE_FOLDER_ID) / [Client Name] / [YYYY-MM-DD]
 * 3. Partage :
 *    Permission automatique "Anyone with the link can view" (role: reader, type: anyone).
 * 4. Frontend :
 *    Renvoie le lien webViewLink pour affichage du bouton "Lien de Sauvegarde".
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'fichiers_reponse_a_envoyer');

let driveClientInstance = null;

/**
 * Résout le fichier de clés JSON du Compte de Service Google Cloud.
 * Ordre de recherche :
 * 1. credentials.json à la racine (standard demandé)
 * 2. Variable d'environnement GOOGLE_SERVICE_ACCOUNT_FILE
 * 3. google_service_account.json à la racine
 */
function resolveCredentialsPath() {
    const credsStandard = path.join(ROOT_DIR, 'credentials.json');
    if (fs.existsSync(credsStandard)) return credsStandard;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
        const envPath = path.resolve(ROOT_DIR, process.env.GOOGLE_SERVICE_ACCOUNT_FILE);
        if (fs.existsSync(envPath)) return envPath;
    }

    const credsLegacy = path.join(ROOT_DIR, 'google_service_account.json');
    if (fs.existsSync(credsLegacy)) return credsLegacy;

    return null;
}

/**
 * Initialise et renvoie le client Google Drive API v3 authentifié.
 * Priorité d'authentification :
 * 1. OAuth2 (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) : Compte personnel admin (Pas de restriction de quota)
 * 2. Compte de Service (credentials.json) : Mode autonome / Disque partagé Workspace
 */
function getDriveClient() {
    if (driveClientInstance) return driveClientInstance;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (clientId && clientSecret && refreshToken) {
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8085/oauth2callback'
        );

        oauth2Client.setCredentials({
            refresh_token: refreshToken
        });

        console.log('[DRIVE SERVICE] 🔑 Authentification Google Drive via OAuth2 active (Compte Administrateur)');
        driveClientInstance = google.drive({ version: 'v3', auth: oauth2Client });
        return driveClientInstance;
    }

    const credPath = resolveCredentialsPath();
    if (credPath) {
        console.log('[DRIVE SERVICE] 🤖 Authentification Google Drive via Compte de Service');
        const auth = new google.auth.GoogleAuth({
            keyFile: credPath,
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        driveClientInstance = google.drive({ version: 'v3', auth });
        return driveClientInstance;
    }

    throw new Error(
        'Authentification Google Drive non configurée. ' +
        'Veuillez renseigner GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REFRESH_TOKEN dans votre .env ' +
        'ou déposer credentials.json à la racine du projet.'
    );
}

/**
 * Recherche ou crée un dossier dans un dossier parent Google Drive.
 * Gère l'idempotence et les Shared Drives.
 * 
 * @param {object} drive - Instance drive
 * @param {string} folderName - Nom du sous-dossier
 * @param {string} parentId - ID du dossier parent
 * @returns {Promise<{id: string, name: string, webViewLink: string}>}
 */
async function findOrCreateFolder(drive, folderName, parentId) {
    const sanitizedName = String(folderName || 'Sans_Nom')
        .replace(/[/\\?%*:|"<>']/g, '_')
        .trim();

    const q = `'${parentId}' in parents and name = '${sanitizedName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const listRes = await drive.files.list({
        q,
        fields: 'files(id, name, webViewLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 10
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
        return listRes.data.files[0];
    }

    const createRes = await drive.files.create({
        requestBody: {
            name: sanitizedName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true
    });

    return createRes.data;
}

/**
 * Configure la permission sur un fichier ou dossier : "Anyone with the link can view".
 * (Lecture seule publique via lien direct).
 * 
 * @param {object} drive - Instance drive
 * @param {string} fileId - ID du fichier ou dossier
 */
async function setPublicReadPermission(drive, fileId) {
    try {
        await drive.permissions.create({
            fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            },
            supportsAllDrives: true
        });
        return true;
    } catch (err) {
        console.warn(`[DRIVE SERVICE] ⚠️ Permission publique non appliquée sur ${fileId} :`, err.message);
        return false;
    }
}

/**
 * Téléverse un fichier local vers un dossier Google Drive avec support streaming.
 * Applique systématiquement la permission de lecture par lien ("Anyone with the link can view").
 * 
 * @param {object} drive - Instance drive
 * @param {string} filePath - Chemin absolu du fichier local
 * @param {string} parentFolderId - ID du dossier parent Google Drive
 * @param {string} mimeType - Type MIME du fichier
 * @param {string} [customName] - Nom du fichier sur Drive (optionnel)
 * @returns {Promise<object>} Métadonnées du fichier créé
 */
async function uploadLocalFile(drive, filePath, parentFolderId, mimeType, customName) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Fichier local introuvable : ${filePath}`);
    }

    const fileName = customName || path.basename(filePath);
    const media = {
        mimeType: mimeType || 'application/octet-stream',
        body: fs.createReadStream(filePath)
    };

    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [parentFolderId]
        },
        media: media,
        fields: 'id, name, webViewLink, webContentLink, size',
        supportsAllDrives: true
    });

    // Configuration des permissions publiques
    await setPublicReadPermission(drive, res.data.id);

    return res.data;
}

/**
 * Sauvegarde centralisée des livrables vidéo pour un client dans le Master Drive Admin.
 * Structure : [GOOGLE_DRIVE_FOLDER_ID] / [Client Name] / [YYYY-MM-DD] / [Fichiers]
 * 
 * @param {object} params
 * @param {string} params.clientName - Nom du client (ex: "Steve", "Anaïs", "Invité")
 * @param {string} [params.dateStr] - Date YYYY-MM-DD
 * @param {object} [params.files] - { mp4, ass, cover, desc }
 * @returns {Promise<{success: boolean, webViewLink: string|null, folderLink: string|null, uploads: object}>}
 */
async function backupDeliverablesForClient({ clientName, dateStr, files = {} }) {
    const { performance } = require('perf_hooks');
    const tDriveStart = performance.now();
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootFolderId) {
        console.warn('[DRIVE MASTER] ℹ️ GOOGLE_DRIVE_FOLDER_ID non défini dans le fichier .env.');
        const tDriveMs = Math.round(performance.now() - tDriveStart);
        return { success: false, reason: 'MISSING_ROOT_FOLDER_ID', webViewLink: null, t_exec_ms: tDriveMs, t_exec_s: (tDriveMs / 1000).toFixed(2) };
    }

    const hasOAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
    const credPath = resolveCredentialsPath();
    if (!hasOAuth && !credPath) {
        console.warn('[DRIVE MASTER] ℹ️ Authentification Drive non configurée (OAuth2 ou credentials.json). Sauvegarde ignorée.');
        const tDriveMs = Math.round(performance.now() - tDriveStart);
        return { success: false, reason: 'MISSING_CREDENTIALS', webViewLink: null, t_exec_ms: tDriveMs, t_exec_s: (tDriveMs / 1000).toFixed(2) };
    }

    const safeClientName = (clientName || 'Client').trim();
    const safeDateStr = (dateStr || new Date().toISOString().slice(0, 10)).trim();

    try {
        const drive = getDriveClient();

        console.log(`[DRIVE MASTER] 📁 Sauvegarde pour "${safeClientName}" sous [${safeDateStr}] dans le Drive Admin...`);

        // 1. Dossier [Client Name]
        const clientFolder = await findOrCreateFolder(drive, safeClientName, rootFolderId);

        // 2. Dossier [YYYY-MM-DD] sous [Client Name]
        const dateFolder = await findOrCreateFolder(drive, safeDateStr, clientFolder.id);

        // Permissions publiques sur le dossier du jour
        await setPublicReadPermission(drive, dateFolder.id);

        let primaryWebViewLink = dateFolder.webViewLink || `https://drive.google.com/drive/folders/${dateFolder.id}`;
        const uploads = {};

        // 3. Téléversement des fichiers
        const fileMapping = [
            { key: 'mp4', name: files.mp4, mime: 'video/mp4' },
            { key: 'ass', name: files.ass, mime: 'text/plain' },
            { key: 'cover', name: files.cover, mime: 'image/jpeg' },
            { key: 'desc', name: files.desc, mime: 'text/plain' }
        ];

        for (const item of fileMapping) {
            if (!item.name) continue;
            const localFilePath = path.isAbsolute(item.name) ? item.name : path.join(OUTPUT_DIR, item.name);

            if (fs.existsSync(localFilePath)) {
                try {
                    console.log(`[DRIVE MASTER] ⬆️ Téléversement de ${path.basename(localFilePath)}...`);
                    const uploaded = await uploadLocalFile(drive, localFilePath, dateFolder.id, item.mime);
                    uploads[item.key] = uploaded;
                    console.log(`[DRIVE MASTER] ✅ Livrable téléversé : ${uploaded.name} (ID: ${uploaded.id})`);

                    if (item.key === 'mp4' && uploaded.webViewLink) {
                        primaryWebViewLink = uploaded.webViewLink;
                    }
                } catch (uploadErr) {
                    console.warn(`[DRIVE MASTER WARNING] Téléversement ${item.key} échoué : ${uploadErr.message}`);
                    if (uploadErr.message && uploadErr.message.includes('quota')) {
                        console.warn(`[DRIVE MASTER INFO] 💡 Note : Compte Service sur Drive personnel. Pour activer les uploads de fichiers binaires sans restriction de quota, rattachez le dossier Admin à un Google Workspace Shared Drive. Le lien du dossier public reste disponible : ${primaryWebViewLink}`);
                    }
                }
            }
        }

        const uploadedCount = Object.keys(uploads).length;
        const tDriveMs = Math.round(performance.now() - tDriveStart);
        return {
            success: uploadedCount > 0,
            uploaded_count: uploadedCount,
            reason: uploadedCount === 0 ? 'SERVICE_ACCOUNT_QUOTA_RESTRICTION' : null,
            webViewLink: primaryWebViewLink,
            folderLink: dateFolder.webViewLink || `https://drive.google.com/drive/folders/${dateFolder.id}`,
            clientFolderId: clientFolder.id,
            dateFolderId: dateFolder.id,
            uploads,
            t_exec_ms: tDriveMs,
            t_exec_s: (tDriveMs / 1000).toFixed(2)
        };

    } catch (err) {
        console.error('[DRIVE MASTER ERROR]', err.message);
        const tDriveMs = Math.round(performance.now() - tDriveStart);
        return {
            success: false,
            error: err.message,
            webViewLink: null,
            t_exec_ms: tDriveMs,
            t_exec_s: (tDriveMs / 1000).toFixed(2)
        };
    }
}

module.exports = {
    getDriveClient,
    findOrCreateFolder,
    setPublicReadPermission,
    uploadLocalFile,
    backupDeliverablesForClient
};
