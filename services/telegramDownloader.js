/**
 * Service de Téléchargement & Pont Telegram - Plateforme Aya
 * Conçu par Thomas & Max (Issue #15 & Correctif Vidéos Lourdes)
 * 
 * Permet d'importer des vidéos et notes vocales depuis un lien public Telegram (ex: t.me/canal/123)
 * Moteur hybride :
 * 1. py -m yt_dlp (Extraction native directe haute vitesse avec paramètres optimisés)
 * 2. Scraping direct du widget embed t.me (Secours autonome avec gestion 'Media is too big')
 */

const { spawn } = require('child_process');
const { getPythonBin } = require('../utils/runtime');
const path = require('path');
const fs = require('fs');

let lastYtDlpUpdateCheck = 0;

/**
 * Vérifie et met à jour yt-dlp de manière asynchrone non-bloquante (au max une fois toutes les 6 heures)
 */
function ensureYtDlpUpdated() {
    const now = Date.now();
    if (now - lastYtDlpUpdateCheck < 6 * 60 * 60 * 1000) {
        return Promise.resolve();
    }
    lastYtDlpUpdateCheck = now;

    return new Promise((resolve) => {
        const proc = spawn(getPythonBin(), ['-m', 'pip', 'install', '-U', 'yt-dlp'], { windowsHide: true });
        proc.on('close', (code) => {
            if (code === 0) {
                console.log("[Telegram Downloader] yt-dlp vérifié et à jour.");
            } else {
                console.warn(`[Telegram Downloader] Vérification yt-dlp code: ${code}`);
            }
            resolve();
        });
        proc.on('error', (err) => {
            console.warn("[Telegram Downloader] Avertissement MAJ yt-dlp:", err.message);
            resolve();
        });
    });
}

const MIN_MEDIA_SIZE_BYTES = 150 * 1024; // 150 Ko minimum pour un vrai média vidéo/audio

const TELEGRAM_TOO_BIG_MSG = "Le fichier Telegram est trop lourd (>20Mo) ou protégé. Veuillez le télécharger manuellement et l'uploader via la zone de dépôt.";

/**
 * Valide que le fichier téléchargé existe et fait au moins 150 Ko.
 * En deçà, le fichier est considéré comme un faux positif (ex: page HTML d'erreur Telegram),
 * il est supprimé immédiatement et lève une erreur MEDIA_TOO_BIG.
 */
function validateMediaFileSize(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        const err = new Error(TELEGRAM_TOO_BIG_MSG);
        err.code = "MEDIA_TOO_BIG";
        throw err;
    }
    const stats = fs.statSync(filePath);
    if (stats.size < MIN_MEDIA_SIZE_BYTES) {
        try {
            fs.unlinkSync(filePath);
            console.warn(`[Telegram Downloader] Fichier sous-dimensionné (${stats.size} octets < 150 Ko) supprimé : ${filePath}`);
        } catch (unlinkErr) {
            console.warn("[Telegram Downloader] Erreur suppression fichier temporaire:", unlinkErr.message);
        }
        const bigErr = new Error(TELEGRAM_TOO_BIG_MSG);
        bigErr.code = "MEDIA_TOO_BIG";
        throw bigErr;
    }
    return stats;
}

/**
 * Valide et normalise une URL Telegram (nettoyage strict des paramètres d'URL comme ?t=2)
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

        // Nettoyage strict des paramètres d'URL (?t=2, etc.)
        const cleanPath = parsed.pathname.replace(/\/+$/, '');
        const cleanUrl = `${parsed.protocol}//${parsed.host}${cleanPath}`;

        const parts = cleanPath.split('/').filter(Boolean);
        if (parts.length >= 2) {
            const channel = parts[0] === 'c' ? parts[1] : parts[0];
            const messageId = parts[0] === 'c' ? parts[2] : parts[1];
            return {
                cleanUrl,
                channel,
                messageId,
                embedUrl: `https://t.me/${parts.join('/')}?embed=1`
            };
        }
        return { cleanUrl, embedUrl: `${cleanUrl}?embed=1` };
    } catch (e) {
        return null;
    }
}

/**
 * Téléchargement via yt-dlp optimisé pour fichiers lourds avec interception stricte des erreurs
 */
