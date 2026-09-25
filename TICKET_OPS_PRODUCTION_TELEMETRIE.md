# 🎫 TICKET GITHUB #42 — OPS PRODUCTION HETZNER
### Activation Télémétrie, Clé Secrète AYA_TELEMETRY_SECRET & Synchronisation Distante (Agent Hugo)

* **Lien Officiel GitHub :** [Issue #42 - artas971/plateforme-aya](https://github.com/artas971/plateforme-aya/issues/42)
* **Date de création :** 25 Septembre 2026
* **Labels :** `ops`, `production`, `telemetry`
* **Priorité :** P1 (Mise en Production Hetzner CPX31)
* **Responsables :** Alexandre, Steve, Thomas & Hugo

---

## 🎯 Objectif & Contexte
Lors du déploiement en production sur le serveur dédié **Hetzner CPX31** (Ubuntu 24.04 LTS), ce ticket récapitule les étapes impératives pour activer le pipeline d'observabilité, sécuriser la passerelle d'export et permettre au nouvel **Agent Hugo** de piloter les performances de la plateforme à distance.

---

## 📋 Checklist des Actions de Déploiement (Jour J)

### 1. 🔑 Configuration des Variables d'Environnement (`.env` du VPS Hetzner)
- [ ] Générer une clé cryptographique forte de 64 caractères :
  ```bash
  openssl rand -hex 32
  ```
- [ ] Ajouter dans le fichier `/var/www/aya/.env` du serveur Hetzner :
  ```env
  # Sécurité de la Télémétrie & Export Machine-to-Machine
  AYA_TELEMETRY_SECRET=insérer_ici_la_clé_64_caractères
  AYA_TELEMETRY_SALT=insérer_ici_un_sel_aléatoire_pour_anonymisation_hmac
  AYA_EXEC_PROFILE=cloud_vps_safe
  NODE_ENV=production
  ```

### 2. 📁 Répertoires & Permissions Disque
- [ ] Vérifier la création et les permissions du dossier local de télémétrie :
  ```bash
  mkdir -p /var/www/aya/data/telemetry
  chown -R deploy:deploy /var/www/aya/data/telemetry
  chmod 750 /var/www/aya/data/telemetry
  ```

### 3. 🛡️ Contrôle du Garbage Collector & MongoDB TTL
- [ ] Vérifier que `services/garbageCollectorService.js` tourne toutes les 4h et intègre bien la purge des journaux `data/telemetry/*.jsonl` de plus de 7 jours.
- [ ] Vérifier que la collection MongoDB `telemetry_metrics` a bien son index TTL natif de 7 jours (`expireAfterSeconds: 604800`).

### 4. 🛰️ Test de l'Endpoint d'Export Sécurisé
- [ ] Tester l'accès non autorisé (Doit renvoyer **HTTP 401**) :
  ```bash
  curl -I https://ayastudio.com/api/admin/telemetry/export
  ```
- [ ] Tester l'accès autorisé avec le jeton d'agent (Doit renvoyer **HTTP 200** avec flux streamé) :
  ```bash
  curl -H "X-Aya-Agent-Token: VOTRE_CLE_64_CHARS" "https://ayastudio.com/api/admin/telemetry/export?limit=5"
  ```

### 5. 💻 Test du Rapatriement Distant & Analyse Hugo depuis la Machine Locale
- [ ] Définir les variables sur la machine locale :
  ```powershell
  $env:AYA_REMOTE_URL="https://ayastudio.com"
  $env:AYA_TELEMETRY_SECRET="VOTRE_CLE_64_CHARS"
  ```
- [ ] Lancer la synchronisation avec analyse d'Hugo intégrée :
  ```bash
  node scripts/sync_telemetry.js --analyze
  ```
- [ ] Confirmer la réception du fichier `telemetry_data/events-YYYY-MM-DD.jsonl` et l'affichage du **Daily Ops Digest**.

### 6. 🧹 Vérification Zéro Pollution
- [ ] Vérifier que les requêtes `/health` et les assets statiques (`/public/*`, `*.ico`, images) ne génèrent aucune ligne dans le fichier de télémétrie.

---

## 👥 Équipe Assignée
* **Lead Déploiement :** Alexandre & Steve
* **Sécurité & Infra Back-End :** Thomas
* **Observabilité & Validation :** Hugo
