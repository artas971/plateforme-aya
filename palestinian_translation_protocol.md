# PROTOCOLE MAÎTRE V3 - TRADUCTION ARABE PALESTINIEN (GAZA) VERS FRANÇAIS VOSTFR

## 1. OBJECTIF & PÉRIMÈTRE
Générer automatiquement des vidéos TikTok 1080x1920 sous-titrées en Français (.ASS v4.00+) à partir d'audios parlés en Arabe palestinien (Dialecte de Gaza / Ammiya).

---

## 2. RÈGLES LINGUISTIQUES & FIDÉLITÉ (GOLD STANDARD)
- Traduction Multimodale Directe (Gemini Audio Waveform) : Traduction directe par écoute acoustique du fichier audio pour préserver l'émotion, le contexte et les tournures dialectales.
- Noms Propres & Entités : Conservation stricte des expressions et toponymes clés :
  - Interpellation : Mon frère Steve
  - Prénom : Soso (3ème personne narrative : Soso est forte, Soso est patiente...)
  - Lieux : Le Port (Al-Mina), La Ligne Jaune, Gaza
- Discernement de Scène & Intégrité Documentaire (Règle d'Or Alexandre & Nadine) :
  - Le contexte éditorial guide obligatoirement la compréhension de la nature de la scène (ex: extraction de restes mortels / martyrs vs secours d'un blessé vivant).
  - Interdiction formelle de projeter des actions de réconfort pour un vivant sur des gestes de recueil d'effets personnels de personnes décédées.
  - Les couvertures réclamées dans les décombres de bombardements font office de linceul pour envelopper la dépouille avec respect et pudeur.
- Cohérence Globale (Sous-titres .ASS ↔ Description .TXT) :
  - La description TikTok doit impérativement concorder avec les paroles authentiques des protagonistes, sans jamais dériver vers des interprétations mélodramatiques contradictoires.
- Exhaustivité 100% Intégrale ([DURÉE_TOTALE]) : Interdiction absolue de condenser, résumer ou tronquer la fin du discours. Traiter la totalité du message du premier au dernier mot.

---

## 3. PROTOCOLE SYNCHRO ACOUSTIQUE & ZERO-GAP
- Détection Dynamique de la Durée Audio (FFprobe) : Interrogation obligatoire via ffprobe pour obtenir la durée réelle exacte ([DURÉE_TOTALE]) sans valeur arbitraire en dur.
- Gestion des Silences (Zero-Gap Rule) :
  - Pour une continuité visuelle fluide, le temps de fin du bloc N est égal au temps de début du bloc N+1 (End_N == Start_N+1).
  - Découpage/pause visuelle autorisé uniquement si un silence réel dépasse 0,30 seconde.
- Pacing & Taille des Blocs :
  - Maximum 7 à 8 mots par sous-titre répartis sur 2 lignes équilibrées (\N).
  - Durée d'affichage idéale : 2.5s à 3.0s par bloc.
  - Découpage Grammatical Propre : Aucun bloc ne commence par une ponctuation (virgule, guillemet, point de suspension).

---

## 4. CHARTE GRAPHIQUE .ASS (TIKTOK 1080x1920)

### 📌 A. Titre Permanent (En-tête Headline)
- Texte : Titre explicite en majuscule propre (ex: SOSO NOUS PARLE DU DRAME SURVENU LE 18 AOÛT).
- Position : Haut-centre, calé sous PALESTINIAN ECHO (Alignment: 8, MarginV: 380px).
- Police : Arial Black (Taille 46, Gras).
- Couleur : Ivoire Méta #D8D0BE (&H00BED0D8) avec contour Noir Épais (Outline: 3) et ombre portée sombre.

### 📌 B. Sous-Titres Dynamiques (Discours Parlé)
- Position : Centre-bas (Alignment: 2, MarginV: 950px).
- Police : Impact (Taille 64).
- Couleur : Jaune Vif Cyber (&H0000FFFF) avec contour Noir Épais (Outline: 3).

---

## 5. ASSETS POST-VIDÉO AUTOMATIQUES
À chaque génération de vidéo, produire en une seule passe :
1. Fichier Sous-Titres Brut (.ASS) : Prêt pour incrustation FFmpeg.
2. Fichier Description TikTok (.TXT) :
   - Hook percutant.
   - Contexte factuel (2 lignes max).
   - Appel à l'action incisif (CTA).
   - Hashtags pertinents (#Gaza #Palestine #Soso #UrgenceGaza).
3. Prompt Image de Couverture (9:16) : Prompt abstrait (Palette : Noir, Blanc, Vert, Rouge).
