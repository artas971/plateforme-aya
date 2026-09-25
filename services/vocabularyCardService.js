/**
 * services/vocabularyCardService.js
 * 
 * Module Premium « Fiches Vocabulaire & Audio 9:16 » - Aya Studio
 * 
 * Pipeline complet :
 * 1. Génération sémantique bilingue via Gemini Flash avec schéma JSON strict
 * 2. Rendu graphique Puppeteer Headless (Edge/Chromium) à 1080x1920 (9:16) avec test de collision DOM
 * 3. Synthèse vocale neuronale bidirectionnelle (edge-tts : fr-FR-HenriNeural + ar-JO-SanaNeural)
 * 4. Concaténation audio séquentielle avec silences pédagogiques via FFmpeg
 * 5. Verrou de concurrence séquentielle (concurrency = 1) anti-emballement CPU/RAM
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const puppeteer = require('puppeteer-core');
const { getPythonBin, spawnNice, execFileNice } = require('../utils/runtime');
const { recordEvent, createTrace } = require('./telemetryService');

// Chemins de stockage
const ROOT_DIR = path.resolve(__dirname, '..');
const UPLOADS_CARDS_DIR = path.join(ROOT_DIR, 'uploads', 'cards');
const TEMP_BUILD_DIR = path.join(ROOT_DIR, 'temp', 'vocab_build');
const TTS_SCRIPT_PATH = path.join(ROOT_DIR, 'generate_tts_quick.py');

fs.mkdirSync(UPLOADS_CARDS_DIR, { recursive: true });
fs.mkdirSync(TEMP_BUILD_DIR, { recursive: true });

// Détection de l'exécutable Navigateur (Edge ou Chromium/Chrome)
function getBrowserExecutablePath() {
    const candidatePaths = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium'
    ];

    for (const p of candidatePaths) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error("Aucun exécutable de navigateur (Edge ou Chromium) trouvé sur le serveur.");
}

/**
 * 🔒 File d'attente séquentielle (Concurrency = 1)
 * Protège le serveur VPS contre l'épuisement mémoire (Puppeteer + FFmpeg simultanés)
 */
class SequentialQueue {
    constructor() {
        this.queue = [];
        this.running = false;
    }

    enqueue(taskFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ taskFn, resolve, reject });
            this.processNext();
        });
    }

    async processNext() {
        if (this.running || this.queue.length === 0) return;
        this.running = true;
        const { taskFn, resolve, reject } = this.queue.shift();

        try {
            const result = await taskFn();
            resolve(result);
        } catch (err) {
            reject(err);
        } finally {
            this.running = false;
            this.processNext();
        }
    }
}

const vocabCardQueue = new SequentialQueue();

/**
 * Nettoie et valide un émoji en extrayant le glyphe Unicode (y compris surrogate pairs Unicode 13+)
 */
function sanitizeEmoji(iconStr, defaultEmoji = '✨') {
    if (!iconStr || typeof iconStr !== 'string') return defaultEmoji;
    const trimmed = iconStr.trim();
    if (!trimmed) return defaultEmoji;
    const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;
    const match = trimmed.match(emojiRegex);
    return match ? match[0] : defaultEmoji;
}

/**
 * Calcule la distance d'édition de Levenshtein entre deux chaînes
 */
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

/**
 * Normalise une chaîne pour comparaison textuelle (minuscules, sans accents, sans tirets/espaces/ponctuation)
 */
