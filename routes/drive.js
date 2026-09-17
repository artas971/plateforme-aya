const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const LEDGER_PATH = path.join(__dirname, '..', 'drive_synced_files.json');

const { getDriveWorkerStatus, processDriveQueue } = require('../services/driveWorker');

// GET /api/drive/status
router.get('/status', (req, res) => {
    try {
        const status = getDriveWorkerStatus();
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/drive/sync : Déclenchement d'un scan immédiat à la demande
router.post('/sync', async (req, res) => {
    const status = getDriveWorkerStatus();
    if (!status.configured) {
        return res.status(400).json({
            success: false,
            error: "Google Drive non configuré. Renseignez GOOGLE_DRIVE_FOLDER_ID et google_service_account.json."
        });
    }

    if (status.isProcessing) {
        return res.json({
            success: true,
            message: "Un traitement Drive est déjà en cours d'exécution."
        });
    }

    // Déclenchement asynchrone non-bloquant
    processDriveQueue().catch(err => console.error('[API DRIVE SYNC ERROR]', err.message));

    res.json({
        success: true,
        message: "Scan Google Drive déclenché avec succès."
    });
});

module.exports = router;
