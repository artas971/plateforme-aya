const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DEFAULT_AVATAR_URL = '/assets/tiktok_app_icon_1024x1024.png';

const UserSchema = new mongoose.Schema({
    // Ticket 1 : Pseudonyme type TikTok (ex: @pseudonyme), unique et requis
    username: {
        type: String,
        required: [true, "Le pseudonyme est obligatoire"],
        unique: true,
        trim: true,
        lowercase: true,
        minlength: [3, "Le pseudonyme doit comporter au moins 3 caractères"],
        maxlength: [30, "Le pseudonyme ne peut pas dépasser 30 caractères"],
        set: (val) => {
            if (!val) return val;
            const cleaned = val.trim().toLowerCase();
            return cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
        },
        match: [/^@[a-z0-9_.]{3,30}$/, "Le pseudonyme ne peut contenir que des lettres minuscules, chiffres, tirets bas (_) et points (.)"]
    },

    // Ticket 1 : Adresse email requise & unique avec statut booléen de confirmation
    email: {
        type: String,
        required: [true, "L'adresse email est obligatoire"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "Format d'adresse email invalide"]
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String,
        select: false,
        default: null
    },
    verificationTokenExpires: {
        type: Date,
        select: false,
        default: null
    },
    resetPasswordToken: {
        type: String,
        select: false,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        select: false,
        default: null
    },

    // Ticket 1 : Mot de passe haché et sécurisé
    password: {
        type: String,
        required: [true, "Le mot de passe est obligatoire"],
        minlength: [8, "Le mot de passe doit comporter au moins 8 caractères"],
        select: false // Protège contre l'exposition involontaire lors des requêtes find()
    },

    // Ticket 1 : Informations facultatives
    firstName: {
        type: String,
        trim: true,
        default: '',
        maxlength: [50, "Le prénom ne peut pas dépasser 50 caractères"]
    },
    lastName: {
        type: String,
        trim: true,
        default: '',
        maxlength: [50, "Le nom ne peut pas dépasser 50 caractères"]
    },

    // Nom complet (conservé pour rétrocompatibilité)
    name: {
        type: String,
        trim: true,
        maxlength: [100, "Le nom ne peut pas dépasser 100 caractères"],
        default: function () {
            const full = `${this.firstName || ''} ${this.lastName || ''}`.trim();
            return full || this.username || 'Utilisateur';
        }
    },

    // Ticket 1 : Avatar avec fallback constant
    avatar: {
        type: String,
        default: DEFAULT_AVATAR_URL,
        set: (v) => (!v || !v.trim() ? DEFAULT_AVATAR_URL : v.trim())
    },

    role: {
        type: String,
        enum: ['visiteur', 'contributeur', 'membre_engage', 'moderateur', 'admin'],
        default: 'contributeur'
    },
    subscriptionStatus: {
        type: String,
        enum: ['free', 'active', 'past_due', 'canceled'],
        default: 'free'
    },
    subscriptionPlan: {
        type: String,
        enum: ['none', 'monthly_support', 'annual_support', 'patron'],
        default: 'none'
    },
    stripeCustomerId: {
        type: String,
        default: null
    },
    preferredLang: {
        type: String,
        enum: ['fr', 'ar'],
        default: 'fr'
    },

    // Ticket 3 : Portefeuille virtuel (Wallet V2.1)
    credits: {
        type: Number,
        default: 5, // 5 crédits offerts par défaut
        min: [0, "Le solde de crédits ne peut pas être inférieur à 0"]
    },
    creditsReserved: {
        type: Number,
        default: 0,
        min: [0, "Les crédits réservés ne peuvent pas être inférieurs à 0"]
    }
}, {
    timestamps: true,
    bufferCommands: false
});

// Middleware Mongoose : Hashage automatique du mot de passe avant sauvegarde
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Méthode d'instance : Comparaison du mot de passe
UserSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Méthode de sérialisation JSON sécurisée (suppression des champs sensibles)
UserSchema.methods.toJSON = function () {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.verificationToken;
    delete userObject.verificationTokenExpires;
    delete userObject.resetPasswordToken;
    delete userObject.resetPasswordExpires;
    return userObject;
};

// Export de la constante DEFAULT_AVATAR_URL pour réutilisation transverse
module.exports = mongoose.model('User', UserSchema);
module.exports.DEFAULT_AVATAR_URL = DEFAULT_AVATAR_URL;
