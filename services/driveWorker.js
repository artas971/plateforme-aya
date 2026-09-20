/**
 * Module d'automatisation Google Drive Worker - Plateforme Aya
 * Ticket 5 : Connecteur Google Drive (Automatisation de bout en bout)
 * 
 * Architecture "State Folders" & Double Verrouillage :
 * 1. Authentification : Compte de Service Google Cloud (Service Account)
 * 2. Arborescence Drive automatique :
 *    - 01_A_TRAITER : Dépôt initial des vidéos/audios
 *    - 02_EN_COURS   : Prise en charge atomique (déplacement immédiat)
 *    - 03_TERMINE   : Vidéo finale MP4 incrustée + Sous-titres .ASS + Source
 *    - 04_ERREURS   : Médias non supportés ou en échec avec rapport texte
 * 3. Double Verrouillage : Sémaphore mémoire (isProcessing) + Registre local persistant (drive_synced_files.json)
 * 4. Planificateur : node-cron (fréquence configurable par .env)
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { google } = require('googleapis');
const cron = require('node-cron');

const ROOT_DIR = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT_DIR, 'drive_synced_files.json');
const TEMP_DOWNLOAD_DIR = path.join(ROOT_DIR, 'temp_drive_downloads');
const OUTPUT_DIR = path.join(ROOT_DIR, 'fichiers_reponse_a_envoyer');

// Extensions média supportées pour le pipeline de transcription & sous-titrage
const SUPPORTED_EXTENSIONS = new Set([
    '.mp4', '.mov', '.mkv', '.avi', '.webm',
    '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'
]);

// Dossiers d'état Google Drive
const STATE_FOLDER_NAMES = {
    INPUT: '01_A_TRAITER',
    IN_PROGRESS: '02_EN_COURS',
    COMPLETED: '03_TERMINE',
    ERRORS: '04_ERREURS'
};

// État du Worker en mémoire
let isProcessing = false;
let cronTask = null;
let driveClient = null;
let cachedFolderIds = null;
let lastSyncTimestamp = null;
let lastProcessedFileName = null;

/**
 * Charge le registre local persistant (Anti-Doublon & Traçabilité).
 */
function loadLedger() {
    if (fs.existsSync(LEDGER_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
        } catch (err) {
            console.error('[DRIVE WORKER] ⚠️ Erreur lecture registre, réinitialisation :', err.message);
        }
    }
    return { synced_files: {} };
}

/**
 * Sauvegarde de manière atomique le registre local.
 */
