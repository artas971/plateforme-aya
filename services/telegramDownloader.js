/**
 * Service de Téléchargement & Pont Telegram - Plateforme Aya
 * Conçu par Thomas & Max (Issue #15)
 * 
 * Permet d'importer des vidéos et notes vocales depuis un lien public Telegram (ex: t.me/canal/123)
 * Moteur hybride :
 * 1. py -m yt_dlp (Extraction native directe haute vitesse)
 * 2. Scraping direct du widget embed t.me (Secours autonome sans dépendance)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Valide et normalise une URL Telegram
 * Formats acceptés :
 * - https://t.me/channel_name/123
 * - http://t.me/channel_name/123
 * - t.me/channel_name/123
 * - https://telegram.me/channel_name/123
 */
function parseTelegramUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host !== 't.me' && host !== 'telegram.me' && !host.endsWith('.t.me')) {
            return null;
        }

        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
            const channel = parts[0] === 'c' ? parts[1] : parts[0];
            const messageId = parts[0] === 'c' ? parts[2] : parts[1];
            return {
                cleanUrl: url,
                channel,
                messageId,
                embedUrl: `https://t.me/${parts.join('/')}?embed=1`
            };
        }
        return { cleanUrl: url, embedUrl: `${url}?embed=1` };
    } catch (e) {
        return null;
    }
}

/**
 * Téléchargement via yt-dlp
 */
function downloadWithYtDlp(url, outputDir, onProgress) {
    return new Promise((resolve, reject) => {
        const outputTemplate = path.join(outputDir, `tg_${Date.now()}_%(id)s.%(ext)s`);
        const args = [
            '-m', 'yt_dlp',
            '--no-playlist',
            '--no-warnings',
            '--newline',
            '-o', outputTemplate,
            url
        ];

        if (onProgress) onProgress(15, "Connexion et analyse du flux Telegram...");

        const proc = spawn('py', args, { windowsHide: true });
        let downloadedFilePath = null;
        let lastError = '';

        proc.stdout.on('data', (data) => {
            const line = data.toString();
            // Détection du chemin de destination
            const destMatch = line.match(/\[download\] Destination:\s*(.+)/i) || 
                              line.match(/\[Merger\] Merging formats into "(.+)"/i) || 
                              line.match(/\[download\]\s+(.+)\s+has already been downloaded/i);
            if (destMatch) {
                downloadedFilePath = destMatch[1].trim();
            }

            // Progression
            const progMatch = line.match(/\[download\]\s+([\d\.]+)%/);
            if (progMatch && onProgress) {
                const pct = Math.round(15 + (parseFloat(progMatch[1]) * 0.25)); // 15% à 40%
                onProgress(pct, `Téléchargement du média Telegram (${progMatch[1]}%)...`);
            }
        });

        proc.stderr.on('data', (data) => {
            lastError += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
                    return resolve(downloadedFilePath);
                }
                // Recherche du fichier le plus récent dans outputDir correspondant au préfixe
                const files = fs.readdirSync(outputDir)
                    .filter(f => f.startsWith('tg_'))
                    .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtimeMs }))
                    .sort((a, b) => b.time - a.time);

                if (files.length > 0) {
                    return resolve(path.join(outputDir, files[0].name));
                }
            }
            reject(new Error(lastError || `yt-dlp exited with code ${code}`));
        });

        proc.on('error', (err) => reject(err));
    });
}

/**
 * Téléchargement de secours par Scraping de l'Embed public Telegram
 */
async function downloadViaEmbedScraping(parsedInfo, outputDir, onProgress) {
    if (onProgress) onProgress(20, "Tentative d'extraction directe via le widget public Telegram...");
    const embedUrl = parsedInfo.embedUrl;

    const res = await fetch(embedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!res.ok) {
        throw new Error(`Impossible de charger l'embed Telegram (${res.status})`);
    }

    const html = await res.text();

    // Recherche de <video src="..."></video> ou <audio src="...">
    const videoMatch = html.match(/<video[^>]+src="([^">]+)"/i) || html.match(/src="([^">]+telesco\.pe\/file\/[^">]+)"/i);
    const audioMatch = html.match(/<audio[^>]+src="([^">]+)"/i);
    const mediaSrc = videoMatch ? videoMatch[1] : (audioMatch ? audioMatch[1] : null);

    if (!mediaSrc) {
        throw new Error("Aucun média vidéo ou audio détecté dans ce message Telegram public.");
    }

    // Téléchargement du fichier
    if (onProgress) onProgress(25, "Téléchargement direct du fichier source Telegram...");
    const mediaRes = await fetch(mediaSrc, {
        headers: {
            'Referer': 'https://t.me/',
            'User-Agent': 'Mozilla/5.0'
        }
    });

    if (!mediaRes.ok) {
        throw new Error(`Erreur lors du téléchargement du média (${mediaRes.status})`);
    }

    const ext = videoMatch ? '.mp4' : '.mp3';
    const filename = `tg_${Date.now()}_telegram${ext}`;
    const targetPath = path.join(outputDir, filename);

    const arrayBuf = await mediaRes.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(arrayBuf));

    if (onProgress) onProgress(40, "Média Telegram récupéré avec succès !");
    return targetPath;
}

/**
 * Fonction principale de téléchargement
 */
async function downloadTelegramMedia(rawUrl, outputDir = null, onProgress = null) {
    const targetDir = outputDir || path.join(__dirname, '..', 'audio_a_traiter');
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const parsed = parseTelegramUrl(rawUrl);
    if (!parsed) {
        throw new Error("Format d'URL Telegram invalide. Exemple attendu : https://t.me/canal/123");
    }

    if (onProgress) onProgress(10, `Lien Telegram validé (${parsed.cleanUrl})`);

    // 1. Essai prioritaire via yt-dlp
    try {
        const filePath = await downloadWithYtDlp(parsed.cleanUrl, targetDir, onProgress);
        const stats = fs.statSync(filePath);
        return {
            success: true,
            filePath,
            filename: path.basename(filePath),
            size: stats.size,
            method: 'yt-dlp'
        };
    } catch (ytErr) {
        console.warn(`[Telegram Downloader] yt-dlp a échoué: ${ytErr.message}. Bascule sur le scraper d'embed...`);
    }

    // 2. Fallback via scraping direct d'embed public
    try {
        const filePath = await downloadViaEmbedScraping(parsed, targetDir, onProgress);
        const stats = fs.statSync(filePath);
        return {
            success: true,
            filePath,
            filename: path.basename(filePath),
            size: stats.size,
            method: 'embed-scraping'
        };
    } catch (scrapErr) {
        console.error(`[Telegram Downloader] Échec du scraper: ${scrapErr.message}`);
        throw new Error(`Impossible de récupérer le média depuis Telegram : ${scrapErr.message}`);
    }
}

module.exports = {
    parseTelegramUrl,
    downloadTelegramMedia
};
