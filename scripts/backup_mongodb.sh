#!/usr/bin/env bash
# ==============================================================================
# Script de Sauvegarde Automatique MongoDB & Disaster Recovery - Plateforme Aya
# VPS Hetzner CPX31 (Ubuntu 24.04 LTS)
# Ticket GitHub : #28 (TICKET-10)
#
# Planification recommandée crontab (quotidien à 03h00 du matin) :
# 0 3 * * * /var/www/aya/scripts/backup_mongodb.sh >> /var/www/aya/logs/cron_backup.log 2>&1
# ==============================================================================

set -euo pipefail

APP_DIR="/var/www/aya"
BACKUP_DIR="${APP_DIR}/backups/mongodb"
LOGS_DIR="${APP_DIR}/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="mongo_backup_${TIMESTAMP}"
TARGET_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

mkdir -p "${BACKUP_DIR}" "${LOGS_DIR}"

echo "===================================================================="
echo "[$(date +"%Y-%m-%d %H:%M:%S")] [BACKUP MONGO] Démarrage de la sauvegarde..."

# 1. Chargement des variables d'environnement si .env existe
if [ -f "${APP_DIR}/.env" ]; then
    # Extraction sécurisée des clés de backup
    BACKUP_KEY=$(grep -E '^BACKUP_ENCRYPTION_KEY=' "${APP_DIR}/.env" | cut -d '=' -f2- || echo "")
    MONGO_URI=$(grep -E '^MONGODB_URI=' "${APP_DIR}/.env" | cut -d '=' -f2- || echo "mongodb://127.0.0.1:27017/plateforme_aya")
else
    BACKUP_KEY=""
    MONGO_URI="mongodb://127.0.0.1:27017/plateforme_aya"
fi

# 2. Exécution du dump MongoDB
echo "[$(date +"%Y-%m-%d %H:%M:%S")] [BACKUP MONGO] Dump en cours via mongodump..."
if command -v mongodump &> /dev/null; then
    mongodump --uri="${MONGO_URI}" --out="${TARGET_PATH}" --gzip
else
    echo "⚠️ [BACKUP MONGO] Binaire mongodump absent. Utilisation de l'outil Node.js..."
    cd "${APP_DIR}" && node scripts/backup_mongodb.js "${TARGET_PATH}"
fi

# 3. Archivage Tarball
ARCHIVE_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
tar -czf "${ARCHIVE_FILE}" -C "${BACKUP_DIR}" "${BACKUP_NAME}"
rm -rf "${TARGET_PATH}"
echo "[$(date +"%Y-%m-%d %H:%M:%S")] [BACKUP MONGO] Archive compressée créée : ${ARCHIVE_FILE}"

# 4. Chiffrement GPG (si clé fournie)
FINAL_FILE="${ARCHIVE_FILE}"
if [ -n "${BACKUP_KEY}" ]; then
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] [BACKUP MONGO] Chiffrement AES-256 GPG en cours..."
    GPG_FILE="${ARCHIVE_FILE}.gpg"
    echo "${BACKUP_KEY}" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 -o "${GPG_FILE}" "${ARCHIVE_FILE}"
    rm -f "${ARCHIVE_FILE}"
    FINAL_FILE="${GPG_FILE}"
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] [BACKUP MONGO] Sauvegarde chiffrée : ${FINAL_FILE}"
fi

# 5. Calcul Checksum SHA-256
sha256sum "${FINAL_FILE}" > "${FINAL_FILE}.sha256"

# 6. Synchronisation Distante Hetzner Storage Box / S3 (Optionnel)
REMOTE_DEST=$(grep -E '^BACKUP_REMOTE_DEST=' "${APP_DIR}/.env" 2>/dev/null | cut -d '=' -f2- || echo "")
if [ -n "${REMOTE_DEST}" ]; then
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] [BACKUP MONGO] Synchronisation distante vers ${REMOTE_DEST}..."
    rsync -avz -e "ssh -o StrictHostKeyChecking=no" "${FINAL_FILE}"* "${REMOTE_DEST}" || echo "⚠️ Échec sync distante"
fi

# 7. Rétention Glissante 7 Jours (Suppression des sauvegardes de plus de 7 jours)
echo "[$(date +"%Y-%m-%d %H:%M:%S")] [BACKUP MONGO] Application de la rétention 7 jours..."
find "${BACKUP_DIR}" -name "mongo_backup_*" -type f -mtime +7 -delete

echo "[$(date +"%Y-%m-%d %H:%M:%S")] [BACKUP MONGO] Sauvegarde complétée avec succès !"
echo "===================================================================="
