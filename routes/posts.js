/**
 * Module Mur Communautaire (Community Wall) - Plateforme Aya
 * Agent Thomas (Architecte Back-End) & Agent Lionel (Expérience UI)
 * 
 * Routes :
 * - GET  /api/posts         : Récupère les témoignages approuvés (tri chronologique décroissant)
 * - POST /api/posts         : Soumet un nouveau témoignage (statut initial impératif : 'pending')
 * - POST /api/posts/:id/like: Incrémente les likes d'un témoignage
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { Post, isDbConnected } = require('../models');

// Configuration des répertoires de stockage
const ROOT_DIR = path.resolve(__dirname, '..');
const UPLOADS_POSTS_DIR = path.join(ROOT_DIR, 'uploads', 'posts');
const REPONSED_DIR = path.join(ROOT_DIR, 'fichiers_reponse_a_envoyer');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const FALLBACK_POSTS_FILE = path.join(DATA_DIR, 'posts.json');

fs.mkdirSync(UPLOADS_POSTS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialisation du fichier de repli si nécessaire
if (!fs.existsSync(FALLBACK_POSTS_FILE)) {
    fs.writeFileSync(FALLBACK_POSTS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

/**
 * Nettoyage strict des noms de fichiers (anti-mojibake)
 */
function sanitizeFileName(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const base = path.basename(originalName, ext)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Supprime accents
        .replace(/[^a-zA-Z0-9_-]/g, '_') // Caractères sûrs uniquement
        .slice(0, 40);
    return `${base}_${Date.now()}${ext}`;
}

// Configuration Multer pour les médias de posts
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_POSTS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, sanitizeFileName(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 Mo max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|mov|webm|mkv|avi|mp3|wav|m4a|ogg|aac/;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        const mime = file.mimetype;
        if (allowedTypes.test(ext) || mime.startsWith('video/') || mime.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error("Format de fichier non supporté. Formats acceptés : MP4, MOV, WEBM, MP3, WAV, M4A."));
        }
    }
});

