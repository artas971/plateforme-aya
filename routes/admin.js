/**
 * Module d'Administration & Supervision (Back-Office) - Aya Studio
 * 
 * Routes :
 * - GET /api/admin/stats             : Tour de contrôle KPIs, métriques financières & santé serveur (Strict ADMIN_EMAIL)
 * - GET /api/admin/posts/pending     : Liste des posts en attente de modération (Admin / Modérateur)
 * - PUT /api/admin/posts/:id/status  : Valide ou rejette un post ('approved' | 'rejected')
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { User, Post, Video, isDbConnected } = require('../models');
const { getFinancialKPIs, getTransactions } = require('../services/transactionService');

// Fichiers de repli (Mode Autonome sans MongoDB)
const DATA_DIR = path.join(__dirname, '..', 'data');
const FALLBACK_POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const FALLBACK_USERS_FILE = path.join(DATA_DIR, 'users.json');
const FALLBACK_VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');

function readJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return [];
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (err) {
        return [];
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error(`❌ Erreur écriture ${filePath} :`, err.message);
    }
}

function getAdminEmails() {
    return (process.env.ADMIN_EMAIL || 'artas971@gmail.com')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
}

/**
 * Middleware d'Autorisation Administrateur Strict (Sécurité Absolue)
 * Vérifie que l'utilisateur est authentifié ET que son e-mail correspond à ADMIN_EMAIL (ou rôle admin).
 * Bloque toute tentative non autorisée avec un statut 403 Forbidden.
 */
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user || !req.session.user.authenticated) {
        return res.status(401).json({
            success: false,
            error: "Authentification requise pour accéder à la tour de contrôle."
        });
    }

    const adminEmails = getAdminEmails();
    const userEmail = (req.session.user.email || '').trim().toLowerCase();
    const userRole = (req.session.user.role || '').trim().toLowerCase();

    if (adminEmails.includes(userEmail) || userRole === 'admin') {
        return next();
    }

    console.warn(`[ADMIN SECURITY] ⛔ Tentative d'accès non autorisée à /api/admin par ${userEmail || 'inconnu'}`);
    return res.status(403).json({
        success: false,
        error: "Accès refusé. Cette zone est strictement réservée à l'administrateur (ADMIN_EMAIL)."
    });
}

/**
 * Middleware pour la modération des publications
 */
function requireModerator(req, res, next) {
    if (!req.session || !req.session.user || !req.session.user.authenticated) {
        return res.status(401).json({
            success: false,
            error: "Authentification requise pour accéder au panneau de modération."
        });
    }
    next();
}

/**
 * Helper de formatage de l'uptime
 */