function normalizeForComparison(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Normalisation phonétique simplifiée française pour intercepter les transcriptions du mot français
 * (ex: "audace" -> "odas", "o-das" -> "odas")
 */
function phoneticFrenchSimplify(str) {
    if (!str) return '';
    let s = normalizeForComparison(str);
    s = s.replace(/eau/g, 'o')
         .replace(/au/g, 'o')
         .replace(/ph/g, 'f')
         .replace(/qu/g, 'k')
         .replace(/gu([eiy])/g, 'g$1')
         .replace(/c([eiy])/g, 's$1')
         .replace(/c/g, 'k')
         .replace(/ai/g, 'e')
         .replace(/ei/g, 'e')
         .replace(/ou/g, 'u')
         .replace(/([aeiouy])s([aeiouy])/g, '$1z$2')
         .replace(/(.)\1+/g, '$1')
         .replace(/e$/g, '');
    return s;
}

/**
 * Calcule le taux de similarité (0.0 à 1.0) entre phoneticFr et le mot french.
 * Détecte si phoneticFr est une copie ou une transcription du mot français plutôt que de l'arabe.
 */
function checkPhoneticSimilarityWithFrench(phoneticFr, frenchWord) {
    if (!phoneticFr || !frenchWord) return 0;

    const cleanPhon = normalizeForComparison(phoneticFr);
    const cleanFrench = normalizeForComparison(frenchWord);

    if (!cleanPhon || !cleanFrench) return 0;

    // 1. Similarité Levenshtein directe normalisée
    const maxLen = Math.max(cleanPhon.length, cleanFrench.length);
    const distRaw = levenshteinDistance(cleanPhon, cleanFrench);
    const simRaw = maxLen > 0 ? 1 - (distRaw / maxLen) : 0;

    // 2. Similarité phonétique simplifiée (règles de prononciation françaises)
    const phonSimp = phoneticFrenchSimplify(phoneticFr);
    const frenchSimp = phoneticFrenchSimplify(frenchWord);
    const maxLenSimp = Math.max(phonSimp.length, frenchSimp.length);
    let simPhonetic = 0;
    if (maxLenSimp > 0) {
        const distSimp = levenshteinDistance(phonSimp, frenchSimp);
        simPhonetic = 1 - (distSimp / maxLenSimp);
    }

    return Math.max(simRaw, simPhonetic);
}

/**
 * 1. Génération sémantique des 5 mots bilingues via Gemini Flash (ou customWords)
 */
async function generateVocabularyData(theme, customWords = null, level = 'debutant', excludeWords = []) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) {
        throw new Error("Clé API Gemini (GEMINI_API_KEY) manquante.");
    }

    const systemInstruction = `Tu es le linguiste expert de la plateforme Aya Studio spécialisé dans l'arabe Shami (palestinien/levantin) et le français.
Tu dois générer exactement 5 fiches de vocabulaire thématiques adaptées à l'apprentissage croisé sur TikTok Live (les francophones apprennent l'arabe et les palestiniens apprennent le français).

Règles de translittération strictes :
1. Pour l'arabe : écriture en arabe avec vocalisation complète (Tashkeel / Harakat).
2. Phonétique pour francophones (phoneticFr) :
   ⚠️ RÈGLE FONDAMENTALE ET IMPÉRATIVE :
   Ce champ sert UNIQUEMENT à apprendre aux francophones à prononcer le mot ARABE en dialecte Shami !
   Il doit TOUJOURS contenir la prononciation phonétique en alphabet latin découpé en syllabes avec tirets DU MOT ARABE (ex: pour بَسَالَة -> Ba-sal-la, pour ثَبَات -> Tha-bat, pour إِقْدَام -> Iq-dam, pour تَجَلُّد -> Ta-jal-lud, pour جُرْأَة -> Jur-'a).
   🚫 INTERDICTION FORMELLE ET ABSOLUE : Ne JAMAIS découper ni transcrire le mot français dans phoneticFr (ne JAMAIS écrire "In-tré-pi-di-té", "Sto-i-cism" ou "O-das"). Si tu y mets le mot français, la fiche est complètement fausse et rejetée.
   Conventions phonétiques : Kh pour خ, Gh pour غ, Ch pour ش, Q pour ق, 'A pour ع.
3. Phonétique pour arabophones (phoneticAr) : transcription du mot français en lettres arabes avec Tashkeel complet pour permettre aux arabophones d'apprendre à prononcer le mot français [ex: بُونْژُورْ pour Bonjour, لُو سُولَيّْ pour Le Soleil, لَا كُونْفْيَانْسْ pour La Confiance, أَنْتْرِيپِيدِيتِيه pour Intrépidité]. Règle impérative : lettre 'V' = ڤ, son 'J' = ژ, voyelle '-er/-é' = ـِيه.
4. Choisis EXACTEMENT UN SEUL émoji Unicode standard très évocateur pour chaque mot (ex: 🌳 pour un arbre, 🪚 pour une scie, 🍞 pour du pain). Interdiction d'utiliser du texte ou du code markdown à la place de l'émoji.

Réponds STRICTEMENT au format JSON suivant :
{
  "titleFr": "Titre thématique en Français (MAJUSCULES, max 25 caractères)",
  "titleAr": "Titre thématique en Arabe Shami avec Tashkeel",
  "theme": "${theme || 'vocabulaire_quotidien'}",
  "words": [
    {
      "french": "MOT EN FRANCAIS (MAJUSCULES)",
      "arabic": "الْكَلِمَةُ بِالْعَرَبِيَّةِ الشَّامِيَّةِ مَعَ التَّشْكِيلِ",
      "phoneticFr": "Prononciation-Du-Mot-Arabe-En-Alphabet-Latin (ex: Iq-dam, JAMAIS le mot francais)",
      "phoneticAr": "كِتَابَةُ النُّطْقِ الْفَرَنْسِيِّ بِالْعَرَبِيِّ",
      "icon": "👋",
      "ttsFrench": "Texte français à prononcer",
      "ttsArabic": "النص العربي للنطق"
    }
  ]
}`;

    const levelText = level === 'avance' ? 'avancé' : level === 'intermediaire' ? 'intermédiaire' : 'débutant';

    // Normalisation robuste du tableau customWords
    let cleanCustomWords = null;
    if (customWords) {
        if (Array.isArray(customWords)) {
            cleanCustomWords = customWords.map(w => (typeof w === 'string' ? w.trim() : '')).filter(Boolean).slice(0, 5);
        } else if (typeof customWords === 'string' && customWords.trim()) {
            cleanCustomWords = customWords.split(/[,;\n]+/).map(w => w.trim()).filter(Boolean).slice(0, 5);
        }
    }

    // Normalisation des mots exclus (pour renouveler la sélection sans doublons)
    let cleanExcludeWords = [];
    if (Array.isArray(excludeWords)) {
        cleanExcludeWords = excludeWords.map(w => (typeof w === 'string' ? w.trim() : '')).filter(Boolean);
    } else if (typeof excludeWords === 'string' && excludeWords.trim()) {
        cleanExcludeWords = excludeWords.split(/[,;\n]+/).map(w => w.trim()).filter(Boolean);
    }

    let userPrompt;
    if (cleanCustomWords && cleanCustomWords.length > 0) {
        if (cleanCustomWords.length >= 5) {
            userPrompt = `Tu DOIS générer la fiche éducative pour ces 5 mots précis imposés par l'utilisateur : ${cleanCustomWords.join(', ')}. Niveau adapté : ${levelText}. Respecte scrupuleusement ces 5 mots sans en substituer aucun.`;
        } else {
            const missingCount = 5 - cleanCustomWords.length;
            userPrompt = `L'utilisateur a imposé ${cleanCustomWords.length} mot(s) précis : ${cleanCustomWords.join(', ')}.
Consigne impérative : Tu DOIS obligatoirement inclure ces ${cleanCustomWords.length} mot(s) exacts dans la fiche.
Ensuite, pour respecter le gabarit obligatoire de 5 mots de l'affiche 9:16, invente et complète intelligemment avec exactement ${missingCount} mot(s) supplémentaire(s) pertinent(s) et en parfaite harmonie avec le thème "${theme || 'vocabulaire_quotidien'}".
Le JSON final doit comporter STRICTEMENT 5 mots (les ${cleanCustomWords.length} mots imposés + les ${missingCount} mots complémentaires). Niveau adapté : ${levelText}.`;
        }
    } else {
        userPrompt = `Génère 5 mots essentiels et poignants sur le thème : "${theme || 'solidarite_et_espoir'}". Niveau de difficulté adapté : ${levelText}.`;
    }

    if (cleanExcludeWords.length > 0) {
        userPrompt += `\nCONSIGNE D'EXCLUSION STRICTE : L'utilisateur a déjà vu ou appris ces mots : [${cleanExcludeWords.join(', ')}]. Tu ne dois ABSOLUMENT PAS inclure ces termes ni leurs variantes directes. Propose une sélection de 5 mots 100% renouvelée et différente.`;
    }

    const models = [
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-flash-lite-latest',
        'gemini-flash-latest',
        'gemini-2.5-flash'
    ];

    let lastError = null;
    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.2
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                lastError = new Error(`Gemini ${model} HTTP ${response.status}: ${errText}`);
                continue;
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) {
                lastError = new Error(`Réponse vide du modèle ${model}`);
                continue;
            }

            let cleanText = textResponse.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            let parsed;
            try {
                parsed = JSON.parse(cleanText);
            } catch (err) {
                lastError = new Error(`Erreur parsing JSON (${model}): ${err.message}`);
                continue;
            }

            // Normalisation de structure au cas où Gemini renvoie un tableau direct
            if (Array.isArray(parsed)) {
                parsed = { words: parsed };
            } else if (!parsed.words && Array.isArray(parsed.vocabulary)) {
                parsed.words = parsed.vocabulary;
            } else if (!parsed.words && Array.isArray(parsed.items)) {
                parsed.words = parsed.items;
            } else if (!parsed.words && Array.isArray(parsed.cards)) {
                parsed.words = parsed.cards;
            }

            if (!parsed.words || !Array.isArray(parsed.words) || parsed.words.length < 5) {
                lastError = new Error("Schéma JSON incomplet reçu de Gemini.");
                continue;
            }

            // Assainissement strict des émojis de chaque mot (Unicode 13+ et surrogate pairs)
            parsed.words = parsed.words.slice(0, 5).map(w => ({
                ...w,
                icon: sanitizeEmoji(w.icon, '✨')
            }));

            // 🛡️ SANITY CHECK : Filet de sécurité algorithmique anti-inversion phonétique
            let sanityCheckFailed = false;
            let failureReason = '';

            for (const word of parsed.words) {
                const sim = checkPhoneticSimilarityWithFrench(word.phoneticFr, word.french);
                if (sim >= 0.75) {
                    sanityCheckFailed = true;
                    failureReason = `Inversion phonétique détectée pour "${word.french}" : phoneticFr="${word.phoneticFr}" (similarité calculée: ${Math.round(sim * 100)}% >= 75%). Ce champ doit impérativement contenir la prononciation du mot arabe "${word.arabic}" et non du français.`;
                    break;
                }
            }

            if (sanityCheckFailed) {
                console.warn(`[SANITY CHECK VOCAB] ⚠️ ${failureReason} -> Rejet de l'itération et re-roll immédiat.`);
                lastError = new Error(`Sanity check rejeté : ${failureReason}`);
                continue;
            }

            return parsed;
        } catch (e) {
            lastError = e;
        }
    }

    throw lastError || new Error("Échec de la génération sémantique Gemini.");
}

