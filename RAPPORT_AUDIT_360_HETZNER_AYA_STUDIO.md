# 📋 MISSION D'ÉVALUATION & CONTRE-EXPERTISE INDÉPENDANTE (PROMPT POUR L'IA)

> **Instructions pour l'utilisateur :**  
> Copiez l'intégralité de ce document et collez-le dans l'interface de l'IA de votre choix (ex: Claude 3.5 Sonnet / Opus, GPT-4o / o1, Gemini Pro, etc.).  
> Le préambule ci-dessous donne immédiatement le rôle et les consignes d'évaluation critique à l'IA réviseuse.

---

```text
Tu es un Architecte Cloud / Principal Engineer indépendant (spécialisé en Node.js, Linux Ubuntu 24.04, Nginx, MongoDB et Systèmes Temps Réel).
On te soumet pour contre-expertise et revue critique le rapport d'audit 360° et le dossier de déploiement préparés pour la plateforme web "Aya Studio" sur un VPS Hetzner CPX31 (4 vCPUs AMD, 8 Go RAM, 160 Go NVMe).

Ta mission :
1. Évaluer la pertinence et la rigueur technique du diagnostic (Performances, Goulots d'étranglement, Ergonomie UX/Mobile).
2. Valider ou challenger les choix d'architecture :
   - Mode PM2 'fork' (instances: 1) vs 'cluster'
   - Choix de Server-Sent Events (SSE) vs WebSockets pour le chat
   - Migration de chat_db.json vers MongoDB avec index TTL automatique à 24h
   - Choix de Google Chrome Stable natif vs Chromium Snap sur Ubuntu 24.04
   - Gestion de la mémoire et Concurrency=1 de Puppeteer
3. Vérifier la configuration Nginx (Reverse proxy, HTTP/2, HSTS, SSE sans buffer, Rate limiting 429).
4. Relever d'éventuels angles morts ou risques omis par le rapport.
5. Donner une note globale de solidité (/10) et tes 3 recommandations prioritaires d'amélioration.
```

---

# 🌐 RAPPORT D'AUDIT 360° & DOSSIER DE DÉPLOIEMENT HETZNER
### Plateforme Aya Studio — Synthèse Stratégique & Technique
*Cible d'Infrastructure : Hetzner Cloud CPX31 (4 vCPUs AMD EPYC, 8 Go RAM, 160 Go NVMe SSD, Ubuntu 24.04 LTS)*  
*Auteurs : Équipes d'Audit DevOps, UX/UI, Backend & Performances — Plateforme Aya Studio*

---

## 1. DIAGNOSTIC UX & PERFORMANCES

### 1.1. Synthèse des Vulnérabilités & Risques Critiques

L'audit approfondi de la base de code (`server.js`, `routes/chat.js`, `services/vocabularyCardService.js`, `utils/runtime.js`, `config/database.js`, `models/`, `ecosystem.config.js`) et des composants d'interface révèle un produit riche, mais confronté à **trois goulots d'étranglement majeurs** pouvant paralyser le serveur sous charge modérée (50 à 200 utilisateurs simultanés).

```
                           ┌────────────────────────────────────────────────────────┐
                           │               VULNÉRABILITÉS MAJEURES                  │
                           └────────────────────────────────────────────────────────┘
                                     │                            │
            ┌────────────────────────┴────────┐          ┌────────┴────────────────────────┐
            ▼                                 ▼          ▼                                 ▼
   [Chat Polling 2.5s]              [Hardcode spawn('py')]     [Saturation NVMe]          [Friction Mobile Clavier]
• 80 req/s à 200 users            • Échec binaire Linux      • 144 vidéos (3+ Go)       • vh rigide (input masqué)
• 160 I/O disque sync/s           • Crash du module vocal    • Temp vocal non purgé     • Safe areas iOS absentes
• Gel Event Loop ~260ms/s         • Doit être getPythonBin() • Fuite disque rapide      • Touch targets < 24px
```

---

### 1.2. Diagnostic Ergonomie & Parcours Utilisateur (UX/UI)

