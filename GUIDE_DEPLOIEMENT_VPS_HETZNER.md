# 🗺️ FEUILLE DE ROUTE DE DÉPLOIEMENT VPS (HETZNER CPX31 - UBUNTU 24.04 LTS)
**Plateforme Aya — Guide d'Exécution Manuel "Jour J"**

---

## 📌 Vue d'Ensemble & Prérequis
Ce document est votre tableau de bord pas-à-pas pour le jour du déploiement. Suivez les 4 tickets dans l'ordre chronologique.

* **Serveur cible** : Hetzner Cloud **CPX31** (4 vCPUs AMD EPYC, 8 Go RAM, 160 Go NVMe).
* **Système d'exploitation** : **Ubuntu 24.04 LTS (64-bit)**.
* **Outils locaux requis sur votre PC** : Terminal Windows (PowerShell ou Invite de commandes) avec client SSH natif.

---

## 🎫 TICKET 1 : Première Connexion & Sécurité de Base du VPS

### 1.1. Récupération des accès Hetzner
Une fois le serveur créé sur la console Hetzner Cloud (Cloud Console) :
* Notez l'**Adresse IPv4 publique** (ex: `195.201.123.45`).
* Récupérez le mot de passe `root` envoyé par email ou utilisez votre clé SSH si vous l'avez injectée lors de la création du serveur.

### 1.2. Première connexion SSH
Ouvrez PowerShell sur votre PC Windows et lancez :

```powershell
ssh root@<IP_DU_VPS>
```

> [!NOTE]
> Lors de la toute première connexion, tapez `yes` pour accepter l'empreinte de la clé d'hôte (Host Key Fingerprint).
> Si vous vous connectez par mot de passe temporaire, le système vous demandera d'entrer le mot de passe actuel, puis d'en définir un nouveau sécurisé.

### 1.3. Mise à jour immédiate du système
Dès que le prompt `root@...:~#` apparaît, appliquez les dernières mises à jour de sécurité Ubuntu :

```bash
apt update -y && apt upgrade -y
```

### 1.4. Sécurisation initiale du pare-feu (UFW)
Pour éviter toute coupure, autorisez d'abord le port SSH avant d'activer le pare-feu :

```bash
# Autoriser le port SSH (22)
ufw allow 22/tcp comment 'SSH'

# Définir les règles par défaut
ufw default deny incoming
ufw default allow outgoing

# Activer le pare-feu
ufw enable
# Confirmez par 'y' si demandé

# Vérifier le statut
ufw status verbose
```

---

## 🎫 TICKET 2 : Transfert du Code & Configuration `.env`

Deux méthodes sont disponibles pour amener le projet sur le serveur. La méthode **Git Clone (Recommandée)** est la plus propre et pérenne.

### 2.1. Méthode A (Recommandée) : Cloner depuis GitHub

Sur le serveur VPS en tant que `root` :

```bash
# 1. Créer le répertoire de destination
mkdir -p /var/www/aya

# 2. Cloner le dépôt GitHub directement
git clone https://github.com/artas971/plateforme-aya.git /var/www/aya

# 3. Entrer dans le projet
cd /var/www/aya
```

*(Si le dépôt est privé, GitHub vous demandera votre identifiant et un Personal Access Token (PAT) généré depuis GitHub > Settings > Developer Settings > Personal access tokens).*

---

### 2.2. Méthode B (Alternative) : Envoi direct depuis votre PC Windows (SCP)
Si vous préférez transférer votre projet local directement avec vos fichiers de configuration sans passer par GitHub, ouvrez une fenêtre **PowerShell locale** sur votre PC (dans le dossier `c:\Users\artas\Desktop\aya`) :

```powershell
# Transférer le fichier .env de configuration
scp -P 22 .env root@<IP_DU_VPS>:/var/www/aya/.env

# Transférer les identifiants Google Service Account si existants
scp -P 22 google_service_account.json root@<IP_DU_VPS>:/var/www/aya/google_service_account.json
```