function saveLedger(ledger) {
    try {
        const tmpPath = `${LEDGER_PATH}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(ledger, null, 2), 'utf8');
        fs.renameSync(tmpPath, LEDGER_PATH);
    } catch (err) {
        console.error('[DRIVE WORKER] ⚠️ Erreur sauvegarde registre :', err.message);
    }
}

/**
 * Initialise le client Google Drive API via Service Account.
 */
function getDriveClient() {
    if (driveClient) return driveClient;

    const credentialsFile = fs.existsSync(path.join(ROOT_DIR, 'credentials.json'))
        ? path.join(ROOT_DIR, 'credentials.json')
        : (process.env.GOOGLE_SERVICE_ACCOUNT_FILE
            ? path.resolve(ROOT_DIR, process.env.GOOGLE_SERVICE_ACCOUNT_FILE)
            : path.join(ROOT_DIR, 'google_service_account.json'));

    if (!fs.existsSync(credentialsFile)) {
        throw new Error(`Fichier Service Account introuvable : "${credentialsFile}". Veuillez déposer votre clé JSON Google Cloud (credentials.json).`);
    }

    const auth = new google.auth.GoogleAuth({
        keyFile: credentialsFile,
        scopes: ['https://www.googleapis.com/auth/drive']
    });

    driveClient = google.drive({ version: 'v3', auth });
    return driveClient;
}

/**
 * S'assure de l'existence des 4 dossiers d'état dans le dossier racine Google Drive.
 * Crée automatiquement les dossiers manquants et met en cache leurs identifiants.
 */
async function ensureStateFolders(drive, rootFolderId) {
    if (cachedFolderIds) return cachedFolderIds;

    console.log(`[DRIVE WORKER] 🔍 Vérification de l'arborescence des dossiers d'état dans le Drive racine (${rootFolderId})...`);

    // Liste les sous-dossiers existants
    const q = `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await drive.files.list({
        q,
        fields: 'files(id, name)',
        pageSize: 50
    });

    const existingFolders = res.data.files || [];
    const folderMap = {};

    for (const [key, folderName] of Object.entries(STATE_FOLDER_NAMES)) {
        let found = existingFolders.find(f => f.name === folderName);
        if (found) {
            folderMap[key] = found.id;
        } else {
            console.log(`[DRIVE WORKER] 📁 Création automatique du dossier "${folderName}"...`);
            const created = await drive.files.create({
                requestBody: {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [rootFolderId]
                },
                fields: 'id, name'
            });
            folderMap[key] = created.data.id;
        }
    }

    cachedFolderIds = folderMap;
    console.log('[DRIVE WORKER] ✅ Arborescence Google Drive validée :', {
        '01_A_TRAITER': folderMap.INPUT,
        '02_EN_COURS': folderMap.IN_PROGRESS,
        '03_TERMINE': folderMap.COMPLETED,
        '04_ERREURS': folderMap.ERRORS
    });

    return cachedFolderIds;
}

/**
 * Déplace un fichier entre deux dossiers Google Drive de façon atomique.
 */
async function moveDriveFile(drive, fileId, currentParentId, newParentId) {
    return await drive.files.update({
        fileId: fileId,
        addParents: newParentId,
        removeParents: currentParentId,
        fields: 'id, name, parents'
    });
}

/**
 * Télécharge un fichier Google Drive en streaming vers le disque local.
 */
async function downloadDriveFile(drive, fileId, destLocalPath) {
    const destStream = fs.createWriteStream(destLocalPath);
    const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
        res.data
            .on('end', () => resolve(destLocalPath))
            .on('error', (err) => reject(err))
            .pipe(destStream);
    });
}

/**
 * Téléverse un fichier local vers un dossier Google Drive spécifique.
 */
async function uploadLocalFile(drive, localFilePath, targetFolderId, mimeType = 'application/octet-stream') {
    const fileName = path.basename(localFilePath);
    const media = {
        mimeType: mimeType,
        body: fs.createReadStream(localFilePath)
    };

    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [targetFolderId]
        },
        media: media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true
    });

    return res.data;
}

/**
 * Téléverse un fichier log d'erreur textuel vers le dossier 04_ERREURS.
 */
async function uploadErrorLog(drive, targetFolderId, sourceFileName, errorDetails) {
    const logName = `rapport_erreur_${path.parse(sourceFileName).name}.txt`;
    const media = {
        mimeType: 'text/plain',
        body: `Rapport d'erreur de traitement Aya V3\nFichier source : ${sourceFileName}\nDate : ${new Date().toISOString()}\n\nDétails de l'erreur :\n${errorDetails}`
    };

    return await drive.files.create({
        requestBody: {
            name: logName,
            parents: [targetFolderId]
        },
        media: media,
        fields: 'id, name'
    });
}

/**
 * Exécute le pipeline de traduction & sous-titrage Python (process_traduction.py)
 */
