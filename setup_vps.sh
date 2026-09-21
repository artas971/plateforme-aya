#!/usr/bin/env bash
# ==============================================================================
# Script de Provisioning Automatisé - Plateforme Aya
# Cible : Serveur VPS Hetzner Cloud CPX31 (Ubuntu 24.04 LTS)
# Rôle : Installation non-interactive de la stack complète (Node 20, Python 3.12,
#        FFmpeg avec polices ASS, Nginx, Certbot SSL, PM2 et environnement virtuel)
# ==============================================================================

set -euo pipefail

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[AYA SETUP] ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}[AYA SETUP] ✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}[AYA SETUP] ⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}[AYA SETUP] ❌ $1${NC}"
}

# ------------------------------------------------------------------------------
# 1. VÉRIFICATION DES PRIVILÈGES ROOT
# ------------------------------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    log_error "Ce script doit être exécuté en tant que root (ou via 'sudo bash setup_vps.sh')."
    exit 1
fi

APP_DIR="/var/www/aya"
APP_USER="aya"

log_info "Démarrage de l'installation automatisée pour Ubuntu 24.04 LTS..."
export DEBIAN_FRONTEND=noninteractive

# ------------------------------------------------------------------------------
# 2. MISES À JOUR SYSTÈME & OUTILS ESSENTIELS
# ------------------------------------------------------------------------------
log_info "Mise à jour des dépôts et paquets du système..."
apt-get update -y && apt-get upgrade -y

log_info "Installation des utilitaires système de base..."
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    ca-certificates \
    gnupg \
    ufw \
    unzip \
    htop

# ------------------------------------------------------------------------------
# 3. INSTALLATION DE NODE.JS 20 LTS (NodeSource) & PM2
# ------------------------------------------------------------------------------
log_info "Installation de Node.js 20 LTS..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list

apt-get update -y
apt-get install -y nodejs

log_info "Installation globale de PM2 & du gestionnaire de rotation des logs..."
npm install -g pm2 pm2-logrotate
# Configuration de la rotation des logs PM2 (max 10 Mo par fichier, conservation 7 jours)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
log_success "Node.js (${NODE_VER}) et npm (${NPM_VER}) installés avec succès."

# ------------------------------------------------------------------------------
# 4. INSTALLATION DE PYTHON 3.12, VIRTUALENV & DÉVELOPPEMENT
# ------------------------------------------------------------------------------
log_info "Installation de Python 3.12 et des outils d'environnement virtuel..."
apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev

PY_VER=$(python3 --version)
log_success "${PY_VER} installé."

# ------------------------------------------------------------------------------
# 5. INSTALLATION DE FFMPEG & DES POLICES ASS (ARABE & IMPACT)
# ------------------------------------------------------------------------------
log_info "Installation de FFmpeg et des bibliothèques de décodage/encodage..."
apt-get install -y \
    ffmpeg \
    libavcodec-extra

# Acceptation automatique de la licence Microsoft Core Fonts (Police 'Impact' pour TikTok)
echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections

log_info "Installation des polices pour le sous-titrage ASS (Impact, Noto Arabe, DejaVu)..."
apt-get install -y \
    ttf-mscorefonts-installer \
    fonts-noto-core \
    fonts-noto-extra \
    fonts-noto-ui-core \
    fonts-dejavu-core \
    fonts-freefont-ttf

# Rafraîchir le cache des polices système
fc-cache -f -v >/dev/null 2>&1 || true

FF_VER=$(ffmpeg -version | head -n 1)
log_success "FFmpeg opérationnel : ${FF_VER}"

# ------------------------------------------------------------------------------
# 6. INSTALLATION DE NGINX & CERTBOT (SSL/HTTPS)
# ------------------------------------------------------------------------------
log_info "Installation de Nginx et Certbot..."
apt-get install -y \
    nginx \
    certbot \
    python3-certbot-nginx

# ------------------------------------------------------------------------------
# 7. CRÉATION DU COMPTE UTILISATEUR SYSTÈME & STRUCTURE DU DOSSIER
# ------------------------------------------------------------------------------
log_info "Configuration de l'utilisateur applicatif '${APP_USER}' et du répertoire '${APP_DIR}'..."
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd -m -s /bin/bash "${APP_USER}"
    log_success "Utilisateur système '${APP_USER}' créé."
fi

mkdir -p "${APP_DIR}"
mkdir -p "${APP_DIR}/logs"
mkdir -p "${APP_DIR}/public/avatars"
mkdir -p "${APP_DIR}/fichiers_reponse_a_envoyer"
mkdir -p "${APP_DIR}/audio_a_traiter"
mkdir -p "${APP_DIR}/uploads"

# Si le script est exécuté depuis le répertoire du projet cloné, copie des fichiers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/server.js" ] && [ "${SCRIPT_DIR}" != "${APP_DIR}" ]; then
    log_info "Copie des fichiers de l'application vers ${APP_DIR}..."
    cp -r "${SCRIPT_DIR}/." "${APP_DIR}/"
fi