// Helpers pour le stockage autonome JSON (fallback anti-crash)
function readFallbackPosts() {
    try {
        const data = fs.readFileSync(FALLBACK_POSTS_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error('Erreur lecture posts.json fallback:', err);
        return [];
    }
}

function writeFallbackPosts(posts) {
    try {
        fs.writeFileSync(FALLBACK_POSTS_FILE, JSON.stringify(posts, null, 2), 'utf-8');
    } catch (err) {
        console.error('Erreur écriture posts.json fallback:', err);
    }
}

/**
 * GET /api/posts
 * Récupère tous les témoignages approuvés, triés du plus récent au plus ancien.
 */
router.get('/', async (req, res) => {
    try {
        const { tag, lang } = req.query;

        if (isDbConnected()) {
            const query = { moderationStatus: 'approved' };
            if (tag) query.tags = tag;
            if (lang) query.targetLang = lang;

            const posts = await Post.find(query)
                .sort({ isPinned: -1, createdAt: -1 })
                .limit(50)
                .lean();

            return res.json({
                success: true,
                count: posts.length,
                posts
            });
        }

        // Mode Fallback (JSON autonome)
        let posts = readFallbackPosts();
        posts = posts.filter(p => p.moderationStatus === 'approved');

        if (tag) posts = posts.filter(p => p.tags && p.tags.includes(tag));
        if (lang) posts = posts.filter(p => p.targetLang === lang);

        posts.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        return res.json({
            success: true,
            count: posts.length,
            posts
        });
    } catch (err) {
        console.error('❌ Erreur GET /api/posts :', err);
        return res.status(500).json({
            success: false,
            error: "Impossible de récupérer les témoignages.",
            details: err.message
        });
    }
});

/**
 * POST /api/posts
 * Soumet un témoignage.
 * Le statut DOIT TOUJOURS être 'pending' (modération préalable).
 */
router.post('/', upload.single('media'), async (req, res) => {
    try {
        const body = req.body || {};
        const content = (body.originalContent || body.text || body.content || body.smartDescription || '').trim();

        if (!content && !req.file && !body.mediaUrl) {
            return res.status(400).json({
                success: false,
                error: "Le témoignage doit comporter au moins un texte explicatif ou un média (vidéo/audio)."
            });
        }

        // Détection et assainissement du chemin média (suppression de tout domaine absolu externe ou tunnel)
        let mediaUrl = body.mediaUrl 
            ? body.mediaUrl
                .replace(/^https?:\/\/[^\/]+(?=\/(?:download|uploads|fichiers_reponse_a_envoyer)\/)/i, '')
                .replace(/^https?:\/\/localhost:\d+/i, '')
            : null;
        let mediaType = 'text';


        if (req.file) {
            mediaUrl = `/uploads/posts/${req.file.filename}`;
            const ext = path.extname(req.file.filename).toLowerCase();
            if (['.mp4', '.mov', '.webm', '.mkv'].includes(ext) || req.file.mimetype.startsWith('video/')) {
                mediaType = 'video';
            } else if (['.mp3', '.wav', '.m4a', '.ogg', '.aac'].includes(ext) || req.file.mimetype.startsWith('audio/')) {
                mediaType = 'audio';
            }
        } else if (mediaUrl) {
            // Si mediaUrl pointe vers un fichier local généré (/download/ ou /fichiers_reponse_a_envoyer/),
            // on copie le fichier vers uploads/posts pour garantir sa persistance définitive
            try {
                let filenameFromUrl = '';
                if (mediaUrl.startsWith('/download/')) {
                    filenameFromUrl = decodeURIComponent(mediaUrl.replace('/download/', ''));
                } else if (mediaUrl.startsWith('/fichiers_reponse_a_envoyer/')) {
                    filenameFromUrl = decodeURIComponent(mediaUrl.replace('/fichiers_reponse_a_envoyer/', ''));
                }

                if (filenameFromUrl) {
                    const sourcePath = path.join(REPONSED_DIR, filenameFromUrl);
                    if (fs.existsSync(sourcePath) && !fs.statSync(sourcePath).isDirectory()) {
                        const sanitizedDestName = sanitizeFileName(filenameFromUrl);
                        const destPath = path.join(UPLOADS_POSTS_DIR, sanitizedDestName);
                        fs.copyFileSync(sourcePath, destPath);
                        mediaUrl = `/uploads/posts/${sanitizedDestName}`;
                        console.log(`📋 [COMMUNAUTÉ] Vidéo persistée dans uploads/posts : ${sanitizedDestName}`);
                    }
                }
            } catch (copyErr) {
                console.warn('⚠️ [POSTS] Échec de la copie persistante du média (url conservée) :', copyErr);
            }

            const cleanUrl = mediaUrl.split('?')[0].toLowerCase();
            if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.webm')) {
                mediaType = 'video';
            } else if (cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.m4a')) {
                mediaType = 'audio';
            }
        }

        // Persistance optionnelle de la miniature transmise
        let mediaThumbnail = body.mediaThumbnail 
            ? body.mediaThumbnail
                .replace(/^https?:\/\/[^\/]+(?=\/(?:download|uploads|fichiers_reponse_a_envoyer)\/)/i, '')
                .replace(/^https?:\/\/localhost:\d+/i, '')
            : null;
        if (mediaThumbnail) {
            try {
                let thumbFromUrl = '';
                if (mediaThumbnail.startsWith('/download/')) {
                    thumbFromUrl = decodeURIComponent(mediaThumbnail.replace('/download/', ''));
                } else if (mediaThumbnail.startsWith('/fichiers_reponse_a_envoyer/')) {
                    thumbFromUrl = decodeURIComponent(mediaThumbnail.replace('/fichiers_reponse_a_envoyer/', ''));
                }
                if (thumbFromUrl) {
                    const thumbSource = path.join(REPONSED_DIR, thumbFromUrl);
                    if (fs.existsSync(thumbSource) && !fs.statSync(thumbSource).isDirectory()) {
                        const sanitizedThumb = sanitizeFileName(thumbFromUrl);
                        const thumbDest = path.join(UPLOADS_POSTS_DIR, sanitizedThumb);
                        fs.copyFileSync(thumbSource, thumbDest);
                        mediaThumbnail = `/uploads/posts/${sanitizedThumb}`;
                    }
                }
            } catch (thumbErr) {
                console.warn('⚠️ [POSTS] Échec de la copie de la miniature :', thumbErr);
            }
        }

        // Traitement des tags
        let tags = [];
        if (Array.isArray(body.tags)) {
            tags = body.tags;
        } else if (typeof body.tags === 'string' && body.tags.trim()) {
            tags = body.tags
                .split(/[\s,#]+/)
                .map(t => t.trim().replace(/^#/, ''))
                .filter(Boolean);
        }

        // Auteur
        const authorName = (
            body.authorName || 
            (req.session && req.session.user && req.session.user.name) || 
            (req.session && req.session.user && req.session.user.username) || 
            "Anonyme"
        ).trim();

        // Création de l'objet témoignage (statut STRICTEMENT 'pending')
        const postData = {
            authorName,
            mediaType,
            originalContent: content || "Témoignage vidéo partagé depuis la plateforme Aya.",
            translatedContent: body.translatedContent || "",
            sourceLang: body.sourceLang || "ar",
            targetLang: body.targetLang || "fr",
            mediaUrl,
            mediaThumbnail: mediaThumbnail || body.mediaThumbnail || null,
            tags,
            moderationStatus: 'pending', // Verrou de sécurité exigé
            likesCount: 0,
            viewsCount: 0,
            sharesCount: 0,
            isPinned: false,
            createdAt: new Date().toISOString()
        };

        if (isDbConnected()) {
            const created = await Post.create(postData);
            console.log(`📝 [COMMUNAUTÉ] Nouveau post soumis (ID: ${created._id}) - Statut : PENDING`);
            return res.status(201).json({
                success: true,
                message: "Votre publication est en cours d'examen par l'équipe de modération.",
                post: created
            });
        }

        // Mode Fallback JSON
        const fallbackList = readFallbackPosts();
        postData._id = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        fallbackList.unshift(postData);
        writeFallbackPosts(fallbackList);

        console.log(`📝 [COMMUNAUTÉ FALLBACK] Nouveau post enregistré en JSON (${postData._id}) - Statut : PENDING`);
        return res.status(201).json({
            success: true,
            message: "Votre publication est en cours d'examen par l'équipe de modération.",
            post: postData
        });

    } catch (err) {
        console.error('❌ Erreur POST /api/posts :', err);
        return res.status(500).json({
            success: false,
            error: "Impossible d'enregistrer le témoignage.",
            details: err.message
        });
    }
});

/**
 * POST /api/posts/:id/like
 * Incrémente le compteur de likes d'un témoignage.
 */
router.post('/:id/like', async (req, res) => {
    try {
        const { id } = req.params;

        if (isDbConnected()) {
            const updated = await Post.findByIdAndUpdate(
                id,
                { $inc: { likesCount: 1 } },
                { new: true }
            );
            if (!updated) {
                return res.status(404).json({ success: false, error: "Témoignage introuvable." });
            }
            return res.json({ success: true, likesCount: updated.likesCount });
        }

        // Fallback
        const fallbackList = readFallbackPosts();
        const post = fallbackList.find(p => p._id === id);
        if (!post) {
            return res.status(404).json({ success: false, error: "Témoignage introuvable." });
        }
        post.likesCount = (post.likesCount || 0) + 1;
        writeFallbackPosts(fallbackList);

        return res.json({ success: true, likesCount: post.likesCount });
    } catch (err) {
        console.error('❌ Erreur like post :', err);
        return res.status(500).json({ success: false, error: "Impossible de liker le témoignage." });
    }
});

/**
 * Helper de vérification des droits administrateur (Harmonisé avec routes/admin.js)
 */
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user || !req.session.user.authenticated) {
        return res.status(401).json({
            success: false,
            error: "Authentification requise pour effectuer cette action."
        });
    }

    const adminEmails = (process.env.ADMIN_EMAIL || 'artas971@gmail.com')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
    const userEmail = (req.session.user.email || '').trim().toLowerCase();
    const userRole = (req.session.user.role || '').trim().toLowerCase();
    const userName = (req.session.user.username || req.session.user.name || '').trim().toLowerCase();

    if (adminEmails.includes(userEmail) || userRole === 'admin' || userRole === 'testeur' || userName === 'john' || userName === 'steve' || userName.includes('admin')) {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: "Accès refusé. Action réservée à l'administrateur."
    });
}

/**
 * DELETE /api/posts/:id
 * Suppression définitive d'un témoignage (Admin uniquement)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (isDbConnected()) {
            if (id.match(/^[0-9a-fA-F]{24}$/)) {
                await Post.findByIdAndDelete(id);
            } else {
                await Post.findOneAndDelete({ $or: [{ _id: id }, { id: id }] });
            }
        }

        // Nettoyage systématique dans le fichier de repli posts.json
        let fallbackList = readFallbackPosts();
        fallbackList = fallbackList.filter(p => p._id !== id && p.id !== id);
        writeFallbackPosts(fallbackList);

        return res.json({ success: true, message: "Témoignage supprimé définitivement." });
    } catch (err) {
        console.error('❌ Erreur DELETE /api/posts/:id :', err);
        return res.status(500).json({ success: false, error: "Erreur lors de la suppression." });
    }
});

/**
 * PATCH /api/posts/:id/pin
 * Bascule l'état épinglé (isPinned) d'un témoignage (Admin uniquement)
 */
router.patch('/:id/pin', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { isPinned } = req.body;

        if (isDbConnected()) {
            let post = null;
            if (id.match(/^[0-9a-fA-F]{24}$/)) {
                post = await Post.findById(id);
            } else {
                post = await Post.findOne({ $or: [{ _id: id }, { id: id }] });
            }
            if (post) {
                post.isPinned = typeof isPinned === 'boolean' ? isPinned : !post.isPinned;
                await post.save();
                return res.json({ success: true, isPinned: post.isPinned, post });
            }
        }

        // Mode Fallback (JSON)
        const fallbackList = readFallbackPosts();
        const post = fallbackList.find(p => p._id === id || p.id === id);
        if (!post) {
            return res.status(404).json({ success: false, error: "Témoignage introuvable." });
        }

        post.isPinned = typeof isPinned === 'boolean' ? isPinned : !post.isPinned;
        writeFallbackPosts(fallbackList);
        return res.json({ success: true, isPinned: post.isPinned, post });
    } catch (err) {
        console.error('❌ Erreur PATCH /api/posts/:id/pin :', err);
        return res.status(500).json({ success: false, error: "Erreur lors de la mise à jour du statut d'épinglage." });
    }
});


module.exports = router;