function runPythonPipeline(mediaPath, sourceLang, targetLang, subColor, subPosition, generateTiktokPack = false) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(ROOT_DIR, 'process_traduction.py');
        const forceReprocess = 'false';

        console.log(`[DRIVE PIPELINE] 🚀 Lancement du traitement pour : ${path.basename(mediaPath)}`);
        console.log(`  - Langue source : ${sourceLang} | Cible : ${targetLang} | Couleur : ${subColor} | Position : ${subPosition} | Pack TikTok : ${generateTiktokPack}`);

        const pyProcess = spawn('py', [
            scriptPath,
            mediaPath,
            targetLang,
            subColor,
            subPosition,
            sourceLang,
            forceReprocess,
        ], {
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

        let stdoutData = '';
        let stderrData = '';

        pyProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdoutData += chunk;
            // Affiche les messages de progression
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.includes('[PROGRESS]')) {
                    console.log(`[DRIVE PIPELINE] ${line.trim()}`);
                }
            }
        });

        pyProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        pyProcess.on('error', (err) => {
            reject(new Error(`Impossible de lancer Python : ${err.message}`));
        });

        pyProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(stderrData.trim() || `Script Python s'est arrêté avec le code ${code}`));
            }

            const jsonMatch = stdoutData.match(/---JSON_OUTPUT_START---([\s\S]*?)---JSON_OUTPUT_END---/);
            if (!jsonMatch) {
                return reject(new Error(`Sortie JSON finale manquante dans le script Python : ${stdoutData.slice(-300)}`));
            }

            try {
                const parsed = JSON.parse(jsonMatch[1].trim());
                if (!parsed.success) {
                    return reject(new Error(parsed.error || 'Échec du traitement Python'));
                }
                resolve(parsed);
            } catch (e) {
                reject(new Error(`Erreur lors du parsing JSON Python : ${e.message}`));
            }
        });
    });
}

/**
 * Cycle principal d'ingestion et de traitement (Sécurisé par le sémaphore).
 */
