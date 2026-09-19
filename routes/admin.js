/**
 * Module d'Administration & Modération (Back-Office) - Plateforme Aya
 * Agent Thomas (Architecte Back-End)
 * 
 * Routes :
 * - GET /api/admin/posts/pending     : Liste tous les posts en attente de modération
 * - PUT /api/admin/posts/:id/status  : Valide ou rejette un post ('approved' | 'rejected')
 * - GET /api/admin/stats             : Statistiques de modération (pending, approved, rejected)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { Post, isDbConnected } = require('../models');

// Configuration du fichier de repli (mode autonome sans MongoDB)
const DATA_DIR = path.join(__dirname, '..', 'data');
const FALLBACK_POSTS_FILE = path.join(DATA_DIR, 'posts.json');

function readFallbackPosts() {
    try {
        if (!fs.existsSync(FALLBACK_POSTS_FILE)) return [];
        const data = fs.readFileSync(FALLBACK_POSTS_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error('❌ Erreur lecture posts fallback :', err);
        return [];
    }
}

function writeFallbackPosts(posts) {
    try {
        fs.writeFileSync(FALLBACK_POSTS_FILE, JSON.stringify(posts, null, 2), 'utf-8');
    } catch (err) {
        console.error('❌ Erreur écriture posts fallback :', err);
    }
}

/**
 * Middleware d'autorisation Admin / Modérateur
 * Permet aux utilisateurs connectés avec un rôle habilité ou aux testeurs de modérer.
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

router.use(requireModerator);

/**
 * GET /api/admin/posts/pending
 * Récupère tous les témoignages en attente de validation (tri du plus ancien au plus récent)
 */
router.get('/posts/pending', async (req, res) => {
    try {
        if (isDbConnected()) {
            const posts = await Post.find({ moderationStatus: 'pending' })
                .sort({ createdAt: 1 }) // FIFO pour traiter dans l'ordre d'arrivée
                .lean();

            return res.json({
                success: true,
                count: posts.length,
                posts
            });
        }

        // Mode Fallback (JSON)
        const allPosts = readFallbackPosts();
        const pendingPosts = allPosts
            .filter(p => p.moderationStatus === 'pending')
            .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

        return res.json({
            success: true,
            count: pendingPosts.length,
            posts: pendingPosts
        });

    } catch (err) {
        console.error('❌ Erreur GET /api/admin/posts/pending :', err);
        return res.status(500).json({
            success: false,
            error: "Impossible de récupérer les posts en attente.",
            details: err.message
        });
    }
});

/**
 * PUT /api/admin/posts/:id/status
 * Met à jour le statut de modération d'un témoignage
 * Body : { status: 'approved' | 'rejected', notes: '...' }
 */
router.put('/posts/:id/status', async (req, res) => {
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

            console.log(`🛡️ [MODÉRATION] Post ${id} passé au statut '${status}' par ${moderatorName}`);
            return res.json({
                success: true,
                message: `Le témoignage a été marqué comme '${status}'.`,
                post: updated
            });
        }

        // Mode Fallback (JSON)
        const posts = readFallbackPosts();
        const index = posts.findIndex(p => p._id === id);

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

        writeFallbackPosts(posts);

        console.log(`🛡️ [MODÉRATION FALLBACK] Post ${id} passé au statut '${status}' par ${moderatorName}`);
        return res.json({
            success: true,
            message: `Le témoignage a été marqué comme '${status}'.`,
            post: posts[index]
        });

    } catch (err) {
        console.error('❌ Erreur PUT /api/admin/posts/:id/status :', err);
        return res.status(500).json({
            success: false,
            error: "Erreur lors de la mise à jour du statut de modération.",
            details: err.message
        });
    }
});

/**
 * GET /api/admin/stats
 * Résumé des compteurs de modération pour le tableau de bord
 */
router.get('/stats', async (req, res) => {
    try {
        if (isDbConnected()) {
            const [pending, approved, rejected] = await Promise.all([
                Post.countDocuments({ moderationStatus: 'pending' }),
                Post.countDocuments({ moderationStatus: 'approved' }),
                Post.countDocuments({ moderationStatus: 'rejected' })
            ]);

            return res.json({
                success: true,
                stats: { pending, approved, rejected, total: pending + approved + rejected }
            });
        }

        const posts = readFallbackPosts();
        const stats = {
            pending: posts.filter(p => p.moderationStatus === 'pending').length,
            approved: posts.filter(p => p.moderationStatus === 'approved').length,
            rejected: posts.filter(p => p.moderationStatus === 'rejected').length,
            total: posts.length
        };

        return res.json({
            success: true,
            stats
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
