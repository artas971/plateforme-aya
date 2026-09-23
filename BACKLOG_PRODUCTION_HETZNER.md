# 📌 BACKLOG DES TICKETS DE DÉPLOIEMENT & ÉVOLUTIONS — AYA STUDIO
### VPS Hetzner CPX31 (Ubuntu 24.04 LTS)

---

## 🟢 ÉTAT D'AVANCEMENT GLOBAL

| Statut | Quantité | Description |
| :--- | :---: | :--- |
| **✅ RÉSOLUS (Hotfixes P0)** | **5** | Correctifs critiques appliqués et testés sur la branche `hotfix/p0-critical-fixes` |
| **🟠 EN ATTENTE (P1 - Haute)** | **6** | Scalabilité, Architecture SSE, MongoDB TTL, Sécurité & Sauvegardes |
| **🟡 EN ATTENTE (P2 - Moyenne)** | **4** | Ergonomie mobile tactile, Warm Chromium, Bascule 1-clic DM |
| **⚪ EN ATTENTE (P3 - Confort)** | **3** | Onglets de tri du chat, Cache LRU Gemini, Harmonisation RTL |

---

## ✅ HOTFIXES P0 VALIDÉS & INTÉGRÉS (Prêts pour fusion)

- **[TICKET-01]** - **Portabilité Linux pour la synthèse vocale des fiches** - Remplacement de `spawn('py')` par `spawnNice(getPythonBin(), ...)` dans `services/vocabularyCardService.js` pour éviter le crash `ENOENT` sur Ubuntu. - **Priorité : P0 (RÉSOLU)**
- **[TICKET-02]** - **Sécurisation absolue de `/api/chat/messages` contre les fuites de DMs** - Éradication du paramètre `req.query.user` et conditionnement strict de la visibilité des messages privés à `req.session.user`. - **Priorité : P0 (RÉSOLU)**
- **[TICKET-03]** - **Correction de la réinitialisation intempestive du destinataire vocal** - Suppression de `chatRecipientSelect.value = 'all'` dans `public/app.js` pour préserver le ciblage privé lors d'envois vocaux successifs. - **Priorité : P0 (RÉSOLU)**
- **[TICKET-04]** - **Encapsulation CPU basse priorité (`nice -n 15`) sous POSIX** - Intégration de `spawnNice`, `execFileNice` et mise à jour de `formatPythonCommand` dans `utils/runtime.js` pour protéger la boucle d'événements Node.js des saturations FFmpeg/Whisper. - **Priorité : P0 (RÉSOLU)**
- **[TICKET-05]** - **Durcissement Nginx sur la taille des payloads HTTP** - Restriction de `client_max_body_size` à 10M par défaut au niveau du serveur, et ouverture à 500M strictement limitée aux routes d'upload média (`/api/traduction/` et `/api/posts`). - **Priorité : P0 (RÉSOLU)**

---

## 📋 BACKLOG FORMEL DES TICKETS RESTANTS (P1, P2, P3)

