const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const LEDGER_PATH = path.join(__dirname, '..', 'drive_synced_files.json');

// GET /api/drive/status
router.get('/status', (req, res) => {
    const isConfigured = Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID && (process.env.GOOGLE_SERVICE_ACCOUNT_FILE || fs.existsSync(path.join(__dirname, '..', 'google_service_account.json'))));
    let syncedCount = 0;
    let lastSynced = null;

    if (fs.existsSync(LEDGER_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
            const files = Object.values(data.synced_files || {});
            syncedCount = files.length;
            if (syncedCount > 0) {
                lastSynced = files[files.length - 1];
            }
        } catch (e) {
            console.error('[DRIVE] Erreur lecture registre :', e.message);
        }
    }

    res.json({
        configured: isConfigured,
        folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
        totalSyncedFiles: syncedCount,
        lastSynced: lastSynced
    });
});

// POST /api/drive/sync
router.post('/sync', (req, res) => {
    const autoProcess = Boolean(req.body && req.body.auto_process);
    const scriptPath = path.join(__dirname, '..', 'sync_google_drive.py');
    const args = [scriptPath];

    if (autoProcess) {
        args.push('--auto-process');
    }

    const pyProcess = spawn('py', args, { cwd: path.join(__dirname, '..') });
    let stdoutData = '';
    let stderrData = '';

    pyProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
    });

    pyProcess.on('close', (code) => {
        if (code === 0) {
            res.json({
                success: true,
                output: stdoutData.trim()
            });
        } else {
            res.status(500).json({
                success: false,
                error: stderrData.trim() || stdoutData.trim()
            });
        }
    });
});

module.exports = router;
