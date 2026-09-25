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

const { User, Post, Video, FeedbackRating, FailureReport, isDbConnected } = require('../models');
const { getFinancialKPIs, getTransactions } = require('../services/transactionService');
const { addCredits } = require('../services/walletService');

// Fichiers de repli (Mode Autonome sans MongoDB)
const DATA_DIR = path.join(__dirname, '..', 'data');
const FALLBACK_POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const FALLBACK_USERS_FILE = path.join(DATA_DIR, 'users.json');
const FALLBACK_VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const FALLBACK_FAILURES_FILE = path.join(DATA_DIR, 'failure_reports.json');
const FALLBACK_RATINGS_FILE = path.join(DATA_DIR, 'ratings.json');

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

const ROOT_DIR = path.resolve(__dirname, '..');
const REPONSED_DIR = path.join(ROOT_DIR, 'fichiers_reponse_a_envoyer');

/**
 * Supprime physiquement les fichiers médias associés à un post rejeté ou supprimé
 */
function deletePostMediaFiles(post) {
    if (!post) return;
    const mediaUrls = [post.mediaUrl, post.mediaThumbnail, post.audioUrl];
    for (const url of mediaUrls) {
        if (!url || typeof url !== 'string') continue;
        try {
            const cleanUrl = decodeURIComponent(url.replace(/^https?:\/\/[^\/]+/i, ''));
            let localPath = null;
            if (cleanUrl.startsWith('/uploads/')) {
                localPath = path.join(ROOT_DIR, cleanUrl.replace(/^\//, ''));
            } else if (cleanUrl.startsWith('/download/')) {
                localPath = path.join(REPONSED_DIR, cleanUrl.replace('/download/', ''));
            } else if (cleanUrl.startsWith('/fichiers_reponse_a_envoyer/')) {
                localPath = path.join(ROOT_DIR, cleanUrl.replace(/^\//, ''));
            }
            if (localPath && fs.existsSync(localPath) && !fs.statSync(localPath).isDirectory()) {
                fs.unlinkSync(localPath);
                console.log(`🗑️ [MODÉRATION REJET] Fichier média supprimé : ${localPath}`);
            }
        } catch (e) {
            console.warn(`⚠️ [MODÉRATION REJET] Erreur suppression fichier média ${url} :`, e.message);
        }
    }
}

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
            const existingPost = await Post.findById(id);
            if (!existingPost) {
                return res.status(404).json({
                    success: false,
                    error: `Témoignage avec l'ID ${id} introuvable.`
                });
            }

            // Si rejeté, suppression immédiate des fichiers médias lourds du disque
            if (status === 'rejected') {
                deletePostMediaFiles(existingPost);
            }

            const updated = await Post.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true }
            );

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

        // Si rejeté, suppression immédiate des fichiers médias lourds du disque
        if (status === 'rejected') {
            deletePostMediaFiles(posts[index]);
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

// ── 4. Gestion des Échecs & Auto-Diagnostics IA (Phase 2) ───────────────────

/**
 * GET /api/admin/failures
 * Récupère la liste des incidents de pipeline avec analyse de l'Agent Alexandre.
 */
router.get('/failures', requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        let failures = [];

        if (isDbConnected()) {
            try {
                const query = status ? { status } : {};
                failures = await FailureReport.find(query).sort({ createdAt: -1 }).lean();
            } catch (mongoErr) {
                console.warn('[ADMIN FAILURES] ⚠️ Erreur MongoDB, bascule JSON :', mongoErr.message);
            }
        }

        if (failures.length === 0) {
            const localFailures = readJsonFile(FALLBACK_FAILURES_FILE);
            failures = status ? localFailures.filter(f => f.status === status) : localFailures;
        }

        return res.json({
            success: true,
            count: failures.length,
            failures
        });
    } catch (err) {
        console.error('❌ Erreur GET /api/admin/failures :', err);
        return res.status(500).json({
            success: false,
            error: "Erreur lors de la récupération des rapports d'échec.",
            details: err.message
        });
    }
});

/**
 * POST /api/admin/failures/:id/action
 * Approuve la relance avec la solution IA ou archive un échec de pipeline.
 */
router.post('/failures/:id/action', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { action, notes } = req.body; // action: 'retry' | 'archive' | 'dismiss'

        if (!['retry', 'archive', 'dismiss'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: "Action invalide. Actions autorisées : 'retry', 'archive', 'dismiss'."
            });
        }

        const adminIdentifier = req.session?.user?.email || req.session?.user?.username || 'admin';
        const newStatus = action === 'retry' ? 'approved_and_retried' : 'rejected_archived';
        const now = new Date();

        let updated = null;

        // 1. Mise à jour MongoDB si connecté
        if (isDbConnected()) {
            try {
                const isObjectId = mongoose.Types.ObjectId.isValid(id);
                const query = isObjectId ? { _id: id } : { $or: [{ id }, { jobId: id }] };

                updated = await FailureReport.findOneAndUpdate(
                    query,
                    {
                        $set: {
                            status: newStatus,
                            reviewedBy: adminIdentifier,
                            reviewedAt: now
                        }
                    },
                    { new: true }
                ).lean();
            } catch (mErr) {
                console.warn('[ADMIN FAILURE ACTION] ⚠️ Erreur Mongo :', mErr.message);
            }
        }

        // 2. Mise à jour fichier local de repli
        const localFailures = readJsonFile(FALLBACK_FAILURES_FILE);
        const idx = localFailures.findIndex(f => f.id === id || f._id === id || f.jobId === id);
        if (idx !== -1) {
            localFailures[idx].status = newStatus;
            localFailures[idx].reviewedBy = adminIdentifier;
            localFailures[idx].reviewedAt = now.toISOString();
            if (notes) localFailures[idx].adminNotes = notes;
            writeJsonFile(FALLBACK_FAILURES_FILE, localFailures);
            if (!updated) updated = localFailures[idx];
        }

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: "Rapport d'échec introuvable."
            });
        }

        console.log(`[ADMIN ACTION] 🚨 Échec ${id} traité par ${adminIdentifier} -> ${newStatus}`);

        return res.json({
            success: true,
            status: newStatus,
            message: action === 'retry' 
                ? "Incident approuvé pour relance avec les paramètres IA d'Alexandre." 
                : "Incident archivé avec succès.",
            failure: updated
        });
    } catch (err) {
        console.error('❌ Erreur POST /api/admin/failures/:id/action :', err);
        return res.status(500).json({
            success: false,
            error: "Erreur lors du traitement de l'action sur l'échec.",
            details: err.message
        });
    }
});


