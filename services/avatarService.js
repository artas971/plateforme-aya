const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const AVATARS_DIR = path.join(ROOT_DIR, 'public', 'avatars');
const SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'resize_avatar.py');

fs.mkdirSync(AVATARS_DIR, { recursive: true });

/**
 * Normalise un avatar uploadé :
 * 1. Recadre au format carré centré 256x256
 * 2. Compresse au format WebP haute qualité (85%)
 * 3. Enregistre dans public/avatars/
 * 4. Purgé le fichier brut temporaire
 *
 * @param {string} tempFilePath - Chemin du fichier uploadé temporaire
 * @param {string} userIdentifier - ID ou pseudo de l'utilisateur
 * @returns {Promise<{success: boolean, avatarUrl: string, sizeBytes: number}>}
 */
async function processAndSaveAvatar(tempFilePath, userIdentifier) {
    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
        throw new Error("Fichier source d'avatar introuvable.");
    }

    const cleanUid = String(userIdentifier || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `avatar_${cleanUid}_${Date.now()}.webp`;
    const outputPath = path.join(AVATARS_DIR, filename);
    const publicUrl = `/avatars/${filename}`;

    return new Promise((resolve, reject) => {
        // Exécution du script Python optimisé avec Pillow (LANCZOS + WebP)
        const pyProcess = spawn('py', [SCRIPT_PATH, tempFilePath, outputPath, '256'], {
            cwd: ROOT_DIR
        });

        let stderr = '';
        pyProcess.stderr.on('data', (d) => { stderr += d.toString(); });

        pyProcess.on('close', async (code) => {
            // Nettoyage immédiat du fichier temporaire brut
            try {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            } catch (e) {}

            if (code === 0 && fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                console.log(`[AVATAR SERVICE] ✅ Avatar normalisé WebP 256x256 généré : ${filename} (${stats.size} octets)`);
                return resolve({
                    success: true,
                    avatarUrl: publicUrl,
                    filename,
                    sizeBytes: stats.size
                });
            }

            console.warn('[AVATAR SERVICE] ⚠️ Échec Pillow, tentative de secours Jimp...', stderr);
            
            // Fallback pur JavaScript (Jimp)
            try {
                const Jimp = require('jimp');
                const image = await Jimp.read(tempFilePath);
                image.cover(256, 256);
                await image.writeAsync(outputPath);
                const stats = fs.statSync(outputPath);
                return resolve({
                    success: true,
                    avatarUrl: publicUrl,
                    filename,
                    sizeBytes: stats.size
                });
            } catch (jimpErr) {
                return reject(new Error(`Impossible de traiter l'image de profil : ${stderr || jimpErr.message}`));
            }
        });

        pyProcess.on('error', (err) => {
            try {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            } catch (e) {}
            reject(err);
        });
    });
}

module.exports = {
    processAndSaveAvatar,
    AVATARS_DIR
};
