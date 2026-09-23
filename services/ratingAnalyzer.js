/**
 * Service d'Analyse des Évaluations - Agent Alexandre (Lead Coordinateur)
 * Plateforme Aya Studio
 * 
 * Analyse automatiquement les notes <= 3 étoiles pour qualifier la cause de l'insatisfaction.
 * Si une anomalie de la plateforme est confirmée, recommande un remboursement à l'administrateur
 * en positionnant le statut en 'pending_approval'.
 * 
 * Règle de Sécurité Absolue :
 * L'IA ne crédite JAMAIS un utilisateur de façon autonome.
 * La restitution de crédits requiert expressément le clic d'approbation de l'administrateur.
 */

const fs = require('fs');
const path = require('path');
const { FeedbackRating, isDbConnected, mongoose } = require('../models');

const ROOT_DIR = path.resolve(__dirname, '..');
const RATINGS_FILE = path.join(ROOT_DIR, 'data', 'ratings.json');

function readRatingsFile() {
    try {
        if (!fs.existsSync(RATINGS_FILE)) return [];
        const content = fs.readFileSync(RATINGS_FILE, 'utf-8');
        return JSON.parse(content || '[]');
    } catch (err) {
        return [];
    }
}

function writeRatingsFile(data) {
    try {
        const dir = path.dirname(RATINGS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(RATINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('[RATING ANALYZER] ❌ Erreur écriture ratings.json :', err.message);
    }
}

/**
 * Qualification IA par Agent Alexandre via Gemini 2.5 Flash
 */
async function qualifyRatingWithAlexandre(ratingContext) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!geminiKey) {
        return fallbackRatingQualification(ratingContext);
    }

    try {
        const systemPrompt = `Tu es Alexandre, Lead Coordinateur de la plateforme solidaire Aya Studio.
Un utilisateur a laissé une note négative ou mitigée (1 à 3 étoiles sur 5).
Ta mission est d'analyser son commentaire avec discernement et empathie pour déterminer si la responsabilité incombe à la plateforme (APPLICATION_ERROR), s'il s'agit d'une mauvaise utilisation (USER_MISTAKE), ou d'une simple appréciation subjective du style (QUALITY_SATISFACTION).

Critères d'attribution d'un remboursement recommandé (refundRecommended: true) :
- Bug avéré de la plateforme : sous-titres manquants ou coupés, synchronisation ASS décalée, son inaudible, blocage vidéo, crash serveur, contresens grossier.
- En cas de doute ou d'anomalie flagrante subie par l'utilisateur, privilégie l'empathie et recommande le remboursement (1 crédit).

Tu DOIS impérativement répondre au format JSON strict avec ces champs :
{
  "faultType": "APPLICATION_ERROR" ou "USER_MISTAKE" ou "QUALITY_SATISFACTION" ou "UNKNOWN",
  "diagnosis": "Synthèse explicative claire de l'incident ressenti par l'utilisateur (2 à 4 phrases)",
  "refundRecommended": true ou false,
  "suggestedCredits": 1
}`;

        const userPrompt = `Détails de l'évaluation utilisateur :
- Note attribuée : ${ratingContext.rating}/5 étoiles
- Service concerné : ${ratingContext.serviceType || 'traduction'}
- Média / Fichier : ${ratingContext.mediaFilename || 'Non spécifié'}
- Job ID : ${ratingContext.jobId || 'N/A'}
- Utilisateur : @${ratingContext.username || 'Anonyme'}
- Commentaire brut de l'utilisateur :
"${ratingContext.comment || 'Aucun commentaire textuel fourni.'}"`;

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
                    faultType: ['APPLICATION_ERROR', 'USER_MISTAKE', 'QUALITY_SATISFACTION', 'UNKNOWN'].includes(parsed.faultType)
                        ? parsed.faultType
                        : 'APPLICATION_ERROR',
                    diagnosis: parsed.diagnosis || "Analyse automatique du retour utilisateur.",
                    refundRecommended: Boolean(parsed.refundRecommended),
                    suggestedCredits: Math.max(1, parseInt(parsed.suggestedCredits, 10) || 1)
                };
            }
        }
    } catch (err) {
        console.warn('[RATING ANALYZER] ⚠️ Exception appel Gemini, repli heuristique :', err.message);
    }

    return fallbackRatingQualification(ratingContext);
}

