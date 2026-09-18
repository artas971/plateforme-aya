const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    donorEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: null
    },
    donorName: {
        type: String,
        trim: true,
        default: "Donateur Anonyme"
    },
    provider: {
        type: String,
        required: [true, "Le fournisseur de paiement est obligatoire (stripe ou paypal)"],
        enum: ['stripe', 'paypal']
    },
    type: {
        type: String,
        required: [true, "Le type de transaction est obligatoire (donation ou subscription)"],
        enum: ['donation', 'subscription']
    },
    amount: {
        type: Number,
        required: [true, "Le montant est obligatoire"],
        min: [0.5, "Le montant minimum est de 0.50 EUR"]
    },
    currency: {
        type: String,
        default: 'EUR',
        uppercase: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'succeeded', 'failed', 'refunded'],
        default: 'pending',
        index: true
    },
    paymentMethod: {
        type: String,
        default: 'card'
    },
    providerTransactionId: {
        type: String,
        default: null,
        index: true
    },
    providerSubscriptionId: {
        type: String,
        default: null,
        index: true
    },
    receiptUrl: {
        type: String,
        default: null
    },
    metadata: {
        type: Map,
        of: String,
        default: {}
    }
}, {
    timestamps: true
});

// Indexation pour les historiques et statistiques financières
TransactionSchema.index({ provider: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