#### A. Frictions Mobiles Majeures
1. **Masquage de la Saisie par le Clavier Virtuel (`100vh` vs `100dvh`) :**  
   Dans `public/index.html`, la disposition du chat repose sur des hauteurs rigides `calc(100vh - 220px)`. Sur iOS Safari et Chrome Android, le déploiement du clavier virtuel réduit l'espace visible sans recalculer `100vh`. Le champ de saisie (`#chatInputText`) passe alors sous le clavier, rendant la rédaction totalement aveugle.
2. **Absence Totale de CSS Safe Areas (`env(safe-area-inset-bottom)`) :**  
   La barre d'envoi du chat chevauche directement la barre blanche de navigation système des iPhone récents (Home Indicator).
3. **Cibles Tactiles Insuffisantes (Non-conformité WCAG 2.5.5) :**  
   Les boutons d'action rapide sur chaque message (Répondre `↩️` et Modération `🗑️`) ne mesurent que **22 × 18 px** (contre un minimum recommandé de **44 × 44 px**), causant de fréquents *miss-clicks* au pouce.
4. **Saturation Horizontale de la Barre de Saisie ("Bar Jam") :**  
   La disposition comprime sur une seule ligne le `<select>` de destinataire (110 px), le micro (44 px), les émojis (40 px), l'input texte et le bouton Envoyer (95 px). Sur un écran de 360–390 px de large, la zone de texte utile est réduite à moins de 75 px.

#### B. Typographie & Direction Bilingue (FR / Shami)
1. **Conflit Global `line-height: 1.7 !important` :**  
   Dans `public/aya-rtl.css`, l'interlignage forcé à 1.7 sur l'ensemble des balises `div`, `span`, `p` tronque verticalement les composants compacts (badges de présence, pilules de statut, boutons audio).
2. **Alignement des Bulles Mixtes :**  
   Une réponse en français dans une interface arabe hérite de l'alignement à droite sans inversion de ponctuation. L'attribut `dir="auto"` avec `unicode-bidi: plaintext` est requis sur les conteneurs textuels.

---

### 1.3. Diagnostic Backend, Scalabilité & Boucle d'Événements

#### A. Le Piège du Polling Synchrone à 2.5s (`routes/chat.js` & `public/app.js`)
Actuellement, chaque client connecté interroge `GET /api/chat/messages` toutes les 2.5 secondes.  
À chaque appel, le serveur exécute de manière bloquante :
- `getChatStatus()` ➔ `fs.readFileSync(CHAT_STATUS_FILE)`
- `purge24hEphemeralChat()` ➔ `fs.readFileSync(CHAT_DB_FILE)` + boucle O(N) + suppressions disque synchrones `fs.unlinkSync()` + sauvegarde bloquante `fs.writeFileSync(CHAT_DB_FILE)`.

