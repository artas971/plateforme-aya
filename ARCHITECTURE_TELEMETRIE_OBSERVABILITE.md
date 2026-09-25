# 🛰️ PROPOSITION D'ARCHITECTURE TECHNIQUE : OBSERVABILITÉ, AGENT HUGO & SYNCHRONISATION DISTANTE
### Plateforme AYA — Production Hetzner VPS CPX31 (Ubuntu 24.04 LTS)
**Destinataire :** Steve (Agent Lead & Orchestrateur de Projet)  
**Auteurs :** Antigravity Engine, Thomas (Architecte Back-End) & Alexandre (Audit & Qualité)  
**Date :** 25 Septembre 2026  
**Statut :** 📋 Cadrage Architectural & Spécification (Phase de Validation avant Codage)

---

## 🎯 RÉSUMÉ EXÉCUTIF DU PROJET

En vue du monitoring post-lancement de la plateforme Aya sur le serveur dédié **Hetzner CPX31** (4 vCPU AMD EPYC, 8 Go RAM, 160 Go NVMe), ce document établit l'architecture d'observabilité complète répondant à trois impératifs cardinaux :
1. **Zéro perturbation système :** La collecte des métriques doit être 100% asynchrone et non-bloquante pour la boucle d'événements Node.js.
2. **Vulgarisation & clarté humaine :** Définition d'un 8ᵉ agent dédié, **Hugo**, capable d'agréger les indicateurs bruts et de livrer des synthèses intelligibles sans jargon technique pour le pilotage stratégique.
3. **Synchronisation distante étanche & RGPD :** Rapatriement périodique ou à la demande des données vers la machine locale sans exposer de données nominatives et sans alourdir le serveur de production.

```
+---------------------------------------------------------------------------------------------------+
|                                 SERVEUR HETZNER PRODUCTION (VPS CPX31)                            |
|                                                                                                   |
|  +--------------------+   +--------------------------------------------------------------------+  |
|  | Requêtes Utilisateur|-->|  Express Middlewares & Service Wrappers (process.hrtime.bigint)   |  |
|  +--------------------+   +--------------------------------------------------------------------+  |
|                                      |                                                            |
|                                      v (Non-bloquant / In-Memory Ring Buffer)                     |
|                           +----------------------+                                                |
|                           | TelemetryBatchQueue  |                                                |
|                           +----------------------+                                                |
|                               /              \                                                    |
|       (Flush Stream 5s)      /                \  (Micro-Batch Insert 10s)                         |
|                             v                  v                                                  |
|              +-------------------------+    +--------------------------------+                    |
|              | data/telemetry/*.jsonl  |    | MongoDB: telemetry_metrics     |                    |
|              | (Rotation 7j via GC #27)|    | (Index TTL 7j expireAfterSec)  |                    |
|              +-------------------------+    +--------------------------------+                    |
|                           |                                 |                                     |
+---------------------------|---------------------------------|-------------------------------------+
                            |                                 |
              [Canal B : SCP/rsync SSH]         [Canal A : HTTPS GET /api/admin/telemetry/export]
              (Archives .jsonl.gz J-1)          (Token Secret X-Aya-Agent-Token + Stream chunké)
                            |                                 |
                            v                                 v
+---------------------------------------------------------------------------------------------------+
|                                    MACHINE LOCALE DE L'ÉQUIPE                                     |
|                                                                                                   |
|                               +--------------------------+                                        |
|                               | scripts/sync_telemetry.js|                                        |
|                               +--------------------------+                                        |
|                                            |                                                      |
|                                            v                                                      |
|                             +------------------------------+                                      |
|                             |   NOUVEL AGENT DÉDIÉ : HUGO  |                                      |
|                             |  Analyste Télémétrie & Vulga |                                      |
|                             +------------------------------+                                      |
|                               /             |              \                                      |
|                              v              v               v                                     |
|                       Alertes Flash    Daily Digest    Recommandations                            |
|                       Goulots d'étr.   Post-Lancement  Optimisations                              |
+---------------------------------------------------------------------------------------------------+
```