// ── 5. Gestion des Remboursements & Retours Utilisateurs (Phase 2) ───────────

/**
 * GET /api/admin/refunds
 * Récupère les évaluations nécessitant une supervision (pending_approval, approved, rejected, ou notes <= 3).
 */
router.get('/refunds', requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        let refunds = [];

        if (isDbConnected()) {
            try {
                let query = {};
                if (status) {
                    query = { refundStatus: status };
                } else {
                    query = {
                        $or: [
                            { refundStatus: { $in: ['pending_approval', 'approved', 'rejected'] } },
                            { rating: { $lte: 3 } }
                        ]
                    };
                }
                refunds = await FeedbackRating.find(query).sort({ createdAt: -1 }).lean();
            } catch (mongoErr) {
                console.warn('[ADMIN REFUNDS] ⚠️ Erreur MongoDB, repli JSON :', mongoErr.message);
            }
        }

        if (refunds.length === 0) {
            const localRatings = readJsonFile(FALLBACK_RATINGS_FILE);
            refunds = status
                ? localRatings.filter(r => r.refundStatus === status)
                : localRatings.filter(r => (r.refundStatus && r.refundStatus !== 'none') || (r.rating && r.rating <= 3));
        }

        return res.json({
            success: true,
            count: refunds.length,
            refunds
        });
    } catch (err) {
        console.error('❌ Erreur GET /api/admin/refunds :', err);
        return res.status(500).json({
            success: false,
            error: "Erreur lors de la récupération des demandes de remboursement.",
            details: err.message
        });
    }
});

