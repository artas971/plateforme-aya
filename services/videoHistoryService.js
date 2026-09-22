const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const { isDbConnected } = require('../config/database');

const DATA_DIR = path.join(__dirname, '../data');
const FALLBACK_VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FALLBACK_VIDEOS_FILE)) {
    fs.writeFileSync(FALLBACK_VIDEOS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

function readFallbackVideos() {
    try {
        if (!fs.existsSync(FALLBACK_VIDEOS_FILE)) return [];
        return JSON.parse(fs.readFileSync(FALLBACK_VIDEOS_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function saveFallbackVideos(videos) {
    fs.writeFileSync(FALLBACK_VIDEOS_FILE, JSON.stringify(videos, null, 2), 'utf-8');
}

/**
 * Enregistre une nouvelle vidéo traitée dans l'historique personnel de l'utilisateur
 */
async function recordVideoGeneration(videoData) {
    const safeData = {
        title: videoData.title || "Vidéo traitée",
        originalMediaName: videoData.originalMediaName || "source_media",
        targetLang: videoData.targetLang || 'fr',
        duration: Number(videoData.duration || 0),
        fileSizeMb: Number(videoData.fileSizeMb || 0),
        mp4Url: videoData.mp4Url,
        mp4Filename: videoData.mp4Filename,
        assUrl: videoData.assUrl || null,
        assFilename: videoData.assFilename || null,
        coverUrl: videoData.coverUrl || null,
        coverFilename: videoData.coverFilename || null,
        descFilename: videoData.descFilename || null,
        contextSummary: videoData.contextSummary || "",
        keywords: Array.isArray(videoData.keywords) ? videoData.keywords : [],
        drive: videoData.drive || { status: 'pending' },
        costCredits: Number(videoData.costCredits !== undefined ? videoData.costCredits : 1),
        status: videoData.status || 'completed'
    };

    const userId = videoData.userId || videoData.user;
    const username = videoData.username || 'Utilisateur';

    // 1. Mode MongoDB Mongoose
    if (isDbConnected()) {
        try {
            const newVideo = new Video({
                user: userId,
                username,
                ...safeData
            });
            await newVideo.save();
            console.log(`[VIDEO HISTORY] 📹 Vidéo enregistrée en base MongoDB pour ${username} (ID: ${newVideo._id})`);
            return newVideo.toObject();
        } catch (err) {
            console.error('[VIDEO HISTORY ERROR MONGODB]', err.message);
        }
    }

    // 2. Mode Autonome JSON (SAFE-1)
    const videos = readFallbackVideos();
    const fallbackVideo = {
        id: `vid_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        user: userId,
        username,
        ...safeData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    videos.unshift(fallbackVideo);
    saveFallbackVideos(videos);
    console.log(`[VIDEO HISTORY (JSON)] 📹 Vidéo enregistrée dans data/videos.json pour ${username} (ID: ${fallbackVideo.id})`);
    return fallbackVideo;
}

/**
 * Met à jour le statut de sauvegarde Google Drive d'une vidéo (ARCH-1)
 */
async function updateVideoDriveInfo(videoId, driveInfo) {
    if (!videoId) return false;
    const vid = String(videoId);

    // 1. Mode MongoDB
    if (isDbConnected()) {
        try {
            await Video.findByIdAndUpdate(vid, {
                $set: {
                    'drive.status': driveInfo.status || 'uploaded',
                    'drive.folderId': driveInfo.folderId || null,
                    'drive.folderLink': driveInfo.folderLink || null,
                    'drive.mp4FileId': driveInfo.mp4FileId || null,
                    'drive.assFileId': driveInfo.assFileId || null,
                    'drive.uploadedAt': driveInfo.uploadedAt || new Date(),
                    'drive.errorReason': driveInfo.errorReason || null
                }
            });
            return true;
        } catch (err) {
            console.warn('[VIDEO DRIVE UPDATE ERROR MONGODB]', err.message);
        }
    }

    // 2. Mode Autonome JSON
    const videos = readFallbackVideos();
    const target = videos.find(v => v.id === vid || String(v._id) === vid);
    if (target) {
        target.drive = {
            status: driveInfo.status || 'uploaded',
            folderId: driveInfo.folderId || null,
            folderLink: driveInfo.folderLink || null,
            mp4FileId: driveInfo.mp4FileId || null,
            assFileId: driveInfo.assFileId || null,
            uploadedAt: driveInfo.uploadedAt || new Date().toISOString(),
            errorReason: driveInfo.errorReason || null
        };
        target.updatedAt = new Date().toISOString();
        saveFallbackVideos(videos);
        return true;
    }
    return false;
}

/**
 * Récupère l'historique personnel des vidéos de l'utilisateur
 */
async function getUserVideoHistory(userIdentifier, { limit = 50, page = 1 } = {}) {
    if (!userIdentifier) return { videos: [], total: 0 };
    const uid = String(userIdentifier).trim();

    // 1. Mode MongoDB
    if (isDbConnected()) {
        try {
            const query = (uid.startsWith('@') || uid.includes('@'))
                ? { username: uid }
                : { $or: [{ user: uid }, { username: uid }] };

            const total = await Video.countDocuments(query);
            const videos = await Video.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            return {
                videos: videos.map(sanitizeVideoForClient),
                total,
                page,
                limit
            };
        } catch (err) {
            console.warn('[VIDEO HISTORY FETCH ERROR MONGODB]', err.message);
        }
    }

    // 2. Mode Autonome JSON
    const allVideos = readFallbackVideos();
    const matchKeys = new Set([uid.toLowerCase()]);

    try {
        const usersFile = path.join(DATA_DIR, 'users.json');
        if (fs.existsSync(usersFile)) {
            const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
            const matched = users.find(u => 
                u.id?.toLowerCase() === uid.toLowerCase() || 
                u.username?.toLowerCase() === uid.toLowerCase() ||
                u.email?.toLowerCase() === uid.toLowerCase()
            );
            if (matched) {
                if (matched.id) matchKeys.add(matched.id.toLowerCase());
                if (matched.username) matchKeys.add(matched.username.toLowerCase());
            }
        }
    } catch (e) {}

    const userVideos = allVideos.filter(v => 
        (v.user && matchKeys.has(String(v.user).toLowerCase())) || 
        (v.username && matchKeys.has(String(v.username).toLowerCase()))
    );

    userVideos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = userVideos.length;
    const startIndex = (page - 1) * limit;
    const paginated = userVideos.slice(startIndex, startIndex + limit);

    return {
        videos: paginated.map(sanitizeVideoForClient),
        total,
        page,
        limit
    };
}

/**
 * Masque les informations d'infrastructure interne (Google Drive, IDs techniques distants)
 * afin que l'utilisateur final ne sache jamais où se trouvent physiquement les fichiers.
 */
function sanitizeVideoForClient(video) {
    if (!video) return video;
    const v = typeof video.toObject === 'function' ? video.toObject() : { ...video };
    delete v.drive; // Supprime strictement toute métadonnée ou lien vers Google Drive
    return v;
}

/**
 * Supprime une vidéo de l'historique personnel de l'utilisateur (avec contrôle de propriété strict)
 */
async function deleteUserVideo(videoId, userIdentifier) {
    if (!videoId || !userIdentifier) return false;
    const vid = String(videoId).trim();
    const uid = String(userIdentifier).trim().toLowerCase();
    const cleanUid = uid.replace(/^@/, '');

    // Récupération de tous les alias d'identification de l'utilisateur
    const matchKeys = new Set([uid, cleanUid, '@' + cleanUid]);
    try {
        const usersFile = path.join(DATA_DIR, 'users.json');
        if (fs.existsSync(usersFile)) {
            const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
            const matched = users.find(u => 
                (u.id && matchKeys.has(u.id.toLowerCase())) || 
                (u.username && (matchKeys.has(u.username.toLowerCase()) || matchKeys.has(u.username.toLowerCase().replace(/^@/, '')))) ||
                (u.email && matchKeys.has(u.email.toLowerCase()))
            );
            if (matched) {
                if (matched.id) matchKeys.add(matched.id.toLowerCase());
                if (matched.username) {
                    matchKeys.add(matched.username.toLowerCase());
                    matchKeys.add(matched.username.toLowerCase().replace(/^@/, ''));
                    matchKeys.add('@' + matched.username.toLowerCase().replace(/^@/, ''));
                }
                if (matched.email) matchKeys.add(matched.email.toLowerCase());
            }
        }
    } catch (e) {}

    // 1. Mode MongoDB
    if (isDbConnected()) {
        try {
            const orConditions = [];
            for (const key of matchKeys) {
                orConditions.push({ user: key });
                orConditions.push({ username: key });
            }
            const query = {
                _id: vid,
                $or: orConditions
            };
            const deleted = await Video.findOneAndDelete(query);
            if (deleted) {
                console.log(`[VIDEO HISTORY] 🗑️ Vidéo ${vid} supprimée de MongoDB pour ${userIdentifier}`);
                return true;
            }
        } catch (err) {
            console.warn('[VIDEO HISTORY DELETE ERROR MONGODB]', err.message);
        }
    }

    // 2. Mode Autonome JSON
    const allVideos = readFallbackVideos();
    const initialLen = allVideos.length;
    const filtered = allVideos.filter(v => {
        const isTarget = (String(v.id) === vid || String(v._id) === vid);
        if (!isTarget) return true; // Conserver les autres vidéos
        // Si c'est la vidéo cible, vérifier que l'appelant en est bien le propriétaire
        const vUser = String(v.user || '').toLowerCase();
        const vUsername = String(v.username || '').toLowerCase();
        const isOwner = matchKeys.has(vUser) || 
                        matchKeys.has(vUser.replace(/^@/, '')) ||
                        matchKeys.has(vUsername) || 
                        matchKeys.has(vUsername.replace(/^@/, ''));
        return !isOwner; // Si propriétaire, retirer de la liste (suppression)
    });

    if (filtered.length < initialLen) {
        saveFallbackVideos(filtered);
        console.log(`[VIDEO HISTORY (JSON)] 🗑️ Vidéo ${vid} supprimée de data/videos.json pour ${userIdentifier}`);
        return true;
    }

    return false;
}

module.exports = {
    recordVideoGeneration,
    updateVideoDriveInfo,
    getUserVideoHistory,
    deleteUserVideo,
    sanitizeVideoForClient
};