/**
 * Qualification heuristique de secours si Gemini n'est pas configuré
 */
function fallbackRatingQualification(context) {
    const comment = (context.comment || '').toLowerCase();
    const rating = context.rating || 3;

    let faultType = 'APPLICATION_ERROR';
    let refundRecommended = false;
    let diagnosis = "Évaluation basse reçue nécessitant l'attention de l'administrateur.";
    let suggestedCredits = 1;

    const isAppError = comment.includes('bug') || comment.includes('erreur') || comment.includes('coupé') ||
                       comment.includes('décal') || comment.includes('bloqu') || comment.includes('marche pas') ||
                       comment.includes('son') || comment.includes('incomplet') || comment.includes('noir') ||
                       comment.includes('synchronisation') || comment.includes('crash') || comment.includes('lent');

    const isUserMistake = comment.includes('mauvais fichier') || comment.includes('je me suis trompé') || comment.includes('erreur de ma part');

    if (isUserMistake) {
        faultType = 'USER_MISTAKE';
        diagnosis = "L'utilisateur indique s'être trompé dans les paramètres ou le média envoyé.";
        refundRecommended = false;
    } else if (isAppError || rating <= 2) {
        faultType = 'APPLICATION_ERROR';
        diagnosis = "Dégradation technique signalée dans le rendu vidéo ou la synchronisation des sous-titres.";
        refundRecommended = true;
    } else {
        faultType = 'QUALITY_SATISFACTION';
        diagnosis = "Retour mitigé sur la qualité du rendu ou l'ergonomie générale.";
        refundRecommended = false;
    }

    return {
        analyzed: true,
        faultType,
        diagnosis,
        refundRecommended,
        suggestedCredits
    };
}

/**
 * Analyse une évaluation utilisateur (déclenchée pour les notes <= 3)
 * Met à jour le document FeedbackRating en base et en JSON local.
 * 
 * @param {object} ratingData - Données de la note enregistrée
 * @returns {Promise<object>} Données de la note enrichies par l'analyse IA
 */
async function analyzeRating(ratingData) {
    if (!ratingData || ratingData.rating > 3) {
        return ratingData;
    }

    console.log(`[RATING ANALYZER] 🧠 Analyse de la note ${ratingData.rating}/5 par Agent Alexandre (ID: ${ratingData.id})...`);

    const aiResult = await qualifyRatingWithAlexandre(ratingData);

    const refundStatus = aiResult.refundRecommended ? 'pending_approval' : 'none';

    // 1. Mise à jour MongoDB si connecté
    if (isDbConnected() && ratingData.id) {
        try {
            const isObjectId = mongoose.Types.ObjectId.isValid(ratingData.id);
            const query = isObjectId ? { _id: ratingData.id } : { jobId: ratingData.jobId };
            
            await FeedbackRating.findOneAndUpdate(
                query,
                {
                    $set: {
                        aiAnalysis: aiResult,
                        refundStatus: refundStatus
                    }
                },
                { new: true }
            );
        } catch (err) {
            console.warn('[RATING ANALYZER] ⚠️ Erreur mise à jour Mongo :', err.message);
        }
    }

    // 2. Mise à jour fichier JSON local
    const ratings = readRatingsFile();
    const index = ratings.findIndex(r => r.id === ratingData.id || (ratingData.jobId && r.jobId === ratingData.jobId));
    if (index !== -1) {
        ratings[index].aiAnalysis = aiResult;
        ratings[index].refundStatus = refundStatus;
        writeRatingsFile(ratings);
    } else {
        ratingData.aiAnalysis = aiResult;
        ratingData.refundStatus = refundStatus;
        ratings.unshift(ratingData);
        writeRatingsFile(ratings);
    }

    console.log(`[RATING ANALYZER] ⭐ Résultat pour @${ratingData.username || 'Anonyme'} : [${aiResult.faultType}] - Remboursement : ${refundStatus} (${aiResult.suggestedCredits} crédit(s))`);

    return {
        ...ratingData,
        aiAnalysis: aiResult,
        refundStatus
    };
}

module.exports = {
    analyzeRating,
    qualifyRatingWithAlexandre,
    readRatingsFile,
    writeRatingsFile
};
