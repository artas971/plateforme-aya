#!/usr/bin/env bash
# ==============================================================================
# Cron de Nettoyage Automatisé NVMe - Aya Studio (VPS Hetzner)
# Ticket GitHub : #27 (TICKET-09)
#
# Installation dans crontab (utilisateur aya ou root) :
# 0 * * * * /var/www/aya/scripts/cron_cleanup_disk.sh >> /var/www/aya/logs/cron_gc.log 2>&1
# ==============================================================================

set -euo pipefail

APP_DIR="/var/www/aya"
LOGS_DIR="${APP_DIR}/logs"
mkdir -p "${LOGS_DIR}"

DATE_TAG=$(date +"%Y-%m-%d %H:%M:%S")
echo "[${DATE_TAG}] [CRON GC] Démarrage du cycle de nettoyage NVMe..."

# 1. Purge des audios orphelins temporaires (> 2h / 120 minutes)
if [ -d "${APP_DIR}/audio_a_traiter" ]; then
    find "${APP_DIR}/audio_a_traiter" -type f ! -name ".git*" ! -name "README.md" -mmin +120 -delete
fi

# 2. Rotation des vidéos et audios générés (> 48h / 2880 minutes)
if [ -d "${APP_DIR}/fichiers_reponse_a_envoyer" ]; then
    find "${APP_DIR}/fichiers_reponse_a_envoyer" -type f ! -name ".git*" ! -name "README.md" -mmin +2880 -delete
fi

# 3. Purge du dossier temp (> 2h)
if [ -d "${APP_DIR}/temp" ]; then
    find "${APP_DIR}/temp" -type f ! -name ".git*" ! -name "README.md" -mmin +120 -delete
fi

# 4. Exécution du collecteur applicatif Node.js pour trace JSON et métriques
if [ -x "$(command -v node)" ]; then
    cd "${APP_DIR}" && node scripts/run_garbage_collector.js >> "${LOGS_DIR}/cron_gc.log" 2>&1 || true
fi

echo "[$(date +"%Y-%m-%d %H:%M:%S")] [CRON GC] Cycle de nettoyage terminé."