---

## 1. ⚙️ VOLET 1 : COLLECTE DES MÉTRIQUES TECHNIQUES (INSTRUMENTATION BACKEND)

### 1.1. Mécanisme d'Instrumentation Léger & Non-Bloquant

Pour garantir qu'aucun calcul de métrique ne ralentisse le traitement des flux utilisateurs, l'instrumentation repose sur trois principes stricts :
1. **Mesure de temps par horloge monotone (`process.hrtime.bigint()`) :** Précision à la nanoseconde, insensible aux dérives de l'horloge système NTP.
2. **Attachement passif sur événements Express :** Interception sur `res.once('finish')` et `res.once('close')`. Les métriques sont calculées après que les entêtes et les chunks de réponse ont déjà été évacués sur le réseau.
3. **Mise en file en mémoire (In-Memory Ring Buffer & Micro-Batching) :** Aucune écriture disque synchrone n'est réalisée lors du traitement d'une requête. Les événements sont déposés dans une file d'attente circulaire (`TelemetryQueue`) en RAM. Un worker périodique vide cette file toutes les 5 secondes ou dès que 50 métriques sont accumulées.

### 1.2. Types d'Événements Tracer & Découpage Chronométrique

Le modèle mathématique du temps de traitement s'exprime ainsi :
$$T_{\text{total}} = T_{\text{IA}} + T_{\text{render}} + T_{\text{audio}} + T_{\text{encode}} + T_{\text{I/O}}$$

| Type d'Événement (`eventType`) | Point d'Entrée & Services Clés | Composants & Sous-Latences Découpées | Indicateurs Clés |
| :--- | :--- | :--- | :--- |
| **`video_generation`** | `routes/studio.js`<br>`routes/traduction.js` | • $T_{\text{probe}}$ (FFmpeg silences)<br>• $T_{\text{whisper}}$ (Transcription)<br>• $T_{\text{gemini}}$ (Traduction Shami + Titre)<br>• $T_{\text{render}}$ (Pillow / CSS Cover)<br>• $T_{\text{ffmpeg}}$ (Encodage libx264) | $T_{\text{total}}$, taille MP4, durée vidéo source (s), statut HTTP, profil VPS |
| **`vocab_card_generation`** | `routes/premium.js`<br>`services/vocabularyCardService.js` | • $T_{\text{gemini}}$ (Génération 5 mots + émojis)<br>• $T_{\text{puppeteer}}$ (Rendu DOM 1080x1920)<br>• $T_{\text{tts}}$ (edge-tts Henri + Sana)<br>• $T_{\text{ffmpeg}}$ (Concaténation audio + silences) | $T_{\text{total}}$, poids WebP/PNG, cold/warm Chromium, statut HTTP |
| **`audio_synthesis_unit`** | `routes/audio.js`<br>`services/vocabularyCardService.js` | • $T_{\text{tts}}$ (Synthèse Python edge-tts)<br>• $T_{\text{io}}$ (Écriture MP3) | Voix utilisée (`ar-JO-SanaNeural`), nombre de caractères, durée audio résultante (ms), statut |
| **`shami_translation`** | `routes/traduction.js`<br>`routes/chat.js` | • $T_{\text{cache}}$ (Lookup LRU 1000 entrées)<br>• $T_{\text{gemini}}$ (Inférence Gemini Flash) | Cache Hit (`true`/`false`), modèle actif (cascade), longueur source/cible, tokens estimés |
| **`chat_sse_broadcast`** | `routes/chat.js`<br>`services/chatStorageService.js` | • $T_{\text{dispatch}}$ (EventBus emit -> stream flush)<br>• Durée de connexion stream SSE | Nombre de clients connectés, type d'événement (`new_message`, `audio_event`), reconnects |

