const fs = require('fs');
const path = require('path');
const { exec, spawn, execFile } = require('child_process');
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
 * Lance un processus fils avec priorité CPU abaissée ('nice -n 15' sous Linux/POSIX)
 * pour immuniser la boucle d'événements Node.js et les services système contre la famine CPU.
 * Sous Windows, exécute un spawn standard de manière transparente.
 *
 * @param {string} command - Commande ou binaire à exécuter
 * @param {Array<string>} [args=[]] - Arguments
 * @param {object} [options={}] - Options child_process.spawn
 * @returns {ChildProcess}
 */
function spawnNice(command, args = [], options = {}) {
    if (process.platform !== 'win32') {
        const niceLevel = process.env.AYA_NICE_PRIORITY || '15';
        return spawn('nice', ['-n', String(niceLevel), command, ...args], options);
    }
    return spawn(command, args, options);
}

/**
 * Exécute un binaire avec priorité CPU abaissée ('nice -n 15' sous Linux/POSIX).
 * Sous Windows, exécute un execFile standard de manière transparente.
 *
 * @param {string} file - Chemin du binaire
 * @param {Array<string>} args - Arguments
 * @param {object} [options] - Options
 * @param {function} callback - Callback d'exécution
 * @returns {ChildProcess}
 */
function execFileNice(file, args, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    if (process.platform !== 'win32') {
        const niceLevel = process.env.AYA_NICE_PRIORITY || '15';
        return execFile('nice', ['-n', String(niceLevel), file, ...args], options, callback);
    }
    return execFile(file, args, options, callback);
}

/**
 * Adapte une commande textuelle contenant un appel Python ('py script.py ...' ou 'python script.py ...')
 * pour substituer le binaire dynamique ('python3', 'py', ou chemin venv),
 * et injecter 'nice -n 15' sous Linux/POSIX pour les calculs lourds.
 *
 * @param {string} command - Ex: "py open_explorer.py 'path'"
 * @param {boolean} [useNice=true] - Applique nice -n 15 sous POSIX si activé
 * @returns {string} - Ex: "nice -n 15 /path/to/venv/bin/python3 open_explorer.py 'path'"
 */
function formatPythonCommand(command, useNice = true) {
    if (!command || typeof command !== 'string') return command;
    const bin = getPythonBin();
    const formattedBin = bin.includes(' ') ? `"${bin}"` : bin;
    let formatted = command.replace(/^(py|python)\s+/, `${formattedBin} `);
    if (useNice && process.platform !== 'win32' && !formatted.startsWith('nice ')) {
        const niceLevel = process.env.AYA_NICE_PRIORITY || '15';
        formatted = `nice -n ${niceLevel} ${formatted}`;
    }
    return formatted;
}

module.exports = {
    getPythonBin,
    killProcessTree,
    formatPythonCommand,
    spawnNice,
    execFileNice,
    ROOT_DIR
};