function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}j`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

/**
 * GET /api/admin/stats
 * Tour de contrôle & KPIs Business (Strictement protégé par requireAdmin)
 */
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const since24h = new Date(Date.now() - 24 * 3600 * 1000);

        // 1. Métriques Utilisateurs
        let totalUsers = 0;
        let newUsers24h = 0;
        let rawUsersList = [];

        if (isDbConnected()) {
            try {
                totalUsers = await User.countDocuments();
                newUsers24h = await User.countDocuments({ createdAt: { $gte: since24h } });
                rawUsersList = await User.find().sort({ createdAt: -1 }).limit(10).lean();
            } catch (e) {
                console.warn('[ADMIN STATS] Erreur lecture Mongo Users :', e.message);
            }
        }

        if (totalUsers === 0) {
            const fallbackUsers = readJsonFile(FALLBACK_USERS_FILE);
            totalUsers = fallbackUsers.length;
            newUsers24h = fallbackUsers.filter(u => new Date(u.createdAt || 0) >= since24h).length;
            rawUsersList = fallbackUsers.slice(0, 10);
        }

        // 2. Métriques Financières (Stripe & Packs de crédits)
        const financialKPIs = await getFinancialKPIs();
        const transactions = await getTransactions(15);

        // 3. Métriques Vidéos & Contenu
        let totalVideos = 0;
        let rawVideosList = [];

        if (isDbConnected()) {
            try {
                totalVideos = await Video.countDocuments();
                rawVideosList = await Video.find().sort({ createdAt: -1 }).limit(10).lean();
            } catch (e) {}
        }

        if (totalVideos === 0) {
            const fallbackVideos = readJsonFile(FALLBACK_VIDEOS_FILE);
            totalVideos = fallbackVideos.length;
            rawVideosList = fallbackVideos.slice(0, 10);
        }

        // 4. Métriques Modération (Garantie de non-régression pour moderation.html)
        let moderationPending = 0;
        let moderationApproved = 0;
        let moderationRejected = 0;
        let rawPostsList = [];

        if (isDbConnected()) {
            try {
                [moderationPending, moderationApproved, moderationRejected] = await Promise.all([
                    Post.countDocuments({ moderationStatus: 'pending' }),
                    Post.countDocuments({ moderationStatus: 'approved' }),
                    Post.countDocuments({ moderationStatus: 'rejected' })
                ]);
                rawPostsList = await Post.find().sort({ createdAt: -1 }).limit(10).lean();
            } catch (e) {}
        } else {
            const posts = readJsonFile(FALLBACK_POSTS_FILE);
            moderationPending = posts.filter(p => p.moderationStatus === 'pending').length;
            moderationApproved = posts.filter(p => p.moderationStatus === 'approved').length;
            moderationRejected = posts.filter(p => p.moderationStatus === 'rejected').length;
            rawPostsList = posts.slice(0, 10);
        }

        // 5. Agrégation du Journal des 10 Derniers Événements
        const activities = [];

        // Événements Inscription
        rawUsersList.forEach(u => {
            activities.push({
                type: 'USER_REGISTRATION',
                icon: '👥',
                title: 'Nouvel utilisateur inscrit',
                detail: `@${u.username || 'utilisateur'} (${u.email || 'email masqué'})`,
                date: u.createdAt || new Date().toISOString()
            });
        });

        // Événements Achat Stripe
        transactions.forEach(t => {
            activities.push({
                type: 'STRIPE_PURCHASE',
                icon: '💳',
                title: `Achat Pack ${t.packId ? t.packId.replace('pack_', '') : 'Crédits'} (+${t.credits} crédits)`,
                detail: `${t.username} • ${t.amount}€ • ${t.provider ? t.provider.toUpperCase() : 'STRIPE'}`,
                date: t.createdAt || new Date().toISOString()
            });
        });

        // Événements Vidéo générée
        rawVideosList.forEach(v => {
            activities.push({
                type: 'VIDEO_GENERATION',
                icon: '🎬',
                title: 'Vidéo sous-titrée générée',
                detail: `"${v.title || v.mp4Filename || 'Témoignage'}" (${v.targetLang ? v.targetLang.toUpperCase() : 'FR'})`,
                date: v.createdAt || new Date().toISOString()
            });
        });

        // Tri chronologique décroissant et sélection des 10 plus récents
        const recentActivities = activities
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
            .slice(0, 10);

        // 6. Santé & Uptime Système
        const mem = process.memoryUsage();
        const uptimeSec = process.uptime();

        const system = {
            uptimeSeconds: Math.floor(uptimeSec),
            uptimeFormatted: formatUptime(uptimeSec),
            nodeVersion: process.version,
            platform: process.platform,
            environment: (process.env.NODE_ENV || 'development').toUpperCase(),
            execProfile: (process.env.AYA_EXEC_PROFILE || 'cloud_vps_safe').toUpperCase(),
            dbConnected: isDbConnected(),
            dbMode: isDbConnected() ? 'MongoDB Cloud' : 'Mode Autonome Local (JSON)',
            memoryUsageMb: {
                rss: Math.round(mem.rss / 1024 / 1024),
                heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
            },
            adminEmail: req.session.user.email,
            serverTime: new Date().toISOString()
        };

        return res.json({
            success: true,
            kpis: {
                totalUsers,
                newUsers24h,
                totalRevenueEur: financialKPIs.totalRevenueEur,
                totalCreditsSold: financialKPIs.totalCreditsSold,
                packsSold: financialKPIs.packsSold,
                totalVideos,
                totalPosts: moderationPending + moderationApproved + moderationRejected
            },
            system,
            recentActivities,
            stats: {
                pending: moderationPending,
                approved: moderationApproved,
                rejected: moderationRejected,
                total: moderationPending + moderationApproved + moderationRejected
            }
        });

    } catch (err) {
        console.error('❌ Erreur GET /api/admin/stats :', err);
        return res.status(500).json({
            success: false,
            error: "Erreur lors de la génération des statistiques d'administration.",
            details: err.message
        });
    }
});

/**
 * GET /api/admin/posts/pending
 * Modération des témoignages
 */
router.get('/posts/pending', requireModerator, async (req, res) => {
    try {
        if (isDbConnected()) {
            const posts = await Post.find({ moderationStatus: 'pending' })
                .sort({ createdAt: 1 })
                .lean();

            return res.json({
                success: true,
                count: posts.length,
                posts
            });
        }

        const allPosts = readJsonFile(FALLBACK_POSTS_FILE);
        const pendingPosts = allPosts
            .filter(p => p.moderationStatus === 'pending')
            .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

        return res.json({
            success: true,
            count: pendingPosts.length,
            posts: pendingPosts
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            error: "Impossible de récupérer les posts en attente.",
            details: err.message
        });
    }
});

/**
 * PUT /api/admin/posts/:id/status
 * Met à jour le statut d'un témoignage (approved / rejected)
 */
router.put('/posts/:id/status', requireModerator, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: "Statut invalide. Valeurs admises : 'approved', 'rejected', 'pending'."
            });
        }

        const moderatorName = (req.session && req.session.user && req.session.user.name) || "Modérateur";
        const updateData = {
            moderationStatus: status,
            moderationNotes: notes || null,
            moderatedAt: new Date().toISOString()
        };

        if (isDbConnected()) {
            const updated = await Post.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    error: `Témoignage avec l'ID ${id} introuvable.`
                });
            }

            return res.json({
                success: true,
                message: `Le témoignage a été marqué comme '${status}'.`,
                post: updated
            });
        }

        const posts = readJsonFile(FALLBACK_POSTS_FILE);
        const index = posts.findIndex(p => p._id === id || p.id === id);

        if (index === -1) {
            return res.status(404).json({
                success: false,
                error: `Témoignage avec l'ID ${id} introuvable.`
            });
        }

        posts[index] = {
            ...posts[index],
            ...updateData
        };

        writeJsonFile(FALLBACK_POSTS_FILE, posts);

        return res.json({
            success: true,
            message: `Le témoignage a été marqué comme '${status}'.`,
            post: posts[index]
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            error: "Erreur lors de la mise à jour du statut de modération.",
            details: err.message
        });
    }
});