/**
 * 2. Gabarit HTML Dual-Compartiment Bilingue 9:16 (Charte Aya Studio)
 * - Pôle Francophone (Bleu Aya / 'Inter')
 * - Séparateur Central (Émoji du mot)
 * - Pôle Arabophone (Turquoise Aya / 'Cairo')
 */
function buildHtmlTemplate(vocabData) {
    const cardsHtml = vocabData.words.slice(0, 5).map(item => {
        const isLongFr = (item.french || '').length > 12;
        const isLongAr = (item.arabic || '').length > 12;
        return `
      <div class="card-item-bilingual">
        <!-- Compartiment Francophone (Apprendre le Shami) -->
        <div class="comp-box comp-fr">
          <div class="comp-header">
            <span class="comp-flag">FRANÇAIS</span>
          </div>
          <div class="comp-word-fr ${isLongFr ? 'comp-word-long' : ''}">${escapeHtml(item.french)}</div>
          <div class="comp-phon-fr" title="Comment le dire en arabe Shami">
            <span class="phon-tag-fr">En Shami :</span>
            <span class="phon-val">${escapeHtml(item.phoneticFr)}</span>
          </div>
        </div>

        <!-- Séparateur Central : Émoji du Mot -->
        <div class="comp-divider">
          <div class="comp-icon-circle">${item.icon || '✨'}</div>
        </div>

        <!-- Compartiment Arabophone (Apprendre le Français) -->
        <div class="comp-box comp-ar">
          <div class="comp-header">
            <span class="comp-flag">عَرَبِيٌّ شَامِيٌّ</span>
          </div>
          <div class="comp-word-ar ${isLongAr ? 'comp-word-long' : ''}">${escapeHtml(item.arabic)}</div>
          <div class="comp-phon-ar" title="نُطْقُ الْفَرَنْسِيِّ بِالْعَرَبِيِّ">
            <span class="phon-tag-ar">نُطْقُ الْفَرَنْسِيِّ :</span>
            <span class="phon-val-ar">${escapeHtml(item.phoneticAr)}</span>
          </div>
        </div>
      </div>
    `;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(vocabData.titleFr || 'Fiche Vocabulaire')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Inter:wght@600;700;800;900&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
  <style>
    :root {
      /* Palette officielle Aya Studio */
      --color-primary: #0b5394;
      --color-turquoise: #00bcd4;
      --bg-gradient: linear-gradient(165deg, #040d1a 0%, #071927 45%, #030b14 100%);
      --fr-bg: linear-gradient(135deg, rgba(11, 83, 148, 0.42) 0%, rgba(15, 23, 42, 0.8) 100%);
      --fr-border: rgba(56, 189, 248, 0.42);
      --ar-bg: linear-gradient(135deg, rgba(0, 188, 212, 0.28) 0%, rgba(13, 148, 136, 0.55) 100%);
      --ar-border: rgba(45, 212, 191, 0.48);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', sans-serif;
      background: #020617;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      overflow: hidden;
    }

    #poster {
      width: 480px;
      height: 853px;
      background: var(--bg-gradient);
      border-radius: 28px;
      padding: 24px 16px 20px 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.12);
      position: relative;
      overflow: hidden;
    }

    /* Entête Titre */
    .header {
      text-align: center;
      z-index: 2;
      padding-top: 2px;
    }

    .header h1 {
      font-family: 'Inter', sans-serif;
      font-size: clamp(1.2rem, 3.2vw, 1.4rem);
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .header p {
      font-family: 'Cairo', sans-serif;
      color: #00bcd4;
      font-size: clamp(1.15rem, 3.2vw, 1.35rem);
      font-weight: 800;
      margin-top: 2px;
      line-height: 1.2;
    }

    .header-sub-bar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 3px 12px;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 700;
      color: #94a3b8;
      margin-top: 6px;
      letter-spacing: 0.3px;
    }

    .header-sub-bar .tag-fr {
      color: #7dd3fc;
    }

    .header-sub-bar .tag-ar {
      color: #5eead4;
      font-family: 'Cairo', sans-serif;
    }

    /* Liste des 5 Cartes */
    .card-list {
      display: flex;
      flex-direction: column;
      gap: 9px;
      z-index: 2;
      margin: auto 0;
    }

    /* Ligne Bilingue à Double Compartiment */
    .card-item-bilingual {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 6px;
      position: relative;
    }

    .comp-box {
      flex: 1;
      border-radius: 14px;
      padding: 7px 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      position: relative;
    }

    /* Compartiment Francophone */
    .comp-fr {
      background: var(--fr-bg);
      border: 1.5px solid var(--fr-border);
      text-align: left;
    }

    /* Compartiment Arabophone */
    .comp-ar {
      background: var(--ar-bg);
      border: 1.5px solid var(--ar-border);
      direction: rtl;
      text-align: right;
    }

    .comp-header {
      display: flex;
      align-items: center;
      margin-bottom: 2px;
    }

    .comp-flag {
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.4px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.25);
    }

    .comp-fr .comp-flag {
      color: #bae6fd;
      font-family: 'Inter', sans-serif;
    }

    .comp-ar .comp-flag {
      color: #a7f3d0;
      font-family: 'Cairo', sans-serif;
    }

    .comp-word-fr {
      font-family: 'Inter', sans-serif;
      font-size: clamp(0.78rem, 2.1vw, 0.98rem);
      font-weight: 900;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      line-height: 1.15;
      word-break: break-word;
      overflow-wrap: break-word;
      margin-top: 1px;
    }

    .comp-word-fr.comp-word-long {
      font-size: clamp(0.68rem, 1.7vw, 0.82rem);
      letter-spacing: 0.1px;
    }

    .comp-word-ar {
      font-family: 'Cairo', sans-serif;
      font-size: clamp(0.96rem, 2.8vw, 1.22rem);
      font-weight: 900;
      color: #fef08a;
      line-height: 1.2;
      word-break: break-word;
      overflow-wrap: break-word;
      margin-top: 1px;
    }

    .comp-word-ar.comp-word-long {
      font-size: clamp(0.82rem, 2.2vw, 1.02rem);
    }

    .comp-phon-fr {
      font-family: 'Inter', sans-serif;
      font-size: clamp(0.66rem, 1.7vw, 0.78rem);
      font-weight: 700;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.16);
      border: 1px solid rgba(56, 189, 248, 0.35);
      padding: 2px 6px;
      border-radius: 6px;
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      word-break: break-word;
      line-height: 1.2;
    }

    .phon-tag-fr {
      color: #bae6fd;
      font-size: 0.62rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .comp-phon-ar {
      font-family: 'Cairo', sans-serif;
      font-size: clamp(0.68rem, 1.7vw, 0.8rem);
      font-weight: 700;
      color: #5eead4;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(45, 212, 191, 0.4);
      padding: 2px 6px;
      border-radius: 6px;
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      word-break: break-word;
      line-height: 1.2;
    }

    .phon-tag-ar {
      color: #99f6e4;
      font-size: 0.62rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .phon-val-ar {
      color: #5eead4;
      font-weight: 700;
    }

    /* Séparateur Central avec Émoji */
    .comp-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 34px;
      z-index: 3;
    }

    .comp-icon-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #09131f;
      border: 1.5px solid rgba(255, 255, 255, 0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.15rem;
      font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols', sans-serif;
      line-height: 1;
      box-shadow: 0 0 12px rgba(0, 0, 0, 0.6);
    }

    /* Pied de page */
    .footer {
      text-align: center;
      z-index: 2;
      border-top: 1px dashed rgba(255, 255, 255, 0.15);
      padding-top: 8px;
    }

    .footer p {
      font-size: 0.76rem;
      color: #94a3b8;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
  </style>
</head>
<body>
  <div id="poster">
    <div class="header">
      <h1>${escapeHtml(vocabData.titleFr || 'VOCABULAIRE ESSENTIEL')}</h1>
      <p>${escapeHtml(vocabData.titleAr || 'كَلِمَاتٌ أَسَاسِيَّةٌ لِلْيَوْمِ')}</p>
      <div class="header-sub-bar">
        <span class="tag-fr">POUR LES FRANCOPHONES</span>
        <span>•</span>
        <span class="tag-ar">لِلنَّاطِقِينَ بِالْعَرَبِيَّةِ</span>
      </div>
    </div>

    <div class="card-list">
      ${cardsHtml}
    </div>

    <div class="footer">
      <p>Aya Studio • تَعَلَّمْ مَعَنَا فِي كُلِّ مَكَانٍ</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Warm Singleton Browser Manager (Ticket #32 - TICKET-14)
 * - Maintient une instance unique de Chromium ouverte en arrière-plan
 * - Réutilise les onglets via browser.newPage() avec fermeture garantie
 * - Recyclage périodique après 25 générations ou si inactif depuis 15 minutes
 * - Protège contre les fuites de mémoire et supprime la latence de démarrage (cold start)
 */
class WarmBrowserManager {
    constructor() {
        this.browser = null;
        this.operationsCount = 0;
        this.maxOperations = 25;
        this.lastUsedTimestamp = Date.now();
        this.idleTimeoutMs = 15 * 60 * 1000;
        this.launchPromise = null;

        const cleanup = async () => {
            await this.close();
        };
        process.once('SIGINT', cleanup);
        process.once('SIGTERM', cleanup);
        process.once('beforeExit', cleanup);
    }

    async getBrowser() {
        const now = Date.now();
        if (this.browser && (this.operationsCount >= this.maxOperations || (now - this.lastUsedTimestamp > this.idleTimeoutMs))) {
            console.log(`♻️ [PUPPETEER WARM RECYCLE] Recyclage périodique de l'instance Chromium (${this.operationsCount} rendus)...`);
            await this.close();
        }

        if (this.browser && this.browser.isConnected()) {
            this.lastUsedTimestamp = Date.now();
            return this.browser;
        }

        if (this.launchPromise) {
            return this.launchPromise;
        }

        this.launchPromise = (async () => {
            const browserPath = getBrowserExecutablePath();
            console.log(`🚀 [PUPPETEER WARM SINGLETON] Lancement de l'instance warm Chromium : ${browserPath}`);
            const browser = await puppeteer.launch({
                executablePath: browserPath,
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--font-render-hinting=medium',
                    '--disable-extensions',
                    '--disable-component-update'
                ],
                defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 2.25 }
            });

            browser.on('disconnected', () => {
                console.warn('⚠️ [PUPPETEER] Instance Chromium déconnectée.');
                if (this.browser === browser) {
                    this.browser = null;
                    this.operationsCount = 0;
                }
            });

            this.browser = browser;
            this.operationsCount = 0;
            this.lastUsedTimestamp = Date.now();
            this.launchPromise = null;
            return browser;
        })();

        return this.launchPromise;
    }

    async withPage(action) {
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        this.operationsCount++;
        this.lastUsedTimestamp = Date.now();

        try {
            return await action(page);
        } finally {
            try {
                await page.close();
            } catch (e) {
                console.warn('⚠️ [PUPPETEER] Erreur fermeture onglet :', e.message);
            }
        }
    }

    async close() {
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (e) {}
            this.browser = null;
            this.operationsCount = 0;
        }
    }
}

