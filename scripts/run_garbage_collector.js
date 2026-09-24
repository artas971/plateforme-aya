#!/usr/bin/env node
/**
 * Script CLI / Cron pour le Garbage Collection du Disque NVMe
 * Usage :
 *   node scripts/run_garbage_collector.js
 *   node scripts/run_garbage_collector.js --dry-run
 */

const { runGarbageCollection } = require('../services/garbageCollectorService');

const isDryRun = process.argv.includes('--dry-run');

console.log(`[AYA DISK GC] Démarrage du Garbage Collector Disque (${isDryRun ? 'DRY-RUN / Simulation' : 'MODE RÉEL'})...`);

try {
    const report = runGarbageCollection({ dryRun: isDryRun });
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
} catch (err) {
    console.error('[AYA DISK GC] Erreur fatale durant le nettoyage :', err);
    process.exit(1);
}