---

### 2.3. Création / Édition du fichier `.env` de production

Sur le serveur VPS, créez ou éditez le fichier `.env` :

```bash
nano /var/www/aya/.env
```

Renseignez les variables nécessaires (collez le bloc suivant en adaptant vos clés) :

```dotenv
# ==============================================================================
# CONFIGURATION PRODUCTION - PLATEFORME AYA (VPS HETZNER CPX31)
# ==============================================================================
PORT=3000
NODE_ENV=production
PYTHON_ENV=production
AYA_EXEC_PROFILE=cloud_vps_safe

# Clé Secrète de Session Express (Générez une chaîne aléatoire 64 hex)
SESSION_SECRET=a8f9c2d1e3b4a5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c

# Base de Données MongoDB (Atlas Cloud ou local)
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/aya_prod?retryWrites=true&w=majority

# IA Gemini (Traduction Dialectale & Analyse Alexandre)
GEMINI_API_KEY=AIzaSy...

# Google Drive (Stockage Cloud & Synchronisation Automatique)
GOOGLE_DRIVE_FOLDER_ID=1imkYqlFZU50a2-kM2B5AMEx85VARw75k
GOOGLE_DRIVE_REFRESH_TOKEN=1//04...
GOOGLE_DRIVE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=GOCSPX-...

# TikTok Marketing API (Optionnel Phase 3A)
TIKTOK_CLIENT_KEY=sbawzm...
TIKTOK_CLIENT_SECRET=...
TIKTOK_TOKEN_ENCRYPTION_KEY=...
TIKTOK_CALLBACK_URL=https://votre-domaine.com/api/tiktok/auth/callback

# Fallback SMTP Nodemailer (Envoi d'e-mails sécurisés)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=mot-de-passe-application
```

> [!TIP]
> Pour quitter `nano`, appuyez sur `Ctrl + O` puis `Entrée` (Sauvegarder), puis `Ctrl + X` (Quitter).

---

## 🎫 TICKET 3 : Exécution du Provisioning & Démarrage PM2

