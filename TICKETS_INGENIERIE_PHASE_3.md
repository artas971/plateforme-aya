# 🎯 BACKLOG STRATÉGIQUE — PHASE 3 : EXPANSION & ULTIME PRÉCISION

---

## 📌 TICKET 1 : Intégration TikTok Publishing API — Direct Post & Schedule (Phase 3A - Édition Révisée)

### 1.1 Fiche d'Identité du Ticket
* **Référence** : `TICKET-PHASE-3A-REV`
* **Priorité** : Haute (Diffusion Multicanale & Automatisation)
* **Statut** : Prêt pour Implémentation (Spécifications Révisées)
* **Lead Technique** : ⚡ Max (Backend Node.js & Flux API) & 🎨 Lionel (Frontend React / UI Studio)
* **Parties prenantes** : 🛡️ Victor (Sécurité Chiffrée & MongoDB), 🧕 Nadine (Copywriting & Hashtags), ⚙️ Thomas (Régénération Couverture)

### 1.2 Objectif & Contexte Stratégique (Révision Tech Lead)
Le projet Aya étant une plateforme de solidarité humaine et documentaire à vocation non commerciale, **l'API Promote (Boosts publicitaires payants) est définitivement abandonnée**.
L'objectif est d'offrir aux créateurs et testeurs un workflow de publication direct, fluide et hautement personnalisable sur TikTok :
1. **Authentification transparente OAuth2 (TikTok Login Kit)** sans friction.
2. **Formulaire d'Édition Pré-Publication** : Contrôle humain total avant diffusion (édition libre de la description de Nadine, des hashtags et du texte incrusté sur la couverture 9:16).
3. **Régénération dynamique de la couverture** : Si l'utilisateur affine le titre de couverture sur l'UI, le backend régénère instantanément le visuel `.jpg` haute définition avant publication.
4. **Diffusion flexible** : Choix entre **Publication Immédiate (Direct Post)** et **Programmation Horodatée (Schedule)**.
5. **Cloisonnement strict des environnements** : Utilisation exclusive de la variable `TIKTOK_CALLBACK_URL` pour supporter sans friction les tunnels locaux (Ngrok) du Tech Lead et le futur nom de domaine en production sur le serveur VPS, sans aucune URL inscrite en dur dans le code source.

### 1.3 Résumé de l'Architecture Technique
```
[ Frontend React / Studio (Lionel) ]
       │
       ├── 1. Connexion / Statut du Compte (@handle, Avatar, Badge)
       ├── 2. Modale Pré-Publication : Édition Description, Hashtags & Titre Couverture
       ├── 3. Régénération Dynamique Cover (Appel API -> Lionel Pillow)
       └── 4. Choix : "Publier Maintenant" vs "Programmer (Date/Heure UTC)"
       ▼
[ Backend Express / Node.js (Max) ]
       │
       ├── Auth : /api/tiktok/auth/login & /callback (Redirect dynamique via TIKTOK_CALLBACK_URL)
       ├── Token Manager : Rafraîchissement transparent & Révocation
       ├── Régénération Cover : /api/tiktok/regenerate-cover
       ├── Publish Service : /api/tiktok/publish (Direct Post / Schedule)
       └── Chunked Uploader : Découpage binaire HTTP PUT (5-20 Mo/chunk)
       ▼
[ Base de Données MongoDB (Victor) ]
       └── Collection `tiktok_accounts` : Tokens chiffrés en AES-256-GCM (IV + AuthTag uniques)
       ▼
[ TikTok Content Posting API v2 (Production TikTok) ]
       ├── /v2/post/publish/video/init/  (Mode: DIRECT_POST ou SCHEDULED_POST)
       ├── Chunks Upload via Upload URL fournie par TikTok
       └── /v2/post/publish/status/fetch/ (Monitoring statut de transcodage)
```

### 1.4 Missions Détaillées par Agent

