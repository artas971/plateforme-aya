const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { isDbConnected } = require('../config/database');
const { getUserWallet } = require('../services/walletService');
const { getUserVideoHistory } = require('../services/videoHistoryService');

const DATA_DIR = path.join(__dirname, '../data');
const FALLBACK_USERS_FILE = path.join(DATA_DIR, 'users.json');

function readFallbackUsers() {
    try {
        if (!fs.existsSync(FALLBACK_USERS_FILE)) return [];
        return JSON.parse(fs.readFileSync(FALLBACK_USERS_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function saveFallbackUsers(users) {
    fs.writeFileSync(FALLBACK_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/**
 * GET /api/user/profile : Récupère le profil complet et le solde de crédits
 */
router.get('/profile', async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        if (!sessionUser) {
            return res.status(401).json({ success: false, error: "Veuillez vous connecter pour accéder à votre profil." });
        }

        const userId = sessionUser.id;
        const wallet = await getUserWallet(userId || sessionUser.username);

        let userProfile = {
            id: sessionUser.id,
            username: sessionUser.username,
            name: sessionUser.name,
            email: sessionUser.email,
            role: sessionUser.role || 'contributeur',
            avatar: sessionUser.avatar || User.DEFAULT_AVATAR_URL,
            credits: wallet.credits,
            creditsReserved: wallet.creditsReserved
        };

        if (isDbConnected()) {
            try {
                const dbUser = await User.findById(userId).select('-password');
                if (dbUser) {
                    userProfile = {
                        ...userProfile,
                        id: dbUser._id.toString(),
                        username: dbUser.username,
                        name: dbUser.name,
                        firstName: dbUser.firstName,
                        lastName: dbUser.lastName,
                        email: dbUser.email,
                        avatar: dbUser.avatar,
                        role: dbUser.role,
                        credits: dbUser.credits,
                        creditsReserved: dbUser.creditsReserved,
                        createdAt: dbUser.createdAt
                    };
                }
            } catch (e) {}
        } else {
            const users = readFallbackUsers();
            const found = users.find(u => u.id === userId || u.username === sessionUser.username);
            if (found) {
                userProfile = {
                    ...userProfile,
                    name: found.name,
                    firstName: found.firstName,
                    lastName: found.lastName,
                    avatar: found.avatar,
                    credits: found.credits !== undefined ? found.credits : wallet.credits,
                    creditsReserved: found.creditsReserved || 0
                };
            }
        }

        return res.json({
            success: true,
            user: userProfile
        });
    } catch (err) {
        console.error('[API USER PROFILE ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/user/wallet : Récupère l'état du portefeuille virtuel (Ticket 3)
 */
router.get('/wallet', async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        if (!sessionUser) {
            return res.status(401).json({ success: false, error: "Non connecté." });
        }

        const wallet = await getUserWallet(sessionUser.id || sessionUser.username);
        return res.json({
            success: true,
            credits: wallet.credits,
            creditsReserved: wallet.creditsReserved,
            username: wallet.username || sessionUser.username
        });
    } catch (err) {
        console.error('[API USER WALLET ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/user/videos : Historique personnel des vidéos traitées (Ticket 1)
 */
router.get('/videos', async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        if (!sessionUser) {
            return res.status(401).json({ success: false, error: "Non connecté." });
        }

        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '30', 10);

        const history = await getUserVideoHistory(sessionUser.id || sessionUser.username, { page, limit });

        return res.json({
            success: true,
            count: history.videos.length,
            total: history.total,
            page: history.page,
            videos: history.videos
        });
    } catch (err) {
        console.error('[API USER VIDEOS ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * PUT /api/user/profile : Mise à jour du nom d'affichage libre (Ticket 2)
 */
router.put('/profile', async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        if (!sessionUser) {
            return res.status(401).json({ success: false, error: "Non connecté." });
        }

        const { name, firstName, lastName } = req.body;
        const newName = (name || `${firstName || ''} ${lastName || ''}`).trim();

        if (!newName) {
            return res.status(400).json({ success: false, error: "Le nom d'affichage ne peut pas être vide." });
        }

        const userId = sessionUser.id;

        if (isDbConnected()) {
            await User.findByIdAndUpdate(userId, {
                $set: {
                    name: newName,
                    firstName: firstName ? firstName.trim() : undefined,
                    lastName: lastName ? lastName.trim() : undefined
                }
            });
        } else {
            const users = readFallbackUsers();
            const target = users.find(u => u.id === userId || u.username === sessionUser.username);
            if (target) {
                target.name = newName;
                if (firstName) target.firstName = firstName.trim();
                if (lastName) target.lastName = lastName.trim();
                saveFallbackUsers(users);
            }
        }

        // Mise à jour de la session courante
        req.session.user.name = newName;

        console.log(`[USER PROFILE] ✏️ Nom d'affichage mis à jour pour ${sessionUser.username} : "${newName}"`);

        return res.json({
            success: true,
            message: "Profil mis à jour avec succès.",
            user: {
                ...sessionUser,
                name: newName
            }
        });
    } catch (err) {
        console.error('[API USER UPDATE ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

const multer = require('multer');
const { processAndSaveAvatar } = require('../services/avatarService');

const avatarUpload = multer({
    dest: path.join(__dirname, '../uploads'),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error("Format invalide. Seules les images (PNG, JPG, WebP) de moins de 2 Mo sont autorisées."));
        }
    }
});

/**
 * POST /api/user/avatar : Upload et normalisation WebP 256x256 de l'avatar (PERF-1)
 */
router.post('/avatar', (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, error: "L'image est trop lourde (2 Mo maximum)." });
            }
            return res.status(400).json({ success: false, error: err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        if (!sessionUser) {
            return res.status(401).json({ success: false, error: "Non connecté." });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: "Aucun fichier image fourni." });
        }

        const userId = sessionUser.id;
        const result = await processAndSaveAvatar(req.file.path, userId || sessionUser.username);

        // Mise à jour persistance
        if (isDbConnected()) {
            await User.findByIdAndUpdate(userId, { $set: { avatar: result.avatarUrl } });
        } else {
            const users = readFallbackUsers();
            const target = users.find(u => u.id === userId || u.username === sessionUser.username);
            if (target) {
                target.avatar = result.avatarUrl;
                saveFallbackUsers(users);
            }
        }

        // Mise à jour session
        req.session.user.avatar = result.avatarUrl;

        console.log(`[USER AVATAR] 🖼️ Nouvel avatar enregistré pour ${sessionUser.username} : ${result.avatarUrl}`);

        return res.json({
            success: true,
            message: "Avatar mis à jour avec succès !",
            avatar: result.avatarUrl,
            sizeBytes: result.sizeBytes
        });
    } catch (err) {
        console.error('[API USER AVATAR ERROR]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;

