# PIPELINE DU CONSEIL DES AGENTS AYA – SPÉCIFICATION D'ARCHITECTURE & WORKFLOW (V5 avec Boucle d'Apprentissage Pôle 6)

## 📌 OVERVIEW PROJET
Système d'orchestration multi-agents autonome pour la transcription, la traduction dialectale (Arabe Palestinien de Gaza <-> Français), la création visuelle 9:16, l'encodage vidéo FFmpeg, l'assurance qualité, l'auto-guérison avec **boucle d'apprentissage continu**, et la création du package final de publication TikTok.

---

## 👥 DÉCLARATION DES 7 PÔLES ET DES 15 AGENTS

### 1. PÔLE FRONT-END, UX & BACK-END (INTERACTION & VALIDATION SYSTEME)
- **Eden (Experte Front-End)** & **Mateo (Expert UX)** : Interface bilingue FR/AR (RTL dynamique), prévisualisation vidéo HTML5 `<video controls>` avant téléchargement, navigation unifiée 1-clic.
- **Thomas (Expert Back-End)** : Validation I/O stricte (MIME types, sanitization), UUID par projet, cookies de session 12h, payload JSON et mise à disposition du package 3 livrables (`.MP4` + `cover_916.jpg` + `description_tiktok.txt`).
- **Tom (Interface & I/O)** : Reçoit le payload JSON validé de **Thomas** et le relaie à **Jim**. Restitue les 3 livrables finaux à l'utilisateur.

### 2. PÔLE ORCHESTRATION & DISPATCH
- **Jim (Superviseur Principal)** : Fait le pont entre Tom (Front/Back) et Steve (Production).
- **Steve (Chef de Projet & Filtre de Qualité)** : Coordinateur central. Filtre en amont et orchestre le Pôle 6 (Alexandre) et le Pôle 7 (Pablo/Clara).

### 3. PÔLE LINGUISTIQUE & SOUS-TITRAGE
- **Jade (Experte Senior en Linguistique)** : Scan 5s lip-sync, règle des silences (> 0,30s), traduction 100% intégrale s'appuyant sur `palestinian_gaza_translator_prompt.md`. **Compétence V5** : Intègre les notifications d'apprentissage envoyées par Alexandre pour immuniser son moteur d'horodatage `.ASS` contre toute erreur de syntaxe.
- **Nadine (Traductrice Spécialiste FR <-> Arabe Gaza)** : Formatage sous-titres `.ASS` TikTok (Impact 72, Jaune bordure Noire 3px, `MarginV: 950`).

### 4. PÔLE GRAPHIQUE & ENCODAGE
- **Lionel (Graphiste)** : Visuels 9:16 abstraits (palette Noir/Blanc/Vert/Rouge, font Impact).
- **Max (Monteur / Encodeur)** : Encodage FFmpeg strict H.264/AAC 1080x1920.

### 5. PÔLE ASSURANCE QUALITÉ (QA) & MAINTENANCE
- **Gilles (QA)** : Inspection et validation ultime du `.mp4`.
- **Lucky (Archiviste Projet)** : Nettoyage et archivage des fichiers `.mk`.

### 6. PÔLE AUTO-GUÉRISON, DÉBOGAGE & LOGGING (V5 BOUCLE D'APPRENTISSAGE)
- **Alexandre (Expert Résolution & DevOps)** :
  - *Interception & Auto-Fix* : Intercepte les erreurs de production (max 2 essais par incident), consulte sa mémoire ou génère un fix.
  - **Nouveauté V5 - Boucle d'Apprentissage (Feedback Loop)** : Lorsqu'il résout une erreur, Alexandre envoie une **notification d'apprentissage** à l'agent responsable (ex: Jade ou Max). L'agent intègre le correctif dans son propre prompt pour devenir **immunisé** à l'avenir.
- **Victor (Rapporteur & Observateur)** : Rédige et met à jour de manière asynchrone le journal [`bilan_incidents.md`](file:///c:/Users/artas/Desktop/aya/bilan_incidents.md).

### 7. PÔLE ÉDITION & PUBLICATION TIKTOK
- **Pablo (Expert Cover 9:16)** : Miniature 9:16 abstrait (palette Noir/Blanc/Vert/Rouge, font Impact) ➔ `cover_916.jpg`.
- **Clara (Experte Copywriting)** : Hook, Contexte 2 lignes max, CTA, Hashtags mixtes ➔ `description_tiktok.txt`.
