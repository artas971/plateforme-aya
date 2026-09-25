# JOURNAL DU PÔLE 6 : BILAN DES INCIDENTS & AUTO-GUÉRISON (PROJET AYA V5)

**Observateur / Rapporteur :** Victor (`victor_logger`)  
**Expert Résolution & DevOps :** Alexandre (`alexandre_devops`)  
**Dernière mise à jour :** 2026-08-19T22:07:00+02:00

---

## 📌 HISTORIQUE DES INTERVENTIONS & APPRENTISSAGE (FEEDBACK LOOPS)

### 🟢 INCIDENT #005 - COURT-CIRCUIT MOCK DE SUBTITLES & GESTION DE CACHE / VERROU QUALITÉ (.ASS)
- **Date & Heure :** 2026-08-19 T22:06:00
- **Agents Concernés :** Steve (Lead Pôle 6 / QA), Thomas (Backend Express), Jade/Nadine (Pôle 3 Linguistique), Max (FFmpeg)
- **Symptôme Originel :** Génération d'une vidéo tronquée de 5 secondes avec sous-titre mock ("C'est ici que vos sous-titres s'afficheront") dû à un fallback silencieux en l'absence de segments transcrits par Whisper.
- **Démarche Analytique d'Alexandre :**
  1. **Audit & Suppression du Court-Circuit (Mock Fallback) :** Éradication de la clause de secours qui créait un segment factice de 5s quand la liste `segments` était vide.
  2. **Interruption par Levée de `RuntimeError` :** Obligation de lever une `RuntimeError` stricte dans `run_studio_v3_full_pipeline.py` en cas d'absence de segments réels.
  3. **Purge Systématique du Cache :** Implémentation d'un nettoyage forcé des anciens fichiers de cache (`subtitles_{project_uuid}.*`, `video_{project_uuid}_1080x1920.mp4`).
  4. **Propagation de `process.env` par Thomas :** Transmission explicite des variables d'environnement (`env: process.env`) dans `execSync` / `exec` par Thomas (`server.js`).
  5. **Verrou Qualité de Steve sur le Fichier `.ASS` :** Ajout d'un contrôle QA rigoureux vérifiant la présence, la taille non nulle (>0 octets) et l'existence d'au moins un événement `Dialogue:` valide dans le fichier `.ASS` avant le lancement de l'encodage FFmpeg.
- **Résultat & Handoff :** ✅ **RÉSOLU (Tentative 1/2)**. Transmission à Victor pour archivage officiel et notification du Pôle 6.

---

### 🟢 INCIDENT #004 - DÉSALIGNEMENT DE NOM DE FICHIER ('PATH MISMATCH')
- **Date & Heure :** 2026-08-19 T21:59:00
- **Agent Défaillant :** Max / Thomas
- **Symptôme Originel :** Erreur 404 lors du téléchargement due à un nommage divergent.
- **Correction :** Instauration de la Single Source of Truth (SSOT) basée sur `projectUUID`.
- **Résultat :** ✅ **RÉSOLU (Tentative 1/2)**.

---

### 🟢 INCIDENT #003 - DÉFAILLANCE FORMAT HORODATAGE ASS (`INVALID_ASS_TIMESTAMP`)
- **Date & Heure :** 2026-08-19 T21:31:30
- **Agent Défaillant :** Jade (Experte Senior en Linguistique & Sous-titrage)
- **Symptôme Originel :** Erreur d'horodatage ASS `00:00:05:10`.
- **Correction :** Formate des centièmes avec un point `.` et structure canonique `H:MM:SS.cs`. Apprentissage transmis à Jade.
- **Résultat :** ✅ **RÉSOLU (Tentative 1/2)**.

---

### 🟢 INCIDENT #002 - DÉFAILLANCE SYNTAXE FFMPEG ('preset_ultrafast_typo')
- **Date & Heure :** 2026-08-19 T21:15:32
- **Agent Défaillant :** Max (Monteur / Encodeur FFmpeg)
- **Résultat :** ✅ **RÉSOLU (Tentative 1/2)**.

---