async function processDriveQueue() {
    // 1. Verrou anti-conflit (Sémaphore)
    if (isProcessing) {
        console.log('[DRIVE WORKER] ⏳ Un traitement est déjà en cours. Passage du cycle.');
        return;
    }

    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootFolderId) {
        return;
    }

    isProcessing = true;
    lastSyncTimestamp = new Date().toISOString();

    try {
        const drive = getDriveClient();
        const folders = await ensureStateFolders(drive, rootFolderId);

        // 2. Scrutation des fichiers présents dans "01_A_TRAITER"
        const q = `'${folders.INPUT}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
        const res = await drive.files.list({
            q,
            fields: 'files(id, name, size, mimeType, createdTime, md5Checksum)',
            orderBy: 'createdTime asc',
            pageSize: 20
        });

        const pendingFiles = res.data.files || [];
        if (pendingFiles.length === 0) {
            return;
        }

        console.log(`[DRIVE WORKER] 🔔 ${pendingFiles.length} nouveau(x) fichier(s) détecté(s) dans 01_A_TRAITER.`);
        const ledger = loadLedger();

        // Récupération des paramètres par défaut configurables
        const defaultSourceLang = (process.env.DRIVE_DEFAULT_SOURCE_LANG || 'ar').toLowerCase();
        const defaultTargetLang = (process.env.DRIVE_DEFAULT_TARGET_LANG || 'fr').toLowerCase();
        const defaultSubColor = process.env.DRIVE_DEFAULT_SUB_COLOR || '#FFFF00';
        const defaultSubPosition = process.env.DRIVE_DEFAULT_SUB_POSITION || '950';

        // Traitement séquentiel fichier par fichier
        for (const file of pendingFiles) {
            const ext = path.extname(file.name).toLowerCase();
            const cleanStem = path.parse(file.name).name.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80);
            const localTempFile = path.join(TEMP_DOWNLOAD_DIR, `${Date.now()}_${cleanStem}${ext}`);

            // Validation du type de fichier
            if (!SUPPORTED_EXTENSIONS.has(ext)) {
                console.warn(`[DRIVE WORKER] ⚠️ Fichier non supporté ("${file.name}"). Déplacement vers 04_ERREURS.`);
                await moveDriveFile(drive, file.id, folders.INPUT, folders.ERRORS);
                await uploadErrorLog(drive, folders.ERRORS, file.name, `Format non supporté (${ext || 'inconnu'}). Formats acceptés : ${Array.from(SUPPORTED_EXTENSIONS).join(', ')}`);
                continue;
            }

            console.log(`\n======================================================`);
            console.log(`[DRIVE WORKER] 🎬 Prise en charge du média : "${file.name}" (ID: ${file.id})`);
            lastProcessedFileName = file.name;

            // ÉTAPE 1 : Déplacement atomique immédiat dans "02_EN_COURS" (Disparaît de 01_A_TRAITER)
            await moveDriveFile(drive, file.id, folders.INPUT, folders.IN_PROGRESS);
            console.log(`[DRIVE WORKER] 📦 Fichier déplacé dans "02_EN_COURS" (Verrou d'état activé).`);

            // Mise à jour du registre en statut PROCESSING
            ledger.synced_files[file.id] = {
                id: file.id,
                name: file.name,
                status: 'PROCESSING',
                started_at: new Date().toISOString()
            };
            saveLedger(ledger);

            try {
                // ÉTAPE 2 : Téléchargement du fichier en local
                fs.mkdirSync(TEMP_DOWNLOAD_DIR, { recursive: true });
                console.log(`[DRIVE WORKER] ⬇️ Téléchargement en local vers : ${localTempFile}...`);
                await downloadDriveFile(drive, file.id, localTempFile);
                console.log(`[DRIVE WORKER] ✅ Téléchargement achevé (${(fs.statSync(localTempFile).size / (1024 * 1024)).toFixed(2)} Mo).`);

                // ÉTAPE 3 : Lancement du Pipeline de Traduction Python
                const result = await runPythonPipeline(
                    localTempFile,
                    defaultSourceLang,
                    defaultTargetLang,
                    defaultSubColor,
                    defaultSubPosition
                );

                const mp4LocalPath = path.join(OUTPUT_DIR, result.mp4_filename);
                const assLocalPath = path.join(OUTPUT_DIR, result.ass_filename);

                let uploadedMp4 = null;
                let uploadedAss = null;
                let driveUploadWarning = null;

                // ÉTAPE 4 : Téléversement des résultats vers "03_TERMINE"
                try {
                    console.log(`[DRIVE WORKER] ⬆️ Upload de la vidéo incrustée (${result.mp4_filename}) vers 03_TERMINE...`);
                    uploadedMp4 = await uploadLocalFile(drive, mp4LocalPath, folders.COMPLETED, 'video/mp4');

                    console.log(`[DRIVE WORKER] ⬆️ Upload des sous-titres ASS (${result.ass_filename}) vers 03_TERMINE...`);
                    uploadedAss = await uploadLocalFile(drive, assLocalPath, folders.COMPLETED, 'text/plain');

                    if (result.cover_filename && fs.existsSync(path.join(OUTPUT_DIR, result.cover_filename))) {
                        console.log(`[DRIVE WORKER] ⬆️ Upload de la couverture 9:16 (${result.cover_filename}) vers 03_TERMINE...`);
                        await uploadLocalFile(drive, path.join(OUTPUT_DIR, result.cover_filename), folders.COMPLETED, 'image/jpeg');
                    }
                    if (result.desc_filename && fs.existsSync(path.join(OUTPUT_DIR, result.desc_filename))) {
                        console.log(`[DRIVE WORKER] ⬆️ Upload de la description TikTok (${result.desc_filename}) vers 03_TERMINE...`);
                        await uploadLocalFile(drive, path.join(OUTPUT_DIR, result.desc_filename), folders.COMPLETED, 'text/plain');
                    }
                } catch (uploadErr) {
                    if (uploadErr.message && uploadErr.message.includes('storage quota')) {
                        driveUploadWarning = "Quota Service Account : Les comptes de service ne peuvent pas uploader de nouveaux fichiers sur un compte Gmail personnel standard sans Disque Partagé Workspace. La vidéo est disponible en local et téléchargeable via l'interface web.";
                        console.warn(`[DRIVE WORKER] ⚠️ ${driveUploadWarning}`);
                    } else {
                        throw uploadErr;
                    }
                }

                // Déplacement du fichier source original dans "03_TERMINE"
                await moveDriveFile(drive, file.id, folders.IN_PROGRESS, folders.COMPLETED);

                // ÉTAPE 5 : Enregistrement du succès dans le registre
                ledger.synced_files[file.id] = {
                    id: file.id,
                    name: file.name,
                    status: uploadedMp4 ? 'DONE' : 'DONE_LOCAL',
                    ai_model_used: result.ai_model_used,
                    completed_at: new Date().toISOString(),
                    local_mp4_url: `/download/${result.mp4_filename}`,
                    local_ass_url: `/download/${result.ass_filename}`,
                    output_mp4_id: uploadedMp4 ? uploadedMp4.id : null,
                    output_mp4_name: uploadedMp4 ? uploadedMp4.name : result.mp4_filename,
                    output_ass_id: uploadedAss ? uploadedAss.id : null,
                    output_ass_name: uploadedAss ? uploadedAss.name : result.ass_filename,
                    drive_upload_warning: driveUploadWarning
                };
                saveLedger(ledger);

                console.log(`[DRIVE WORKER] 🌟 Média "${file.name}" finalisé avec succès ! (Modèle: ${result.ai_model_used} | Fichier: ${result.mp4_filename})`);

            } catch (mediaError) {
                console.error(`[DRIVE WORKER] ❌ Échec sur "${file.name}" :`, mediaError.message);

                // En cas d'erreur : transfert dans "04_ERREURS" et tentative de téléversement du rapport d'erreur
                try {
                    await moveDriveFile(drive, file.id, folders.IN_PROGRESS, folders.ERRORS);
                    await uploadErrorLog(drive, folders.ERRORS, file.name, mediaError.stack || mediaError.message);
                } catch (e) {
                    console.warn('[DRIVE WORKER] Erreur lors du transfert vers 04_ERREURS :', e.message);
                }

                ledger.synced_files[file.id] = {
                    id: file.id,
                    name: file.name,
                    status: 'ERROR',
                    error: mediaError.message,
                    failed_at: new Date().toISOString()
                };
                saveLedger(ledger);

            } finally {
                // Nettoyage systématique du fichier média local temporaire
                if (fs.existsSync(localTempFile)) {
                    try {
                        fs.unlinkSync(localTempFile);
                        console.log(`[DRIVE WORKER] 🧹 Fichier local temporaire supprimé : ${path.basename(localTempFile)}`);
                    } catch (e) {
                        console.warn(`[DRIVE WORKER] Impossible de supprimer le fichier temp : ${e.message}`);
                    }
                }
            }
        }

    } catch (globalError) {
        console.error('[DRIVE WORKER GLOBAL ERROR]', globalError.message);
    } finally {
        isProcessing = false;
    }
}

