# 🗺️ DOCUMENT DE CADRAGE STRATÉGIQUE — ROADMAP V2 (POST-LANCEMENT)

> **Projet** : AYA Studio • Plateforme Documentaire & Solidaire  
> **Date de cadrage** : 22 Septembre 2026  
> **Statut V1** : 🔒 **Code Freeze Absolu** — En ligne de mire pour le déploiement du **26 Septembre 2026**.  
> **Horizon V2** : Octobre 2026  

---

## 📌 1. Arbitrage Produit : Exposition Publique des Extraits du Direct

### 1.1 Décision Validée & Rejet de la Page Dédiée
* **Décision actée** : L'option d'une page dédiée distincte (type `/fil-actualite` ou `/gazette`) est **définitivement écartée** pour éviter l'éparpillement de l'audience, la démultiplication des onglets dans la barre de navigation et le risque de « pages minces » (*thin content* néfaste au SEO).
* **Arbitrage retenu** : L'exposition publique des extraits du direct est **intégrée au Mur Communautaire existant (`/communaute`)** sous la forme d'un filtre dédié :
  `[ Tous les témoignages ]` &nbsp;|&nbsp; `[ 🎬 Vidéos 9:16 ]` &nbsp;|&nbsp; `[ 💬 Échanges du Direct ]` *(Sélection Officielle)*.
* **Planning** : **Zéro développement sur la V1** afin de garantir la stabilité totale pour le lancement du 26 septembre. Implémentation planifiée dans le premier sprint de la V2.

---

## 🛡️ 2. Spécifications Fonctionnelles & Sécurité (V2)

### 2.1 Garde-Fous de Confidentialité & Déontologie
1. **Exclusion Stricte des Messages Privés (DM)** :
   * Tout message comportant un destinataire ciblé (`recipient !== 'all'`) est **inaccessible à la publication publique** au niveau du backend et de l'interface d'administration.
   * Règle de validation bloquante : `if (msg.recipient && msg.recipient !== 'all') throw new ForbiddenError("Les échanges privés ne peuvent pas être publiés.");`
2. **Anonymisation Automatique par Défaut** :
   * Les identifiants (@pseudonymes, emails, numéros de téléphone ou identifiants techniques `usr_...`) sont systématiquement expurgés avant publication.
   * Attribution d'alias neutres et bienveillants : *« Témoin du Direct »*, *« Voix de Gaza »*, *« Participant anonyme »*.
   * Masquage automatique des données sensibles via regex et validation humaine obligatoire de l'administrateur.
3. **Curation & Double Accord** :
   * Seuls les administrateurs et modérateurs accrédités peuvent promouvoir un extrait archivé vers le statut public.

### 2.2 Modèle de Données : `chat_highlight`
Le format hérite du schéma unifié des publications de la collection `posts` pour une compatibilité native avec l'API existante `/api/posts` :

```json
{
  "_id": "post_chathighlight_1790103456789_x9z2a",
  "type": "chat_highlight",
  "status": "approved",
  "author": {
    "displayName": "Témoin du Direct",
    "isAnonymous": true,
    "role": "participant"
  },
  "content": {
    "originalText": "رسالة حية من شمال قطاع غزة...",
    "frenchTranslation": "Témoignage direct depuis le nord de la bande de Gaza...",
    "sourceLang": "ar",
    "targetLang": "fr",
    "contextSnippet": "Échange recueilli lors du direct d'urgence"
  },
  "media": {
    "hasAudio": true,
    "audioUrl": "/fichiers_reponse_a_envoyer/chat_tts_highlight_example.mp3",
    "durationSeconds": 14.5
  },
  "moderation": {
    "approvedBy": "john",
    "sourceArchiveId": "archive_chat_2026-09-22T18-28-24-203Z.json",
    "originalMessageId": "chat_1790101701075_fzftf",
    "approvedAt": "2026-10-02T10:15:00.000Z"
  },
  "tags": ["Direct", "Temoignage", "Gaza", "ArchiveOfficielle"],
  "likesCount": 0,
  "sharesCount": 0,
  "createdAt": "2026-10-02T10:15:00.000Z"
}
```

### 2.3 Rendu Visuel : « Carte Citation Bilingue » (Card Dialogue)
Sur le Mur Communauté (`/communaute`), les cartes de type `chat_highlight` se distingueront nettement des vidéos 9:16 :
* **Badge officiel** : `💬 Échange du Direct • Validé par l'équipe`.
* **Typographie bilingue soignée** :
  - Bloc supérieur : Arabe Shami authentique en police calligraphiée *Amiri / Cairo*.
  - Bloc inférieur : Traduction française fluide et certifiée en police *Inter*.
* **Lecteur audio intégré** : Mini-player circulaire avec visualiseur d'ondes pour écouter la note vocale associée sans quitter la page.

---

## 🚀 3. Synthèse du Backlog Roadmap V2 (Octobre 2026)

| Chantier Majeur | Description & Enjeux Techniques | Priorité V2 |
| :--- | :--- | :---: |
| **💬 Extraits du Direct sur Mur Communauté** | Système de promotion d'extraits (`chat_highlight`), anonymisation automatique, cartes citations bilingues et filtre dédié sur `/communaute`. | **P1 (Haute)** |
| **⚡ File Distribuée BullMQ & Redis** | Découplage complet des tâches lourdes (transcription Whisper, incrustation FFmpeg, batch audio) pour absorber les pics de trafic sans saturer le VPS Hetzner. | **P1 (Haute)** |
| **🎁 Système de Parrainage & Crédits Créateurs** | Mécanisme de codes parrains, attribution automatique de crédits de sous-titrage bonus pour les nouveaux inscrits et leurs prescripteurs. | **P2 (Moyenne)** |
| **📊 Statistiques Vidéo TikTok Analytics API** | Récupération automatique des métriques de vues, partages et rétention des vidéos publiées via l'API TikTok pour le tableau de bord créateur. | **P3 (Évolution)** |

---

## 🔒 4. Rappel Impératif : Statut V1 & Code Freeze

* **Périmètre V1 scellé** : 
  - Authentification et sas testeurs sécurisés (`testeur1-4`, `john`, etc.).
  - Réactivité instantanée du chat éphémère (latence serveur 10 ms, Optimistic UI 0 ms).
  - Modération d'urgence (Réinitialisation collective, Archivage horodaté, Suppression ciblée de message).
  - Studio VOSTFR 9:16 (Scan 5s, police Impact Jaune proportionnelle, zéro débordement sur tous les écrans PC et mobiles).
  - Intégration TikTok Content Posting API v2 (Direct Post & Schedule).
* **Consigne de rigueur** : Aucun développement supplémentaire n'est autorisé sur la V1 d'ici le **26 Septembre 2026**. Les équipes se concentrent exclusivement sur la validation des tests, la recette sur VPS Hetzner et la préparation de la bascule en production.
