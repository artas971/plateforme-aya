const mongoose = require('mongoose');

const WordItemSchema = new mongoose.Schema({
    french: {
        type: String,
        required: true,
        trim: true
    },
    arabic: {
        type: String,
        required: true,
        trim: true
    },
    phoneticFr: {
        type: String,
        trim: true
    },
    phoneticAr: {
        type: String,
        trim: true
    },
    icon: {
        type: String,
        default: "✨"
    },
    ttsFrench: {
        type: String,
        trim: true
    },
    ttsArabic: {
        type: String,
        trim: true
    }
}, { _id: false });

const CardSchema = new mongoose.Schema({
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
    theme: {
        type: String,
        required: true,
        trim: true,
        default: 'Général'
    },
    level: {
        type: String,
        enum: ['debutant', 'intermediaire', 'avance'],
        default: 'debutant'
    },
    titleFr: {
        type: String,
        trim: true,
        default: "FICHE VOCABULAIRE"
    },
    titleAr: {
        type: String,
        trim: true,
        default: "بطاقة مفردات"
    },
    imageUrl: {
        type: String,
        required: [true, "L'URL de l'image est obligatoire"]
    },
    imageFilename: {
        type: String,
        default: null
    },
    audioUrl: {
        type: String,
        required: [true, "L'URL de l'audio est obligatoire"]
    },
    audioFilename: {
        type: String,
        default: null
    },
    words: [WordItemSchema],
    costCredits: {
        type: Number,
        default: 1
    },
    status: {
        type: String,
        enum: ['completed', 'failed', 'processing'],
        default: 'completed'
    }
}, {
    timestamps: true,
    bufferCommands: false
});

module.exports = mongoose.model('Card', CardSchema);