/**
 * POST /api/admin/refunds/:id/action
 * Approuve (re-crédite le compte utilisateur via walletService) ou refuse un remboursement.
 * Sécurité stricte : Nécessite requireAdmin et le clic de l'administrateur.
 */
router.post('/refunds/:id/action', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { action, credits, reason } = req.body; // action: 'approve' | 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: "Action invalide. Actions autorisées : 'approve', 'reject'."
            });
        }

        const adminIdentifier = req.session?.user?.email || req.session?.user?.username || 'admin';
        const now = new Date();

        // 1. Recherche du feedback à traiter
        let rating = null;
        if (isDbConnected()) {
            try {
                const isObjectId = mongoose.Types.ObjectId.isValid(id);
                const query = isObjectId ? { _id: id } : { $or: [{ id }, { jobId: id }] };
                rating = await FeedbackRating.findOne(query);
            } catch (e) {}
        }

        const localRatings = readJsonFile(FALLBACK_RATINGS_FILE);
        const localIdx = localRatings.findIndex(r => r.id === id || r._id === id || r.jobId === id);
        if (!rating && localIdx !== -1) {
            rating = localRatings[localIdx];
        }

        if (!rating) {
            return res.status(404).json({
                success: false,
                error: "Évaluation / Demande de remboursement introuvable."
            });
        }

        // Sécurité double remboursement
        if (action === 'approve' && rating.refundStatus === 'approved') {
            return res.status(400).json({
                success: false,
                error: "Cette demande a déjà été approuvée et remboursée."
            });
        }

        let creditsAdded = 0;
        let walletResult = null;
        const newRefundStatus = action === 'approve' ? 'approved' : 'rejected';

        // 2. Action financière stricte si approuvé
        if (action === 'approve') {
            creditsAdded = Math.max(1, parseInt(credits, 10) || rating.aiAnalysis?.suggestedCredits || 1);
            const userTarget = rating.user || rating.username || rating.userEmail;

            if (!userTarget) {
                return res.status(400).json({
                    success: false,
                    error: "Impossible d'identifier l'utilisateur à re-créditer."
                });
            }

            console.log(`[ADMIN REFUND] 💚 Approbation de remboursement par ${adminIdentifier} : +${creditsAdded} crédit(s) pour ${userTarget}...`);
            walletResult = await addCredits(userTarget, creditsAdded, `admin_feedback_refund_${id}`);

            if (!walletResult || !walletResult.success) {
                // Essai avec username ou email si l'ID d'origine n'a pas matché
                if (rating.username && String(rating.username) !== String(userTarget)) {
                    walletResult = await addCredits(rating.username, creditsAdded, `admin_feedback_refund_${id}`);
                }
                if ((!walletResult || !walletResult.success) && rating.userEmail && String(rating.userEmail) !== String(userTarget)) {
                    walletResult = await addCredits(rating.userEmail, creditsAdded, `admin_feedback_refund_${id}`);
                }
            }

            if (!walletResult || !walletResult.success) {
                return res.status(500).json({
                    success: false,
                    error: `Échec du crédit du portefeuille : ${walletResult?.reason || 'Erreur walletService'}`
                });
            }
        }

        // 3. Mise à jour de l'enregistrement en base
        if (isDbConnected() && rating.save) {
            rating.refundStatus = newRefundStatus;
            rating.refundedBy = adminIdentifier;
            rating.refundedAt = now;
            await rating.save();
        }

        // 4. Mise à jour fichier JSON local
        if (localIdx !== -1) {
            localRatings[localIdx].refundStatus = newRefundStatus;
            localRatings[localIdx].refundedBy = adminIdentifier;
            localRatings[localIdx].refundedAt = now.toISOString();
            if (action === 'approve') {
                localRatings[localIdx].creditsRefunded = creditsAdded;
            }
            writeJsonFile(FALLBACK_RATINGS_FILE, localRatings);
        }

        console.log(`[ADMIN REFUND] ✅ Statut remboursement mis à jour : ${newRefundStatus} (Par ${adminIdentifier})`);

        return res.json({
            success: true,
            refundStatus: newRefundStatus,
            creditsAdded: action === 'approve' ? creditsAdded : 0,
            newCredits: walletResult?.credits !== undefined ? walletResult.credits : null,
            message: action === 'approve'
                ? `Remboursement approuvé avec succès ! +${creditsAdded} crédit(s) ajoutés au compte.`
                : "Demande de remboursement refusée."
        });

    } catch (err) {
        console.error('❌ Erreur POST /api/admin/refunds/:id/action :', err);
        return res.status(500).json({
            success: false,
            error: "Erreur lors de l'exécution de l'action de remboursement.",
            details: err.message
        });
    }
});