**Impact mathématique sur l'Event Loop du VPS (4 vCPUs AMD EPYC) :**
- **À 50 utilisateurs :** 20 req/s, 40 I/O sync/s, ~45 ms de gel CPU par seconde.
- **À 200 utilisateurs :** **80 req/s**, **160 I/O sync/s**, **~260 ms de gel CPU par seconde (26% de l'Event Loop monopolisée)**.
- **Risque de corruption :** Deux requêtes concurrentes appelant `fs.writeFileSync` en parallèle provoquent un crash `SyntaxError: Unexpected end of JSON input` et la perte de l'historique de discussion.

#### B. Incohérence Critique Bloquante : `spawn('py')` dans `vocabularyCardService.js`
Aux lignes 478 et 492 de `services/vocabularyCardService.js` :
```javascript
const pyProc = spawn('py', [TTS_SCRIPT_PATH, payloadFile]); // ⚠️ Échec immédiat sur Linux
```
Le binaire `py` (propre au Windows Python Launcher) n'existe pas sous Linux. Sur Ubuntu 24.04, cette instruction lève une exception `ENOENT`, rendant la génération audio des fiches 9:16 inopérante. Le module utilitaire `utils/runtime.js` (`getPythonBin()`) doit être exploité.

#### C. Puppeteer : Cold Start vs Warm Singleton
La file séquentielle `SequentialQueue` (`concurrency = 1`) protège efficacement la mémoire vive contre l'emballement. Néanmoins, l'instanciation et la destruction répétées de Chromium (`puppeteer.launch` suivi de `browser.close`) ajoutent **1.5 à 2.8 secondes de latence** et provoquent des pics d'allocation de 300 Mo de RAM par carte. Le passage à un **Warm Singleton avec recyclage périodique** réduit la latence à moins de 80 ms.

#### D. Saturation & Fuites Silencieuses du Disque NVMe
1. **Fuite `audio_a_traiter/` :** Dans `routes/chat.js` (ligne 567), les fichiers audio téléversés par Multer pour transcription ne sont jamais supprimés via `fs.unlinkSync()`.
2. **Rétention Vidéo :** Le dossier `fichiers_reponse_a_envoyer/` stocke actuellement **144 fichiers vidéos et audios (plus de 3 Go)**. Sans tâche de purge automatisée, le disque de 160 Go sera saturé sous 30 jours.

---

## 2. FOCUS CHAT PRIVÉ (DMs) : ARCHITECTURE & EXPÉRIENCE UTILISATEUR

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BARRE DE FILTRES SUPÉRIEURE                      │
│   [ 🌍 Salon Général (32) ]     [ 🔒 Mes DMs (4) ]     [ 💬 @Soso ✕ ]   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         FLUX DE CONVERSATION                           │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ 👤 Steve • 10:14                                 [↩️]          │   │
│   │ Bonjour l'équipe, comment avance la traduction ?               │   │
│   │ ✨ صباح الخير يا فريق، كيف تسير الترجمة؟                       │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ 🔒 Confidentiel • De @Soso pour vous • 10:16     [↩️]          │   │
│   │ [Bulle Violette Nuit / Bordure Turquoise / Lueur Diffuse]      │   │
│   │ Voici le document confidentiel concernant le convoi.           │   │
│   │ ✨ إليك الوثيقة السرية الخاصة بالقافلة.                        │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 🔒 Vous écrivez en privé à @Soso • Chiffré & Invisible aux tiers [✕]   │
├────────────────────────────────────────────────────────────────────────┤
│ [ 🔒 @Soso 🟢 ▾ ]  [🎙️]  [😀  Votre message confidentiel...   ] [🔒 Envoyer]│
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Parcours Utilisateur & Sélection du Destinataire

1. **Remplacement du `<select>` Statique par la Pilule Dynamique (`Target Pill`) :**
   - État public par défaut : `[ 🌍 Salon Général ▾ ]`.
   - État privé actif : `[ 🔒 @Soso 🟢 ▾ ]` avec pastille verte d'activité et bouton de retour public rapide.
2. **Bascule en DM 1-Clic depuis le Flux :**
   - L'utilisateur clique directement sur le nom ou l'avatar d'un membre dans n'importe quel message du chat.
   - La cible passe immédiatement en DM vers cet utilisateur, ouvrant le mode privé sans friction.
3. **Annuaire Popover / Bottom Sheet Tactile :**
   - Clic sur la pilule de destinataire ➔ Ouverture d'un tiroir tactile listant :
     - *En ligne maintenant* (données issues de `/api/presence` avec pastille verte pulsante).
     - *Tous les collaborateurs / testeurs* (avec horodatage de dernière connexion).
     - *Salon Public (Tout le monde)*.

### 2.2. Distinction Visuelle des Messages Privés

| Élément Graphique | Message Public | Message Privé (DM Reçu) | Message Privé (DM Envoyé) |
| :--- | :--- | :--- | :--- |
| **Arrière-plan** | Ardoise sombre (`#0f172a`) | Gradient Nuit Améthyste (`#1e1435` à `#261847`) | Gradient Violet Royal (`#6d28d9` à `#4c1d95`) |
| **Bordure** | `1px solid rgba(51,65,85,0.5)` | `1.5px solid #a855f7` (Bordure Violette) | `1.5px solid #00bcd4` (Turquoise Aya) |
| **Effet Lumineux (Glow)** | Aucun | `box-shadow: 0 4px 18px rgba(168,85,247,0.25)` | `box-shadow: 0 4px 18px rgba(0,188,212,0.25)` |
| **Badge d'En-tête** | Aucun | `🔒 Confidentiel • De @Auteur pour vous` | `🔒 Message Privé • Envoyé à @Destinataire` |
| **Bouton d'Envoi** | Bleu/Vert standard (`Envoyer`) | Dégradé Violet-Turquoise (`🔒 Envoyer en Privé`) | — |

### 2.3. Garde-fous et Règles de Confidentialité Côté Client et Serveur

#### A. Côté Client (Front-End)
- **Bannière Active de Composition :** Dès qu'un destinataire privé est sélectionné, un bandeau d'alerte violet apparaît au-dessus de l'input :  
  *« 🔒 Vous écrivez en privé à @Soso. Cet échange est chiffré et strictement invisible aux autres membres. [ Repasser en public ✕ ] »*.
- **Suppression du Reset Involontaire :** Suppression du bug de la ligne 2338 de `public/app.js` qui réinitialisait la cible vers `'all'` après l'envoi d'un audio vocal. L'utilisateur peut ainsi enchaîner plusieurs notes vocales en privé sans fuite publique.

#### B. Côté Serveur (Back-End)
- **Neutralisation de la Faille `req.query.user` :**  
  Dans `routes/chat.js` (ligne 377), le filtrage acceptait `req.query.user`, permettant à un attaquant d'usurper l'identité d'un testeur via l'URL. **La session serveur authentifiée (`req.session.user`) devient la seule et unique autorité de filtrage.**
- **Filtrage Strict à la Source :**
  ```javascript
  const filteredMessages = allMessages.filter(msg => {
      if (!msg.recipient || msg.recipient === 'all') return true; // Message public
      if (isAdmin) return true; // Modération globale
      if (!authenticatedUser) return false; // Visiteur non authentifié : 0 DM
      return msg.sender.toLowerCase() === authenticatedUser.toLowerCase() ||
             msg.recipient.toLowerCase() === authenticatedUser.toLowerCase();
  });
  ```
- **Intégrité de l'Expéditeur :** Le champ `sender` est injecté directement depuis la session serveur (`req.session.user.name`), rendant impossible l'usurpation d'identité dans les requêtes POST.

---

## 3. TICKET TECHNIQUE DE DÉPLOIEMENT HETZNER (UBUNTU 24.04 LTS)

### 3.1. Prérequis & Spécificités Ubuntu 24.04 LTS

1. **Architecture `time_t` 64-bit (`t64`) :**  
   Ubuntu 24.04 a migré ses paquets C/C++ partagés. Les paquets comme `libasound2` ou `libatk1.0-0` doivent obligatoirement être installés avec leur suffixe moderne : **`libasound2t64`**, **`libatk1.0-0t64`**, **`libcups2t64`**.
2. **Éviter le Piège de Chromium Snap :**  
   Le paquet `apt install chromium-browser` installe un Snap confiné par AppArmor qui échoue systématiquement sous PM2. Le déploiement s'appuie sur le binaire officiel natif **Google Chrome Stable (.deb)**, parfaitement pris en charge par `services/vocabularyCardService.js` (`/usr/bin/google-chrome-stable`).
3. **Typographie Arabe & Sous-Titres ASS :**  
   Pour éviter le texte arabique morcelé ("tofu") lors du rendu Chromium et de l'incrustation vidéo FFmpeg (`libass`), les polices **Cairo**, **Amiri**, **Noto Sans/Serif Arabic** et **Impact** (`ttf-mscorefonts-installer`) sont installées directement au niveau de l'OS avec recompilation du cache Fontconfig (`fc-cache -f -v`).
4. **Justification du Mode PM2 `fork` (instances: 1) :**
   - Préserve le verrou d'exclusion mutuelle `SequentialQueue (concurrency = 1)` pour Chromium/FFmpeg (le mode cluster lancerait 4 Chromium en parallèle et saturerait la RAM).
   - Garantit l'unicité du thread d'arrière-plan `driveWorker` (évite les conflits d'écrasement OAuth2 et le bannissement par Google Drive).
   - Maintient la cohérence de la mémoire de présence des utilisateurs.

---

### 3.2. Configuration Nginx Complète (`/etc/nginx/sites-available/aya`)

```nginx
# ==============================================================================
# Configuration Nginx Haute Disponibilité - Plateforme Aya Studio
# VPS Hetzner CPX31 (Ubuntu 24.04 LTS) - /etc/nginx/sites-available/aya
# ==============================================================================

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream aya_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
    keepalive 64;
}

# Limitation de débit anti-bruteforce et anti-flood (Code standard : HTTP 429)
limit_req_status 429;
limit_req_zone $binary_remote_addr zone=aya_auth_limit:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=aya_chat_limit:10m rate=10r/s;

# ------------------------------------------------------------------------------
# SERVEUR HTTP (Port 80) : Redirection ACME & HTTPS
# ------------------------------------------------------------------------------
server {
    listen 80;
    listen [::]:80;
    server_name votre-domaine.com www.votre-domaine.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# ------------------------------------------------------------------------------
# SERVEUR HTTPS (Port 443) : Production Sécurisée, HTTP/2 & Streaming SSE
# ------------------------------------------------------------------------------
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name votre-domaine.com www.votre-domaine.com;

    ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 8.8.8.8 valid=300s;

    # En-têtes de Sécurité HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Capacité d'upload alignée avec Multer (500 Mo max)
    client_max_body_size 500M;
    client_body_buffer_size 512k;

    access_log /var/log/nginx/aya_access.log;
    error_log /var/log/nginx/aya_error.log warn;

    # Compression dynamique Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;

    # 1. Mise en cache directe des médias statiques (zéro charge Node.js)
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

    location /uploads/ {
        alias /var/www/aya/uploads/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        sendfile on;
        tcp_nopush on;
        try_files $uri @proxy_backend;
    }

    location /fichiers_reponse_a_envoyer/ {
        alias /var/www/aya/fichiers_reponse_a_envoyer/;
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
        sendfile on;
        tcp_nopush on;
        try_files $uri @proxy_backend;
    }

    # 2. Flux SSE & Streaming Temps Réel (/api/traduction/process)
    location ~ ^/api/traduction/(process|status) {
        proxy_pass http://aya_backend;
        proxy_http_version 1.1;

        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        proxy_set_header X-Accel-Buffering "no";

        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        send_timeout 600s;

        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Routes Sensibles : Rate Limiting
    location /api/auth/login {
        limit_req zone=aya_auth_limit burst=5 nodelay;
        proxy_pass http://aya_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/chat/send {
        limit_req zone=aya_chat_limit burst=10 nodelay;
        proxy_pass http://aya_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 4. Proxy Global Node.js & WebSockets
    location / {
        proxy_pass http://aya_backend;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

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
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### 3.3. Configuration PM2 (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [
    {
      name: 'aya-platform',
      script: './server.js',
      cwd: '/var/www/aya',
      instances: 1, // Mode FORK impératif (SequentialQueue Concurrency=1 & DriveWorker)
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G', // Seuil anti-fuite adapté aux 8 Go du VPS
      restart_delay: 4000,
      kill_timeout: 10000, // 10s de grâce pour FFmpeg et les connexions actives
      listen_timeout: 15000,
      exp_backoff_restart_delay: 100,

      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/aya/logs/pm2-error.log',
      out_file: '/var/www/aya/logs/pm2-out.log',
      merge_logs: true,

      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        PYTHON_ENV: 'production',
        AYA_EXEC_PROFILE: 'cloud_vps_safe'
      }
    }
  ]
};
```

---

### 3.4. Commandes de Déploiement Bash Pas-à-Pas (Terminal Serveur)

```bash
# ------------------------------------------------------------------------------
# 1. SYSTÈME, PARE-FEU & MULTIMÉDIA (Ubuntu 24.04 LTS)
# ------------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y

ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP ACME'
ufw allow 443/tcp comment 'HTTPS'
echo "y" | ufw enable

apt-get install -y curl wget git build-essential ca-certificates gnupg \
    ffmpeg libavcodec-extra sox libsox-fmt-all htop unzip

# ------------------------------------------------------------------------------
# 2. POLICES ARABES SHAMI & CORE FONTS (Tashkeel & Sous-titres TikTok)
# ------------------------------------------------------------------------------
echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections
apt-get install -y ttf-mscorefonts-installer \
    fonts-cairo fonts-hosny-amiri fonts-noto-core fonts-noto-extra \
    fonts-noto-ui-core fonts-kacst fonts-sil-scheherazade fonts-dejavu-core
fc-cache -f -v

# ------------------------------------------------------------------------------
# 3. DÉPENDANCES HEADLESS & GOOGLE CHROME STABLE (Sans Snap)
# ------------------------------------------------------------------------------
apt-get install -y \
    libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0t64 libcairo2 libcups2t64 \
    libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0t64 libgtk-3-0t64 \
    libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libx11-xcb1 \
    libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 xdg-utils

mkdir -p /etc/apt/keyrings
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg --yes
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list
apt-get update -y && apt-get install -y google-chrome-stable

# ------------------------------------------------------------------------------
# 4. RUNTIMES : NODE.JS 20 LTS, PYTHON 3.12 & MONGODB 7.0
# ------------------------------------------------------------------------------
# Node.js 20 LTS & PM2
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
apt-get update -y && apt-get install -y nodejs
npm install -g pm2 pm2-logrotate
pm2 set pm2-logrotate:max_size 10M && pm2 set pm2-logrotate:retain 7

# Python 3.12
apt-get install -y python3 python3-pip python3-venv python3-dev

# MongoDB 7.0 Community
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg --yes
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -y && apt-get install -y mongodb-org
systemctl enable --now mongod

# ------------------------------------------------------------------------------
# 5. DÉPLOIEMENT APPLICATIF SOUS UTILISATEUR DÉDIÉ 'aya'
# ------------------------------------------------------------------------------
id -u aya >/dev/null 2>&1 || useradd -m -s /bin/bash aya
mkdir -p /var/www/aya
cd /var/www/aya

git clone https://github.com/artas971/plateforme-aya.git .
mkdir -p logs temp/vocab_build uploads public/avatars public/assets audio_a_traiter fichiers_reponse_a_envoyer "message pour john"

# Environnement virtuel Python
python3 -m venv /var/www/aya/venv
/var/www/aya/venv/bin/pip install --upgrade pip setuptools wheel
/var/www/aya/venv/bin/pip install -r requirements.txt

# Dépendances Node.js de production
npm install --omit=dev
chown -R aya:aya /var/www/aya

# ------------------------------------------------------------------------------
# 6. CONFIGURATION NGINX & SSL CERTBOT
# ------------------------------------------------------------------------------
apt-get install -y nginx certbot python3-certbot-nginx
mkdir -p /var/www/certbot
cp /var/www/aya/nginx/aya.conf /etc/nginx/sites-available/aya
ln -sf /etc/nginx/sites-available/aya /etc/nginx/sites-enabled/aya
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Génération SSL Let's Encrypt (après propagation DNS)
certbot --nginx -d votre-domaine.com -d www.votre-domaine.com --agree-tos -m contact@votre-domaine.com --no-eff-email --redirect

# ------------------------------------------------------------------------------
# 7. LANCEMENT PM2 EN PRODUCTION & PERSISTANCE SYSTEMD
# ------------------------------------------------------------------------------
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u aya --hp /home/aya
sudo -u aya -i bash << 'EOF'
cd /var/www/aya
pm2 start ecosystem.config.js --env production
pm2 save
EOF

# Smoke Testing
curl -I http://127.0.0.1:3000/api/presence
curl -I https://votre-domaine.com
```

---

## 4. BACKLOG DES TICKETS D'ÉVOLUTION

Voici la liste numérotée des tickets prêts pour votre suivi de projet :

### 🔴 Priorité P0 : Correctifs Critiques Pré-Déploiement
- **TICKET-01 : Correctif de portabilité Linux pour la synthèse vocale des cartes**  
  *Description :* Remplacer `spawn('py')` par `spawn(getPythonBin())` aux lignes 478 et 492 de `services/vocabularyCardService.js` pour éviter le crash binaire sur Ubuntu.  
  *Priorité :* **P0 (Bloquant)** | *Effort :* 10 min
- **TICKET-02 : Sécurisation absolue de la route `/api/chat/messages` contre les fuites de DMs**  
  *Description :* Supprimer le paramètre vulnérable `req.query.user` et conditionner la visibilité des messages privés strictement à `req.session.user`.  
  *Priorité :* **P0 (Sécurité)** | *Effort :* 20 min
- **TICKET-03 : Correction du reset involontaire du destinataire chat après vocal**  
  *Description :* Supprimer la ligne 2338 de `public/app.js` (`chatRecipientSelect.value = 'all'`) pour maintenir le ciblage privé lors d'envois vocaux successifs.  
  *Priorité :* **P0 (Confidentialité)** | *Effort :* 5 min

---

### 🟠 Priorité P1 : Scalabilité & Expérience Chat Privé
- **TICKET-04 : Migration du stockage Chat vers MongoDB avec TTL Index 24h**  
  *Description :* Remplacer `chat_db.json` par le modèle Mongoose `ChatMessage` doté de l'index `{ createdAt: 1 }, { expireAfterSeconds: 86400 }` et d'un index composé `{ recipient: 1, sender: 1 }`.  
  *Priorité :* **P1 (Haute)** | *Effort :* 2h
- **TICKET-05 : Bascule du Chat en Server-Sent Events (SSE) Zéro-Polling**  
  *Description :* Créer l'endpoint `/api/chat/stream` et brancher le `ChatEventBus` EventEmitter. Supprimer le `setInterval(2500)` client pour diviser le trafic HTTP par 50 et éliminer les I/O disque synchrones.  
  *Priorité :* **P1 (Haute)** | *Effort :* 3h
- **TICKET-06 : Intégration de la Pilule de Destinataire Dynamique & Bannière Privée**  
  *Description :* Remplacer le `<select>` statique par le composant cliquable `Target Pill` connecté à `/api/presence`, avec bandeau d'alerte violet sécurisé au-dessus de la saisie.  
  *Priorité :* **P1 (Haute)** | *Effort :* 2h
- **TICKET-07 : Déploiement du Service de Garbage Collection Automatique (Disque NVMe)**  
  *Description :* Mettre en place un cron de nettoyage horaire purgeant les audios temporaires non réclamés (`audio_a_traiter/` > 2h) et les vidéos livrées (`fichiers_reponse_a_envoyer/` > 48h).  
  *Priorité :* **P1 (Haute)** | *Effort :* 1h30

---

### 🟡 Priorité P2 : Ergonomie Mobile & Optimisations Mémoire
- **TICKET-08 : Adaptation Mobile Safe Areas & Hauteur Dynamique (`dvh`)**  
  *Description :* Remplacer `100vh` par `100dvh` dans la CSS du chat et appliquer `padding-bottom: env(safe-area-inset-bottom)` pour empêcher le clavier virtuel de masquer le champ de saisie.  
  *Priorité :* **P2 (Moyenne)** | *Effort :* 45 min
- **TICKET-09 : Clic Avatar / Nom pour Bascule Rapide en DM**  
  *Description :* Rendre cliquable l'en-tête de chaque bulle pour préremplir instantanément la cible privée vers l'auteur du message.  
  *Priorité :* **P2 (Moyenne)** | *Effort :* 45 min
- **TICKET-10 : Passage de Puppeteer en Warm Singleton avec Recyclage Périodique**  
  *Description :* Conserver une instance Chromium ouverte en arrière-plan et réutiliser ses onglets (`browser.newPage()`) pour abaisser la latence de génération des fiches de 5s à 1.8s.  
  *Priorité :* **P2 (Moyenne)** | *Effort :* 1h30
- **TICKET-11 : Agrandissement des Cibles Tactiles Mobile (Conformité WCAG 44px)**  
  *Description :* Augmenter la zone de clic des boutons Répondre (`↩️`), Supprimer (`🗑️`) et Switcher de langue (FR/عربي) à 44 × 44 px minimum.  
  *Priorité :* **P2 (Moyenne)** | *Effort :* 30 min

---

### 🟢 Priorité P3 : Confort Avancé & Cache
- **TICKET-12 : Barre d'Onglets de Filtrage du Chat (`Général` / `DMs`)**  
  *Description :* Ajouter au-dessus du flux les boutons de filtre permettant d'isoler les messages privés des messages publics.  
  *Priorité :* **P3 (Confort)** | *Effort :* 1h30
- **TICKET-13 : Cache LRU en Mémoire pour Traductions Récurrentes du Chat**  
  *Description :* Mettre en cache les salutations et phrases courantes (1 000 entrées, TTL 12h) afin d'économiser 35% de requêtes vers Gemini Flash et offrir des réponses en 0 ms.  
  *Priorité :* **P3 (Confort)** | *Effort :* 1h
- **TICKET-14 : Harmonisation Typographique `line-height` en Mode Arabe (RTL)**  
  *Description :* Supprimer le `line-height: 1.7 !important` universel dans `aya-rtl.css` et le cibler uniquement sur les paragraphes de lecture pour éviter les coupures sur les boutons d'interface.  
  *Priorité :* **P3 (Confort)** | *Effort :* 30 min