/**
 * GET /api/admin/chat/archives
 * Liste des fichiers d'archives du chat éphémère avec URLs de téléchargement (Admin uniquement)
 */
router.get('/chat/archives', requireAdmin, async (req, res) => {
    try {
        const archivesFile = path.join(__dirname, '..', 'chat_archives.json');
        const archivesDir = path.join(__dirname, '..', 'message pour john');
        let archives = readJsonFile(archivesFile);

        // Scanner également le dossier 'message pour john' s'il existe
        if (fs.existsSync(archivesDir)) {
            const files = fs.readdirSync(archivesDir);
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    const filePath = path.join(archivesDir, file);
                    const stats = fs.statSync(filePath);
                    const fileUrl = `/message pour john/${file}`;
                    if (!archives.some(a => a.file === file || a.url === fileUrl)) {
                        archives.push({
                            id: file.replace('.json', ''),
                            file: file,
                            url: fileUrl,
                            size: stats.size,
                            createdAt: stats.mtime.toISOString()
                        });
                    }
                }
            });
        }

        return res.json({
            success: true,
            count: archives.length,
            archives
        });
    } catch (err) {
        console.error('❌ Erreur GET /api/admin/chat/archives :', err);
        return res.status(500).json({
            success: false,
            error: "Erreur lors de la récupération des archives chat.",
            details: err.message
        });
    }
});

module.exports = router;

