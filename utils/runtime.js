const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Résout dynamiquement l'interpréteur Python approprié selon l'OS et l'environnement :
 * 1. Variable d'environnement PYTHON_BIN si fournie (ex: /usr/bin/python3 ou /path/to/venv/bin/python3)
 * 2. Environnement virtuel local si présent (./venv/Scripts/python.exe sous Win, ./venv/bin/python3 sous Linux)
 * 3. 'py' sous Windows (standard Windows Python Launcher)
 * 4. 'python3' sous Linux / macOS / POSIX
 *
 * @returns {string} Le binaire ou la commande Python à invoquer
 */
function getPythonBin() {
    if (process.env.PYTHON_BIN && process.env.PYTHON_BIN.trim().length > 0) {
        return process.env.PYTHON_BIN.trim();
    }

    const isWin = process.platform === 'win32';

    // Détection d'un éventuel environnement virtuel local (venv ou .venv)
    const venvCandidates = isWin
        ? [
            path.join(ROOT_DIR, 'venv', 'Scripts', 'python.exe'),
            path.join(ROOT_DIR, '.venv', 'Scripts', 'python.exe')
        ]
        : [
            path.join(ROOT_DIR, 'venv', 'bin', 'python3'),
            path.join(ROOT_DIR, 'venv', 'bin', 'python'),
            path.join(ROOT_DIR, '.venv', 'bin', 'python3'),
            path.join(ROOT_DIR, '.venv', 'bin', 'python')
        ];

    for (const cand of venvCandidates) {
        if (fs.existsSync(cand)) {
            return cand;
        }
    }

    // Défaut standard cross-platform
    return isWin ? 'py' : 'python3';
}

/**
 * Neutralise un arbre complet de processus (le parent et tous ses enfants/workers)
 * de manière fiable sous Windows (taskkill /T /F) et POSIX (pkill -P && kill -9).
 * Évite les crashs, les processus orphelins (zombies) et les exceptions EPERM/ESRCH.
 *
 * @param {number|string} pid - ID du processus
 * @param {string} [contextTag='PROCESS_KILL'] - Tag pour les logs
 * @returns {Promise<void>}
 */
function killProcessTree(pid, contextTag = 'PROCESS_KILL') {
    if (!pid || isNaN(Number(pid))) return Promise.resolve();

    const targetPid = Number(pid);

    return new Promise((resolve) => {
        try {
            if (process.platform === 'win32') {
                exec(`taskkill /PID ${targetPid} /T /F`, (err) => {
                    if (err) {
                        console.warn(`[${contextTag}] ⚠️ Avertissement taskkill (PID: ${targetPid}) :`, err.message);
                    } else {
                        console.log(`[${contextTag}] 🛑 Arbre de processus PID ${targetPid} neutralisé avec succès (Windows taskkill).`);
                    }
                    resolve();
                });
            } else {
                // Sous Linux / POSIX :
                // 1. On termine d'abord gracieusement puis par la force les processus fils (pkill -P)
                // 2. On neutralise le processus parent lui-même (kill -9)
                // Le || true empêche une sortie d'erreur shell si un sous-processus s'est déjà arrêté
                const cmd = `pkill -TERM -P ${targetPid} 2>/dev/null || true; sleep 0.1; pkill -KILL -P ${targetPid} 2>/dev/null || true; kill -9 ${targetPid} 2>/dev/null || true`;
                exec(cmd, (err) => {
                    if (err) {
                        console.warn(`[${contextTag}] ⚠️ Avertissement terminaison POSIX (PID: ${targetPid}) :`, err.message);
                    } else {
                        console.log(`[${contextTag}] 🛑 Arbre de processus PID ${targetPid} neutralisé avec succès (Linux/POSIX pkill).`);
                    }
                    resolve();
                });
            }
        } catch (err) {
            console.warn(`[${contextTag}] ⚠️ Exception lors de l'arrêt du processus PID ${targetPid} :`, err.message);
            resolve();
        }
    });
}

/**
 * Adapte une commande textuelle contenant un appel Python ('py script.py ...' ou 'python script.py ...')
 * pour substituer le binaire dynamique ('python3', 'py', ou chemin venv).
 *
 * @param {string} command - Ex: "py open_explorer.py 'path'"
 * @returns {string} - Ex: "python3 open_explorer.py 'path'" ou "./venv/bin/python3 open_explorer.py 'path'"
 */
function formatPythonCommand(command) {
    if (!command || typeof command !== 'string') return command;
    const bin = getPythonBin();
    const formattedBin = bin.includes(' ') ? `"${bin}"` : bin;
    return command.replace(/^(py|python)\s+/, `${formattedBin} `);
}

module.exports = {
    getPythonBin,
    killProcessTree,
    formatPythonCommand,
    ROOT_DIR
};
