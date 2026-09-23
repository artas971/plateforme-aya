const mongoose = require('mongoose');

const FailureReportSchema = new mongoose.Schema({
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
    jobId: {
        type: String,
        default: null,
        index: true
    },
    serviceType: {
        type: String,
        required: true,
        enum: ['traduction', 'studio', 'audio', 'vostfr', 'job'],
        default: 'traduction'
    },
    component: {
        type: String,
        required: true,
        default: 'General'
    },
    mediaUrl: {
        type: String,
        default: null
    },
    inputParams: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    errorMessage: {
        type: String,
        required: true
    },
    errorStack: {
        type: String,
        default: ""
    },
    aiDiagnosis: {
        analyzed: { type: Boolean, default: false },
        cause: { type: String, default: "" },
        technicalExplanation: { type: String, default: "" },
        proposedFix: { type: String, default: "" },
        suggestedAction: { type: String, default: "MANUAL_REVIEW" }
    },
    status: {
        type: String,
        enum: ['pending_admin_review', 'approved_and_retried', 'rejected_archived'],
        default: 'pending_admin_review',
        index: true
    },
    reviewedBy: {
        type: String,
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

FailureReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('FailureReport', FailureReportSchema);