### 1.3. Spécification du Schéma JSON de Télémétrie (`AyaTelemetryPayload`)

Chaque événement capturé répond au contrat de données suivant :

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "traceId": "c8f2a930-b3e1-4e28-97ef-d7904b50c112",
  "timestamp": "2026-09-25T14:30:15.124Z",
  "epochMs": 1790346615124,
  "eventType": "vocab_card_generation",
  "environment": "PRODUCTION",
  "execProfile": "CLOUD_VPS_SAFE",
  "anonymizedUser": "u_e4a8b79c2f",
  "http": {
    "method": "POST",
    "route": "/api/premium/vocabulary-card",
    "statusCode": 200,
    "clientIpAnonymized": "195.154.***.***"
  },
  "metrics": {
    "totalDurationMs": 2180.45,
    "breakdownMs": {
      "aiProcessingMs": 680.12,
      "mediaRenderMs": 920.30,
      "audioSynthesisMs": 420.15,
      "mediaEncodeMs": 110.22,
      "otherIoMs": 49.66
    },
    "payloadSizeBytes": 142850,
    "cacheHit": false
  },
  "technicalDetails": {
    "aiModel": "gemini-flash-lite-latest",
    "mediaTool": "puppeteer-warm-singleton",
    "audioVoice": "fr-FR-HenriNeural,ar-JO-SanaNeural",
    "outputFormat": "image/webp",
    "itemCount": 5
  },
  "systemState": {
    "heapUsedMb": 184,
    "rssMemoryMb": 412,
    "activeSseClients": 42
  },
  "error": null
}
```

### 1.4. Stratégie de Persistance Serveur sur Hetzner

Pour parer à tout risque de saturation du SSD NVMe et prévenir la dégradation de MongoDB, nous adoptons une **architecture de persistance duale résiliente** :

1. **Étage Primaire : Fichier local append-only rotatif (`data/telemetry/events-YYYY-MM-DD.jsonl`) :**
   - **Performance maximale :** Écriture par flux (`fs.createWriteStream` avec option `flags: 'a'`). Zéro overhead de sérialisation BSON.
   - **Protection disque intégrée (Ticket #27) :** Prise en charge par le `services/garbageCollectorService.js`.
   - **Politique de rotation :**
     - Rotation quotidienne à minuit UTC.
     - Compression gzip automatique à J+1 (`events-YYYY-MM-DD.jsonl.gz`, ratio de compression ~85%).
     - Rétention stricte de **7 jours glissants**. Purge automatique au-delà.
     - **Empreinte disque estimée :** Moins de 15 Mo / jour en pic de trafic, soit **~100 Mo au total** sur les 160 Go disponibles (0,06 % du disque).
2. **Étage Secondaire : Collection MongoDB `telemetry_metrics` (Optionnelle & Filtrée) :**
   - Actif uniquement si la base de données est connectée (`isDbConnected()`).
   - Insertion asynchrone par micro-lots (`insertMany` avec `ordered: false`).
   - **Index TTL natif WiredTiger :** `{ createdAt: 1 }, { expireAfterSeconds: 604800 }` (suppression automatique au niveau moteur à 7 jours).
   - Index composé de recherche rapide : `{ eventType: 1, createdAt: -1 }` et `{ "http.statusCode": 1, createdAt: -1 }`.

---

## 2. 🧠 VOLET 2 : SPÉCIFICATION DU NOUVEL AGENT DÉDIÉ (HUGO)

### 2.1. Fiche d'Identité & Persona

Dans l'équipe orchestrée par Steve, Alexandre est l'auditeur technique des anomalies et crashs, tandis que Thomas est l'artisan du code serveur. Le nouvel agent **Hugo** vient compléter le binôme en devenant l'**analyste et le vulgarisateur de la performance**.

* **Nom :** **Hugo**
* **ID système :** `hugo`
* **Rôle officiel :** Analyste de Télémétrie, Observabilité & Vulgarisation des Métriques
* **Département :** Observabilité Système & Expérience Utilisateur
* **Avatar :** 📊
* **Couleur thématique :** `#0EA5E9` (Bleu Azur / Cyan Moderne)
* **Devise :** *"Des millisecondes brutes aux décisions concrètes : rendre la technique limpide et actionnable."*