### 🟢 INCIDENT #001 - INTERCEPTION TIMEOUT RÉSEAU & UNESCAPED STRING
- **Date & Heure :** 2026-08-19 T17:38:00
- **Résultat :** ✅ **RÉSOLU (Tentative 1/2)**.

---

### 🟢 INCIDENT #006 - RUPTURE DES ROUTES DU CHAT ÉPHÉMÈRE 24H & AUDIOS DANS LE SERVEUR PRINCIPAL
- **Date & Heure :** 2026-08-20 T23:00:00
- **Agents Concernés :** Thomas (Backend Express), Alexandre (DevOps / Résolution), Steve (Lead QA), Victor (Rapporteur)
- **Symptôme Originel :** Le module "Chat Éphémère Traduit (Messages & Audios)" ne fonctionnait plus (erreurs HTTP 404 sur `/api/chat/*` et blocage des vocaux).
- **Démarche Analytique d'Alexandre :**
  1. **Diagnostic :** Lors du verrouillage de la route Studio V3, le fichier `server.js` avait été écrasé, amputant toutes les routes API du Chat Éphémère (`/api/chat/status`, `/api/chat/messages`, `/api/chat/send`, `/api/chat/send-audio`, `/api/chat/reset`, `/api/chat/archive`) ainsi que les endpoints de base (`/api/login`, `/api/messages`, etc.).
  2. **Reconstruction & Unification SSOT :** Consolidation complète de `server.js` intégrant l'intégralité du cycle de vie du Chat Éphémère 24h, les traductions bidirectionnelles (FR ↔ AR) avec vocalisation Edge-TTS, la purge glissante 24h/10 fichiers, la gestion multi-utilisateurs et le Studio V3.
  3. **Optimisation I/O & Chemins :** Correction du résolveur de fichiers `find_file` dans `process_single_file.py` et `whisper_service.py` pour supporter les chemins absolus directs transmis par Multer et l'isolation des fichiers temporaires `.wav`.
  4. **Validation des tests E2E :** Exécution et validation des tests unitaires HTTP GET/POST sur `/api/chat/status`, `/api/chat/messages`, `/api/chat/send` (FR ➔ AR), `/api/chat/send` (AR ➔ FR), `/api/chat/archive` et `/api/chat/reset`.
- **Résultat & Handoff :** ✅ **RÉSOLU (Tentative 1/2)**. Serveur relancé sur le port 3000, chat 100% opérationnel.

---

### 🟢 INCIDENT #007 - TITRE TRONQUÉ INACHEVÉ ('Droits sp') & DÉFAILLANCE COUVERTURE
- **Date & Heure :** 2026-09-23 T12:45:00
- **Agents Concernés :** Nadine (Directrice Éditoriale), Steve (Lead QA), Lionel (Graphisme Couverture), Alexandre (Expert DevOps / Résolution)
- **Symptôme Originel :** Génération d'un titre tronqué incompréhensible ("Droits sp") et d'une couverture affichant ce fragment de mot inachevé sur un témoignage de Jabalia, consécutif à une interruption de génération token / quota 429 et une absence de filtre de complétude lexicale.
- **Démarche Analytique d'Alexandre :**
  1. **Diagnostic de la Cause Racine :**
     - Lors de l'inférence synchrone de titrage, le modèle principal `gemini-2.5-flash` a subi un refus de quota HTTP 429 temporaire.
     - Le repli a produit une chaîne fragmentaire interrompue au milieu du mot ("Droits sp..." au lieu de "Nos droits spoliés").
     - La validation historique de Nadine ne contrôlait que `len(words) > 1` et `len(text) >= 3`, laissant passer ce faux titre de 2 mots et 9 caractères.
  2. **Immunisation de l'Agent Nadine & Steve (`is_invalid_or_truncated_title`) :**
     - Exigence stricte d'un groupe de sens fermé : minimum 3 mots et minimum 12 caractères.
     - Détection et rejet automatique des fragments de mots orphelins (mots de $\le 2$ lettres non lexicaux comme 'sp', coupures brutales sans voyelles).
     - Rejet formel et bascule automatique sur les modèles suivants de la cascade ou extraction contextuelle noble basée sur le `user_context`.
  3. **Auto-Guérison Immédiate :**
     - Régénération de la couverture au format 3:4 natif TikTok (1080×1440) avec le titre complet et digne : *"Nos droits bafoués à Jabalia"*.
     - Déploiement automatique des fichiers corrigés dans le dossier `Téléchargements` de l'utilisateur.
