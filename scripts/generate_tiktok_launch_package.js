/**
 * Générateur du Kit de Lancement TikTok Jour J (26 Septembre)
 * Ticket GitHub : #23
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LAUNCH_DIR = path.join(ROOT_DIR, 'public', 'assets', 'tiktok_jour_j');
fs.mkdirSync(LAUNCH_DIR, { recursive: true });

// 1. Génération du fichier ASS V3 Standard (1080x1920, Impact 72, MarginV 950, Jaune Cyber, Bandeau Rouge)
const assContent = `[Script Info]
Title: TikTok Launch Video Jour J - Aya Studio
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: HeaderBand,Impact,48,&H00FFFFFF,&H000000FF,&H002611CE,&H80000000,1,0,0,0,100,100,2,0,1,2,0,8,40,40,120,1
Style: SubtitlesImpact,Impact,72,&H0000FFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,0,2,60,60,950,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:01:00.00,HeaderBand,,0,0,0,,{\\an8\\bord4\\c&HFFFFFF&\\3c&H2611CE&}  PALESTINIAN ECHO  
Dialogue: 0,0:00:00.40,0:00:03.00,SubtitlesImpact,,0,0,0,,98% DES CRIS DU TERRAIN\\NRESTENT INAUDIBLES.
Dialogue: 0,0:00:03.00,0:00:08.00,SubtitlesImpact,,0,0,0,,NOUS NE SOMMES PAS DES CHIFFRES...\\NNOUS SOMMES DES HISTOIRES.
Dialogue: 0,0:00:08.00,0:00:15.00,SubtitlesImpact,,0,0,0,,DES GENS QUI AVAIENT DES MAISONS,\\NDES VIES, DES RÊVES ET DES RIRES.
Dialogue: 0,0:00:15.00,0:00:22.00,SubtitlesImpact,,0,0,0,,45 MINUTES DE MONTAGE MANUEL\\NRÉDUITES À 60 SECONDES.
Dialogue: 0,0:00:22.00,0:00:30.00,SubtitlesImpact,,0,0,0,,L'IA ACOUSTIQUE DÉCODE LE DIALECTE\\NMOT PAR MOT, SANS FILTRE.
Dialogue: 0,0:00:30.00,0:00:38.00,SubtitlesImpact,,0,0,0,,FORMAT 9:16 OPTIMISÉ TIKTOK :\\NSOUS-TITRAGE IMPACT INSTANTANÉ.
Dialogue: 0,0:00:38.00,0:00:45.00,SubtitlesImpact,,0,0,0,,CHAQUE PIERRE QUI TOMBE\\NEMPORTE DES ANNÉES DE SOUVENIRS...
Dialogue: 0,0:00:45.00,0:00:52.00,SubtitlesImpact,,0,0,0,,MAIS LA VOIX, ELLE,\\nRESTERA VIVANTE.
Dialogue: 0,0:00:52.00,0:00:57.00,SubtitlesImpact,,0,0,0,,NE LAISSEZ PAS LE SILENCE GAGNER.\\nTRADUISEZ. PARTAGEZ. TRANSMETTEZ.
Dialogue: 0,0:00:57.00,0:01:00.00,SubtitlesImpact,,0,0,0,,PLATEFORME OUVERTE.\\nLIEN DISPONIBLE EN BIO.
`;

const assFilePath = path.join(LAUNCH_DIR, 'subtitles_lancement_jour_j.ass');
fs.writeFileSync(assFilePath, assContent.trim(), 'utf8');

// 2. Copie de la couverture
const sourceThumb = path.join(ROOT_DIR, 'public', 'assets', 'couverture_lancement_tiktok_9_16.jpg');
const destThumb = path.join(LAUNCH_DIR, 'couverture_lancement_tiktok_9_16.jpg');
if (fs.existsSync(sourceThumb)) {
    fs.copyFileSync(sourceThumb, destThumb);
}

// 3. Fichier texte de description
const descriptionContent = `🔥 LE HOOK
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
`;

const descFilePath = path.join(LAUNCH_DIR, 'description_tiktok_jour_j.txt');
fs.writeFileSync(descFilePath, descriptionContent.trim(), 'utf8');

console.log(`✅ [TIKTOK LAUNCH KIT] Kit Jour J généré avec succès dans : ${LAUNCH_DIR}`);
console.log(`- Fichier ASS : ${path.basename(assFilePath)}`);
console.log(`- Miniature : ${path.basename(destThumb)}`);
console.log(`- Description : ${path.basename(descFilePath)}`);
