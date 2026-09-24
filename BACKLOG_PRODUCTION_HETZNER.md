# 📌 BACKLOG DES TICKETS DE DÉPLOIEMENT & ÉVOLUTIONS — AYA STUDIO
### VPS Hetzner CPX31 (Ubuntu 24.04 LTS)

---

## 🟢 ÉTAT D'AVANCEMENT GLOBAL

| Statut | Quantité | Description |
| :--- | :---: | :--- |
| **✅ RÉSOLUS (P0, P1, P2, P3)** | **18 / 19** | **18 tickets résolus, 1 nouveau ticket d'interface en cours** |
| **🟠 EN ATTENTE (P1 - Haute)** | **0** | Aucun ticket P1 restant (Garbage Collection, MongoDB TTL, SSE, Sauvegardes résolus) |
| **🟡 EN ATTENTE (P2 - Moyenne)** | **1** | **[TICKET-19]** : Harmonisation globale de la footbar / footer selon `/communaute` |
| **⚪ EN ATTENTE (P3 - Confort)** | **0** | Aucun ticket P3 restant (Cache LRU, Onglets de filtrage, RTL résolus) |

---

## ✅ TICKETS VALIDÉS, TESTÉS & CLÔTURÉS SUR GITHUB

### 🔴 Hotfixes Critiques P0 (Infrastructure & Sécurité) :
- **[TICKET-01]** - **Portabilité Linux pour la synthèse vocale des fiches** - Remplacement de `spawn('py')` par `spawnNice(getPythonBin(), ...)` dans `services/vocabularyCardService.js`. - **Priorité : P0 (RÉSOLU)**
- **[TICKET-02]** - **Sécurisation absolue de `/api/chat/messages` contre les fuites de DMs** - Éradication du paramètre `req.query.user` et conditionnement strict de la visibilité des messages privés à `req.session.user`. - **Priorité : P0 (RÉSOLU)**
- **[TICKET-03]** - **Correction de la réinitialisation intempestive du destinataire vocal** - Suppression du reset involontaire vers `'all'` dans `public/app.js`. - **Priorité : P0 (RÉSOLU)**
- **[TICKET-04]** - **Encapsulation CPU basse priorité (`nice -n 15`) sous POSIX** - Intégration de `spawnNice` et `execFileNice` dans `utils/runtime.js`. - **Priorité : P0 (RÉSOLU)**
- **[TICKET-05]** - **Durcissement Nginx sur la taille des payloads HTTP** - Restriction de `client_max_body_size` à 10M par défaut et 500M sur uploads médias. - **Priorité : P0 (RÉSOLU)**