/**
 * Démarre le Worker Google Drive en tâche de fond (appelé au boot de server.js).
 */
function startDriveWorker() {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const credentialsFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE
        ? path.resolve(ROOT_DIR, process.env.GOOGLE_SERVICE_ACCOUNT_FILE)
        : path.join(ROOT_DIR, 'google_service_account.json');

    if (!rootFolderId || !fs.existsSync(credentialsFile)) {
        console.log('----------------------------------------------------------------------');
        console.log('[DRIVE WORKER] ℹ️ Service Google Drive inactif (Configuration requise) :');
        if (!rootFolderId) console.log('  - Variable GOOGLE_DRIVE_FOLDER_ID manquante dans .env');
        if (!fs.existsSync(credentialsFile)) console.log(`  - Fichier de clé Service Account introuvable (${credentialsFile})`);
        console.log('  -> Pour activer : ajoutez GOOGLE_DRIVE_FOLDER_ID et déposez google_service_account.json');
        console.log('----------------------------------------------------------------------');
        return false;
    }

    const cronSchedule = process.env.DRIVE_POLL_CRON || '*/2 * * * *'; // Toutes les 2 minutes par défaut

    console.log('======================================================================');
    console.log('[DRIVE WORKER] 🚀 Démarrage du Worker autonome Google Drive');
    console.log(`  - Dossier racine : ${rootFolderId}`);
    console.log(`  - Fréquence Cron : ${cronSchedule}`);
    console.log('======================================================================');

    // Déclenchement d'un premier scan immédiat (non bloquant)
    setTimeout(() => {
        processDriveQueue().catch(err => console.error('[DRIVE WORKER FIRST RUN ERROR]', err.message));
    }, 3000);

    // Programmation du cron récurrent
    cronTask = cron.schedule(cronSchedule, () => {
        processDriveQueue().catch(err => console.error('[DRIVE WORKER CRON ERROR]', err.message));
    });

    return true;
}