### 🟠 Priorité P1 : Scalabilité, Architecture & Sauvegardes
- **[TICKET-06]** ([#24](https://github.com/artas971/plateforme-aya/issues/24)) - **Migration du stockage Chat vers MongoDB avec TTL Index 24h** - Remplacer `chat_db.json` par le modèle Mongoose `ChatMessage` doté de l'index `{ createdAt: 1 }, { expireAfterSeconds: 86400 }` et d'un index composé `{ recipient: 1, sender: 1 }` pour éliminer les écritures disque synchrones bloquantes. - **P1**
- **[TICKET-07]** ([#25](https://github.com/artas971/plateforme-aya/issues/25)) - **Bascule du Chat en Server-Sent Events (SSE) Zéro-Polling** - Créer l'endpoint `/api/chat/stream` et connecter `ChatEventBus` (EventEmitter) pour supprimer le `setInterval(2500)` client et réduire la latence de réception à < 10ms. - **P1**
- **[TICKET-08]** ([#26](https://github.com/artas971/plateforme-aya/issues/26)) - **Intégration de la Pilule de Destinataire Dynamique & Bannière Privée** - Remplacer le `<select>` statique du chat par le composant `Target Pill` connecté à `/api/presence` et afficher le bandeau violet de composition sécurisée. - **P1**
- **[TICKET-09]** ([#27](https://github.com/artas971/plateforme-aya/issues/27)) - **Service de Garbage Collection Automatisé (Disque NVMe)** - Déployer une tâche planifiée nettoyant les fichiers temporaires orphelins dans `audio_a_traiter/` (> 2h) et rotatant les vidéos générées de `fichiers_reponse_a_envoyer/` (> 48h). - **P1**
- **[TICKET-10]** ([#28](https://github.com/artas971/plateforme-aya/issues/28)) - **Stratégie de Sauvegarde Automatique MongoDB & Rotation S3/Hetzner Storage** - Mettre en place un script `mongodump` quotidien chiffré (GPG) avec rétention glissante 7 jours et synchronisation distante pour garantir la reprise après sinistre (Disaster Recovery). - **P1**
- **[TICKET-11]** ([#29](https://github.com/artas971/plateforme-aya/issues/29)) - **Gestion Sécurisée et Chiffrée du Fichier `.env` en Production** - Cloisonner les permissions Linux (`chmod 600 .env`, propriétaire `aya:aya`), interdire l'accès public via Nginx (`location ~ /\.env { deny all; }`) et documenter un `.env.example` complet. - **P1**

---

### 🟡 Priorité P2 : Ergonomie Mobile & Optimisations Mémoire
- **[TICKET-12]** ([#30](https://github.com/artas971/plateforme-aya/issues/30)) - **Adaptation Mobile Safe Areas & Hauteur Dynamique (`dvh`)** - Remplacer `100vh` par `100dvh` et appliquer `padding-bottom: env(safe-area-inset-bottom)` dans la CSS du chat pour empêcher le clavier virtuel de masquer le champ de saisie sur smartphone. - **P2**
- **[TICKET-13]** ([#31](https://github.com/artas971/plateforme-aya/issues/31)) - **Clic Avatar / Nom pour Bascule Rapide en DM** - Rendre cliquable l'en-tête de chaque bulle pour préremplir instantanément la cible privée vers l'auteur du message en 1-clic. - **P2**
- **[TICKET-14]** ([#32](https://github.com/artas971/plateforme-aya/issues/32)) - **Passage de Puppeteer en Warm Singleton avec Recyclage Périodique** - Conserver une instance Chromium ouverte en arrière-plan et réutiliser ses onglets (`browser.newPage()`) pour abaisser la latence de génération des fiches de 5s à 1.8s. - **P2**
- **[TICKET-15]** ([#33](https://github.com/artas971/plateforme-aya/issues/33)) - **Agrandissement des Cibles Tactiles Mobile (Conformité WCAG 44px)** - Augmenter la zone de clic des boutons Répondre (`↩️`), Supprimer (`🗑️`) et Switcher de langue (FR/عربي) à 44 × 44 px minimum. - **P2**

---

### ⚪ Priorité P3 : Confort Avancé & Cache
- **[TICKET-16]** ([#34](https://github.com/artas971/plateforme-aya/issues/34)) - **Barre d'Onglets de Filtrage du Chat (`Général` / `DMs`)** - Ajouter au-dessus du flux les boutons de filtre permettant d'isoler les messages privés des messages publics. - **P3**
- **[TICKET-17]** ([#35](https://github.com/artas971/plateforme-aya/issues/35)) - **Cache LRU en Mémoire pour Traductions Récurrentes du Chat** - Mettre en cache les salutations et phrases courantes (1 000 entrées, TTL 12h) afin d'économiser 35% de requêtes vers Gemini Flash et offrir des réponses en 0 ms. - **P3**
- **[TICKET-18]** ([#36](https://github.com/artas971/plateforme-aya/issues/36)) - **Harmonisation Typographique `line-height` en Mode Arabe (RTL)** - Supprimer le `line-height: 1.7 !important` universel dans `aya-rtl.css` et le cibler uniquement sur les paragraphes de lecture pour éviter les coupures sur les boutons d'interface. - **P3**