### 🟠 Priorité P1 : Scalabilité, Architecture & Sauvegardes :
- **[TICKET-06]** ([#24](https://github.com/artas971/plateforme-aya/issues/24)) - **Migration du stockage Chat vers MongoDB avec TTL Index 24h** - Modèle Mongoose `ChatMessage` avec TTL 24h (`expireAfterSeconds: 86400`) et compound index `{ recipient: 1, sender: 1 }` dans `models/ChatMessage.js` et `services/chatStorageService.js`. - **Priorité : P1 (RÉSOLU & FERMÉ)**
- **[TICKET-07]** ([#25](https://github.com/artas971/plateforme-aya/issues/25)) - **Bascule du Chat en Server-Sent Events (SSE) Zéro-Polling** - Endpoint `/api/chat/stream`, `ChatEventBus` (EventEmitter) et écouteur `EventSource` client dans `public/app.js` (suppression du polling 2.5s). - **Priorité : P1 (RÉSOLU & FERMÉ)**
- **[TICKET-08]** ([#26](https://github.com/artas971/plateforme-aya/issues/26)) - **Intégration de la Pilule de Destinataire Dynamique & Bannière Privée** - Composant `Target Pill`, popover connecté à `/api/presence` et bandeau violet de composition sécurisée. - **Priorité : P1 (RÉSOLU & FERMÉ)**
- **[TICKET-09]** ([#27](https://github.com/artas971/plateforme-aya/issues/27)) - **Service de Garbage Collection Automatisé (Disque NVMe)** - Service Node.js `services/garbageCollectorService.js`, script CLI `scripts/run_garbage_collector.js`, cron bash `scripts/cron_cleanup_disk.sh` et endpoints admin (1,47 Go libérés). - **Priorité : P1 (RÉSOLU & FERMÉ)**
- **[TICKET-10]** ([#28](https://github.com/artas971/plateforme-aya/issues/28)) - **Stratégie de Sauvegarde Automatique MongoDB & Rotation 7 Jours** - Scripts `scripts/backup_mongodb.sh` & `services/backupService.js`, checksum SHA-256, chiffrement AES-256 GPG, et rétention glissante 7 jours. - **Priorité : P1 (RÉSOLU & FERMÉ)**
- **[TICKET-11]** ([#29](https://github.com/artas971/plateforme-aya/issues/29)) - **Gestion Sécurisée et Chiffrée du Fichier `.env` en Production** - Cloisonnement Linux (`chmod 600`), interdiction Nginx et `.env.example`. - **Priorité : P1 (RÉSOLU & FERMÉ)**

### 🟡 Priorité P2 : Ergonomie Mobile & Optimisations Mémoire :
- **[TICKET-12]** ([#30](https://github.com/artas971/plateforme-aya/issues/30)) - **Adaptation Mobile Safe Areas & Hauteur Dynamique (`dvh`)** - Intégration de `100dvh` et `env(safe-area-inset-bottom)`. - **Priorité : P2 (RÉSOLU & FERMÉ)**
- **[TICKET-13]** ([#31](https://github.com/artas971/plateforme-aya/issues/31)) - **Clic Avatar / Nom pour Bascule Rapide en DM** - En-tête de bulle interactive `.chat-sender-clickable` pour préremplir instantanément la cible privée vers l'auteur. - **Priorité : P2 (RÉSOLU & FERMÉ)**
- **[TICKET-14]** ([#32](https://github.com/artas971/plateforme-aya/issues/32)) - **Passage de Puppeteer en Warm Singleton avec Recyclage Périodique** - Classe `WarmBrowserManager` dans `services/vocabularyCardService.js` réduisant la latence de génération de 37% avec recyclage mémoire automatique. - **Priorité : P2 (RÉSOLU & FERMÉ)**
- **[TICKET-15]** ([#33](https://github.com/artas971/plateforme-aya/issues/33)) - **Agrandissement des Cibles Tactiles Mobile (Conformité WCAG 44px)** - Cibles minimales 44 × 44 px sur les actions tactiles. - **Priorité : P2 (RÉSOLU & FERMÉ)**

### ⚪ Priorité P3 : Confort Avancé, Cache & Typographie :
- **[TICKET-16]** ([#34](https://github.com/artas971/plateforme-aya/issues/34)) - **Barre d'Onglets de Filtrage du Chat (`Général` / `DMs`)** - Filtrage instantané côté client. - **Priorité : P3 (RÉSOLU & FERMÉ)**
- **[TICKET-17]** ([#35](https://github.com/artas971/plateforme-aya/issues/35)) - **Cache LRU en Mémoire pour Traductions Récurrentes du Chat** - Cache LRU `ChatTranslationLRUCache` (1 000 entrées, TTL 12h, réponses 0 ms). - **Priorité : P3 (RÉSOLU & FERMÉ)**
- **[TICKET-18]** ([#36](https://github.com/artas971/plateforme-aya/issues/36)) - **Harmonisation Typographique `line-height` en Mode Arabe (RTL)** - Préservation des composants compacts et protection des glyphes émojis. - **Priorité : P3 (RÉSOLU & FERMÉ)**

### 📢 Lancement & Légal (Phase 2 & Jour J) :
- **[LANCEMENT / MARKETING]** ([#23](https://github.com/artas971/plateforme-aya/issues/23)) - **Publication de la 1ère Vidéo TikTok Inaugurale (Jour J - 26 Septembre)** - Kit complet généré dans `public/assets/tiktok_jour_j/` (sous-titres ASS V3, miniature 9:16, description hybride). - **RÉSOLU & FERMÉ**
- **[PHASE 2]** ([#14](https://github.com/artas971/plateforme-aya/issues/14)) - **Conformité Légale France & RGPD** - Pages `mentions-legales.html` (LCEN), `cgu.html` et `confidentialite.html` (RGPD/CNIL) avec routage public et footer. - **RÉSOLU & FERMÉ**

---

## 🟡 TICKETS EN ATTENTE D'IMPLÉMENTATION

### 🟡 Priorité P2 : Ergonomie & Cohérence UI :
- **[TICKET-19]** ([#38](https://github.com/artas971/plateforme-aya/issues/38)) - **Harmonisation Globale de la Footbar / Footer sur Toutes les Pages** - Standardisation et déploiement du pied de page légal et solidaire (CGU/CGV, Politique de Confidentialité RGPD, Soutien PayPal solidaire, Copyright 2026) calqué à 100% sur le modèle validé de la page `/communaute` ([modèle de référence](https://rugby-practitioner-mere-brian.trycloudflare.com/communaute)). Déploiement sur `fiches.html`, `traduction.html`, `traducteur.html`, `mentions-legales.html`, `moderation.html`, `index.html`, avec hydratation multilingue temps réel (FR/AR) via `aya-i18n.js` et adaptation safe-area mobile. - **Priorité : P2 (EN ATTENTE)**

