const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, "L'identifiant de l'utilisateur est obligatoire"],
        index: true
    },
    username: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    title: {
        type: String,
        trim: true,
        default: "Vidéo sans titre",
        maxlength: [200, "Le titre ne peut pas dépasser 200 caractères"]
    },
    originalMediaName: {
        type: String,
        trim: true,
        default: "source_media"
    },
    targetLang: {
        type: String,
        enum: ['ar', 'fr'],
        default: 'fr'
    },
    duration: {
        type: Number,
        default: 0
    },
    fileSizeMb: {
        type: Number,
        default: 0
    },

    // Fichiers et livrables locaux
    mp4Url: {
        type: String,
        required: [true, "L'URL de la vidéo MP4 est obligatoire"]
    },
    mp4Filename: {
        type: String,
        required: [true, "Le nom du fichier MP4 est obligatoire"]
    },
    assUrl: {
        type: String,
        default: null
    },
    assFilename: {
        type: String,
        default: null
    },
    coverUrl: {
        type: String,
        default: null
    },
    coverFilename: {
        type: String,
        default: null
    },
    descFilename: {
        type: String,
        default: null
    },
    contextSummary: {
        type: String,
        default: ""
    },
    keywords: [{
        type: String,
        trim: true
    }],

    // Sauvegarde Cloud Google Drive (ARCH-1)
    drive: {
        status: {
            type: String,
            enum: ['pending', 'uploaded', 'failed_retry', 'failed', 'disabled'],
            default: 'pending',
            index: true
        },
        folderId: {
            type: String,
            default: null
        },
        folderLink: {
            type: String,
            default: null
        },
        mp4FileId: {
            type: String,
            default: null
        },
        assFileId: {
            type: String,
            default: null
        },
        uploadedAt: {
            type: Date,
            default: null
        },
        errorReason: {
            type: String,
            default: null
        }
    },

    costCredits: {
        type: Number,
        default: 1,
        min: 0
    },
    status: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'completed',
        index: true
    }
}, {
    timestamps: true,
    bufferCommands: false
});

// Index composé pour optimiser les requêtes d'historique personnel chronologique
VideoSchema.index({ user: 1, createdAt: -1 });
VideoSchema.index({ username: 1, createdAt: -1 });

module.exports = mongoose.model('Video', VideoSchema);
