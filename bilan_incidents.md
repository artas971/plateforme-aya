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

## 📊 REGISTRE MÉMOIRE DES SOLUTIONS CONFRONTÉES (ALEXANDRE)

| Code Erreur | Motif | Correction Mémorisée | Statut |
| :--- | :--- | :--- | :--- |
| `ERR_CHAT_ROUTES_TRUNCATED` | Écrasement de `server.js` lors d'un refactor Studio | Consolidation unifiée SSOT de toutes les routes + Tests E2E | ✅ MEMORISÉ |
| `ERR_MOCK_FALLBACK_SHORTCIRCUIT` | Mock 5s silencieux si 0 segments | Suppression fallback + RuntimeError + process.env + Verrou QA .ASS | ✅ MEMORISÉ |
| `ERR_PATH_MISMATCH_UUID` | Nommage vidéo divergent | SSOT projectUUID (`video_${projectUUID}_1080x1920.mp4`) | ✅ MEMORISÉ |
| `ERR_ASS_TIMESTAMP_FORMAT` | Horodatage ASS invalide (`00:00:05:10`) | Format strict `H:MM:SS.cs` (`0:00:05.10`) + Feedback Jade | ✅ MEMORISÉ |
| `ERR_FFMPEG_UNRECOGNIZED_OPTION` | Option `-preset` libx264 invalide | Remplacement par `-preset ultrafast` | ✅ MEMORISÉ |
| `ERR_EXEC_SYNC_TIMEOUT` | Event loop bloqué sur FFmpeg | Passage en `child_process.exec` asynchrone | ✅ MEMORISÉ |
| `ERR_MIME_INVALID` | PDF uploadé à la place d'un Audio | Rejet HTTP 400 avec rapport d'erreur Eden | ✅ MEMORISÉ |
