/**
 * Service d'Auto-Diagnostic des Pannes - Agent Alexandre (Lead Coordinateur)
 * Plateforme Aya Studio
 * 
 * Analyse automatiquement les pannes de pipeline (FFmpeg, Whisper, Python, etc.)
 * et formule un diagnostic d'expert pour la Tour de Contrôle Administrateur.
 * 
 * Règle de Sécurité Absolue :
 * L'IA n'exécute aucune action de relance sans l'accord et le clic de l'administrateur.
 */

const fs = require('fs');
const path = require('path');
const { FailureReport, isDbConnected, mongoose } = require('../models');

const ROOT_DIR = path.resolve(__dirname, '..');
const FAILURES_FILE = path.join(ROOT_DIR, 'data', 'failure_reports.json');

function readFailuresFile() {
    try {
        if (!fs.existsSync(FAILURES_FILE)) return [];
        const content = fs.readFileSync(FAILURES_FILE, 'utf-8');
        return JSON.parse(content || '[]');
    } catch (err) {
        return [];
    }
}

function writeFailuresFile(data) {
    try {
        const dir = path.dirname(FAILURES_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(FAILURES_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('[FAILURE ANALYZER] ❌ Erreur écriture failure_reports.json :', err.message);
    }
}

/**
 * Diagnostic IA par Agent Alexandre via Gemini 2.5 Flash
 */
async function diagnoseFailureWithAlexandre(failureContext) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!geminiKey) {
        return fallbackFailureDiagnosis(failureContext);
    }

    try {
        const systemPrompt = `Tu es Alexandre, Lead Coordinateur et Chef de Diagnostic Système de la plateforme Aya.
Tu reçois un rapport d'échec technique d'un pipeline de traitement multimédia (FFmpeg, Whisper, Node.js, Python).
Ton rôle est de diagnostiquer la cause racine avec une rigueur d'ingénieur senior et de formuler une solution claire pour l'administrateur.

Tu DOIS impérativement répondre au format JSON strict avec ces champs :
{
  "cause": "Cause racine synthétique en 5 à 12 mots (ex: Incompatibilité codec audio AAC / Stream corrompu)",
  "technicalExplanation": "Explication technique détaillée du comportement observé dans les logs et de la cause probable",
  "proposedFix": "Solution technique préconisée pour résoudre définitivement l'anomalie ou relancer le job",
  "suggestedAction": "RETRY_WITH_TRANSCODE" ou "RETRY_WITH_CPU" ou "RETRY_DEFAULT" ou "DISMISS_INVALID_INPUT" ou "MANUAL_FIX"
}`;

        const userPrompt = `Détails de l'échec système :
- Service : ${failureContext.serviceType || 'traduction'}
- Composant : ${failureContext.component || 'Pipeline'}
- Job ID : ${failureContext.jobId || 'N/A'}
- Fichier / Média : ${failureContext.mediaUrl || 'N/A'}
- Message d'erreur :
${failureContext.errorMessage || 'Erreur non spécifiée'}

- Stack / Extraits de logs :
${(failureContext.errorStack || '').slice(-2000)}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json"
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                const parsed = JSON.parse(text);
                return {
                    analyzed: true,
                    cause: parsed.cause || "Anomalie d'exécution du pipeline",
                    technicalExplanation: parsed.technicalExplanation || "Interruption du processus de rendu.",
                    proposedFix: parsed.proposedFix || "Relancer avec ré-encodage préalable.",
                    suggestedAction: parsed.suggestedAction || "RETRY_DEFAULT"
                };
            }
        }
    } catch (err) {
        console.warn('[FAILURE ANALYZER] ⚠️ Exception appel Gemini, bascule sur diagnostic heuristique :', err.message);
    }

    return fallbackFailureDiagnosis(failureContext);
}

/**
 * Diagnostic heuristique de secours si Gemini est indisponible
 */
function fallbackFailureDiagnosis(context) {
    const errorStr = `${context.errorMessage || ''} ${context.errorStack || ''}`.toLowerCase();

    let cause = "Échec inattendu du processus d'encodage";
    let technicalExplanation = "Le sous-processus de traitement s'est terminé avec un code d'erreur non nul.";
    let proposedFix = "Vérifier l'intégrité du fichier source et relancer le traitement.";
    let suggestedAction = "RETRY_DEFAULT";

    if (errorStr.includes('ffmpeg') || errorStr.includes('codec') || errorStr.includes('aac') || errorStr.includes('h264') || errorStr.includes('moov atom')) {
        cause = "Incompatibilité de codec ou conteneur multimédia corrompu (FFmpeg)";
        technicalExplanation = "FFmpeg a rencontré une erreur lors du démultiplexage ou du transcodage du flux source. Le conteneur peut être incomplet ou utiliser un profil non supporté.";
        proposedFix = "Transcoder la source en H.264 / AAC 48kHz standard avant passage dans les filtres ASS.";
        suggestedAction = "RETRY_WITH_TRANSCODE";
    } else if (errorStr.includes('whisper') || errorStr.includes('cuda') || errorStr.includes('out of memory') || errorStr.includes('oom')) {
        cause = "Saturation mémoire ou défaillance GPU lors de la transcription Whisper";
        technicalExplanation = "Le modèle de reconnaissance vocale a dépassé l'allocation mémoire allouée ou le pilote GPU a rencontré une interruption.";
        proposedFix = "Bascule sur exécution CPU ou découpage audio par blocs de 30 secondes.";
        suggestedAction = "RETRY_WITH_CPU";
    } else if (errorStr.includes('timeout') || errorStr.includes('abort') || errorStr.includes('délai')) {
        cause = "Dépassement du délai de traitement (Timeout Watchdog)";
        technicalExplanation = "Le traitement a dépassé le temps maximal alloué, probablement causé par un débit vidéo très lourd ou un fichier trop long.";
        proposedFix = "Relancer avec une priorité d'encodage 'fast' ou fragmenter le média.";
        suggestedAction = "RETRY_DEFAULT";
    } else if (errorStr.includes('ass') || errorStr.includes('subtitles') || errorStr.includes('libass')) {
        cause = "Erreur de syntaxe ou de police dans le script ASS";
        technicalExplanation = "Le moteur de rendu des sous-titres a rejeté le fichier ASS en raison d'un caractère non échappé ou d'un timing invalide.";
        proposedFix = "Nettoyer les balises de style et régénérer le fichier .ass conforme.";
        suggestedAction = "MANUAL_FIX";
    }

    return {
        analyzed: true,
        cause,
        technicalExplanation,
        proposedFix,
        suggestedAction
    };
}

/**
 * Capture et analyse un échec de pipeline
 * Enregistre le rapport complet dans MongoDB et dans data/failure_reports.json
 * 
 * @param {object} params
 * @returns {Promise<object>} Rapport de panne sauvegardé
 */
async function analyzeFailure(params) {
    const {
        jobId,
        userId,
        username,
        userEmail,
        serviceType = 'traduction',
        component = 'Pipeline',
        mediaUrl = null,
        inputParams = {},
        errorMessage = 'Erreur inconnue',
        errorStack = ''
    } = params;

    console.log(`[FAILURE ANALYZER] 🚨 Capture d'un incident pour le job ${jobId || 'N/A'} (Composant: ${component})...`);

    // 1. Analyse IA par Alexandre
    const aiDiagnosis = await diagnoseFailureWithAlexandre({
        jobId,
        serviceType,
        component,
        mediaUrl,
        errorMessage,
        errorStack
    });

    const reportData = {
        id: `fail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        jobId: jobId || null,
        user: userId || null,
        username: username || 'Anonyme',
        userEmail: userEmail || null,
        serviceType,
        component,
        mediaUrl,
        inputParams,
        errorMessage: String(errorMessage),
        errorStack: String(errorStack || ''),
        aiDiagnosis,
        status: 'pending_admin_review',
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date().toISOString()
    };

    // 2. Sauvegarde MongoDB si connecté
    if (isDbConnected()) {
        try {
            const doc = new FailureReport({
                jobId: reportData.jobId,
                user: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
                username: reportData.username,
                userEmail: reportData.userEmail,
                serviceType: reportData.serviceType,
                component: reportData.component,
                mediaUrl: reportData.mediaUrl,
                inputParams: reportData.inputParams,
                errorMessage: reportData.errorMessage,
                errorStack: reportData.errorStack,
                aiDiagnosis: reportData.aiDiagnosis,
                status: 'pending_admin_review'
            });
            const saved = await doc.save();
            reportData.id = saved._id.toString();
        } catch (mongoErr) {
            console.warn('[FAILURE ANALYZER] ⚠️ Erreur sauvegarde Mongo, repli JSON :', mongoErr.message);
        }
    }

    // 3. Sauvegarde locale persistante dans data/failure_reports.json
    const reports = readFailuresFile();
    reports.unshift(reportData);
    writeFailuresFile(reports);

    console.log(`[FAILURE ANALYZER] ✅ Incident qualifié par Alexandre : "${aiDiagnosis.cause}" (Action suggérée : ${aiDiagnosis.suggestedAction})`);

    return reportData;
}

module.exports = {
    analyzeFailure,
    diagnoseFailureWithAlexandre,
    readFailuresFile,
    writeFailuresFile
};
