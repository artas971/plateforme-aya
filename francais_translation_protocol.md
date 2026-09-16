# PROTOCOLE MAÎTRE V3 - TRADUCTION FRANÇAIS VERS ARABE PALESTINIEN (GAZA) VOAR

## 1. OBJECTIF & PÉRIMÈTRE
Générer automatiquement des vidéos TikTok 1080x1920 sous-titrées en **Arabe Palestinien parlé de Gaza (العامية الغزاوية)** à partir d'audios ou vidéos parlés en **Français**.

---

## 2. RÈGLES LINGUISTIQUES & FIDÉLITÉ (GAZA AMMIYA)
- **Traduction Multimodale vers l'Arabe Palestinien Authentique** :
  - Traduire directement en Arabe parlé de Gaza (Ammiya / العامية الغزاوية) et NON en Arabe littéraire rigide (Fusha).
- **Lexique & Expressions Incontournables de Gaza** :
  - *« Mon frère Steve »* ➔ **« أخوي ستيف »**
  - *« Ma sœur Soso »* ➔ **« أختي سوسو »**
  - *« Prends soin de toi »* ➔ **« ديري بالك على حالك »** *(féminin pour Soso)* / **« دير بالك على حالك »** *(masculin)*
  - *« Est-ce que tu vas bien ? »* ➔ **« كيفك؟ إن شاء الله تكوني بخير؟ »**
  - *« Je m'inquiète pour toi »* ➔ **« قلقان عليكِ / خايف عليكِ »**
  - *« Tu as raison »* ➔ **« معك حق »**
  - *« Que Dieu te protège et vous garde »* ➔ **« الله يحميكِ ويحفظكم يا رب »**
  - *« C'est sûr / D'accord »* ➔ **« أكيد / ماشي »**
  - *« On est ensemble / Je suis avec toi »* ➔ **« إحنا معك / أنا معك يا أختي »**

---

## 3. PROTOCOLE SYNCHRO ACOUSTIQUE & ZERO-GAP (.ASS ARABE)
- **Détection Dynamique de la Durée Audio (FFprobe)** : Interrogation obligatoire via fprobe pour obtenir la durée réelle exacte ([DURÉE_TOTALE]).
- **Gestion des Silences (Zero-Gap Rule)** :
  - Continuité visuelle fluide : End_N == Start_N+1. Pause autorisée uniquement si un silence réel dépasse 0,30 seconde.
- **Formatage des Sous-Titres Arabes** :
  - Maximum **6 à 8 mots arabes par bloc** sur 2 lignes équilibrées (\N).
  - Durée d'affichage idéale : 2.5s à 3.0s par bloc.
  - Aucun bloc ne commence par une ponctuation.

---

## 4. CHARTE GRAPHIQUE .ASS (TIKTOK 1080x1920)

### 📌 A. Titre Permanent (En-tête Headline)
- **Texte** : Titre explicite en Français ou Arabe (ex: رسالة دعم من فرنسا إلى غزة / MESSAGE DE SOUTIEN À GAZA).
- **Position** : Haut-centre, calé sous PALESTINIAN ECHO (Alignment: 8, MarginV: 380px).
- **Police** : Arial Black ou Segoe UI (Taille 46, Gras).
- **Couleur** : **Ivoire Méta #D8D0BE (&H00BED0D8)** avec contour Noir Épais (Outline: 3).

### 📌 B. Sous-Titres Dynamiques Arabes (Discours)
- **Position** : Centre-bas (Alignment: 2, MarginV: 950px).
- **Police** : Impact / Segoe UI / Traditional Arabic (Taille 64, Gras).
- **Couleur** : **Jaune Vif Cyber (&H0000FFFF)** avec contour Noir Épais (Outline: 3).

---

## 5. ASSETS POST-VIDÉO AUTOMATIQUES
À chaque génération de vidéo Français ➔ Arabe Palestinien :
1. Fichier Sous-Titres Brut (.ASS Arabe).
2. Vidéo TikTok MP4 VOAR 1080x1920.
3. Fichier Description TikTok (.TXT Bilingue Fr/Ar avec hashtags).
4. Prompt Image de Couverture (9:16 Abstrait).