#### ⚡ Agent Max (Backend Node.js & Flux API)
1. **Authentification OAuth2 via TikTok Login Kit** :
   * Implémenter le flux d'autorisation standard TikTok avec génération de `state` anti-CSRF et protocole PKCE (`code_verifier` / `code_challenge`).
   * Scopes demandés : `user.info.basic`, `video.upload`, `video.publish`.
   * Routes Express dédiées :
     - `GET /api/tiktok/auth/login` : Construit l'URL d'autorisation TikTok en injectant `client_key`, `scope`, `state`, et `redirect_uri`.
     - `GET /api/tiktok/auth/callback` : Réceptionne le `code`, valide le `state`, échange le code contre la paire `access_token` / `refresh_token`, récupère les métadonnées du profil (`open_id`, `display_name`, `avatar_url`), et déclenche la sauvegarde chiffrée via Victor.
     - `GET /api/tiktok/auth/status` : Renvoie au frontend l'état de connexion de l'utilisateur actif (`connected: true/false`, nom du compte, date d'expiration).
     - `POST /api/tiktok/auth/disconnect` : Révoque et supprime les identifiants en base.
2. **Sécurité Environnementale & Découplage Local/Prod** :
   * **Zéro configuration d'URL en dur** dans le code.
   * Récupération stricte de la variable `process.env.TIKTOK_CALLBACK_URL`.
   * En local : `TIKTOK_CALLBACK_URL=https://<id-ngrok>.ngrok-free.app/api/tiktok/auth/callback`
   * En production : `TIKTOK_CALLBACK_URL=https://plateforme-aya.org/api/tiktok/auth/callback`
3. **Intégration TikTok Content Posting API v2** :
   * Initialisation via `POST https://open.tiktokapis.com/v2/post/publish/video/init/` :
     - Support du mode direct : `post_mode: "DIRECT_POST"`
     - Support du mode programmé : `post_mode: "SCHEDULED_POST"`, avec `schedule_time` au format Unix Timestamp (UTC secondes).
   * **Gestion de l'Upload par Chunks (Chunked Transfer)** :
     - Découpage du fichier `.mp4` en blocs réguliers (ex: 10 Mo par chunk).
     - Envoi séquentiel par requêtes HTTP PUT sur l'`upload_url` fournie par TikTok, avec calcul précis des en-têtes `Content-Range: bytes <start>-<end>/<total>` et `Content-Length`.
   * Polling de vérification du statut : interrogation de `/v2/post/publish/status/fetch/` jusqu'à validation finale ou échec explicite.
4. **Service de Régénération de Couverture à la Demande** :
   * Endpoint `POST /api/tiktok/regenerate-cover` :
     - Reçoit : `{ originalMediaPath, newTitleText, targetLang }`.
     - Invoque l'Agent Lionel (`generate_lionel_cover`) pour générer instantanément un nouveau fichier `.jpg` avec typographie, centrage et bandeau rouge Gaza ajustés.
     - Renvoie le chemin et l'URL du nouveau visuel pour mise à jour immédiate de l'aperçu dans l'UI.

#### 🎨 Agent Lionel (Frontend React / UI Aya Studio)
1. **Gestion du Compte TikTok dans l'Interface** :
   * Bouton d'action dans la barre utilisateur ou les paramètres :
     - Si non connecté : Bouton avec logo officiel TikTok *« Lier mon compte TikTok »* ouvrant la popup OAuth2.
     - Si connecté : Badge vert *« TikTok Connecté »*, affichage du `@handle` et avatar de l'utilisateur, avec bouton discret de déconnexion.
2. **Modale "Publier sur TikTok" (Écran Post-Génération)** :
   * Apparaît sur Aya Studio dès que la vidéo est finalisée et disponible.
   * Affiche l'aperçu dynamique de la vidéo et de la couverture 9:16.
3. **Formulaire d'Édition Pré-Publication** :
   * **Édition du Titre / Couverture** :
     - Champ texte interactif pré-rempli avec le titre sémantique proposé par Nadine.
     - Bouton *« 🔄 Mettre à jour la Couverture »* : déclenche la régénération backend et rafraîchit la miniature 9:16 en direct avec animation fluide.
   * **Édition de la Légende / Description** :
     - Zone de texte éditable pré-remplie avec la Smart Description de Nadine.
     - Compteur dynamique de caractères (limite TikTok 2 200 caractères).
   * **Gestion des Hashtags** :
     - Tags générés automatiquement sous forme de badges cliquables (suppression/ajout rapide).
     - Champ d'ajout rapide de hashtags libres.
4. **Sélecteur de Mode de Publication & Programmation** :
   * Boutons radio stylisés :
     - 🚀 **Publier Maintenant** (publication immédiate).
     - 🕒 **Programmer la Publication** : Déploie un sélecteur de Date & Heure (calendrier + horloge).
     - Contrôle de cohérence : Horaires autorisés entre **+15 minutes** et **+10 jours** à partir du moment présent (règles TikTok). Conversion automatique de l'heure locale de l'utilisateur en timestamp UTC pour le backend.
5. **Feedback & Barre de Progression Interactive** :
   * Progression de l'upload chunk par chunk (0% à 100%).
   * Message de confirmation enrichi : lien vers le brouillon/post TikTok ou affichage de la confirmation d'horaire de programmation.

#### 🛡️ Agent Victor (Sécurité MongoDB & Gestion des Jetons)
1. **Chiffrement At-Rest AES-256-GCM** :
   * Schéma Mongoose `TikTokAccount` relié à l'utilisateur :
     - `userId` (référence ObjectId)
     - `openId` (identifiant unique TikTok)
     - `accessTokenEncrypted` + `accessTokenIV` + `accessTokenTag`
     - `refreshTokenEncrypted` + `refreshTokenIV` + `refreshTokenTag`
     - `expiresAt` (Date d'expiration de l'access token - standard 24h)
     - `refreshExpiresAt` (Date d'expiration du refresh token - standard 365j)
     - `displayName`, `avatarUrl`, `scope`
   * Utilisation d'un vecteur d'initialisation (IV) de 16 octets généré aléatoirement (`crypto.randomBytes(16)`) et d'un tag d'authentification GCM de 16 octets pour chaque chiffrement.
   * Clé maîtresse de 256 bits extraite de la variable d'environnement `TIKTOK_TOKEN_ENCRYPTION_KEY`.
2. **Middleware de Gestion & Rotation Transparente des Tokens** :
   * Fonction utilitaire `getValidTikTokToken(userId)` :
     - Si l'`accessToken` est encore valide (marge de sécurité > 30 minutes) : déchiffre et renvoie le token actif.
     - Si l'`accessToken` est expiré ou proche de l'expiration : déclenche automatiquement la requête de renouvellement (`grant_type=refresh_token`) auprès de l'API TikTok, rechiffre les nouveaux tokens en base et renvoie la nouvelle clé sans déconnecter l'utilisateur.
3. **Révocation & Purge RGPD** :
   * Lors de la déconnexion par l'utilisateur, suppression définitive de l'enregistrement en base et notification de révocation auprès de TikTok.

---

### 1.5 Critères de Succès & Definition of Done (DoD)

1. **Environnement & Configuration :**
   - [ ] Aucune URL Ngrok ou domaine en dur dans le code source ; la redirection OAuth2 s'appuie à 100% sur `TIKTOK_CALLBACK_URL`.
   - [ ] La commutation entre développement local (tunnel Ngrok) et production (domaine VPS) s'effectue uniquement en changeant la valeur dans le `.env`.

2. **Flux OAuth2 & Sécurité des Tokens :**
   - [ ] L'utilisateur peut connecter et déconnecter son compte TikTok en toute simplicité.
   - [ ] Tous les tokens sont chiffrés en base de données avec l'algorithme AES-256-GCM.
   - [ ] Le rafraîchissement des tokens s'opère de manière transparente sans interruption de session.

3. **Édition Pré-Publication & Couverture Dynamique :**
   - [ ] La modale permet de modifier manuellement la description, les hashtags et le titre de couverture.
   - [ ] La modification du titre régénère avec succès le fichier `.jpg` de la couverture 9:16 via Pillow et actualise l'aperçu visuel.

4. **Publication Directe & Programmation :**
   - [ ] L'upload par Chunks (Content-Range) fonctionne sans échec sur les fichiers vidéo légers et lourds.
   - [ ] Le mode "Publier Maintenant" déploie la vidéo directement sur le profil TikTok.
   - [ ] Le mode "Programmer" planifie la diffusion à la date et heure UTC spécifiées en respectant les fenêtres de TikTok (+15 min à +10 jours).
   - [ ] En cas de rejet par TikTok (format vidéo, restriction de compte, quota), un message d'erreur clair et actionnable est présenté sur l'interface.

---

## 📌 TICKET 2 : L'Agent Levantin & Intégration Google Cloud Chirp 2 (Phase 3B)

### 2.1 Fiche d'Identité du Ticket
* **Référence** : `TICKET-PHASE-3B`
* **Priorité** : Haute (Excellence Acoustique & Dialectale)
* **Statut** : Planifié (Backlog Phase 3)
* **Lead Technique** : ⚙️ Thomas (Backend Python / DSP Acoustique)
* **Parties prenantes** : 👩‍💼 Jade (Alignement & Timestamps), 🧕 Nadine (Validation Lexicale Ammiya), 🏛️ Jim (Supervision de la Cascade)

### 2.2 Objectif & Contexte Métier
Actuellement, la transcription acoustique s'appuie sur Faster-Whisper (modèle généraliste) combiné à l'Agent Jade / Gemini pour la traduction.
Pour atteindre un niveau de discernement inégalé sur les enregistrements de Gaza et de Cisjordanie (fond sonore extrême de bombardements, drones quadricoptères, interférences, pleurs et dialecte très fermé), nous devons intégrer le modèle de fondation **Google Cloud Chirp 2** (Speech-to-Text V2). Chirp 2 a été entraîné sur des millions d'heures de données multilingues et excelle spécifiquement dans les dialectes arabes régionaux (arabe levantin / palestinien).

### 2.3 Résumé de l'Architecture Technique
```
[ Fichier Média Original (.mp4 / .ogg) ]
                     │
                     ▼
       ┌───────────────────────────┐
       │   Client STT v2 Chirp 2   │ <── Auth Service Account (google_service_account.json)
       │  (Language: ar-PS / Levant)│
       └─────────────┬─────────────┘
                     │
            (Succès ou Échec ?)
            ├── [SUCCÈS] ➔ JSON Chirp 2 avec Word Time Offsets précis
            └── [ÉCHEC]  ➔ CASCADE DE SECOURS TRANSPARENTE :
                                1. Faster-Whisper Local (Int8)
                                2. Gemini 2.5 Flash Audio Direct
                     ▼
       ┌───────────────────────────┐
       │ Adaptateur Chirp2 -> ASS  │
       │ - Découpage en répliques  │
       │ - Règle Zéro Gap limitée  │
       │ - Plafonnement de fin     │
       └─────────────┬─────────────┘
                     │
                     ▼
       ┌───────────────────────────┐
       │ Traduction Contextuelle   │ <── Agent Nadine & Jade (Gemini Flash)
       │ (Conservation Timestamps) │
       └─────────────┬─────────────┘
                     │
                     ▼
       [ Fichier .ASS & Rendu Vidéo ]
```

### 2.4 Missions Détaillées par Agent

#### ⚙️ Agent Thomas (Backend Python & Moteur Acoustique)
1. **Client Python Google Cloud Speech-to-Text V2 (`chirp_client.py`)** :
   * Installer et configurer la bibliothèque `google-cloud-speech>=2.25.0`.
   * Définir la configuration de reconnaissance :
     * Modèle : `chirp_2` (ou fallback `chirp`).
     * `language_codes = ['ar-PS', 'ar-IL', 'ar-JO']` (Priorité Arabe Palestinien / Levantin).
     * `enable_word_time_offsets = True` (Alignement mot à mot précis au centième de seconde).
     * `features = RecognitionFeatures(enable_automatic_punctuation=True)`.
   * Support des fichiers longs (> 1 min) via upload Cloud Storage temporaire ou streaming gRPC par chunks.
2. **Convertisseur Chirp JSON ➔ Blocs Temporels Métier** :
   * Fonction `parse_chirp_to_subtitles(chirp_response)` :
     * Grouper les mots en sous-titres naturels (1,8s à 4,0s, max 36 caractères par ligne).
     * Préserver les timestamps acoustiques exacts de début et fin de chaque bloc.
3. **Application des Règles de Robustesse Acoustique** :
   * Appliquer la règle du **Zéro-Gap Limité** (raccord si gap <= 1.2s sans silence franc).
   * Appliquer le **Filtre de Silence d'Outro** (suppression de tout résidu au-delà de la fin de voix détectée).
   * Plafonner strictement la dernière réplique pour éviter tout étirement sur bruit résiduel.

#### 👩‍💼 Agent Jade & 🧕 Agent Nadine (Supervision Linguistique)
1. **Pont Chirp ➔ Traduction Contextuelle** :
   * Passer les blocs transcrits par Chirp 2 à la fonction `gemini_batch_translate_units()` pour obtenir une traduction française poignante (VOSTFR) ou une normalisation Ammiya Gaza (VOAR).
   * Garantir que le vocabulaire sensible (martyrs, camps, centres d'hébergement, vocatifs fraternels) bénéficie du lexique strict de Nadine.
2. **Benchmarking Comparatif (Whisper vs Chirp 2)** :
   * Valider sur 10 vidéos d'archive complexes (dont *Soso 18 août* et *Al-Sawiya*) le taux de reconnaissance des mots en dialecte pur (ex: `هلقيت`, `طركتر`, `حاوية`).

#### 🏛️ Agent Jim (Gestion des Clés & Résilience de la Cascade)
1. **Gestion des Identifiants Google Cloud** :
   * Utiliser le fichier de Service Account existant (`google_service_account.json`) en activant l'API Cloud Speech-to-Text V2 sur le projet GCP.
   * Variable d'environnement de contrôle : `ENABLE_CHIRP_STT=true/false`.
2. **Cascade de Fallback Triple Palier** :
   * Si Chirp 2 renvoie une erreur (quota, timeout réseau, absence d'accès GCP STT v2) :
     1. Bascule automatique et silencieuse sur **Faster-Whisper local**.
     2. Si indisponible, bascule sur **Gemini 2.5 Flash Audio direct**.
   * Garantir une tolérance absolue aux pannes : le pipeline ne doit jamais planter.

### 2.5 Critères de Succès & Definition of Done (DoD)
- [x] Le client Chirp 2 est opérationnel et reconnaît l'arabe palestinien dialectal avec ponctuation automatique et horodatage mot à mot.
- [x] Le convertisseur transforme le flux Chirp 2 en sous-titres `.ass` parfaitement rythmés sans chevauchement ni trou artificiel.
- [x] La cascade de repli (Chirp 2 ➔ Whisper ➔ Gemini) est testée et fonctionne sans interruption en cas de panne réseau ou de simulation d'erreur 429.
- [x] La synchronisation sur environnement bruyant (drone, rue, foule) égale ou dépasse la précision humaine.

---

## 📌 TICKET 3 : Migration VPS & Bascule Production TikTok (Phase 3B-PROD)

### 3.1 Fiche d'Identité du Ticket
* **Référence** : `TICKET-PHASE-3B-PROD`
* **Priorité** : Haute (Mise en Ligne & Déploiement Serveur VPS)
* **Statut** : 🧊 **En attente** (Bloqué jusqu'à la résolution de toutes les issues locales)
* **Assignés** : ⚡ Max (Lead Backend & Configuration Environnement) & 🛡️ Victor (Sécurité & Base de Données)
* **Parties prenantes** : 🎨 Lionel (Validation Frontend & Expérience Utilisateur), 🏛️ Tech Lead (Gestion Console TikTok Developers)

### 3.2 Objectif & Contexte
Le pipeline local a passé tous les tests de résilience avec succès. Ce ticket devra être activé uniquement lorsque l'application sera prête à être mise en ligne sur un serveur dédié avec un nom de domaine officiel (ex : `https://plateforme-aya.org`).

### 3.3 Checklist d'Exécution Officielle
- [ ] **1. Préparation VPS** : Cloner la branche `main` de production sur le serveur VPS.
- [ ] **2. Achat & Link du Domaine** : Lier le serveur VPS au nom de domaine officiel avec certificat SSL (Let's Encrypt / Certbot).
- [ ] **3. Configuration de l'Environnement (`.env` PROD)** :
  * Remplacer toutes les références à Ngrok par le nom de domaine officiel du serveur.
  * Mettre à jour `TIKTOK_CALLBACK_URL` avec la route de production (`https://[mon-domaine.com]/api/tiktok/auth/callback`).
  * Configurer `NODE_ENV=production`, `PYTHON_ENV=production`, `AYA_EXEC_PROFILE=cloud_vps_safe`.
- [ ] **4. Sécurité Cryptographique (Agent Victor)** :
  * Générer de nouvelles clés de chiffrement AES-256-GCM spécifiques à la base de données de production pour isoler totalement les tokens des utilisateurs finaux (`TIKTOK_TOKEN_ENCRYPTION_KEY`).
- [ ] **5. Bascule TikTok Developer (Portail Administrateur)** :
  * Basculer l'application du mode "Sandbox" à "Production" sur le portail développeur TikTok.
  * Mettre à jour les Redirect URIs avec l'adresse du domaine (`https://[mon-domaine.com]/api/tiktok/auth/callback`).
  * Configurer les URLs des CGU et Politique de Confidentialité (`/terms`, `/privacy`).
- [ ] **6. Démarrage & Recette** :
  * Démarrer les services de production (via PM2 ou Docker).
  * Confirmer que l'interface de connexion TikTok s'ouvre correctement depuis le nom de domaine public et que le flux OAuth2 se finalise avec succès.