const warmBrowserManager = new WarmBrowserManager();

/**
 * 3. Rendu Puppeteer Headless (1080x1920) avec test de collision DOM (Warm Singleton)
 */
async function renderCardImage(htmlContent, outputPath) {
    const tempHtmlFile = path.join(TEMP_BUILD_DIR, `temp_card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.html`);
    fs.writeFileSync(tempHtmlFile, htmlContent, 'utf8');

    try {
        await warmBrowserManager.withPage(async (page) => {
            await page.goto('file:///' + tempHtmlFile.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

            // Temporisation et attente explicite du chargement complet des polices Web (Noto Color Emoji, Cairo, Inter)
            try {
                await page.evaluate(() => document.fonts.ready);
            } catch (e) {}
            await new Promise(r => setTimeout(r, 400));

            // Test de collision et de troncature DOM
            const check = await page.evaluate(() => {
                const poster = document.getElementById('poster');
                const items = document.querySelectorAll('.card-item-all-in-one');
                let truncated = false;
                const posterRect = poster.getBoundingClientRect();
                const itemRects = Array.from(items).map(it => {
                    const rect = it.getBoundingClientRect();
                    if (rect.bottom > posterRect.bottom - 5 || rect.top < posterRect.top) {
                        truncated = true;
                    }
                    return { top: rect.top, bottom: rect.bottom };
                });
                return { truncated, itemCount: items.length };
            });

            if (check.truncated) {
                console.warn("⚠️ Attention : Troncature d'éléments détectée dans le gabarit.");
            }

            const posterElement = await page.$('#poster');
            await posterElement.screenshot({
                path: outputPath,
                type: 'jpeg',
                quality: 95
            });
        });

        return outputPath;
    } finally {
        if (fs.existsSync(tempHtmlFile)) {
            try { fs.unlinkSync(tempHtmlFile); } catch (e) {}
        }
    }
}

/**
 * 4. Synthèse vocale unitaire via generate_tts_quick.py
 * Encapsulée avec getPythonBin() et spawnNice (nice -n 15 sous POSIX)
 */
function synthesizeTtsAudio(text, voice, outputPath) {
    const ttsStart = process.hrtime.bigint();
    return new Promise((resolve, reject) => {
        const payloadFile = path.join(TEMP_BUILD_DIR, `tts_payload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.json`);
        fs.writeFileSync(payloadFile, JSON.stringify({
            text: text,
            voice: voice,
            output_path: outputPath
        }), 'utf8');

        const pythonBin = getPythonBin();
        const pyProc = spawnNice(pythonBin, [TTS_SCRIPT_PATH, payloadFile]);

        let stdoutData = '';
        let stderrData = '';

        pyProc.stdout.on('data', chunk => stdoutData += chunk);
        pyProc.stderr.on('data', chunk => stderrData += chunk);

        pyProc.on('close', code => {
            if (fs.existsSync(payloadFile)) fs.unlinkSync(payloadFile);
            if (code === 0 && fs.existsSync(outputPath)) {
                const durationMs = Number(process.hrtime.bigint() - ttsStart) / 1e6;
                let payloadSizeBytes = 0;
                try { payloadSizeBytes = fs.statSync(outputPath).size; } catch (e) {}

                recordEvent({
                    eventType: 'audio_synthesis_unit',
                    metrics: {
                        totalDurationMs: durationMs,
                        breakdownMs: { audioSynthesisMs: durationMs },
                        payloadSizeBytes
                    },
                    technicalDetails: {
                        voice,
                        textLength: (text || '').length,
                        outputFilename: path.basename(outputPath)
                    }
                });

                resolve(outputPath);
            } else {
                reject(new Error(`Erreur TTS (code ${code}): ${stderrData || stdoutData}`));
            }
        });
    });
}

/**
 * 5. Création d'un silence MP3 via FFmpeg
 * Encapsulée avec execFileNice (nice -n 15 sous POSIX)
 */
function createSilenceMp3(durationSeconds, outputPath) {
    return new Promise((resolve, reject) => {
        // Commande ffmpeg pour générer du silence pur MP3
        const args = [
            '-y',
            '-f', 'lavfi',
            '-i', 'anullsrc=r=44100:cl=mono',
            '-t', String(durationSeconds),
            '-q:a', '9',
            outputPath
        ];

        execFileNice('ffmpeg', args, (err) => {
            if (err) reject(err);
            else resolve(outputPath);
        });
    });
}

/**
 * 6. Concaténation séquentielle avec FFmpeg
 * Encapsulée avec execFileNice (nice -n 15 sous POSIX)
 */
function concatAudioFiles(fileList, outputFinalPath) {
    return new Promise((resolve, reject) => {
        const listFile = path.join(TEMP_BUILD_DIR, `concat_list_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.txt`);
        const fileContent = fileList.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
        fs.writeFileSync(listFile, fileContent, 'utf8');

        const args = [
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', listFile,
            '-c:a', 'libmp3lame',
            '-b:a', '128k',
            outputFinalPath
        ];

        execFileNice('ffmpeg', args, (err) => {
            if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
            if (err) reject(err);
            else resolve(outputFinalPath);
        });
    });
}

/**
 * 7. Orchestration Audio Complète (FR Henri -> 400ms pause -> AR Sana -> 800ms pause)
 */
async function generateCombinedAudio(vocabData, outputFinalMp3) {
    const tempAudios = [];

    try {
        const silence400ms = path.join(TEMP_BUILD_DIR, `silence_400ms_${Date.now()}.mp3`);
        const silence800ms = path.join(TEMP_BUILD_DIR, `silence_800ms_${Date.now()}.mp3`);
        await createSilenceMp3(0.4, silence400ms);
        await createSilenceMp3(0.8, silence800ms);
        tempAudios.push(silence400ms, silence800ms);

        const playlist = [];

        for (let i = 0; i < vocabData.words.length; i++) {
            const item = vocabData.words[i];
            const frText = item.ttsFrench || item.french;
            const arText = item.ttsArabic || item.arabic.replace(/[()]/g, '');

            const frMp3 = path.join(TEMP_BUILD_DIR, `fr_${i}_${Date.now()}.mp3`);
            const arMp3 = path.join(TEMP_BUILD_DIR, `ar_${i}_${Date.now()}.mp3`);

            // Synthèse FR (HenriNeural)
            await synthesizeTtsAudio(frText, 'fr-FR-HenriNeural', frMp3);
            tempAudios.push(frMp3);

            // Synthèse AR Shami (SanaNeural)
            await synthesizeTtsAudio(arText, 'ar-JO-SanaNeural', arMp3);
            tempAudios.push(arMp3);

            // Ajout ordonné à la playlist avec pauses
            playlist.push(frMp3);
            playlist.push(silence400ms);
            playlist.push(arMp3);
            playlist.push(silence800ms);
        }

        await concatAudioFiles(playlist, outputFinalMp3);
        return outputFinalMp3;
    } finally {
        // Nettoyage de tous les fichiers temporaires
        tempAudios.forEach(f => {
            if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (e) {}
        });
    }
}

/**
 * 🚀 MÉTHODE PUBLIQUE PRINCIPALE : Génération Complète d'une Fiche Vocabulaire Premium
 * Encadrée par la file d'attente séquentielle (concurrency = 1)
 */
async function generateFullVocabularyCard({ theme, level = 'debutant', customWords = null, outputId = null, validatedVocabData = null, userId = 'anon' }) {
    return vocabCardQueue.enqueue(async () => {
        const id = outputId || `vcard_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const outputJpg = path.join(UPLOADS_CARDS_DIR, `${id}.jpg`);
        const outputMp3 = path.join(UPLOADS_CARDS_DIR, `${id}.mp3`);

        const trace = createTrace({
            eventType: 'vocab_card_generation',
            userId,
            technicalDetails: {
                cardId: id,
                theme: theme || 'général',
                level,
                hasCustomWords: !!customWords,
                isPreValidated: !!(validatedVocabData && validatedVocabData.words?.length >= 5)
            }
        });

        console.log(`[VOCAB SERVICE] 🚀 Démarrage génération fiche ${id} (Thème: "${theme || 'général'}", Niveau: ${level}) [Trace: ${trace.traceId}]`);

        // 1. Sémantique Gemini Flash (ou données pré-validées dans l'écran d'arbitrage)
        let vocabData;
        if (validatedVocabData && Array.isArray(validatedVocabData.words) && validatedVocabData.words.length >= 5) {
            vocabData = validatedVocabData;
            trace.recordStep('aiProcessingMs', 0);
            console.log(`[VOCAB SERVICE] 🎯 Utilisation des 5 mots pré-validés par l'utilisateur : ${vocabData.words.map(w => w.french).join(', ')}`);
        } else {
            const aiStart = process.hrtime.bigint();
            vocabData = await generateVocabularyData(theme, customWords, level);
            const aiElapsed = Number(process.hrtime.bigint() - aiStart) / 1e6;
            trace.recordStep('aiProcessingMs', aiElapsed);
            console.log(`[VOCAB SERVICE] ✅ Sémantique générée via Gemini en ${aiElapsed.toFixed(0)}ms (5 mots : ${vocabData.words.map(w => w.french).join(', ')})`);
        }

        // 2. Rendu Graphique Puppeteer
        const renderStart = process.hrtime.bigint();
        const htmlContent = buildHtmlTemplate(vocabData);
        await renderCardImage(htmlContent, outputJpg);
        const renderElapsed = Number(process.hrtime.bigint() - renderStart) / 1e6;
        trace.recordStep('mediaRenderMs', renderElapsed);
        console.log(`[VOCAB SERVICE] 🖼️ Image 1080x1920 générée en ${renderElapsed.toFixed(0)}ms : ${outputJpg}`);

        // 3. Audio combiné FFmpeg + edge-tts
        const audioStart = process.hrtime.bigint();
        await generateCombinedAudio(vocabData, outputMp3);
        const audioElapsed = Number(process.hrtime.bigint() - audioStart) / 1e6;
        trace.recordStep('audioSynthesisMs', audioElapsed);
        console.log(`[VOCAB SERVICE] 🎙️ Audio combiné généré en ${audioElapsed.toFixed(0)}ms : ${outputMp3}`);

        // Calcul de la taille du livrable généré
        let totalPayloadBytes = 0;
        try { if (fs.existsSync(outputJpg)) totalPayloadBytes += fs.statSync(outputJpg).size; } catch (e) {}
        try { if (fs.existsSync(outputMp3)) totalPayloadBytes += fs.statSync(outputMp3).size; } catch (e) {}

        // Enregistrement télémétrique final
        trace.finish({
            statusCode: 200,
            payloadSizeBytes: totalPayloadBytes,
            technicalDetails: {
                titleFr: vocabData.titleFr,
                titleAr: vocabData.titleAr,
                wordsCount: vocabData.words?.length || 5
            }
        });

        return {
            success: true,
            cardId: id,
            theme: vocabData.theme || theme,
            level: level,
            titleFr: vocabData.titleFr,
            titleAr: vocabData.titleAr,
            imagePath: outputJpg,
            imageUrl: `/uploads/cards/${id}.jpg`,
            imageFilename: `${id}.jpg`,
            audioPath: outputMp3,
            audioUrl: `/uploads/cards/${id}.mp3`,
            audioFilename: `${id}.mp3`,
            words: vocabData.words,
            createdAt: new Date().toISOString()
        };
    });
}

module.exports = {
    generateFullVocabularyCard,
    generateVocabularyData,
    buildHtmlTemplate,
    renderCardImage,
    generateCombinedAudio,
    warmBrowserManager
};
