#!/usr/bin/env node
/**
 * Script CLI d'exécution et de test de sauvegarde MongoDB
 * Usage: node scripts/backup_mongodb.js
 */

const { connectDB } = require('../config/database');
const { performBackup, listBackups } = require('../services/backupService');

async function main() {
    console.log('[BACKUP RUNNER] Initialisation de la sauvegarde...');
    await connectDB();

    try {
        const result = await performBackup();
        console.log('\n--- RAPPORT DE SAUVEGARDE ---');
        console.log(JSON.stringify(result, null, 2));

        console.log('\n--- SAUVEGARDES DISPONIBLES SUR DISQUE ---');
        const list = listBackups();
        console.table(list);

        process.exit(0);
    } catch (err) {
        console.error('❌ Échec critique de la sauvegarde :', err);
        process.exit(1);
    }
}

main();
