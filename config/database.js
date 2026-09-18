const mongoose = require('mongoose');

/**
 * Gestionnaire de Connexion Base de Données MongoDB (Mongoose)
 * Conçu par l'Agent Thomas (Architecte Back-End)
 */
async function connectDB() {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/plateforme_aya';

    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            autoIndex: true
        });

        console.log(`✅ [DATABASE] Base de données MongoDB connectée avec succès sur : ${conn.connection.host}/${conn.connection.name}`);

        mongoose.connection.on('error', (err) => {
            console.error(`❌ [DATABASE ERROR] Perte de connexion MongoDB :`, err.message);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn(`⚠️ [DATABASE WARNING] MongoDB déconnecté.`);
        });

        return conn;
    } catch (err) {
        console.warn(`⚠️ [DATABASE WARNING] Connexion MongoDB indisponible (${err.message}).`);
        console.warn(`ℹ️ [DATABASE] Le serveur fonctionne normalement en mode autonome. Démarrez MongoDB ou configurez MONGODB_URI dans votre .env pour activer la persistance.`);
        return null;
    }
}

function isDbConnected() {
    return mongoose.connection.readyState === 1;
}

module.exports = {
    connectDB,
    isDbConnected,
    mongoose
};
