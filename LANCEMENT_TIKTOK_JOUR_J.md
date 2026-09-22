# 🎬 GUIDE OFFICIEL DE LANCEMENT TIKTOK (JOUR J - 26 SEPTEMBRE)
**Aya Studio — Première Vidéo Inaugurale : "La Voix Brisée du Silence"**

---

## 📌 FICHE TECHNIQUE & PROTOCOLE DE RENDU V3 (STRICT)

Conformément au protocole officiel Aya Studio V3 ([`aya_tiktok_vostfr_protocol.md`](aya_tiktok_vostfr_protocol.md)), la vidéo respecte scrupuleusement ces spécifications de rendu :

| Paramètre | Valeur Standard V3 | Justification & Règle Mobile |
| :--- | :--- | :--- |
| **Format & Résolution** | `1080 x 1920` (9:16 Vertical) | Plein écran natif TikTok / Instagram Reels |
| **Zone Sous-Titres (`MarginV`)** | **`950 px`** (Alignement 2, Centré) | Évite le masquage par les boutons TikTok (Like, Partage, Description) |
| **Police des Sous-Titres** | **`Impact`** | Lisibilité instantanée, contraste maximal à grande vitesse de lecture |
| **Taille de Police (`Fontsize`)** | **`72 px`** | Impact visuel fort sans déborder du cadre mobile |
| **Couleur Principale** | **Jaune Cyber (`#FFFF00`)** | `&H0000FFFF` en format ASS BGR — Capte le regard en 0.2s |
| **Bordure & Ombre (`Outline`)** | **Noir Pur (`#000000`), Épaisseur `3 px`** | Détachement parfait du texte sur n'importe quel arrière-plan vidéo |
| **Bandeau Supérieur (Header)** | **`PALESTINIAN ECHO`** | Fond Rouge Palestine (`#CE1126`), Texte Blanc Pur (`#FFFFFF`) |
| **Densité Textuelle** | **Maximum 2 lignes par bloc** | Règle Zéro-Gap : aucune coupure de phrase, synchronisation labiale pure |
| **Couverture 9:16 (Thumbnail)** | **Abstraite (Zéro visage humain)** | Palette stricte : Noir, Blanc, Vert Olive, Rouge Carmin |

---

## 🖼️ COUVERTURE VIDÉO 9:16 (ASSET GÉNÉRÉ)

L'asset officiel de couverture respecte la consigne de sobriété symbolique absolue (**zéro être humain**, onde acoustique et géométrie brisée, palette 4 couleurs) :
* **Chemin local de l'asset** : [`public/assets/couverture_lancement_tiktok_9_16.jpg`](public/assets/couverture_lancement_tiktok_9_16.jpg)
* **Format** : Vertical 1080x1920 (9:16)
* **Titre typographique à superposer** : `LE POIDS DES MOTS` (Police Impact, 90px, Jaune Cyber).

---

## ⚡ LE HOOK CHOC (0 à 3 SECONDES)

> [!IMPORTANT]
> **L'Arrêt du Scroll (00:00 - 00:03)** :  
> Le spectateur moyen décide de glisser en moins de **1.5 seconde**. Nous coupons court à tous les codes habituels de TikTok.
>
> * **Visuel** : Écran noir absolu pendant 0.4s. Soudain, une onde acoustique rouge sang pulse brutalement au centre, synchronisée sur un bip cardiaque sourd (*battement de cœur lourd - 60 Hz bass drop*).  
> * **Texte géant Jaune Impact (MarginV 950)** :  
>   **« 98% DES CRIS DU TERRAIN**  
>   **RESTENT INAUDIBLES. »**  
> * **Audio Voix-Off (chuchotement percutant, voix grave)** :  
>   *« Ce que vous allez entendre n'a jamais été traduit en français. Jusqu'à aujourd'hui. »*

---

## ⏱️ STORYBOARD DE 60 SECONDES : PLANS VISUELS & SCRIPT AUDIO BILINGUE