const vocabThemeService = require('../services/vocabThemeService');

/**
 * GET /api/admin/vocab-themes
 * Liste complète de tous les thèmes de vocabulaire configurés
 */
router.get('/vocab-themes', requireAdmin, (req, res) => {
    try {
        const themes = vocabThemeService.getAllThemes(false);
        return res.json({ success: true, themes });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/admin/vocab-themes
 * Ajout d'un nouveau thème par un administrateur
 */
router.post('/vocab-themes', requireAdmin, (req, res) => {
    try {
        const { titleFr, titleAr, emoji, category } = req.body || {};
        const created = vocabThemeService.addTheme({ titleFr, titleAr, emoji, category });
        return res.json({ success: true, theme: created });
    } catch (e) {
        return res.status(400).json({ success: false, error: e.message });
    }
});

/**
 * DELETE /api/admin/vocab-themes/:id
 * Suppression d'un thème par un administrateur
 */
router.delete('/vocab-themes/:id', requireAdmin, (req, res) => {
    try {
        const success = vocabThemeService.deleteTheme(req.params.id);
        if (!success) {
            return res.status(404).json({ success: false, error: "Thème non trouvé." });
        }
        return res.json({ success: true, message: "Thème supprimé avec succès." });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * PUT /api/admin/vocab-themes/:id/toggle
 * Active / Désactive un thème
 */
router.put('/vocab-themes/:id/toggle', requireAdmin, (req, res) => {
    try {
        const theme = vocabThemeService.toggleTheme(req.params.id);
        if (!theme) {
            return res.status(404).json({ success: false, error: "Thème non trouvé." });
        }
        return res.json({ success: true, theme });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/admin/maintenance/disk
 * État d'occupation des dossiers tampons et temporaires (Ticket #27 - TICKET-09)
 */
router.get('/maintenance/disk', requireAdmin, (req, res) => {
    try {
        const { runGarbageCollection, AUDIO_A_TRAITER_DIR, REPONSED_DIR, TEMP_DIR } = require('../services/garbageCollectorService');
        
        function getFolderMetrics(dirPath) {
            if (!fs.existsSync(dirPath)) return { count: 0, sizeMb: 0 };
            const entries = fs.readdirSync(dirPath);
            let size = 0;
            let fileCount = 0;
            for (const f of entries) {
                try {
                    const st = fs.statSync(path.join(dirPath, f));
                    if (st.isFile()) {
                        fileCount++;
                        size += st.size;
                    }
                } catch (e) {}
            }
            return { count: fileCount, sizeMb: (size / (1024 * 1024)).toFixed(2) };
        }

        const metrics = {
            audio_a_traiter: getFolderMetrics(AUDIO_A_TRAITER_DIR),
            fichiers_reponse_a_envoyer: getFolderMetrics(REPONSED_DIR),
            temp: getFolderMetrics(TEMP_DIR)
        };

        const totalMb = (parseFloat(metrics.audio_a_traiter.sizeMb) + parseFloat(metrics.fichiers_reponse_a_envoyer.sizeMb) + parseFloat(metrics.temp.sizeMb)).toFixed(2);

        return res.json({
            success: true,
            totalDiskUsageMb: `${totalMb} MB`,
            folders: metrics
        });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/admin/maintenance/gc
 * Déclenchement manuel ou planifié du Garbage Collector NVMe (Ticket #27 - TICKET-09)
 */
router.post('/maintenance/gc', requireAdmin, (req, res) => {
    try {
        const { runGarbageCollection } = require('../services/garbageCollectorService');
        const dryRun = req.body?.dryRun === true;
        const result = runGarbageCollection({ dryRun });
        return res.json({ success: true, result });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/admin/maintenance/backups
 * Liste des sauvegardes de bases de données et leur statut (Ticket #28 - TICKET-10)
 */
router.get('/maintenance/backups', requireAdmin, (req, res) => {
    try {
        const { listBackups } = require('../services/backupService');
        const backups = listBackups();
        return res.json({ success: true, count: backups.length, backups });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/admin/maintenance/backup-now
 * Déclenchement immédiat d'une sauvegarde de la base de données (Ticket #28 - TICKET-10)
 */
router.post('/maintenance/backup-now', requireAdmin, async (req, res) => {
    try {
        const { performBackup } = require('../services/backupService');
        const report = await performBackup();
        return res.json({ success: true, report });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * Middleware d'Authentification Hybride pour la Télémétrie
 * Accepte :
 * 1. Session Administrateur active (req.session.user)
 * 2. Jeton Agent Machine-to-Machine (En-tête 'X-Aya-Agent-Token' ou 'Authorization: Bearer ...')
 */
function requireAdminOrAgentToken(req, res, next) {
    const agentToken = req.headers['x-aya-agent-token'] || 
        (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null);

    const configuredSecret = process.env.AYA_TELEMETRY_SECRET || 'aya_secret_telemetry_token_2026';

    if (agentToken) {
        try {
            const bufA = Buffer.from(String(agentToken));
            const bufB = Buffer.from(String(configuredSecret));
            if (bufA.length === bufB.length && require('crypto').timingSafeEqual(bufA, bufB)) {
                req.isAgentCaller = true;
                return next();
            }
        } catch (e) {}
        console.warn(`[TELEMETRY SECURITY] ⛔ Jeton d'agent invalide présenté depuis ${req.ip}`);
        return res.status(401).json({ success: false, error: "Jeton de télémétrie d'agent invalide." });
    }

    // Fallback sur session administrateur classique
    return requireAdmin(req, res, next);
}

/**
 * GET /api/admin/telemetry/stats
 * Tableau de bord instantané du moteur de télémétrie & métriques récentes
 */
router.get('/telemetry/stats', requireAdminOrAgentToken, (req, res) => {
    try {
        const { getTelemetryStats, getRecentEvents } = require('../services/telemetryService');
        const stats = getTelemetryStats();
        const recent = getRecentEvents(20);
        return res.json({
            success: true,
            stats,
            recentEvents: recent
        });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/admin/telemetry/export
 * Export streamé non-bloquant du journal JSONL du jour (ou d'une date spécifique ?date=YYYY-MM-DD)
 */
router.get('/telemetry/export', requireAdminOrAgentToken, (req, res) => {
    try {
        const { TELEMETRY_DIR } = require('../services/telemetryService');
        const requestedDate = req.query.date || new Date().toISOString().split('T')[0];
        
        // Sécurisation stricte du nom de fichier contre toute traversée de chemin
        if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
            return res.status(400).json({ success: false, error: "Format de date invalide (attendu: YYYY-MM-DD)." });
        }

        const targetFile = path.join(TELEMETRY_DIR, `events-${requestedDate}.jsonl`);
        const targetGz = path.join(TELEMETRY_DIR, `events-${requestedDate}.jsonl.gz`);

        let filePath = null;
        let isGz = false;

        if (fs.existsSync(targetFile)) {
            filePath = targetFile;
        } else if (fs.existsSync(targetGz)) {
            filePath = targetGz;
            isGz = true;
        } else {
            return res.status(404).json({ success: false, error: `Aucun journal de télémétrie trouvé pour la date ${requestedDate}.` });
        }

        const stat = fs.statSync(filePath);
        res.setHeader('Content-Type', isGz ? 'application/gzip' : 'application/x-ndjson; charset=utf-8');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);

        // Streaming direct sans accumulation en mémoire RAM
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;


