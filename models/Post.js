const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    authorName: {
        type: String,
        default: "Anonyme",
        trim: true
    },
    mediaType: {
        type: String,
        required: [true, "Le type de média est obligatoire"],
        enum: ['text', 'audio', 'video', 'announcement'],
        default: 'text'
    },
    originalContent: {
        type: String,
        required: [true, "Le contenu texte original est obligatoire"],
        trim: true,
        maxlength: [5000, "Le contenu ne peut pas dépasser 5000 caractères"]
    },
    translatedContent: {
        type: String,
        default: "",
        trim: true
    },
    sourceLang: {
        type: String,
        default: "auto"
    },
    targetLang: {
        type: String,
        default: "ar"
    },
    mediaUrl: {
        type: String,
        default: null
    },
    mediaThumbnail: {
        type: String,
        default: null
    },
    tags: [{
        type: String,
        trim: true
    }],
    moderationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    moderatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    moderationNotes: {
        type: String,
        default: null
    },
    moderatedAt: {
        type: Date,
        default: null
    },
    likesCount: {
        type: Number,
        default: 0
    },
    viewsCount: {
        type: Number,
        default: 0
    },
    sharesCount: {
        type: Number,
        default: 0
    },
    isPinned: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexation pour le fil d'actualité public
PostSchema.index({ moderationStatus: 1, createdAt: -1 });
PostSchema.index({ tags: 1 });

module.exports = mongoose.model('Post', PostSchema);