# ------------------------------------------------------------------------------
# 8. INITIALISATION DU VIRTUALENV PYTHON & DÉPENDANCES
# ------------------------------------------------------------------------------
log_info "Création de l'environnement virtuel Python dans ${APP_DIR}/venv..."
if [ ! -d "${APP_DIR}/venv" ]; then
    python3 -m venv "${APP_DIR}/venv"
fi

log_info "Mise à niveau de pip et installation des modules (requirements.txt)..."
"${APP_DIR}/venv/bin/pip" install --upgrade pip setuptools wheel

if [ -f "${APP_DIR}/requirements.txt" ]; then
    "${APP_DIR}/venv/bin/pip" install -r "${APP_DIR}/requirements.txt"
    log_success "Dépendances Python (faster-whisper, Pillow, yt-dlp) installées."
else
    log_warn "Fichier requirements.txt non trouvé dans ${APP_DIR}, installation directe des paquets recommandés..."
    "${APP_DIR}/venv/bin/pip" install faster-whisper Pillow yt-dlp edge-tts python-dotenv imageio-ffmpeg requests
fi

# ------------------------------------------------------------------------------
# 9. INSTALLATION DES DÉPENDANCES NODE.JS
# ------------------------------------------------------------------------------
log_info "Installation des dépendances npm..."
cd "${APP_DIR}"
if [ -f "package.json" ]; then
    npm install --omit=dev
    log_success "Modules Node.js installés."
fi

# Ajustement des permissions
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# ------------------------------------------------------------------------------
# 10. DÉPLOIEMENT DU BLOC DE CONFIGURATION NGINX
# ------------------------------------------------------------------------------
log_info "Déploiement de la configuration Nginx optimisée pour le streaming SSE..."
NGINX_CONF_SRC="${APP_DIR}/nginx/aya.conf"
NGINX_CONF_DEST="/etc/nginx/sites-available/aya"

if [ -f "${NGINX_CONF_SRC}" ]; then
    cp "${NGINX_CONF_SRC}" "${NGINX_CONF_DEST}"
else
    log_warn "Fichier ${NGINX_CONF_SRC} non trouvé. Utilisation de la configuration intégrée..."
    cat << 'EOF' > "${NGINX_CONF_DEST}"
upstream aya_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

limit_req_zone $binary_remote_addr zone=aya_auth_limit:10m rate=5r/s;

server {
    listen 80;
    listen [::]:80;
    server_name _;

    client_max_body_size 200M;
    client_body_buffer_size 128k;

    access_log /var/log/nginx/aya_access.log;
    error_log /var/log/nginx/aya_error.log warn;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    location /avatars/ {
        alias /var/www/aya/public/avatars/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files $uri @proxy_backend;
    }

    location /assets/ {
        alias /var/www/aya/public/assets/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files $uri @proxy_backend;
    }

    location ~ ^/api/traduction/(process|status) {
        proxy_pass http://aya_backend;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;

        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        send_timeout 600s;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location /api/auth/login {
        limit_req zone=aya_auth_limit burst=10 nodelay;
        proxy_pass http://aya_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://aya_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    location @proxy_backend {
        proxy_pass http://aya_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
fi

# Activation du site Nginx
ln -sf /etc/nginx/sites-available/aya /etc/nginx/sites-enabled/aya
rm -f /etc/nginx/sites-enabled/default

# Test de la configuration Nginx
nginx -t
systemctl restart nginx
log_success "Nginx configuré et redémarré."

# ------------------------------------------------------------------------------
# 11. CONFIGURATION DU PARE-FEU UFW
# ------------------------------------------------------------------------------
log_info "Configuration du pare-feu UFW (Ports 22, 80, 443)..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo "y" | ufw enable || true
log_success "Pare-feu UFW activé."

# ------------------------------------------------------------------------------
# 12. CONFIGURATION DU DÉMARRAGE SYSTEMD PM2
# ------------------------------------------------------------------------------
log_info "Configuration du service de démarrage automatique PM2..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" || true

# ------------------------------------------------------------------------------
# 13. INSTRUCTIONS FINALES
# ------------------------------------------------------------------------------
echo ""
echo "=========================================================================="
log_success "PROVISIONING DU VPS TERMINÉ AVEC SUCCÈS SUR HETZNER CPX31 !"
echo "=========================================================================="
echo ""
echo "📋 PROCHAINES ÉTAPES POUR FINALISER LA MISE EN LIGNE :"
echo ""
echo "1. Créer le fichier d'environnement de production :"
echo "   sudo nano ${APP_DIR}/.env"
echo "   (Définir NODE_ENV=production, SESSION_SECRET, MONGODB_URI, GEMINI_API_KEY, etc.)"
echo ""
echo "2. Lancer l'application sous l'utilisateur '${APP_USER}' avec PM2 :"
echo "   sudo -u ${APP_USER} -i"
echo "   cd ${APP_DIR}"
echo "   pm2 start ecosystem.config.js --env production"
echo "   pm2 save"
echo "   exit"
echo ""
echo "3. Lier votre nom de domaine avec SSL/HTTPS (Certbot) :"
echo "   sudo certbot --nginx -d votre-domaine.com"
echo ""
echo "4. Consulter les logs de l'application :"
echo "   pm2 logs aya-platform"
echo "=========================================================================="
echo ""
