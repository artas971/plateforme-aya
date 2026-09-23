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
 * 1. Génération sémantique des 5 mots bilingues via Gemini Flash (ou customWords)
 */
async function generateVocabularyData(theme, customWords = null, level = 'debutant') {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!geminiKey) {
        throw new Error("Clé API Gemini (GEMINI_API_KEY) manquante.");
    }

    const systemInstruction = `Tu es le linguiste expert de la plateforme Aya Studio spécialisé dans l'arabe Shami (palestinien/levantin) et le français.
Tu dois générer exactement 5 fiches de vocabulaire thématiques adaptées à l'apprentissage croisé sur TikTok Live (les francophones apprennent l'arabe et les palestiniens apprennent le français).

Règles de translittération strictes :
1. Pour l'arabe : écriture en arabe avec vocalisation complète (Tashkeel / Harakat).
2. Phonétique pour francophones (phoneticFr) : en alphabet latin découpé en syllabes avec tirets [ex: Mar-ha-ban, Ach-chams]. Conventions : Kh pour خ, Gh pour غ, Ch pour ش, Q pour ق, 'A pour ع.
3. Phonétique pour arabophones (phoneticAr) : transcription du mot français en lettres arabes avec Tashkeel complet [ex: بُونْژُورْ pour Bonjour, لُو سُولَيّْ pour Le Soleil, لَا كُونْفْيَانْسْ pour La Confiance]. Règle impérative : lettre 'V' = ڤ, son 'J' = ژ, voyelle '-er/-é' = ـِيه.
4. Choisis un emoji pertinent pour chaque mot.

Réponds STRICTEMENT au format JSON suivant :
{
  "titleFr": "Titre thématique en Français (MAJUSCULES, max 25 caractères)",
  "titleAr": "Titre thématique en Arabe Shami avec Tashkeel",
  "theme": "${theme || 'vocabulaire_quotidien'}",
  "words": [
    {
      "french": "MOT EN FRANCAIS (MAJUSCULES)",
      "arabic": "(الْكَلِمَةُ بِالْعَرَبِيَّةِ)",
      "phoneticFr": "Phonétique-Latin-Découpée",
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

    const models = [
        'gemini-2.5-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-flash-lite-latest',
        'gemini-pro-latest'
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

            const parsed = JSON.parse(textResponse);
            if (!parsed.words || !Array.isArray(parsed.words) || parsed.words.length < 5) {
                lastError = new Error("Schéma JSON incomplet reçu de Gemini.");
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
 * 2. Gabarit HTML Glassmorphism 9:16
 */
function buildHtmlTemplate(vocabData) {
    const cardsHtml = vocabData.words.slice(0, 5).map(item => `
      <div class="card-item-all-in-one">
        <div class="left-badge">${item.icon || '✨'}</div>
        <div class="middle-content">
          <div class="fr-title">${escapeHtml(item.french)}</div>
          <div class="ar-translation">${escapeHtml(item.arabic)}</div>
          <div class="phonetic-for-french">
            <span class="phon-tag">🇵🇸 Shami:</span> ${escapeHtml(item.phoneticFr)}
          </div>
        </div>
        <div class="right-pill">
          <span class="pill-label">نُطْقُ الْفَرَنْسِيِّ 🇫🇷</span>
          <span class="pill-word">${escapeHtml(item.phoneticAr)}</span>
        </div>
      </div>
    `).join('\n');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(vocabData.titleFr || 'Fiche Vocabulaire')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;800;900&family=Inter:wght@600;800;900&family=Noto+Sans+Arabic:wght@700;900&family=Outfit:wght@600;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: linear-gradient(160deg, #061214 0%, #0a2022 45%, #040d0e 100%);
      --card-bg: rgba(255, 255, 255, 0.08);
      --card-border: rgba(255, 255, 255, 0.18);
      --accent-ar: #fef08a;
      --accent-phon-fr: #38bdf8;
      --accent-pill-bg: rgba(20, 184, 166, 0.35);
      --accent-pill-border: #2dd4bf;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', sans-serif;
      background: #030708;
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
      padding: 28px 18px 24px 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.12);
      position: relative;
      overflow: hidden;
    }

    .header {
      text-align: center;
      z-index: 2;
      padding-top: 4px;
    }

    .header h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.45rem;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .header p {
      font-family: 'Noto Sans Arabic', 'Cairo', sans-serif;
      color: #5eead4;
      font-size: 1.3rem;
      font-weight: 900;
      margin-top: 3px;
    }

    .card-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 2;
      margin: auto 0;
    }

    .card-item-all-in-one {
      background: var(--card-bg);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.22);
    }

    .left-badge {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      font-weight: 900;
      color: #ffffff;
      flex-shrink: 0;
    }

    .middle-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .fr-title {
      font-family: 'Inter', sans-serif;
      font-size: 0.82rem;
      font-weight: 800;
      color: #94a3b8;
      line-height: 1.15;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      word-break: break-word;
    }

    .ar-translation {
      font-family: 'Noto Sans Arabic', 'Cairo', sans-serif;
      font-size: 1.08rem;
      font-weight: 900;
      color: var(--accent-ar);
      line-height: 1.2;
      word-break: break-word;
    }

    .phonetic-for-french {
      font-family: 'Inter', sans-serif;
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.2px;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.2);
      padding: 3px 8px;
      border-radius: 8px;
      border: 1.5px solid #38bdf8;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
      word-break: break-word;
      line-height: 1.2;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      max-width: 100%;
    }

    .phon-tag {
      font-size: 0.72rem;
      color: #bae6fd;
      font-weight: 700;
      opacity: 0.9;
    }

    .right-pill {
      font-family: 'Noto Sans Arabic', 'Cairo', sans-serif;
      color: #ffffff;
      background: var(--accent-pill-bg);
      border: 2px solid var(--accent-pill-border);
      padding: 5px 12px;
      border-radius: 14px;
      box-shadow: 0 0 14px rgba(45, 212, 191, 0.35);
      white-space: normal;
      text-align: center;
      flex-shrink: 0;
      min-width: 125px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
    }

    .pill-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: #a7f3d0;
      letter-spacing: 0.2px;
      line-height: 1.1;
      display: block;
      opacity: 0.95;
    }

    .pill-word {
      font-size: 1.18rem;
      font-weight: 900;
      color: #ffffff;
      line-height: 1.25;
      display: block;
    }

    .footer {
      text-align: center;
      z-index: 2;
      border-top: 1px dashed rgba(255, 255, 255, 0.15);
      padding-top: 8px;
    }

    .footer p {
      font-size: 0.8rem;
      color: #94a3b8;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div id="poster">
    <div class="header">
      <h1>${escapeHtml(vocabData.titleFr || 'VOCABULAIRE ESSENTIEL')}</h1>
      <p>${escapeHtml(vocabData.titleAr || 'كَلِمَاتٌ أَسَاسِيَّةٌ لِلْيَوْمِ')}</p>
    </div>

    <div class="card-list">
      ${cardsHtml}
    </div>

    <div class="footer">
      <p>Aya Studio • نَتَعَلَّمُ مَعًا فِي الْبَثِّ المُبَاشِرِ 🇫🇷 🇵🇸</p>
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
 * 3. Rendu Puppeteer Headless (1080x1920) avec test de collision DOM
 */
async function renderCardImage(htmlContent, outputPath) {
    const browserPath = getBrowserExecutablePath();
    const tempHtmlFile = path.join(TEMP_BUILD_DIR, `temp_card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.html`);
    fs.writeFileSync(tempHtmlFile, htmlContent, 'utf8');

    let browser = null;
    try {
        browser = await puppeteer.launch({
            executablePath: browserPath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
            defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 2.25 }
        });

        const page = await browser.newPage();
        await page.goto('file:///' + tempHtmlFile.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

        // Temporisation de rendu des polices Google
        await new Promise(r => setTimeout(r, 600));

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

        return outputPath;
    } finally {
        if (browser) await browser.close();
        if (fs.existsSync(tempHtmlFile)) fs.unlinkSync(tempHtmlFile);
    }
}

/**
 * 4. Synthèse vocale unitaire via generate_tts_quick.py
 * Encapsulée avec getPythonBin() et spawnNice (nice -n 15 sous POSIX)
 */
function synthesizeTtsAudio(text, voice, outputPath) {
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
async function generateFullVocabularyCard({ theme, level = 'debutant', customWords = null, outputId = null }) {
    return vocabCardQueue.enqueue(async () => {
        const id = outputId || `vcard_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const outputJpg = path.join(UPLOADS_CARDS_DIR, `${id}.jpg`);
        const outputMp3 = path.join(UPLOADS_CARDS_DIR, `${id}.mp3`);

        console.log(`[VOCAB SERVICE] 🚀 Démarrage génération fiche ${id} (Thème: "${theme || 'général'}", Niveau: ${level})`);

        // 1. Sémantique Gemini Flash
        const vocabData = await generateVocabularyData(theme, customWords, level);
        console.log(`[VOCAB SERVICE] ✅ Sémantique validée (5 mots : ${vocabData.words.map(w => w.french).join(', ')})`);

        // 2. Rendu Graphique Puppeteer
        const htmlContent = buildHtmlTemplate(vocabData);
        await renderCardImage(htmlContent, outputJpg);
        console.log(`[VOCAB SERVICE] 🖼️ Image 1080x1920 générée : ${outputJpg}`);

        // 3. Audio combiné FFmpeg + edge-tts
        await generateCombinedAudio(vocabData, outputMp3);
        console.log(`[VOCAB SERVICE] 🎙️ Audio combiné généré : ${outputMp3}`);

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
    generateCombinedAudio
};
