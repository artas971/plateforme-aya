# 📜 CAHIER DES CHARGES MAÎTRE & SPÉCIFICATIONS TECHNIQUES
## PROJET AYA — PLATEFORME D'INTELLIGENCE ARTIFICIELLE AUDIOVISUELLE BILINGUE (FRANÇAIS 🇫🇷 ↔ ARABE PALESTINIEN DE GAZA 🇵🇸)

---

### 📑 TABLE DES MATIÈRES
1. [Vision Globale, Objectifs & Identité du Projet](#1-vision-globale-objectifs--identité-du-projet)
2. [Architecture du Conseil des Agents IA (Rôles & Missions)](#2-architecture-du-conseil-des-agents-ia-rôles--missions)
3. [Charte Linguistique & Dialectale de Gaza (Gold Standard)](#3-charte-linguistique--dialectale-de-gaza-gold-standard)
4. [Protocole Acoustique & Sous-Titrage Dynamique (.ASS)](#4-protocole-acoustique--sous-titrage-dynamique-ass)
5. [Modules Métier & Pipeline de Traitement](#5-modules-métier--pipeline-de-traitement)
6. [Pack Post-Vidéo Optionnel (Couverture 9:16 & Copywriting TikTok)](#6-pack-post-vidéo-optionnel-couverture-916--copywriting-tiktok)
7. [Charte Graphique Officielle & Design System (UI/UX)](#7-charte-graphique-officielle--design-system-uiux)
8. [Module Feedback Testeur & Connecteur GitHub Automatisé](#8-module-feedback-testeur--connecteur-github-automatisé)
9. [Infrastructure Technique, I/O, Cache & Synchronisation Drive](#9-infrastructure-technique-io-cache--synchronisation-drive)
10. [Phase 2 : Plateforme Publique, Communauté & Monétisation](#10-phase-2--plateforme-publique-communauté--monétisation)

---

## 1. VISION GLOBALE, OBJECTIFS & IDENTITÉ DU PROJET

### 1.1 Identité & Séparation Stricte
* **Nom officiel unique** : **Projet Aya** (ou **Plateforme Aya**).
* **Règle absolue** : Exclusion totale de toute autre dénomination historique ou externe (telle que *Metamorphosis*). Le projet est dédié à 100% à Aya, Soso et la transmission authentique des témoignages de Palestine.

### 1.2 Mission Principale
* Transformer des enregistrements vocaux et vidéos réels (souvent enregistrés dans des conditions extrêmes de guerre, de bruit de drones, d'explosions et de coupures de réseau) en médias professionnels prêts à la diffusion internationale.
* Assurer une fidélité émotionnelle, dialectale et factuelle absolue : traduire le vécu brut sans adoucir, sans censurer et sans dénaturer.
* Fournir une chaîne de production automatisée complète :
  1. Transcription multimodale acoustique.
  2. Traduction dialectale fine (Gaza Ammiya ↔ Français).
  3. Génération de sous-titres animés `.ASS` calibrés pour les formats verticaux 9:16 (TikTok, Reels, Shorts).
  4. Encodage vidéo matériel direct via FFmpeg.
  5. Audit automatique par un Conseil de 7 Agents IA.
  6. Génération conditionnelle de kits de publication (Miniature 9:16 + Copywriting optimisé).

### 1.3 Contraintes Techniques Fondatrices
* **Zéro CPU Local pour l'IA** : L'ingérence et le traitement de la parole sont délégués aux modèles multimodaux de pointe (Gemini 2.5 Flash) via API cloud.
* **Résilience Anti-Quota (Cascade Multi-Modèles)** : Mécanisme de fallback automatique transparent (`gemini-2.5-flash` ➔ modèles alternatifs de secours) garantissant un taux de disponibilité de 100%.
* **Compatibilité Système Windows** : Gestion sécurisée des contraintes `MAX_PATH` et nettoyage des caractères spéciaux pour éviter tout blocage de système de fichiers.

---

## 2. ARCHITECTURE DU CONSEIL DES AGENTS IA (RÔLES & MISSIONS)

Le cœur décisionnel de la Plateforme Aya est articulé autour d'un collège de **7 Agents IA Spécialisés**, intervenant en audit automatique post-production ou lors de consultations interactives de l'utilisateur :

```
                     ┌────────────────────────┐
                     │       🏛️ JIM           │
                     │  Superviseur Général   │
                     │  (Synthèse & Verdict)  │
                     └───────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
 ┌───────┴────────┐      ┌───────┴────────┐      ┌───────┴────────┐
 │   👩‍💼 JADE     │      │   🧕 NADINE    │      │   🎨 LIONEL    │
 │ Linguistique & │      │ Dialecte Gaza  │      │ Direct. Artist.│
 │ Synchronisation│      │ & Lexique Pur  │      │ & Graphisme    │
 └────────────────┘      └────────────────┘      └────────────────┘
         │                       │                       │
 ┌───────┴────────┐      ┌───────┴────────┐      ┌───────┴────────┐
 │    🎬 MAX      │      │   📱 STEVE     │      │   🛡️ THOMAS    │
 │ Montage Vidéo  │      │ Chef de Projet │      │ Architecte I/O │
 │ & Encodage     │      │ Rétention TikTok│     │ & QA Feedback  │
 └────────────────┘      └────────────────┘      └────────────────┘
```

### 2.1 Fiches de Rôle des 7 Agents du Conseil

| Agent | Rôle / Spécialité | Critères d'Évaluation & Mission |
| :--- | :--- | :--- |
| **Jim** | Superviseur Général & Arbitre | Coordonne les avis du collège, calcule la note globale (/100) et délivre le verdict officiel (*"VALIDÉ POUR DIFFUSION 🚀"* ou *"RÉVISION SUGGÉRÉE ⚠️"*). |
| **Jade** | Senior Linguiste & Synchronisation | Contrôle la règle **Zero-Gap**, vérifie le seuil de confort des segments ($\le 4.5\text{s}$), la vitesse de lecture (caractères par seconde) et le lip-sync. |
| **Nadine** | Traductrice Spécialiste Arabe Gaza | Gardienne de la pureté du dialecte ammiya de Gaza. Traque les résidus alphabétiques indésirables, valide le lexique sous blocus et interdit le fusha artificiel. |
| **Lionel** | Directeur Artistique & Graphiste | Supervise la composition 9:16, le positionnement `MarginV`, le contraste OLED des polices (Impact 72), et conçoit la couverture abstraite TikTok "Zéro Humain". |
| **Max** | Monteur & Ingénieur Encodage | Inspecte les paramètres techniques du conteneur MP4 : codec H.264, flux audio AAC, drapeau `+faststart` pour streaming immédiat, débit binaire et intégrité. |
| **Steve** | Chef de Projet & Rétention TikTok | Maximise l'accroche des 3 premières secondes (Hook), optimise le découpage séquentiel et rédige le copywriting de publication engageant avec CTA et hashtags. |
| **Thomas** | Architecte Back-End, I/O & QA | Assure la sécurité du pipeline, la normalisation des noms de fichiers, le triage IA des retours testeurs et la création automatique des tickets GitHub. |

---

## 3. CHARTE LINGUISTIQUE & DIALECTALE DE GAZA (GOLD STANDARD)

La Plateforme Aya intègre un moteur de traduction acoustique directe entraîné sur le parler réel de Gaza. Le modèle respecte scrupuleusement les 4 règles d'or suivantes :

### 3.1 Adresses Directes & Noms Propres (Priorité Absolue)
* **Vocatifs préservés** : Ne jamais supprimer ni affadir les apostrophes fraternelles :
  * *"يا أخي ستيف"* ➔ **« Mon frère Steve »** (Français) / *"أخوي ستيف"* (Arabe).
  * *"يا أختي سوسو"* ➔ **« Ma sœur Soso »** (Français) / *"أختي سوسو"* (Arabe).
* **Narrative à la 3ème personne** : Si Soso parle d'elle-même pour exprimer son endurance :
  * *"سوسو صابرة، سوسو بتضحك، سوسو بتطلع على اللايفات"* ➔ **« Soso est forte, Soso est patiente, Soso rit, Soso va sur les lives... »**.
* **Interdiction absolue de l'amnésie de début ou fin de discours** : Retranscription intégrale sans résumé du premier au dernier son prononcé.

### 3.2 Lexique Toponymique & Ancrage Géographique à Gaza
Aucune hallucination géographique n'est tolérée. Dictionnaire de référence obligatoire :

| Terme Arabe Dialectal | Traduction Française Certifiée | Contexte Gaza |
| :--- | :--- | :--- |
| **المينة / ميناء غزة** | **Le Port de Gaza (Al-Mina)** | À ne jamais traduire par "la ville". |
| **الخط الأصفر** | **La Ligne Jaune** | Zone militaire tampon côtière. |
| **الزوارق البحرية / البحرية** | **Les canonnières / Vedettes de la marine** | Tirs d'artillerie venant de la mer. |
| **القطاع** | **La Bande de Gaza / Le secteur** | Territoire de Gaza. |
| **الخيام / مراكز الإيواء** | **Les camps de tentes / Centres d'accueil** | Zones de déplacés. |
| **جباليا / مخيم جباليا** | **Jabalia / Camp de Jabalia** | Nord de Gaza. |
| **كابون / كوبون** | **Coupon d'aide alimentaire** | Rations humanitaires. |
| **جرافة / جرافات** | **Bulldozers militaires** | Démolition de maisons. |
| **راية بيضا** | **Drapeau blanc** | Déplacement sous drapeau blanc. |
| **أم علاء / علاء** | **Oum Alaa / Alaa** | Noms de personnes réelles. |

### 3.3 Expressions Idiomatiques & Réalité sous les Bombardements
* **بحط المخدة على راسي** ➔ **« Je mets l'oreiller sur ma tête »** *(pour atténuer le fracas des bombes)*.
* **صوت الزنانة / طيران الإف 16** ➔ **« Le bourdonnement continu des drones / Les chasseurs F-16 »**.
* **القلب مليان / مش قادرين نتحمل** ➔ **« Le cœur est lourd / Nous n'en pouvons plus »**.
* **طايرين في الهواء / طاروا إرباً** ➔ **« Voler en éclats / Déchiquetés par le souffle »**.
* **حتى الحيوان ما بيتحمل هيك** ➔ **« Même un animal ne pourrait supporter une telle épreuve »**.
* **Formules de foi** :
  * *حسبي الله ونعم الوكيل* ➔ **« Dieu nous suffit, Il est le meilleur Protecteur »**.
  * *الله يرحم الشهداء* ➔ **« Que Dieu fasse miséricorde aux martyrs »**.

### 3.4 Sens de Traduction Supportés
1. **VOSTFR (Arabe Palestinien ➔ Français)** : Discours authentique en dialecte de Gaza avec sous-titres français fluides et poignants.
2. **VOAR (Français ➔ Arabe Palestinien Ammiya)** : Messages de soutien traduits dans la langue de cœur des Gazaouis, excluant l'Arabe classique rigide.

---

## 4. PROTOCOLE ACOUSTIQUE & SOUS-TITRAGE DYNAMIQUE (.ASS)

### 4.1 Règle "Zero-Gap" & Continuité Visuelle
* **Principe de flux ininterrompu** : Le temps de fin du segment $N$ coïncide exactement avec le temps de début du segment $N+1$ ($\text{End}_N = \text{Start}_{N+1}$).
* **Gestion des silences** : Une coupure visuelle n'est appliquée que si un silence absolu mesuré dépasse **$0,30\text{ seconde}$**.
* **Durée maximale de segment** : Aucun sous-titre ne doit dépasser **$4,5\text{ secondes}$** afin d'éviter la fatigue oculaire sur mobile.

### 4.2 Métrique et Cadence d'Affichage
* **Volume par bloc** : 6 à 8 mots maximum par bloc d'affichage.
* **Structure multi-lignes** : Répartition sur 2 lignes équilibrées à l'aide de la balise de saut de ligne `\N`.
* **Propreté typographique** : Aucun segment ne doit commencer par un symbole de ponctuation orphelin (virgule, point d'interrogation, tiret).

### 4.3 Styles ASS v4.00+ Standardisés (Cadre 1080x1920)

```ini
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Impact,72,&H0000FFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,950,1
```

* **Positions Verticales Paramétrables** :
  * ⬇️ **Bas (950)** : Alignement 2, `MarginV: 950` *(Standard TikTok/Reels pour dégager les boutons d'interaction latéraux et le bandeau de description)*.
  * ↕️ **Milieu (500)** : Alignement 5, `MarginV: 500` *(Centre de l'attention visuelle)*.
  * ⬆️ **Haut (150)** : Alignement 8, `MarginV: 150` *(Sous l'en-tête de chaîne)*.
* **Palette de Couleurs de Texte Prédéfinies** :
  * 🟡 **Jaune Cyber** : `#FFFF00` (`&H0000FFFF`) — Couleur par défaut à contraste maximal.
  * ⚪ **Blanc Pur** : `#FFFFFF` (`&H00FFFFFF`) — Style classique épuré.
  * 🟢 **Vert Émeraude** : `#00E676` (`&H0076E600`) — Teinte fraîche et dynamique.
  * 🔵 **Cyan Électrique** : `#38BDF8` (`&H00F8BD38`) — Style néon moderne.

---

## 5. MODULES MÉTIER & PIPELINE DE TRAITEMENT

### 5.1 Module 1 : Studio Vidéo TikTok V3 (`/traduction` et `/studio`)
* **Entrées acceptées** : Vidéos (`.mp4`, `.mov`, `.mkv`, `.webm`) ou Audios purs (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.flac`) jusqu'à 500 Mo.
* **Mode Audio pur** : Conversion automatique en vidéo verticale 9:16 avec image d'arrière-plan sobre officielle (`temoignage_gaza_bg.jpg`).
* **Streaming en Temps Réel** : Communication chunked HTTP renvoyant les balises `[PROGRESS] XX% - Message` pour une fluidité totale de la jauge côté utilisateur.
* **Sorties générées** :
  * Vidéo finale incrustée `.mp4` prête à publier.
  * Fichier de sous-titres source `.ass`.
  * Rapport d'audit complet du Conseil des Agents en JSON.

### 5.2 Module 2 : Traduction Texte Express (`aya_audio_markdown_protocol.md`)
* Traduction textuelle directe d'un fichier audio en Texte Brut Markdown (`.md`) ou pour affichage interactif direct avec bouton **Copier**.
* Court-circuite l'encodage vidéo FFmpeg pour une restitution en moins de 5 secondes.

### 5.3 Module 3 : Pont Telegram (Importation & Traduction via Lien Public) — Issue #15
* **Intégration du Bot** : Connexion avec le bot Telegram officiel `@johncreasybotbot` via variable d'environnement `TELEGRAM_BOT_TOKEN`.
* **Entrées acceptées** : Liens publics Telegram (`https://t.me/canal/123`, `t.me/canal/123`, ou `t.me/c/...`).
* **Stratégie de Téléchargement Hybride & Résiliente** :
  1. *Téléchargement haute performance via yt-dlp* (`py -m yt_dlp`) avec extraction directe des flux vidéo et audio sans restriction de quota bot.
  2. *Scraping Fallback Intégré* : En cas d'indisponibilité ou lien léger, scraping de la page publique de post Telegram (`https://t.me/{canal}/{id}?embed=1`) et extraction du tag `<video src>` / `<audio src>`.
* **Interface UI Unifiée** :
  * Séparateur stylisé "OU" et champ d'importation Telegram responsive avec bouton "Coller" (Presse-papier) et bouton d'effacement rapide.
  * Support bilingue FR/AR instantané avec adaptation RTL automatique.
* **Pipeline Asynchrone & Streaming** :
  * Envoi d'événements de progression temps réel `[PROGRESS] 5% - Connexion au lien Telegram...`, `[PROGRESS] 25% - Téléchargement du média...`, etc.
  * Stockage immédiat dans le dossier tampon `audio_a_traiter/` avec normalisation du nom de fichier.
  * Relais transparent vers le pipeline `process_traduction.py` (transcription, traduction Ammiya Gaza, sous-titres `.ass`, et encodage vidéo/pack post-vidéo).

---

## 6. PACK POST-VIDÉO OPTIONNEL (COUVERTURE 9:16 & COPYWRITING TIKTOK)

Ce module est **strictement conditionnel** et activable via la case à cocher Turquoise `#00bcd4` du formulaire.

### 6.1 Déclenchement & Conditions
* **Option NON cochée** : Seuls la vidéo `.mp4` et le `.ass` sont générés. Les tâches graphiques et rédactionnelles sont court-circuitées.
* **Option COCHÉE** : Déclenchement simultané des agents Lionel et Steve.

### 6.2 Couverture 9:16 par Lionel (Directeur Artistique)
* **Dimensions** : $1080 \times 1920\text{ px}$ (ratio 9:16 vertical).
* **Philosophie visuelle** : **Zéro Humain**, design abstrait géométrique respectueux de la dignité.
* **Palette Stricte** :
  * Fond sombre texturé : Noir profond `#070B12`.
  * Rubans angulaires aux couleurs palestiniennes : Blanc `#FFFFFF`, Vert `#007A3D`, Rouge `#CE1126`.
  * Liseré interne géométrique fin et badge de collection.
* **Typographie** : Police **Impact** centrée avec ombre portée contrastée pour un détachement parfait sur l'écran d'accueil TikTok.
* **Fichier produit** : `{clean_stem} (Couverture 9-16).jpg`.

### 6.3 Copywriting & Description par Steve (Chef de Projet Rétention)
* **Génération IA** : Requête structurée adressée à Gemini 2.5 Flash.
* **Format rigide (.txt)** :
  1. **Hook (Accroche)** : Une phrase choc qui captive dès la première seconde.
  2. **Contexte factuel** : Exactement deux lignes résumant l'événement sans extrapolation.
  3. **Call To Action (CTA)** : Invitation claire au partage et au soutien.
  4. **Hashtags optimisés** : Mélange de mots-clés d'actualité et de marque (`#Gaza #Palestine #Soso #Aya #UrgenceGaza #Temoignage`).
* **Fichier produit** : `{clean_stem} (Description TikTok).txt`.

### 6.4 Distribution Automatique
* Téléchargement local direct sur la page `/traduction` (boutons dédiés).
* Téléversement automatique dans le dossier Google Drive **`03_TERMINE`**.

---

## 7. CHARTE GRAPHIQUE OFFICIELLE & DESIGN SYSTEM (UI/UX)

Conçue par la direction artistique pour unifier l'expérience utilisateur et refléter l'identité du projet :

### 7.1 Palette Chromatique Web Stricte

```css
:root {
    --color-primary-blue: #0b5394;   /* Bleu Primaire : Navbar, en-têtes majeurs */
    --color-turquoise:    #00bcd4;   /* Turquoise : Boutons d'action, accents, hover, feedback */
    --color-dark-gray:    #434343;   /* Gris Foncé : Typographie principale, titres */
    --color-gray-secondary: #999999; /* Gris Secondaire : Sous-titres, bordures fines */
    --color-white:        #ffffff;   /* Blanc : Fonds de cartes, modales, contrastes */
}
```

### 7.2 Typographie Adaptative Bilingue (Google Fonts)
* **Mode Arabe (`html[dir="rtl"]`)** :
  * Police unique : **Cairo** (`wght@400;500;600;700;800`).
  * Appliquée à **100% des éléments** pour une lisibilité arabe optimale.
* **Mode Français (`html[dir="ltr"]`)** :
  * Police littéraire et éditoriale : **Amiri** pour les titres et corps de texte narratif.
  * Police fonctionnelle et technique : **Plus Jakarta Sans** pour les composants d'interface (boutons, badges, inputs, menus de navigation).

### 7.3 Navbar Partagée & État Linguistique Persistant
* **Composant unique** présent sur toutes les pages (`/`, `/traduction`, `/studio`).
* **Sélecteur de Langue instantané** : Français 🇫🇷 ↔ Arabe 🇵🇸 avec inversion dynamique de la direction de lecture (LTR / RTL).
* **Persistance** du choix de langue et de l'utilisateur dans le `localStorage` (`aya_lang`, `aya_user`).

---

## 8. MODULE FEEDBACK TESTEUR & CONNECTEUR GITHUB AUTOMATISÉ

### 8.1 Périmètre & Objectif
Permettre aux testeurs habilités (Anaïs, Aya, Soso, Steve/Artas, John) de remonter bugs et suggestions directement depuis l'interface web, sans quitter l'application.

### 8.2 Règles Fondamentales
* **Préservation intégrale** : Le message brut d'origine du testeur ne doit **JAMAIS** être tronqué ni altéré.
* **Triage IA automatique par l'Agent Thomas** :
  * Qualification automatique : `Bug` ou `Feature`.
  * Génération d'un titre court et percutant.
  * Audit de reproduction technique et estimation de sévérité.
* **Création instantanée d'Issue GitHub** sur le dépôt officiel (`artas971/plateforme-aya`) avec labels automatiques (`bug`, `enhancement`, `feedback-testeur`).
* **Notification Webhook** pour alerte en direct de l'équipe d'ingénierie.

---

## 9. INFRASTRUCTURE TECHNIQUE, I/O, CACHE & SYNCHRONISATION DRIVE

### 9.1 Stack Logicielle
* **Serveur d'application** : Node.js (v18+) avec Express, Multer, Server-Sent Events / Chunked Streaming.
* **Moteur Multimédia & Traitement** : Python 3.10+, FFmpeg 6.0+ (accélération matérielle NVENC / libx264), Pillow 11.3+, Google GenAI SDK.
* **API Cloud Principale** : Google Gemini 2.5 Flash.

### 9.2 Arborescence des Répertoires Clés
```
aya/
├── public/                     # Interface Web (HTML5, CSS3, JS, Assets)
│   ├── index.html              # Accueil & Vocal
│   ├── traduction.html         # Studio Traduction & Sous-titres V3
│   ├── aya-i18n.js             # Moteur de traduction FR/AR & Navbar partagée
│   ├── feedback-widget.js      # Bouton flottant & modale de signalement
│   └── style.css               # Feuilles de styles officielles
├── routes/                     # Contrôleurs Express
│   ├── traduction.js           # API de traitement & streaming
│   ├── agents.js               # API de consultation & audit du Conseil
│   └── feedback.js             # API de triage IA & connecteur GitHub
├── services/                   # Services métier d'orchestration
│   ├── agentSupervisor.js      # Moteur d'audit automatique des 7 agents
│   └── driveWorker.js          # Synchronisation Google Drive Service Account
├── cache_transcriptions/       # Cache déterministe (hash MD5 + langue)
├── audio_a_traiter/            # Fichiers temporaires en entrée
├── fichiers_reponse_a_envoyer/ # Livrables finalisés (.mp4, .ass, .jpg, .txt)
└── process_traduction.py       # Moteur Python de transcription & encodage
```

### 9.3 Gestion du Cache & Bypass Cache
* Pour chaque média, un hash unique est généré à partir de son empreinte et de la langue cible.
* Si le résultat existe en cache, le traitement est instantané.
* Un bouton **Bypass Cache** (`🔄 Forcer le retraitement`) permet à l'utilisateur d'invalider le cache et de forcer une nouvelle transcription et traduction complète.

### 9.4 Stockage Centralisé Master Drive & Sauvegarde Automatique (Correction V1.1)
* **Architecture Single-Tenant Admin (Sans flux OAuth2 utilisateur)** :
  * Annulation définitive de l'OAuth2 par utilisateur. Le stockage des livrables est centralisé sur le Google Drive de l'Administrateur (Master Drive).
  * Authentification serveur directe via un Compte de Service Google Cloud (`credentials.json` à la racine ou `GOOGLE_SERVICE_ACCOUNT_FILE`).
* **Arborescence Dynamique & Idempotente** :
  * Le serveur crée et organise automatiquement les dossiers : `[GOOGLE_DRIVE_FOLDER_ID] / [Client Name] / [YYYY-MM-DD] / <livrables>`.
  * Le nom du client est résolu à partir de la session utilisateur connectée (`req.session.user.name`) ou du paramètre `client_name` (fallback : `Client`).
* **Partage Public Universel ("Anyone with the link can view")** :
  * Dès la création du sous-dossier ou le téléversement des livrables (vidéo MP4, sous-titres ASS, couverture, script), la permission est automatiquement définie sur `role: "reader", type: "anyone"`.
* **Expérience Dashboard & Bouton "Lien de Sauvegarde"** :
  * L'utilisateur Premium n'a aucun compte Google à associer.
  * Son tableau de bord affiche instantanément un bouton officiel **"Lien de Sauvegarde"** pointant directement vers le lien public de consultation `webViewLink` sur le Drive de l'Admin.
* **Note d'Infrastructure (Google Cloud Quotas)** :
  * Les comptes de service Google Cloud ne disposant pas de quota sur les Drives personnels standards (`@gmail.com`), le dossier racine Admin est idéalement hébergé sur un Google Shared Drive (Google Workspace) pour autoriser les flux de téléversement binaire sans restriction de quota. Le service gère ce cas avec grâce et fournit toujours un lien valide vers le dossier client.

---

## 10. PHASE 2 : PLATEFORME PUBLIQUE, COMMUNAUTÉ & MONÉTISATION

### 10.1 Vision de la Phase 2 : De l'Outil de Production au Média Communautaire
La Phase 1 a doté le Projet Aya d'un moteur industriel complet de traduction dialectale, de transcription acoustique et d'encodage audiovisuel. La Phase 2 étend ce périmètre en construisant un écosystème public bilingue complet, permettant d'amplifier la voix des civils palestiniens, de fédérer une communauté solidaire mondiale et d'assurer l'autonomie financière et opérationnelle du projet.

---

### 10.2 Espace Front-End Public & Fil d'Actualité Communautaire
* **Fil d'actualité moderne & réactif (Newsfeed / Wall)** :
  * Espace public accessible sans restriction technique pour consulter des annonces vérifiées, des alertes de terrain, des témoignages textuels, des notes vocales et des vidéos sous-titrées.
  * Système de filtres par thématiques (Urgence humanitaire, Récits de vie, Témoignages d'enfants, Analyses factuelles).
  * Affichage en cartes multimédias riches (lecteur vidéo 9:16 intégré, lecteur audio interactif avec onde sonore, transcription bilingue déroulante).
* **Espace d'expression & de dépôt participatif** :
  * Formulaire public permettant aux utilisateurs de déposer des annonces de soutien, des messages de solidarité et des vidéos/audios documentant la situation palestinienne.
  * File d'attente de modération préalable (automatisée via l'Agent Jim pour détection de spam/contenus haineux + validation humaine) avant publication officielle.
* **Ergonomie & Internationalisation Native** :
  * Conception bilingue Français 🇫🇷 / Arabe 🇵🇸 avec support bidirectionnel (LTR / RTL) et polices officielles `Plus Jakarta Sans` / `Amiri` / `Cairo`.
  * Optimisation mobile-first adaptée à une consommation fluide sur smartphone.

---

### 10.3 Création de l'Identité Visuelle & Logo Officiel
* **Direction Artistique par Lionel** :
  * Création d'un logo officiel professionnel, moderne et intemporel incarnant la mission d'Aya : la transmission fidèle de la parole palestinienne par la lumière et la technologie.
  * Respect strict de la charte graphique : Bleu Primaire (`#0b5394`), Turquoise marque (`#00bcd4`), Noir profond, Blanc pur et accents aux couleurs palestiniennes (Noir, Blanc, Vert, Rouge).
  * Règle d'or maintenue : Approche symbolique et géométrique "Zéro Humain" (ondes vocales stylisées, calligraphie arabe moderne du prénom "آية / Aya", typographie contemporaine).
* **Déclinaisons & Kit de Marque** :
  * Formats vectoriels haute résolution (SVG master, PNG transparent 4K).
  * Variantes responsive : Favicon (32x32, 64x64), avatar réseaux sociaux (1:1), logo horizontal pour Navbar, et logo vertical pour écrans de chargement et miniatures.
  * Guidelines d'utilisation, zones d'exclusion et contrastes accessibilité (WCAG AA).

---

### 10.4 Architecture de Base de Données Persistante
* **Transition Technologique** :
  * Remplacement du stockage temporaire en mémoire et des fichiers JSON plats par une base de données relationnelle ou documentaire scalable (ex: **PostgreSQL** avec Prisma/TypeORM ou **MongoDB** avec Mongoose).
* **Modélisation des Données & Schémas** :
  * **Utilisateurs & Profils (`users`)** : Identifiant unique, email vérifié, hash de mot de passe sécurisé (Argon2 / bcrypt), rôle (`public`, `contributor`, `subscriber`, `moderator`, `admin`), langue préférée, date d'inscription.
  * **Abonnements & Transactions (`subscriptions` / `payments`)** : Statut de l'abonnement (`active`, `past_due`, `canceled`), identifiant client Stripe/PayPal, plan souscrit, historique des factures et dates de renouvellement.
  * **Publications & Annonces (`posts`)** : Type de contenu (`announcement`, `testimony`, `audio`, `video`), texte source, traduction, URL des médias (Drive/S3/CDN), statut de modération (`pending`, `approved`, `rejected`), compteurs de vues et de partages.
  * **Interactions & Commentaires (`interactions`)** : Réactions de solidarité, commentaires bilingues modérés, signalements de contenu.
* **Indexation, Cache & Haute Disponibilité** :
  * Indexation full-text multilingue (recherche en français et en arabe).
  * Cache Redis pour les flux publics à fort trafic et les sessions utilisateurs.

---

### 10.5 Modèle Économique Freemium & Monétisation Durable
Afin de financer les coûts récurrents d'infrastructure (appels API Gemini, serveurs GPU d'encodage vidéo, bande passante de streaming, hébergement base de données), la plateforme adopte un modèle Freemium transparent :

* **Niveaux d'Accès & Fonctionnalités** :
  1. **Niveau Gratuit (Public & Visiteurs)** :
     * Consultation libre et illimitée du fil d'actualité et des médias publics.
     * Soumission de messages de soutien et annonces (soumises à modération).
     * Quota de découverte pour l'outil de traduction (ex: 2 traductions express par jour, vidéos limitées à 30 secondes en résolution standard).
  2. **Niveau Soutien / Membre Engagé (Abonnement Mensuel / Annuel ou Don Libre)** :
     * Traduction audio et vidéo illimitée en haute résolution (1080x1920 60fps).
     * Priorité absolue dans la file de rendu FFmpeg et de transcription IA.
     * Déblocage complet du Pack TikTok (Génération automatique de la Couverture 9:16 HD & Copywriting optimisé par Steve).
     * Badge donateur exclusif à côté du nom sur le mur communautaire.
     * Accès anticipé aux nouvelles fonctionnalités et aux rapports d'impact.
* **Passerelles de Paiement Sécurisées** :
  * Intégration de **Stripe** pour les paiements par cartes bancaires (CB, Visa, Mastercard) et prélèvements SEPA avec webhooks automatiques de synchronisation d'état.
  * Intégration de **PayPal** pour les dons ponctuels et paiements internationaux simplifiés.
  * Génération automatique de reçus de don et factures conformes.

---

### 10.6 Stricte Conformité Légale France & RGPD
* **Cadre Juridique Français & Européen** :
  * Rédaction et intégration des **Mentions Légales** obligatoires (loi LCEN) : identification de l'éditeur du site, coordonnées du directeur de publication, coordonnées complètes de l'hébergeur.
  * **Conditions Générales d'Utilisation (CGU)** : Règles de respect mutuel, charte de bienveillance, interdiction des propos diffamatoires ou haineux, clauses de modération et de responsabilité.
  * **Conditions Générales de Vente (CGV)** : Tarifs clairs en euros TTC, droit de rétractation et modalités de désabonnement en un clic pour les souscriptions.
* **Protection des Données Personnelles (RGPD / CNIL)** :
  * Politique de confidentialité transparente détaillant les finalités de chaque traitement de données.
  * Gestion du consentement pour les cookies et traceurs via un bandeau conforme CNIL (avec choix explicite d'acceptation et de refus).
  * Droits des utilisateurs garantis : droit d'accès, de rectification, de portabilité et de suppression définitive de leurs données personnelles ("Droit à l'oubli").
  * Chiffrement des données en transit (HTTPS / TLS 1.3) et au repos (base de données chiffrée AES-256).