- **Résultat & Handoff :** ✅ **RÉSOLU**. Pipeline immunisé contre tout titre tronqué ou fragmentaire.

---

### 🟢 INCIDENT #008 - DÉCONNEXION STREAMING TUNNEL ("ERREUR RÉSEAU") & ANOMALIES VOAR (FR ➔ AR)
- **Date & Heure :** 2026-09-23 T15:35:00
- **Agents Concernés :** Alexandre (Lead DevOps), Thomas (Backend / Streaming), Lionel (Typographie & Design .ASS), Nadine (Nomenclature), Eden (Frontend UI)
- **Symptôme Originel :** Une utilisatrice distante ("soso") a tenté de traduire une vidéo française en dialecte arabe (mode VOAR). Le traitement a affiché côté client le message d'alerte rouge : *"Erreur de communication réseau - La connexion avec le serveur a été interrompue pendant le traitement"*, laissant penser à un échec global de l'IA ou du serveur.
- **Démarche Analytique d'Alexandre :**
  1. **Autopsie des Fichiers Serveur & Télégramme :**
     - Le backend a en réalité **parfaitement finalisé** le traitement en moins de 8 secondes (`data/videos.json`, vidéo `media (VOAR) (1).mp4` de 593 Ko, fichier sous-titres `.ass`, couverture et description générés avec succès).
     - **Cause Racine n°1 (Conflit de Tunnels Cloudflare concurrents) :** Deux processus `run_tunnel_forever.py` (PID 16624 et PID 2276) tournaient simultanément, pilotant deux `cloudflared.exe`. Le premier tunnel a été coupé par Cloudflare en plein vol, coupant le stream HTTP Chunked de la cliente avant la réception du JSON final, ce qui a déclenché le catch réseau de `fetch()`.
     - **Cause Racine n°2 (Absence de Heartbeat SSE/Chunked) :** Entre les étapes de transcription et d'encodage, aucun octet n'était émis, exposant la connexion aux fermetures agressives des proxies intermédiaires.
     - **Cause Racine n°3 (Nomenclature "media (VOAR)" en Arabe) :** `sanitize_filename_stem` filtrait `[^a-zA-Z0-9\s\-]`, supprimant 100% des caractères arabes du titre sémantique de Nadine et provoquant un repli systématique sur le libellé générique `media`.
     - **Cause Racine n°4 (Inversion d'horodatage & Police ASS) :** Présence d'un segment halluciné en fin de bande avec `start: 8.36s > end: 8.08s` (après la durée du média), et utilisation de la police `Impact` (incompatible avec la graphie arabe) au lieu de `Arial`/`Segoe UI`.
  2. **Plan de Résolution & Auto-Guérison DevOps :**
     - **Verrou d'Instance Unique (`run_tunnel_forever.py`) :** Implémentation d'un verrou socket loopback (`127.0.0.1:49992`) empêchant tout lancement accidentel de tunnels multiples concurrents. Élimination des processus orphelins.
     - **Heartbeat Chunked Streaming (`routes/traduction.js`) :** Émission périodique d'un battement de cœur (`:\n`) toutes les 4 secondes maintenant le canal HTTP ouvert et étanche aux coupures de tunnel.
     - **Isolation du Render Frontend (`public/traduction.html`) :** Encapsulation de `renderTranslationResult` dans son propre `try/catch` pour éviter que des erreurs DOM locales ne soient travesties en fausses erreurs réseau.
     - **Garde-fou Horodatage & Police Arabe (`process_traduction.py`) :** Rejet strict des segments inversés (`start >= end` ou `start >= duration`), plafonnement à `total_duration`, et bascule automatique sur `Arial` pour le rendu libass en mode `ar`.
     - **Sauvegarde Nomenclature Arabe :** En cas de titre en caractères arabes purs, repli propre sur le stem du média source plutôt que sur le mot `media`.
- **Résultat & Handoff :** ✅ **RÉSOLU**. Serveur redémarré (PID managé), tunnel unique certifié actif (`library-forests-standard-midi.trycloudflare.com`), pipeline VOAR 100% stable et testé.

---


---

### 🟢 INCIDENT #009 — CONTRESENS PHONÉTIQUE ARABE GAZAOUI (BATTANIYYA / CIVIÈRE)
- **Date & Heure :** 2026-09-25 T19:00:00
- **Référence :** `INC-20260925-BATTANIYYA-MASSASSA` — Vidéo `IMG_6789.MP4` (*Famille Atallah, Gaza*)
- **Agents Concernés :** Nadine (Dialecte), Jade (Timing), Steve (Lead QA), Alexandre (Audit)
- **Symptôme Originel :** La traduction produisait *"Apportez une civière !"* au lieu de *"Apportez une couverture !"*, et omettait la tétine retrouvée dans les décombres.
- **Démarche Analytique d'Alexandre :**
  1. **Audit acoustique Gemini direct :** Confirmation que le mot crié en boucle est **`بطانية`** (*baṭṭāniyye* = couverture) et non *naqqāla* (civière).
  2. **Cause Racine #1 — Biais Contextuel :** Biais "secours/décombres = civière".
  3. **Cause Racine #2 — Manque au Glossaire Gaza :** `بطانية`, `مصاصة`, `ما ينفعش` absents des tables anti-pièges.
  4. **Cause Racine #3 — Garde-fou Permissif :** `verify_timeline_coverage` validait à tort des flux squelettiques (3 répliques).
  5. **Corrections déployées :**
     - Glossaire enrichi dans `gemini_translator.py` (`ar` et `auto`).
     - `verify_timeline_coverage` durcie (trous > 5.5s, densité < 35%, seuil $\ge 4$ répliques).
     - Remplacement de l'ensemble des caches par les segments certifiés.
- **Résultat :** ✅ **RÉSOLU**

---

### 🔴 INCIDENT #010 — ERREUR DE NATURE DE SCÈNE & CONTRADICTION ÉDITORIALE (VIVANT VS DÉCÉDÉ)
- **Date & Heure :** 2026-09-25 T20:08:00
- **Référence :** `INC-20260925-SCENE-NATURE-MORTE` — Vidéo `IMG_6789.MP4` (*Famille Atallah, Gaza*)
- **Agents Concernés :** Tous les agents (Steve, Jade, Nadine, Lionel, Thomas, Alexandre)
- **Signalé par :** L'utilisateur — Contexte réel : extraction des ossements et vêtements d'un enfant décédé avec biberon et tétine.
- **Symptômes Originels :**
  1. Sous-titre erroné : *"Apportez-lui sa tétine !"* (laisse croire à un enfant vivant à consoler).
  2. Description TikTok contaminée : *"suppliant qu'on apporte une tétine pour un corps trop petit pour ce monde"* (double contresens sur la tétine retrouvée et sur le tissu trop petit).
- **Gravité :** 🔴 CRITIQUE — Faute de véracité documentaire et d'éthique humaine.
- **Démarche Analytique d'Alexandre :**
  1. **Faille dans `user_context_directive` :** Le prompt confinait le contexte utilisateur aux seuls noms propres en lui interdisant de guider la compréhension de la scène.
  2. **Interprétation terrain rétablie :** Les secouristes découvrent et mettent de côté la tétine parmi les restes mortels (*"Voici sa petite tétine."*). La couverture réclamée sert de linceul pour envelopper la dépouille avec respect. Le morceau de tissu inspecté est jugé trop petit pour couvrir les restes (*"C'est trop petit, ça ne suffit pas."*).
  3. **Corrections Architecturales (Steve & Nadine) :**
     - Refonte de `user_context_directive` avec détection automatique de scènes de deuil/martyrs et injection de la **DIRECTIVE SCÈNE CRITIQUE**.
     - Harmonisation complète de la description TikTok : suppression de la sur-interprétation dramatique au profit d'un récit sobre, digne et rigoureux.
     - Régénération de l'ASS, du MP4 encodé et du TXT descriptif.
- **Résultat :** ✅ **RÉSOLU & IMMUNISÉ**

---

## 📊 REGISTRE MÉMOIRE DES SOLUTIONS CONFRONTÉES (ALEXANDRE)

| Code Erreur | Motif | Correction Mémorisée | Statut |
| :--- | :--- | :--- | :--- |
| `ERR_STREAMING_TUNNEL_DISCONNECT` | Tunnel Cloudflare tombé / conflit de double instance | Verrou socket loopback anti-doublon + Heartbeat HTTP 4s | ✅ MÉMORISÉ |
| `ERR_VOAR_INVERTED_TIMESTAMPS` | Segments Whisper `start > end` post-durée | Filtre QA strict `start < end` et `start < total_duration` | ✅ MÉMORISÉ |
| `ERR_VOAR_GENERIC_MEDIA_NAME` | Caractères arabes purgés par regex ASCII | Repli sur stem source noble + préservation métadonnées | ✅ MÉMORISÉ |
| `ERR_VOAR_ASS_FONT_UNSUPPORTED` | Police `Impact` sans glyphes arabes | Bascule dynamique sur police arabe native (`Arial`) | ✅ MÉMORISÉ |
| `ERR_TRUNCATED_SEMANTIC_TITLE` | Titre tronqué / fragmentaire ("Droits sp") | Garde-fou `is_invalid_or_truncated_title` ($\ge 3$ mots, $\ge 12$ car, anti-fragments) | ✅ MÉMORISÉ |
| `ERR_CHAT_ROUTES_TRUNCATED` | Écrasement de `server.js` lors d'un refactor Studio | Consolidation unifiée SSOT de toutes les routes + Tests E2E | ✅ MEMORISÉ |
| `ERR_MOCK_FALLBACK_SHORTCIRCUIT` | Mock 5s silencieux si 0 segments | Suppression fallback + RuntimeError + process.env + Verrou QA .ASS | ✅ MEMORISÉ |
| `ERR_PATH_MISMATCH_UUID` | Nommage vidéo divergent | SSOT projectUUID (`video_${projectUUID}_1080x1920.mp4`) | ✅ MEMORISÉ |
| `ERR_ASS_TIMESTAMP_FORMAT` | Horodatage ASS invalide (`00:00:05:10`) | Format strict `H:MM:SS.cs` (`0:00:05.10`) + Feedback Jade | ✅ MEMORISÉ |
| `ERR_FFMPEG_UNRECOGNIZED_OPTION` | Option `-preset` libx264 invalide | Remplacement par `-preset ultrafast` | ✅ MEMORISÉ |
| `ERR_EXEC_SYNC_TIMEOUT` | Event loop bloqué sur FFmpeg | Passage en `child_process.exec` asynchrone | ✅ MEMORISÉ |
| `ERR_MIME_INVALID` | PDF uploadé à la place d'un Audio | Rejet HTTP 400 avec rapport d'erreur Eden | ✅ MEMORISÉ |
| `ERR_PHONETIC_LEXICON_GAZ_001` | `بطانية` traduit par "civière" — biais contextuel modèle | Règles lexicales Gaza obligatoires dans `gemini_translator.py` (branches `ar` + `auto`) | ✅ MÉMORISÉ |
| `ERR_SKELETON_TRANSCRIPTION` | 3 segments acceptés comme valides (25s de vidéo) | Garde-fou densité <35% + anti-squelette + seuil min 4 segments | ✅ MÉMORISÉ |
| `ERR_SCENE_NATURE_MISMATCH` | Scène de mort traduite comme sauvetage d'un vivant | Détection auto scènes de deuil + DIRECTIVE SCÈNE CRITIQUE dans `user_context_directive` | ✅ MÉMORISÉ |
| `ERR_DESCRIPTION_CONTEXT_DESYNC` | Description TikTok propageant le contresens "tétine demandée" | Alignement éditorial strict : recueil d'effets personnels & linceul digne | ✅ MÉMORISÉ |