### 3.1. Lancement du script de provisioning automatisé
Le script [`setup_vps.sh`](file:///c:/Users/artas/Desktop/aya/setup_vps.sh) que nous avons conçu s'occupe de tout : Node 20, Python 3.12, venv, dépendances `requirements.txt`, FFmpeg, polices ASS (Impact, Noto Arabe), Nginx, Certbot et utilisateur système dédié `aya`.

Sur le VPS (en `root`) :

```bash
cd /var/www/aya

# Donner les droits d'exécution au script
chmod +x setup_vps.sh

# Lancer le script d'installation automatisé
./setup_vps.sh
```

⏱️ *Temps estimé : environ 2 à 3 minutes.*  
À la fin, vous verrez le message vert : `[AYA SETUP] ✅ PROVISIONING DU VPS TERMINÉ AVEC SUCCÈS !`

---

### 3.2. Démarrage de l'Application via PM2 sous l'utilisateur `aya`
Pour des raisons strictes de cybersécurité, Node.js ne doit jamais tourner en root. Basculez sur l'utilisateur applicatif dédié `aya` :

```bash
# 1. Se connecter en tant qu'utilisateur aya
sudo -u aya -i

# 2. Se positionner dans le dossier de l'application
cd /var/www/aya

# 3. Démarrer l'application avec la configuration de production (max 2Go RAM, fork mode)
pm2 start ecosystem.config.js --env production

# 4. Enregistrer la liste des processus pour redémarrage automatique au boot du serveur
pm2 save

# 5. Revenir sur le compte root
exit
```

### 3.3. Commandes de contrôle PM2 utiles
* Voir le statut et la mémoire en temps réel : `sudo -u aya pm2 status`
* Voir les logs en direct : `sudo -u aya pm2 logs aya-platform`
* Redémarrer l'application à chaud : `sudo -u aya pm2 restart aya-platform`
* Arrêter l'application : `sudo -u aya pm2 stop aya-platform`

---

## 🎫 TICKET 4 : Domaine, DNS Cloudflare, Nginx & Certificat SSL (HTTPS)

### 4.1. Configuration des DNS chez votre Registrar / Cloudflare
Dans le panneau de gestion de votre nom de domaine (ex: Cloudflare DNS) :

| Type | Nom (Name) | Valeur (Content / Cible) | Proxy Status | TTL |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `@` (ou racine) | `<IP_DU_VPS>` (ex: `195.201.123.45`) | **DNS Only** *(gris)* au début pour Certbot | Auto |
| **CNAME** | `www` | `votre-domaine.com` | **DNS Only** *(gris)* au début pour Certbot | Auto |

> [!IMPORTANT]
> **Pourquoi désactiver le proxy Cloudflare (nuage orange) temporairement ?**  
> Let's Encrypt / Certbot a besoin de communiquer directement avec le serveur Nginx du VPS sur le port 80 pour valider le challenge HTTP-01. Une fois le certificat obtenu, vous pouvez réactiver le nuage orange si vous le souhaitez (en configurant le mode SSL Cloudflare sur **Full (Strict)**).

---

### 4.2. Configuration du nom de domaine dans Nginx
Sur le VPS (en `root`) :

```bash
# Éditer la configuration Nginx
nano /etc/nginx/sites-available/aya
```

Remplacez la ligne :
```nginx
server_name _;
```
par votre domaine réel :
```nginx
server_name votre-domaine.com www.votre-domaine.com;
```

Testez et rechargez Nginx :
```bash
nginx -t
systemctl reload nginx
```

---

### 4.3. Génération du certificat SSL HTTPS gratuit avec Certbot
Générez le certificat SSL en une seule ligne de commande :

```bash
certbot --nginx -d votre-domaine.com -d www.votre-domaine.com --agree-tos -m votre-email@gmail.com --no-eff-email --redirect
```

Certbot va :
1. Négocier le certificat avec Let's Encrypt.
2. Installer les clés cryptographiques dans `/etc/letsencrypt/live/votre-domaine.com/`.
3. Mettre à jour automatiquement le fichier Nginx pour écouter sur le port 443 SSL et rediriger tout le trafic HTTP vers HTTPS.
4. Recharger Nginx.

---

### 4.4. Test du renouvellement automatique SSL
Les certificats Let's Encrypt sont valables 90 jours et se renouvellent automatiquement via un cron/timer systemd. Testez que le renouvellement fonctionne :

```bash
certbot renew --dry-run
```

Si vous obtenez `Congratulations, all simulated renewals succeeded`, tout est configuré à la perfection pour les années à venir.

---

## 🏁 CHECK-LIST DE VALIDATION FINALE (Le "Go-Live")

Connectez-vous depuis votre smartphone ou navigateur PC à `https://votre-domaine.com` :

- [ ] **Accès HTTPS** : Le cadenas vert/sécurisé apparaît sans avertissement de certificat.
- [ ] **Authentification** : Connexion réussie avec `@artas971` sur `/login`.
- [ ] **Espace Profil** : Visualisation de l'avatar et du solde de crédits sur `/profil.html`.
- [ ] **Streaming SSE sans buffering** : Lancez une traduction sur `/traducteur` ; la barre de progression s'incrémente en temps réel (15%, 35%, 60%, 100%) sans figer.
- [ ] **Encodage FFmpeg & Sous-titres** : Vérification de la bonne incrustation des sous-titres avec la police Impact et les glyphes arabes nets.
- [ ] **Google Drive Worker** : Les vidéos générées sont bien synchronisées dans le dossier Google Drive distant.

---
*Ce document est stocké à la racine de votre projet sous [`GUIDE_DEPLOIEMENT_VPS_HETZNER.md`](file:///c:/Users/artas/Desktop/aya/GUIDE_DEPLOIEMENT_VPS_HETZNER.md).*