function downloadWithYtDlp(url, outputDir, onProgress) {
    return new Promise((resolve, reject) => {
        // Déclencher la vérification en tâche de fond
        ensureYtDlpUpdated().catch(() => {});

        const outputTemplate = path.join(outputDir, `tg_${Date.now()}_%(id)s.%(ext)s`);
        const args = [
            '-m', 'yt_dlp',
            '--no-playlist',
            '--no-warnings',
            '--newline',
            '--format', 'bestvideo+bestaudio/best',
            '--no-check-certificates',
            '--geo-bypass',
            '--retries', '3',
            '--fragment-retries', '3',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            '-o', outputTemplate,
            url
        ];

        if (onProgress) onProgress(15, "Connexion et extraction du flux Telegram via yt-dlp...");

        const startTime = Date.now();
        const proc = spawn(getPythonBin(), args, { windowsHide: true });
        let downloadedFilePath = null;
        let lastError = '';

        proc.stdout.on('data', (data) => {
            const line = data.toString();
            if (/media\s+is\s+too\s+big/i.test(line) || /too\s+large/i.test(line)) {
                lastError += " Media is too big";
            }
            const destMatch = line.match(/\[download\] Destination:\s*(.+)/i) || 
                              line.match(/\[Merger\] Merging formats into "(.+)"/i) || 
                              line.match(/\[download\]\s+(.+)\s+has already been downloaded/i);
            if (destMatch) {
                downloadedFilePath = destMatch[1].trim();
            }

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
            // Détection explicite de fichier trop volumineux ou bloqué
            if (/media\s+is\s+too\s+big/i.test(lastError) || /too\s+large/i.test(lastError) || /413/i.test(lastError)) {
                const bigErr = new Error(TELEGRAM_TOO_BIG_MSG);
                bigErr.code = "MEDIA_TOO_BIG";
                return reject(bigErr);
            }

            if (code === 0) {
                let finalPath = null;
                if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
                    finalPath = downloadedFilePath;
                } else {
                    // Sécurité absolue : recherche UNIQUEMENT des fichiers créés pendant cette exécution exacte (anti-recyclage)
                    const files = fs.readdirSync(outputDir)
                        .filter(f => f.startsWith('tg_'))
                        .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtimeMs }))
                        .filter(f => f.time >= startTime - 1000)
                        .sort((a, b) => b.time - a.time);

                    if (files.length > 0) {
                        finalPath = path.join(outputDir, files[0].name);
                    }
                }

                if (finalPath && fs.existsSync(finalPath)) {
                    try {
                        validateMediaFileSize(finalPath);
                        return resolve(finalPath);
                    } catch (valErr) {
                        return reject(valErr);
                    }
                }
            }

            // Si yt-dlp échoue ou n'a produit aucun fichier valide : AUCUN recyclage d'ancien média
            const isTooBig = /media\s+is\s+too\s+big/i.test(lastError) || (code !== 0 && !downloadedFilePath);
            const failErr = new Error(TELEGRAM_TOO_BIG_MSG);
            failErr.code = "MEDIA_TOO_BIG";
            reject(failErr);
        });

        proc.on('error', (err) => {
            const spawnErr = new Error(TELEGRAM_TOO_BIG_MSG);
            spawnErr.code = "MEDIA_TOO_BIG";
            reject(spawnErr);
        });
    });
}

/**
 * Téléchargement de secours par Scraping de l'Embed public Telegram
 * Avec détection explicite de l'erreur "Media is too big"
 */
async function downloadViaEmbedScraping(parsedInfo, outputDir, onProgress) {
    if (onProgress) onProgress(20, "Tentative d'extraction directe via le widget public Telegram...");
    const embedUrl = parsedInfo.embedUrl;

    const res = await fetch(embedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
    });

    if (!res.ok) {
        throw new Error(`Impossible de charger l'embed Telegram (${res.status})`);
    }

    const html = await res.text();

    // Détection explicite de l'erreur Telegram "Media is too big"
    if (/media\s+is\s+too\s+big/i.test(html)) {
        const bigErr = new Error(TELEGRAM_TOO_BIG_MSG);
        bigErr.code = "MEDIA_TOO_BIG";
        throw bigErr;
    }

    // Recherche de <video src="..."> ou <audio src="...">
    const videoMatch = html.match(/<video[^>]+src="([^">]+)"/i) || html.match(/src="([^">]+telesco\.pe\/file\/[^">]+)"/i);
    const audioMatch = html.match(/<audio[^>]+src="([^">]+)"/i);
    const mediaSrc = videoMatch ? videoMatch[1] : (audioMatch ? audioMatch[1] : null);

    if (!mediaSrc) {
        const notFoundErr = new Error(TELEGRAM_TOO_BIG_MSG);
        notFoundErr.code = "MEDIA_TOO_BIG";
        throw notFoundErr;
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
        const fetchErr = new Error(TELEGRAM_TOO_BIG_MSG);
        fetchErr.code = "MEDIA_TOO_BIG";
        throw fetchErr;
    }

    const ext = videoMatch ? '.mp4' : '.mp3';
    const filename = `tg_${Date.now()}_telegram${ext}`;
    const targetPath = path.join(outputDir, filename);

    const arrayBuf = await mediaRes.arrayBuffer();
    fs.writeFileSync(targetPath, Buffer.from(arrayBuf));

    // Validation stricte du poids minimum (anti faux-positif / pages d'erreur HTML)
    validateMediaFileSize(targetPath);

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
        const stats = validateMediaFileSize(filePath);
        return {
            success: true,
            filePath,
            filename: path.basename(filePath),
            size: stats.size,
            method: 'yt-dlp'
        };
    } catch (ytErr) {
        if (ytErr.code === 'MEDIA_TOO_BIG' || (ytErr.message && ytErr.message.includes('MEDIA_TOO_BIG'))) {
            throw ytErr;
        }
        console.warn(`[Telegram Downloader] yt-dlp a échoué: ${ytErr.message}. Bascule sur le scraper d'embed...`);
    }

    // 2. Fallback via scraping direct d'embed public
    try {
        const filePath = await downloadViaEmbedScraping(parsed, targetDir, onProgress);
        const stats = validateMediaFileSize(filePath);
        return {
            success: true,
            filePath,
            filename: path.basename(filePath),
            size: stats.size,
            method: 'embed-scraping'
        };
    } catch (scrapErr) {
        console.error(`[Telegram Downloader] Échec du scraper: ${scrapErr.message}`);
        const finalErr = new Error(TELEGRAM_TOO_BIG_MSG);
        finalErr.code = "MEDIA_TOO_BIG";
        throw finalErr;
    }
}

module.exports = {
    parseTelegramUrl,
    downloadTelegramMedia,
    ensureYtDlpUpdated
};
