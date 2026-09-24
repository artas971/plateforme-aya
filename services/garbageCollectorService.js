/**
 * Service de Garbage Collection Automatisé (NVMe Disk Protection) - Plateforme Aya
 * Ticket GitHub : #27 (TICKET-09)
 * 
 * Rôles :
 * 1. Purger les fichiers orphelins dans audio_a_traiter/ âgés de plus de 2 heures
 * 2. Nettoyer et faire pivoter les vidéos/audios dans fichiers_reponse_a_envoyer/ âgés de plus de 48 heures
 * 3. Nettoyer les fichiers résiduels dans temp/ âgés de plus de 2 heures
 * 4. Prévenir toute saturation du disque NVMe (160 Go Hetzner)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const AUDIO_A_TRAITER_DIR = path.join(ROOT_DIR, 'audio_a_traiter');
const REPONSED_DIR = path.join(ROOT_DIR, 'fichiers_reponse_a_envoyer');
const TEMP_DIR = path.join(ROOT_DIR, 'temp');

// Seuils temporels par défaut
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Fichiers système protégés à ne jamais supprimer
const PROTECTED_FILES = new Set(['.gitkeep', '.gitignore', 'README.md', '.keep']);

/**
 * Parcourt un dossier et supprime les fichiers dépassant un âge limite
 */
function cleanDirectory(dirPath, maxAgeMs, dryRun = false) {
    if (!fs.existsSync(dirPath)) {
        return { deletedCount: 0, bytesFreed: 0, errors: [] };
    }

    const now = Date.now();
    let deletedCount = 0;
    let bytesFreed = 0;
    const errors = [];

    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                // Sous-dossiers récursifs éventuels (ex: temp/vocab_build)
                const subDir = path.join(dirPath, entry.name);
                const subRes = cleanDirectory(subDir, maxAgeMs, dryRun);
                deletedCount += subRes.deletedCount;
                bytesFreed += subRes.bytesFreed;
                // Supprimer le sous-dossier vide s'il n'est pas protégé
                if (!dryRun) {
                    try {
                        const remaining = fs.readdirSync(subDir);
                        if (remaining.length === 0) {
                            fs.rmdirSync(subDir);
                        }
                    } catch (e) {
                        // ignore rmdir error
                    }
                }
                continue;
            }

            if (PROTECTED_FILES.has(entry.name)) {
                continue;
            }

            const filePath = path.join(dirPath, entry.name);
            try {
                const stats = fs.statSync(filePath);
                const fileAgeMs = now - stats.mtimeMs;

                if (fileAgeMs > maxAgeMs) {
                    const fileSize = stats.size;
                    if (!dryRun) {
                        fs.unlinkSync(filePath);
                    }
                    deletedCount++;
                    bytesFreed += fileSize;
                }
            } catch (err) {
                errors.push({ file: entry.name, error: err.message });
            }
        }
    } catch (err) {
        errors.push({ directory: dirPath, error: err.message });
    }

    return { deletedCount, bytesFreed, errors };
}

/**
 * Exécute un cycle complet de garbage collection
 */
function runGarbageCollection(options = {}) {
    const {
        dryRun = false,
        audioMaxAgeMs = TWO_HOURS_MS,
        responseMaxAgeMs = FORTY_EIGHT_HOURS_MS,
        tempMaxAgeMs = TWO_HOURS_MS
    } = options;

    const startTime = Date.now();

    const audioRes = cleanDirectory(AUDIO_A_TRAITER_DIR, audioMaxAgeMs, dryRun);
    const responseRes = cleanDirectory(REPONSED_DIR, responseMaxAgeMs, dryRun);
    const tempRes = cleanDirectory(TEMP_DIR, tempMaxAgeMs, dryRun);

    const totalCount = audioRes.deletedCount + responseRes.deletedCount + tempRes.deletedCount;
    const totalBytes = audioRes.bytesFreed + responseRes.bytesFreed + tempRes.bytesFreed;
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
    const durationMs = Date.now() - startTime;

    const summary = {
        timestamp: new Date().toISOString(),
        dryRun,
        durationMs,
        totalFilesDeleted: totalCount,
        totalBytesFreed: totalBytes,
        totalMegaBytesFreed: `${totalMb} MB`,
        details: {
            audio_a_traiter: {
                deleted: audioRes.deletedCount,
                freedMb: (audioRes.bytesFreed / (1024 * 1024)).toFixed(2),
                errors: audioRes.errors
            },
            fichiers_reponse_a_envoyer: {
                deleted: responseRes.deletedCount,
                freedMb: (responseRes.bytesFreed / (1024 * 1024)).toFixed(2),
                errors: responseRes.errors
            },
            temp: {
                deleted: tempRes.deletedCount,
                freedMb: (tempRes.bytesFreed / (1024 * 1024)).toFixed(2),
                errors: tempRes.errors
            }
        }
    };

    if (totalCount > 0) {
        console.log(`🧹 [GARBAGE COLLECTOR] ${dryRun ? '[SIMULATION] ' : ''}Nettoyage terminé : ${totalCount} fichier(s) supprimé(s), ${totalMb} Mo libérés en ${durationMs}ms`);
    } else {
        console.log(`🧹 [GARBAGE COLLECTOR] Aucun fichier expiré à purger. Disque sain (${durationMs}ms).`);
    }

    return summary;
}

let gcTimer = null;

/**
 * Démarre le planificateur automatique récurrent
 */
function startGarbageCollectorService(intervalMs = ONE_HOUR_MS) {
    if (gcTimer) {
        clearInterval(gcTimer);
    }

    console.log(`🚀 [GARBAGE COLLECTOR] Service automatisé initialisé (Cycle : toutes les ${intervalMs / 60000} minutes)`);
    
    // Première passe immédiate au boot
    setTimeout(() => {
        try {
            runGarbageCollection({ dryRun: false });
        } catch (e) {
            console.error('❌ [GARBAGE COLLECTOR] Erreur lors du premier cycle :', e);
        }
    }, 5000); // 5 secondes après le boot pour laisser le serveur respirer

    // Répétition périodique
    gcTimer = setInterval(() => {
        try {
            runGarbageCollection({ dryRun: false });
        } catch (e) {
            console.error('❌ [GARBAGE COLLECTOR] Erreur lors du cycle planifié :', e);
        }
    }, intervalMs);

    return gcTimer;
}

function stopGarbageCollectorService() {
    if (gcTimer) {
        clearInterval(gcTimer);
        gcTimer = null;
        console.log(`🛑 [GARBAGE COLLECTOR] Service arrêté.`);
    }
}

module.exports = {
    runGarbageCollection,
    startGarbageCollectorService,
    stopGarbageCollectorService,
    AUDIO_A_TRAITER_DIR,
    REPONSED_DIR,
    TEMP_DIR,
    TWO_HOURS_MS,
    FORTY_EIGHT_HOURS_MS
};