/**
 * Renvoie l'état opérationnel du Worker (utilisé pour les routes de statut).
 */
function getDriveWorkerStatus() {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    const credentialsFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE
        ? path.resolve(ROOT_DIR, process.env.GOOGLE_SERVICE_ACCOUNT_FILE)
        : path.join(ROOT_DIR, 'google_service_account.json');

    const isConfigured = Boolean(rootFolderId && fs.existsSync(credentialsFile));
    const ledger = loadLedger();
    const syncedCount = Object.keys(ledger.synced_files || {}).length;

    return {
        configured: isConfigured,
        isProcessing: isProcessing,
        folderId: rootFolderId,
        cronSchedule: process.env.DRIVE_POLL_CRON || '*/2 * * * *',
        lastSyncTimestamp: lastSyncTimestamp,
        lastProcessedFileName: lastProcessedFileName,
        totalSyncedFiles: syncedCount
    };
}

/**
 * Téléverse les livrables finaux vers le dossier 03_TERMINE sur Google Drive.
 */
async function uploadDeliverablesToDrive({ mp4Filename, assFilename, coverFilename, descFilename }) {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootFolderId) return null;

    try {
        const drive = getDriveClient();
        const folders = await ensureStateFolders(drive, rootFolderId);
        const uploads = {};

        if (mp4Filename) {
            const mp4Path = path.join(OUTPUT_DIR, mp4Filename);
            if (fs.existsSync(mp4Path)) {
                uploads.mp4 = await uploadLocalFile(drive, mp4Path, folders.COMPLETED, 'video/mp4');
                console.log(`[DRIVE SYNC] ⬆️ Vidéo uploadée vers 03_TERMINE : ${mp4Filename}`);
            }
        }
        if (assFilename) {
            const assPath = path.join(OUTPUT_DIR, assFilename);
            if (fs.existsSync(assPath)) {
                uploads.ass = await uploadLocalFile(drive, assPath, folders.COMPLETED, 'text/plain');
                console.log(`[DRIVE SYNC] ⬆️ Sous-titres uploadés vers 03_TERMINE : ${assFilename}`);
            }
        }
        if (coverFilename) {
            const coverPath = path.join(OUTPUT_DIR, coverFilename);
            if (fs.existsSync(coverPath)) {
                uploads.cover = await uploadLocalFile(drive, coverPath, folders.COMPLETED, 'image/jpeg');
                console.log(`[DRIVE SYNC] ⬆️ Couverture 9:16 uploadée vers 03_TERMINE : ${coverFilename}`);
            }
        }
        if (descFilename) {
            const descPath = path.join(OUTPUT_DIR, descFilename);
            if (fs.existsSync(descPath)) {
                uploads.desc = await uploadLocalFile(drive, descPath, folders.COMPLETED, 'text/plain');
                console.log(`[DRIVE SYNC] ⬆️ Description TikTok uploadée vers 03_TERMINE : ${descFilename}`);
            }
        }

        return uploads;
    } catch (err) {
        console.warn(`[DRIVE SYNC WARNING] Erreur upload Drive 03_TERMINE : ${err.message}`);
        return null;
    }
}

module.exports = {
    startDriveWorker,
    processDriveQueue,
    getDriveWorkerStatus,
    uploadDeliverablesToDrive
};
