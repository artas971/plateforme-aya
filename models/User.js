const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Le nom de l'utilisateur est obligatoire"],
        trim: true,
        maxlength: [80, "Le nom ne peut pas dépasser 80 caractères"]
    },
    email: {
        type: String,
        required: [true, "L'adresse email est obligatoire"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "Format d'adresse email invalide"]
    },
    password: {
        type: String,
        required: [true, "Le mot de passe est obligatoire"],
        minlength: [6, "Le mot de passe doit contenir au moins 6 caractères"],
        select: false // Protège contre l'exposition involontaire lors des requêtes find()
    },
    role: {
        type: String,
        enum: ['visiteur', 'contributeur', 'membre_engage', 'moderateur', 'admin'],
        default: 'visiteur'
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
    avatar: {
        type: String,
        default: null
    }
}, {
    timestamps: true
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

// Méthode de sérialisation JSON sécurisée
UserSchema.methods.toJSON = function () {
    const userObject = this.toObject();
    delete userObject.password;
    return userObject;
};

module.exports = mongoose.model('User', UserSchema);