### 🎬 PLAN 1 : L'ARRÊT DU SCROLL (00:00 - 00:03)
* **Plan Caméra / Graphisme** : Écran noir absolu $\rightarrow$ Pulsation brutale d'une onde sonore rouge au centre de l'écran 9:16 $\rightarrow$ Transition glitch rapide.
* **Audio Arabe (Bruit réel du terrain)** : Souffle du vent, rumeur lointaine et première respiration d'un homme qui commence à parler.
* **Voix-Off Française (Impact)** : *« 98% des cris du terrain restent inaudibles. »*
* **Sous-titres ASS (Impact 72, Jaune, Bordure 3px Noire)** :
  ```text
  98% DES CRIS DU TERRAIN
  RESTENT INAUDIBLES.
  ```

---

### 🎬 PLAN 2 : LA VOIX DU TÉMOIN SANS TRADUCTION (00:03 - 00:15)
* **Plan Caméra / Graphisme** : Fond vidéo flouté et sombre d'un quartier de Gaza au crépuscule. Au centre, l'onde sonore réagit en direct à la voix du témoin.
* **Audio Arabe Authentique (Dialecte Gazaoui)** :
  *« إحنا مش أرقام يا عالم... إحنا حكايات، إحنا ناس كان إلها بيوت وحياة وأحلام وضحكات... »*  
  *(Phonétique : « Ihna mosh arqam ya 'alam... Ihna hekayat, ihna nas kan elha byout w hayat w ahlam w dehkât... »)*
* **Dilemme visuel** : Un chronomètre rouge tourne en bas à droite : *« 12 secondes de parole = 0 compréhension sans IA »*.
* **Sous-titres ASS (Rythme sync 2 lignes max)** :
  ```text
  [00:03 - 00:08]
  NOUS NE SOMMES PAS DES CHIFFRES...
  NOUS SOMMES DES HISTOIRES.

  [00:08 - 00:15]
  DES GENS QUI AVAIENT DES MAISONS,
  DES VIES, DES RÊVES ET DES RIRES.
  ```

---

### 🎬 PLAN 3 : LA DÉMONSTRATION EN DIRECT DU STUDIO AYA (00:15 - 00:38)
* **Plan Caméra / Graphisme** : Capture d'écran dynamique du logiciel Aya Studio ([`public/traduction.html`](public/traduction.html)) sur smartphone moderne.
  1. *00:15 - 00:20* : Le fichier audio brut est déposé dans l'interface (`Drag & Drop`). La jauge d'analyse acoustique s'illumine en vert émeraude.
  2. *00:20 - 00:28* : Zoom sur les deux agents en action :
     - **Agent Aya** : Horodatage précis mot-à-mot (`word_timestamps=True`).
     - **Agent Alexandre** : Détection instantanée de l'expression dialectale gazaouie.
  3. *00:28 - 00:38* : Aperçu direct du Canvas 9:16 interactif : les sous-titres Impact Jaune 72 s'animent en temps réel sur la vidéo avec l'en-tête `PALESTINIAN ECHO`.
* **Voix-Off Française (Énergique, rythmée, informative)** :
  *« Traduire manuellement prenait 45 minutes. Aya le fait en 60 secondes chrono. Notre IA acoustique décode le dialecte levantin, mot par mot, sans filtre ni trahison du sens. »*
* **Sous-titres ASS (Impact 72, Jaune, Bordure 3px Noire)** :
  ```text
  [00:15 - 00:22]
  45 MINUTES DE MONTAGE
  RÉDUITES À 60 SECONDES.

  [00:22 - 00:30]
  L'IA ACOUSTIQUE DÉCODE LE DIALECTE
  MOT PAR MOT, SANS FILTRE.

  [00:30 - 00:38]
  FORMAT 9:16 OPTIMISÉ TIKTOK :
  SOUS-TITRAGE IMPACT INSTANTANÉ.
  ```

---

### 🎬 PLAN 4 : L'EXTRAIT DU RÉSULTAT FINAL BRUT (00:38 - 00:52)
* **Plan Caméra / Graphisme** : Plein écran 1080x1920 sur le rendu final exporté par FFmpeg. Image brute contrastée, sous-titrage ultra-net centré à MarginV 950, bandeau `PALESTINIAN ECHO` en haut.
* **Audio Arabe Authentique (Témoignage émouvant)** :
  *« كل حجر بيوقع بياخد معه ذكريات سنين... بس الصوت رح يضل عايش. »*  
  *(Phonétique : « Koul hajar byouqa' byakhoud ma'ou zikrayat sineen... bas el-sawte rah ydal 'ayesh. »)*
* **Sous-titres ASS (Synchronisation parfaite mot-à-mot)** :
  ```text
  [00:38 - 00:45]
  CHAQUE PIERRE QUI TOMBE
  EMPORTE DES ANNÉES DE SOUVENIRS...

  [00:45 - 00:52]
  MAIS LA VOIX, ELLE,
  RESTERA VIVANTE.
  ```

---

### 🎬 PLAN 5 : PACKSHOT FINAL & APPEL À LA SOLIDARITÉ (00:52 - 01:00)
* **Plan Caméra / Graphisme** : L'affiche abstraite 9:16 ([`couverture_lancement_tiktok_9_16.jpg`](public/assets/couverture_lancement_tiktok_9_16.jpg)) apparaît avec une animation de fondu noble.
* **Voix-Off Française (Solennelle & mobilisatrice)** :
  *« Ne laissez pas leurs voix s'éteindre dans le flux des réseaux. Traduisez, partagez, archivez. Plateforme accessible dès maintenant. Lien en bio. »*
* **Sous-titres ASS & Typographie Finale** :
  ```text
  [00:52 - 00:57]
  NE LAISSEZ PAS LE SILENCE GAGNER.
  TRADUISEZ. PARTAGEZ. TRANSMETTEZ.

  [00:57 - 01:00]
  PLATEFORME OUVERTE.
  LIEN DISPONIBLE EN BIO.
  ```

---

## 📝 DESCRIPTION TIKTOK HYBRIDE (À COPIER-COLLER DANS L'APPLICATION)

Voici le texte officiel rédigé selon la structure stricte de l'Agent Nadine (Zéro publicité agressive, Zéro fabulation, 5 hashtags max) :

```text
🔥 LE HOOK
98% des témoignages enregistrés sur le terrain restent invisibles en France à cause de la barrière de la langue.

📌 LE CONTEXTE
Face à la barrière du dialecte palestinien et à la lenteur du montage manuel, les voix authentiques sont noyées par le flux des algorithmes.
Cette technologie solidaire traduit et sous-titre chaque récit en format 9:16 en moins de 60 secondes pour préserver la mémoire.

👉 LE CTA
Partagez cette capsule pour briser le mur du silence et permettre à ces récits d'atteindre le monde entier.

---

📖 L'HISTOIRE COMPLÈTE
Chaque jour, des centaines de messages vocaux et d'enregistrements audio documentent la réalité vécue à Gaza et au Proche-Orient. Pourtant, la complexité du dialecte levantin et l'urgence quotidienne rendent la transcription manuelle presque impossible pour les créateurs de contenu et journalistes indépendants. 

Derrière chaque phrase enregistrée au milieu des décombres se trouve une existence, une famille et une mémoire qui refusent de disparaître. En automatisant l'extraction acoustique et l'incrustation de sous-titres bicolores haute lisibilité au format TikTok, nous donnons à chaque citoyen les moyens techniques de relayer la vérité brute, mot par mot, sans déformation ni intermédiaire. 

L'accès à la traduction n'est pas un luxe technologique, c'est un outil de justice humaine et d'archivage historique. Écoutez leurs mots, transmettez leurs voix, et refusez l'indifférence.

🏷️ LES HASHTAGS
#Palestine #Gaza #Traduction #IA #PourToi
```

---

## 📋 CHECK-LIST OPÉRATIONNELLE DE PUBLICATION TIKTOK (JOUR J)

- [ ] **Média source** : Vérifier que le fichier MP4 est bien exporté en 1080x1920 à 30 ou 60 FPS (H.264 / AAC).
- [ ] **Couverture vidéo** : Sélectionner l'image abstraite générée [`public/assets/couverture_lancement_tiktok_9_16.jpg`](public/assets/couverture_lancement_tiktok_9_16.jpg) comme vignette officielle sur TikTok.
- [ ] **Description** : Coller l'intégralité du texte ci-dessus sans altérer les 5 hashtags.
- [ ] **Son officiel TikTok** : Conserver le son original de la vidéo ("Voix originale") à 100% de volume pour maximiser la rétention audio.
- [ ] **Lien en Bio** : Vérifier que l'URL publique de la plateforme est bien ajoutée dans la biographie du compte TikTok.