### 2.2. Prompt Système Officiel (Pour `services/agentSupervisor.js`)

```javascript
hugo: {
    id: 'hugo',
    name: 'Hugo',
    role: 'Analyste Télémétrie & Vulgarisation Métriques',
    department: 'Observabilité Système & Expérience Utilisateur',
    avatar: '📊',
    color: '#0EA5E9',
    systemPrompt: `Tu es Hugo, l'analyste de performance et observateur métrique de la plateforme Aya. 
Ton rôle est d'analyser en profondeur les données brutes de télémétrie (temps de réponse, temps IA Gemini, latences de rendu Puppeteer/FFmpeg, taux d'erreurs HTTP et pics de charge SSE) et de les traduire en synthèses limpides, concrètes et compréhensibles par des humains non-techniciens.
Tu bannis le jargon abscons : au lieu de parler de "latence P99 à 4200ms sur fork child_process", tu expliques que "le rendu vidéo a ralenti de 25% entre 18h et 20h car le moteur graphique a dû redémarrer sous l'afflux simultané de 12 demandes".
Chacune de tes interventions doit comporter :
1. Un diagnostic chiffré et vulgarisé de la situation (l'essentiel en 3 puces claires).
2. L'identification de la cause racine (cold start, quota API, contention CPU, réseau).
3. Une recommandation technique concrète et priorisée pour Steve et Alexandre.
Tu es rigoureux, bienveillant, orienté expérience utilisateur et garant d'une plateforme fluide.`
}
```

### 2.3. Compétences Techniques d'Hugo

1. **Calcul Statistique Avancé :** Détermination systématique des percentiles (P50, P90, P99), de l'écart-type et des taux de succès ($S_{\text{rate}} = \frac{N_{\text{200}}}{N_{\text{total}}} \times 100$).
2. **Détection d'Anomalies Signature :**
   - *Chromium Cold Start :* Détection d'un écart > 2,5s sur la première carte générée après 15 min d'inactivité.
   - *Saturation Quota IA (429) :* Détection précoce des temps de réponse anormaux ou des bascules sur modèles de secours dans la cascade Gemini.
   - *Fuites de sockets SSE :* Corrélation entre pic de connexions et augmentation de la mémoire heap.
3. **Restitution Multi-Niveaux :** Capacité de produire un rapport exécutif pour le décideur (court, orienté impact utilisateur) ET un appendice technique pour Thomas et Alexandre.

### 2.4. Exemples de Livrables Types Produits par Hugo

````carousel
```markdown
### 🚨 ALERTE GOULOT D'ÉTRANGLEMENT — [HUGO]
**Période :** 25 Septembre 2026, 18h15 - 19h00 (Pic d'audience)
**Composant concerné :** Module Fiches Vocabulaire 9:16 (Puppeteer & Audio)

**1. Ce qui s'est passé en clair :**
Les utilisateurs ont attendu en moyenne 4,8 secondes (contre 2,1 secondes d'habitude) pour obtenir leur fiche. 3 utilisateurs ont vu leur requête expirer.

**2. La cause expliquée simplement :**
Le navigateur headless Chromium s'est éteint après 15 minutes d'inactivité. À 18h15, 6 utilisateurs ont cliqué simultanément : le serveur a dû relancer Chromium à froid tout en exécutant 6 synthèses audio FFmpeg de front, saturant temporairement les 4 vCPU du serveur Hetzner.

**3. Action recommandée pour l'équipe :**
- Porter le timeout d'inactivité Chromium de 15 min à 45 min durant les heures de pointe (17h-22h).
- Activer une file d'attente FIFO (concurrence max : 2 cartes simultanées).
```
<!-- slide -->
```markdown
### 📈 BULLETIN QUOTIDIEN DE SANTÉ SYSTÈME (DAILY DIGEST) — [HUGO]
**Date :** 25 Septembre 2026 | **Requêtes totales traitées :** 1 420 | **Disponibilité globale :** 99.85%

**Performances moyennes par fonctionnalité :**
- 💬 **Traductions du Chat :** 210 ms en moyenne (⚡ 41% servies instantanément en 0 ms grâce au cache LRU).
- 🎙️ **Synthèse Audio Unitaire :** 480 ms (Excellente fluidité de la voix ar-JO-SanaNeural).
- 🎴 **Génération Fiches Vocabulaire :** 2,35 s (Warm Singleton Chromium stable, 0 fuite mémoire).
- 🎬 **Pipeline Vidéo TikTok V3 :** 28,4 s pour une vidéo de 60s (Ratio de traitement : 0.47x le temps réel).

**Recommandation d'optimisation :**
Le taux d'utilisation du cache LRU plafonne à 41%. Ajouter les 20 expressions palestiniennes les plus fréquentes dans le pré-chargement pour atteindre 60% d'économie d'appels Gemini.
```
````

---

## 3. 🔐 VOLET 3 : SYNCHRONISATION SÉCURISÉE SERVEUR PROD ➔ MACHINE LOCALE

### 3.1. Arbitrage Technique : API REST vs Script SSH/SCP

| Critère d'Arbitrage | Option A : Endpoint API Dédié (`/api/admin/telemetry/export`) | Option B : Tâche CLI / Script SSH / SCP |
| :--- | :--- | :--- |
| **Ergonomie pour les agents locaux** | ⭐⭐⭐⭐⭐ Requêtable en 1 ligne HTTP par n'importe quel agent ou UI | ⭐⭐⭐ Nécessite clé SSH locale et outil terminal |
| **Filtrage temporel & granulaire** | ⭐⭐⭐⭐⭐ Natif (`?since=...&eventType=...&limit=500`) | ⭐⭐ Télécharge le fichier brut complet |
| **Impact CPU serveur en pic** | ⭐⭐⭐⭐ Zéro impact si streaming JSONL direct sans parse | ⭐⭐⭐⭐⭐ Zéro impact applicatif (géré par démon OpenSSH) |
| **Gestion des archives volumineuses** | ⭐⭐⭐ Moins adapté aux dumps de plusieurs Go | ⭐⭐⭐⭐⭐ Parfait pour synchroniser les `.jsonl.gz` |

### 3.2. Décision Architecturale : Approche Complémentaire Hybride

Pour concilier l'agilité d'interrogation de l'agent Hugo et la robustesse des sauvegardes de métriques, nous adoptons une **architecture hybride à double canal** :

#### Canal A (En Ligne & Temps Réel) : Endpoint d'API Streamée Sécurisée
* **Route :** `GET /api/admin/telemetry/export`
* **Mécanisme de Streaming Zéro-Mémoire :** L'endpoint ouvre un flux en lecture (`fs.createReadStream`) sur le fichier JSONL du jour ou un curseur streamé MongoDB, et le pipe directement dans la réponse HTTP :
  ```javascript
  // Pas d'accumulation en RAM V8
  fileStream.pipe(res);
  ```
* **Sécurité & Authentification à Deux Niveaux :**
  1. *Mode Agent Machine-to-Machine :* En-tête strict `X-Aya-Agent-Token` comparé en temps constant (`crypto.timingSafeEqual`) avec la variable d'environnement secrète `AYA_TELEMETRY_SECRET`.
  2. *Mode Navigateur :* Session administrateur validée via `requireAdmin` (`ADMIN_EMAIL`).
* **Protection Anti-DDoS :** Limiteur de débit dédié (max 10 requêtes par tranche de 5 minutes par token/IP).

#### Canal B (Hors-Bande & Dumps Historiques) : Tâche CLI Sécurisée SSH/SCP
* **Script Local :** `scripts/sync_telemetry_from_vps.ps1` (Windows) & `sync_telemetry.sh` (Linux/Mac).
* **Protocole :** Transfert sécurisé SCP/rsync chiffré par clé SSH ed25519 dédiée :
  ```bash
  scp -i ~/.ssh/aya_hetzner_ed25519 deploy@vps.ayastudio.com:/var/www/aya/data/telemetry/*.jsonl.gz ./local_telemetry/
  ```
* **Performance :** L'opération est déléguée au système d'exploitation Ubuntu sans toucher au runtime Node.js.

### 3.3. Respect Strict de la Confidentialité & Conformité RGPD

1. **Hachage Irréversible des Identifiants :**
   Les identifiants utilisateurs ou adresses e-mail ne sont **jamais** consignés en clair dans les métriques.
   $$\text{anonymizedId} = \text{HMAC-SHA256}(\text{userId}, \text{SALT\_SECRET})[0:12]$$
2. **Anonymisation des Adresses IP :**
   Troncature systématique du dernier octet pour IPv4 (`192.168.1.xxx` ➔ `192.168.1.0/24`) et du bloc hôte pour IPv6.
3. **Zéro Donnée Textuelle Privée (No-PII Payload) :**
   Les prompts de chat personnels et les transcriptions audio intégrales ne figurent pas dans la télémétrie. Seules les métadonnées techniques sont conservées (nombre de caractères, tokens estimés, langue détectée, durée en secondes).

---

## 4. 🗺️ PLAN D'IMPLÉMENTATION PAR ÉTAPES (AVANT CODAGE)

| Phase | Intitulé de la Tâche | Livrables Produits | Assignation |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **Moteur de Télémétrie & File Asynchrone** | • `services/telemetryService.js`<br>• `middleware/telemetryMiddleware.js`<br>• Répertoire `data/telemetry/` | Thomas |
| **Phase 2** | **Instrumentation des 5 Modules Clés** | • Wrappers non-bloquants dans `vocabularyCardService.js`, `studio.js`, `audio.js`, `chat.js`, `traduction.js` | Thomas & Max |
| **Phase 3** | **Enregistrement de l'Agent Hugo & Intégration** | • Définition d'Hugo dans `services/agentSupervisor.js`<br>• Logique d'analyse et génération de rapports dans `services/telemetryAnalyzer.js` | Steve & Alexandre |
| **Phase 4** | **Endpoint d'Export Sécurisé & Script Sync Local** | • `GET /api/admin/telemetry/export` dans `routes/admin.js`<br>• `scripts/sync_telemetry.js` pour rapatriement local machine | Thomas |
| **Phase 5** | **Tests de Charge, Validation Zéro-Fuite & Déploiement** | • Banc d'essai automatisé sous 100 requêtes concurrentes<br>• Rapport de certification pour Alexandre | Alexandre |

---

## 5. 🛡️ RECOMMANDATIONS IMMÉDIATES DE STEVE POUR VALIDATION

Avant d'autoriser l'écriture du premier fichier de code :
1. **Validation de l'emplacement de persistance :** Confirmer l'usage prioritaire du format append-only JSONL compressé avec rotation 7 jours dans `data/telemetry/`, complété par la collection MongoDB TTL si connectée.
2. **Approbation de la clé de synchronisation :** Génération d'une clé cryptographique aléatoire de 64 caractères pour `AYA_TELEMETRY_SECRET` dans le fichier `.env` du VPS Hetzner.
3. **Validation formelle du persona Hugo :** Confirmation de son rattachement au collège des agents Aya (8ᵉ membre officiel de l'équipe).
