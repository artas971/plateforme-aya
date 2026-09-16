# MODULE 1 : CRÉATEUR DE VIDÉO TIKTOK & SOUS-TITRES .ASS (PROTOCOLE V3)

## 📌 OBJECTIF
Générer des vidéos TikTok 1080x1920 sous-titrées (VOSTFR ou VOAR) avec prévisualisation dynamique interactive (Studio HTML Canvas 9:16) et encodage réel FFmpeg.

---

## 🎨 VARIABLES DE STYLISATION & PROTOCOLE DE COULEURS

### 1. Panel Titre (10 Nuances)
- **Couleur par Défaut** : Ivoire Méta `#D8D0BE` (`&H00BED0D8` en ASS BGR).
- **Nuances Disponibles** : 
  - Ivoire Méta `#D8D0BE`
  - Blanc Pur `#FFFFFF`
  - Jaune Cyber `#FFFF00`
  - Or Néon `#FFD700`
  - Rouge Carmin `#FF3B30`
  - Vert Émeraude `#34C759`
  - Cyan Néon `#00E5FF`
  - Orange Solaire `#FF9500`
  - Violet Royal `#AF52DE`
  - Rose Néon `#FF2D55`

### 2. Panel Sous-Titres (10 Nuances)
- **Couleur par Défaut** : Jaune Cyber `#FFFF00` (`&H0000FFFF` en ASS BGR).
- **Nuances Disponibles** : 
  - Jaune Cyber `#FFFF00`
  - Blanc Pur `#FFFFFF`
  - Ivoire Méta `#D8D0BE`
  - Or Néon `#FFD700`
  - Rouge Carmin `#FF3B30`
  - Vert Émeraude `#34C759`
  - Cyan Néon `#00E5FF`
  - Orange Solaire `#FF9500`
  - Violet Royal `#AF52DE`
  - Rose Néon `#FF2D55`

### 3. Bandeau d'En-tête Interactif
- **Affichage** : Case à cocher (Activable / Désactivable, activé par défaut).
- **Texte par Défaut** : `PALESTINIAN ECHO` (personnalisable en temps réel).
- **Couleur du Bandeau** : 
  - Rouge Palestine `#CE1126` (par défaut)
  - Noir Pur `#000000`
  - Bleu Cyan `#0EA5E9`
  - Vert Émeraude `#10B981`
  - Violet Nuit `#8B5CF6`

---

## 📐 POSITIONNEMENT DYNAMIQUE (`MarginV`)

1. **Position du Titre (`MarginV` Haut)** :
   - **Plage** : `50px` à `1000px` (Valeur par défaut : `380px`).
2. **Position des Sous-Titres (`MarginV` Bas)** :
   - **Plage** : `500px` à `1850px` (Valeur par défaut : `950px`, extensible jusqu'au bas absolu du cadre 1920).

---

## 🛠️ WORKFLOW INTERACTIF (STUDIO AYA V3)

1. **Sens de Traduction & Mode** :
   - 🇵🇸 Arabe Palestinien (Gaza) ➔ 🇫🇷 Français (VOSTFR)
   - 🇫🇷 Français ➔ 🇵🇸 Arabe Palestinien (Gaza Ammiya) (VOAR)

2. **Médias Source** :
   - Si **Vidéo** (.mp4 / .mov) : Incrustation directe des sous-titres .ASS.
   - Si **Audio** (.ogg / .mp3) : Sélection obligatoire par l'utilisateur de l'image de fond 9:16 (aucun fond forcé par défaut).

3. **Simulateur Visuel HTML Canvas 9:16 Temps Réel** :
   - Rendu fidèle avec aperçu instantané des couleurs du titre, des sous-titres, du bandeau et des positions.

4. **Pack Éditorial Sélectif & Téléchargement Direct** :
   - Fichiers exportés dans `fichiers_reponse_a_envoyer/` :
     - 🎬 Vidéo TikTok `.MP4` (1080x1920, H.264 / AAC)
     - 📄 Fichier de sous-titres `.ASS` v4.00+
     - 📝 Description TikTok `.TXT`
     - 🎨 Prompt de Couverture 9:16 `.TXT`
