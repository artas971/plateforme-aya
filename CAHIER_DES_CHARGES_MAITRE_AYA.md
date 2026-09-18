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

### 9.4 Machine à États Google Drive (Worker Autonome)
Le service d'arrière-plan surveille les 3 dossiers Google Drive en boucle fermée :
1. `01_A_TRAITER` : Détection du média brut déposé par les équipes sur le terrain ➔ Déplacement automatique vers `02_EN_COURS`.
2. `02_EN_COURS` : Verrouillage exclusif, traitement par le pipeline local.
3. `03_TERMINE` : Dépôt sécurisé des livrables finaux (`.mp4`, `.ass`, et si demandé `.jpg` et `.txt`).
* En cas de dépassement de quota Service Account, le worker capture l'exception avec grâce, préserve les livrables locaux intacts et ne bloque jamais la réponse utilisateur.
