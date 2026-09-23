const mongoose = require('mongoose');

const FeedbackRatingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    username: {
        type: String,
        default: "Anonyme",
        trim: true
    },
    userEmail: {
        type: String,
        default: null,
        trim: true
    },
    serviceType: {
        type: String,
        required: true,
        enum: ['traduction', 'studio', 'audio', 'chat', 'communaute'],
        default: 'traduction'
    },
    jobId: {
        type: String,
        default: null,
        index: true
    },
    mediaFilename: {
        type: String,
        default: null
    },
    rating: {
        type: Number,
        required: [true, "La note (1 à 5 étoiles) est obligatoire"],
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        default: "",
        trim: true,
        maxlength: [2000, "Le commentaire ne peut pas dépasser 2000 caractères"]
    },
    aiAnalysis: {
        analyzed: { type: Boolean, default: false },
        faultType: { 
            type: String, 
            enum: ['APPLICATION_ERROR', 'USER_MISTAKE', 'QUALITY_SATISFACTION', 'UNKNOWN'], 
            default: 'UNKNOWN' 
        },
        diagnosis: { type: String, default: "" },
        refundRecommended: { type: Boolean, default: false },
        suggestedCredits: { type: Number, default: 1 }
    },
    refundStatus: {
        type: String,
        enum: ['none', 'pending_approval', 'approved', 'rejected'],
        default: 'none',
        index: true
    },
    refundedAt: {
        type: Date,
        default: null
    },
    refundedBy: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

FeedbackRatingSchema.index({ rating: 1, createdAt: -1 });
FeedbackRatingSchema.index({ refundStatus: 1 });

module.exports = mongoose.model('FeedbackRating', FeedbackRatingSchema);
