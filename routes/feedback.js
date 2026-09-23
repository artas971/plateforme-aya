/**
 * Module Feedback Testeur & Connecteur GitHub Automatisé
 * Plateforme Aya - Triage IA par Agent Thomas (Architecte Back-End)
 * 
 * Règle absolue : Le message brut du testeur n'est JAMAIS perdu.
 * Fonctionnalités :
 * 1. Triage IA automatique via Gemini 2.5 Flash (Agent Thomas)
 * 2. Création automatique d'Issue sur le dépôt GitHub via API REST
 * 3. Sauvegarde locale persistante de sécurité (anti-perte)
 * 4. Notification instantanée via Webhook (Discord / Slack)
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const FEEDBACKS_DIR = path.join(ROOT_DIR, 'feedbacks');
fs.mkdirSync(FEEDBACKS_DIR, { recursive: true });

/**
 * Triage IA par Agent Thomas (Gemini 2.5 Flash)
 */
async function triageFeedbackWithThomas(rawMessage, context = {}) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!geminiKey) {
        return fallbackThomasTriage(rawMessage, context);
    }

    try {
        const systemPrompt = `Tu es Thomas, architecte back-end et sécurité I/O de la plateforme Aya.
Tu reçois le retour brut d'un testeur (bug, incohérence, suggestion ou crash).
Ta mission est d'effectuer un audit technique rigoureux pour créer une Issue GitHub professionnelle.

Tu dois impérativement répondre au format JSON strict avec ces champs :
{
  "type": "BUG" ou "FEATURE" ou "UX" ou "PERF",
  "priority": "P0 (Critique)" ou "P1 (Important)" ou "P2 (Normal)" ou "P3 (Mineur)",
  "short_title": "Titre court et percutant de 6 à 10 mots commençant par [BUG] ou [FEATURE]",
  "component": "Composant suspecté (ex: FFmpeg, Gemini Translator, Synchronisation ASS, Multer I/O, UI Traduction)",
  "technical_diagnosis": "Explication technique détaillée de ce qui a pu se passer ou de la faisabilité technique",
  "action_items": ["Action concrète 1 à mener", "Action concrète 2 à mener"],
  "labels": ["bug", "triage-ai"]
}`;

        const userPrompt = `Message brut du testeur :
"${rawMessage}"

Contexte de session :
- Page : ${context.current_url || '/traduction'}
- Média en cours : ${context.media_filename || 'Aucun'}
- Langue cible : ${context.target_lang || 'fr'}
- Erreur éventuelle captée : ${context.last_error || 'Aucune'}`;

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
                return JSON.parse(text);
            }
        }
    } catch (err) {
        console.warn('[FEEDBACK] Exception triage Gemini, bascule heuristique :', err.message);
    }

    return fallbackThomasTriage(rawMessage, context);
}

/**
 * Triage heuristique expert de secours si pas de clé IA
 */
function fallbackThomasTriage(rawMessage, context = {}) {
    const lower = rawMessage.toLowerCase();
    const isBug = lower.includes('erreur') || lower.includes('bug') || lower.includes('marche pas') || lower.includes('échoué') || lower.includes('crash') || lower.includes('décalage') || lower.includes('problème') || context.last_error;
    const isPerf = lower.includes('lent') || lower.includes('temps') || lower.includes('lenteur');

    const type = isBug ? 'BUG' : (isPerf ? 'PERF' : 'FEATURE');
    const priority = isBug ? (lower.includes('bloqué') || lower.includes('crash') ? 'P0 (Critique)' : 'P1 (Important)') : 'P2 (Normal)';
    const component = lower.includes('sous-titre') || lower.includes('sync') ? 'Synchronisation ASS' : (lower.includes('vidéo') ? 'FFmpeg Pipeline' : 'Plateforme / UI');

    const shortMessage = rawMessage.slice(0, 50).replace(/\n/g, ' ');
    const short_title = isBug ? `[BUG] ${shortMessage}...` : `[FEATURE] ${shortMessage}...`;

    return {
        type,
        priority,
        short_title,
        component,
        technical_diagnosis: `Retour testeur nécessitant une investigation sur le composant ${component}. Le pipeline doit être testé avec les paramètres signalés.`,
        action_items: [
            `Reproduire le cas signalé sur la page ${context.current_url || '/traduction'}`,
            `Vérifier les logs serveur et l'intégrité des flux d'I/O`
        ],
        labels: isBug ? ['bug', 'triage-ai'] : ['enhancement', 'triage-ai']
    };
}

/**
 * Construit le corps Markdown officiel de l'Issue GitHub en 2 parties strictes :
 * Partie 1 : L'Audit Technique de Thomas
 * Partie 2 : Le Message Brut du Testeur (Verbatim, aucune altération)
 */
function buildIssueMarkdownBody({ triage, rawMessage, testerName, context, userAgent, clientIp }) {
    const dateStr = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    const formattedVerbatim = rawMessage.split('\n').map(line => `> ${line}`).join('\n');

    return `## 🛡️ PARTIE 1 : Audit Technique de Thomas (Architecte Back-End & I/O)

| Métrique | Valeur |
| :--- | :--- |
| **Type** | \`${triage.type}\` |
| **Priorité** | \`${triage.priority}\` |
| **Composant ciblé** | \`${triage.component}\` |
| **Testeur** | **${testerName || 'Testeur Anonyme'}** |
| **Date du signalement** | ${dateStr} (Paris) |
| **Page d'origine** | \`${context.current_url || '/traduction'}\` |
| **Média associé** | \`${context.media_filename || 'N/A'}\` |

### 🔍 Diagnostic & Analyse Technique
${triage.technical_diagnosis}

### 🛠️ Actions Correctives Recommandées
${triage.action_items.map(act => `- [ ] ${act}`).join('\n')}

---

## 🗣️ PARTIE 2 : Message Brut du Testeur (Verbatim - Règle Zéro Perte)

> [!IMPORTANT]
> **Ce bloc contient la saisie textuelle exacte du testeur sans aucun filtre ni altération.**

${formattedVerbatim}

---
*Généré automatiquement par l'Agent Thomas pour la Plateforme Aya - Intégrité I/O Certifiée.*
`;
}

/**
 * Crée l'Issue sur GitHub via l'API REST
 */
async function createGitHubIssue({ title, body, labels }) {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER || 'artas971';
    const repo = process.env.GITHUB_REPO || 'plateforme-aya';

    if (!token) {
        console.warn('[GITHUB CONNECTOR] ⚠️ GITHUB_TOKEN non configuré dans .env. Enregistrement en mode local persistant.');
        return null;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Aya-Tester-Feedback-App'
        },
        body: JSON.stringify({
            title,
            body,
            labels: labels || ['triage-ai']
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erreur GitHub API (${response.status}): ${errText}`);
    }

    return await response.json();
}

/**
 * Envoie une notification instantanée par Webhook Discord / Slack
 */
async function sendWebhookNotification({ issueTitle, issueUrl, issueNumber, testerName, triage, rawMessage }) {
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    const slackUrl = process.env.SLACK_WEBHOOK_URL;

    // 1. Notification Discord
    if (discordUrl) {
        try {
            const isBug = triage.type === 'BUG';
            const color = isBug ? 0xEF4444 : 0x10B981; // Rouge ou Vert

            const discordPayload = {
                username: "Agent Thomas (Aya Supervisor)",
                avatar_url: "https://raw.githubusercontent.com/artas971/plateforme-aya/main/public/favicon.ico",
                embeds: [{
                    title: `🔔 [Feedback Testeur] ${issueTitle}`,
                    url: issueUrl,
                    color: color,
                    description: `Un nouveau retour a été qualifié par l'Agent Thomas et transformé en Issue GitHub **#${issueNumber}**.`,
                    fields: [
                        { name: "👤 Testeur", value: testerName || "Anonyme", inline: true },
                        { name: "🏷️ Type", value: triage.type, inline: true },
                        { name: "⚡ Priorité", value: triage.priority, inline: true },
                        { name: "💬 Message Brut (Extrait)", value: `> ${rawMessage.slice(0, 200)}${rawMessage.length > 200 ? '...' : ''}` },
                        { name: "🔗 Lien direct Issue", value: `[Ouvrir l'Issue GitHub #${issueNumber}](${issueUrl})` }
                    ],
                    footer: { text: "Plateforme Aya • Module Feedback Automatisé" },
                    timestamp: new Date().toISOString()
                }]
            };

            await fetch(discordUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(discordPayload)
            });
            console.log('[NOTIFICATION] ✅ Webhook Discord envoyé avec succès.');
        } catch (err) {
            console.warn('[NOTIFICATION] ⚠️ Échec envoi Discord :', err.message);
        }
    }

    // 2. Notification Slack
    if (slackUrl) {
        try {
            const slackPayload = {
                text: `🔔 *[Feedback Testeur]* *<${issueUrl}|#${issueNumber} - ${issueTitle}>*\n*Testeur :* ${testerName || 'Anonyme'} | *Type :* ${triage.type} | *Priorité :* ${triage.priority}\n> ${rawMessage.slice(0, 150)}...\n👉 <${issueUrl}|Voir l'Issue sur GitHub>`
            };
            await fetch(slackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(slackPayload)
            });
            console.log('[NOTIFICATION] ✅ Webhook Slack envoyé avec succès.');
        } catch (err) {
            console.warn('[NOTIFICATION] ⚠️ Échec envoi Slack :', err.message);
        }
    }
}

/**
 * POST /api/feedback : Endpoint principal de soumission des retours testeurs
 */
router.post('/', async (req, res) => {
    try {
        const { raw_message, tester_name, context = {} } = req.body;

        if (!raw_message || !raw_message.trim()) {
            return res.status(400).json({
                success: false,
                error: "Le message brut du testeur ne peut pas être vide."
            });
        }

        const trimmedRaw = raw_message.trim();
        const tester = (tester_name && tester_name.trim()) ? tester_name.trim() : 'Testeur Aya';

        console.log(`\n======================================================`);
        console.log(`[FEEDBACK TESTEUR] 📥 Nouveau retour reçu de "${tester}" : "${trimmedRaw.slice(0, 60)}..."`);

        // ÉTAPE 1 : Triage IA par l'Agent Thomas
        console.log('[FEEDBACK TESTEUR] 🤖 Triage et analyse par l\'Agent Thomas (Gemini 2.5)...');
        const triage = await triageFeedbackWithThomas(trimmedRaw, context);
        console.log(`[FEEDBACK TESTEUR] ✅ Triage achevé : [${triage.type}] ${triage.short_title} (Priorité: ${triage.priority})`);

        // ÉTAPE 2 : Construction du Markdown avec respect strict des 2 parties
        const issueBody = buildIssueMarkdownBody({
            triage,
            rawMessage: trimmedRaw,
            testerName: tester,
            context,
            userAgent: req.headers['user-agent'] || 'Inconnu',
            clientIp: req.ip || '127.0.0.1'
        });

        // ÉTAPE 3 : Sauvegarde locale de sécurité permanente (Garantie Zéro Perte)
        const timestampId = Date.now();
        const localBackupPath = path.join(FEEDBACKS_DIR, `feedback_${timestampId}.json`);
        const localBackupMd = path.join(FEEDBACKS_DIR, `feedback_${timestampId}.md`);

        fs.writeFileSync(localBackupPath, JSON.stringify({
            id: timestampId,
            tester_name: tester,
            raw_message: trimmedRaw,
            context,
            triage,
            created_at: new Date().toISOString()
        }, null, 2), 'utf8');
        fs.writeFileSync(localBackupMd, issueBody, 'utf8');
        console.log(`[FEEDBACK TESTEUR] 💾 Sauvegarde locale sécurisée : ${path.basename(localBackupPath)}`);

        // ÉTAPE 4 : Création de l'Issue GitHub
        let gitHubIssue = null;
        let issueUrl = null;
        let issueNumber = null;
        let githubConfigured = false;

        try {
            gitHubIssue = await createGitHubIssue({
                title: triage.short_title,
                body: issueBody,
                labels: triage.labels
            });

            if (gitHubIssue) {
                issueUrl = gitHubIssue.html_url;
                issueNumber = gitHubIssue.number;
                githubConfigured = true;
                console.log(`[FEEDBACK TESTEUR] 🐙 Issue GitHub #${issueNumber} créée avec succès : ${issueUrl}`);
            }
        } catch (ghErr) {
            console.error('[FEEDBACK TESTEUR] ⚠️ Erreur lors de la création GitHub :', ghErr.message);
        }

        // ÉTAPE 5 : Envoi de la notification Webhook (Discord / Slack)
        if (issueUrl) {
            await sendWebhookNotification({
                issueTitle: triage.short_title,
                issueUrl,
                issueNumber,
                testerName: tester,
                triage,
                rawMessage: trimmedRaw
            });
        }

        // Réponse finale envoyée au Front-End
        return res.json({
            success: true,
            github_created: githubConfigured,
            issue_number: issueNumber,
            issue_url: issueUrl || `file://${localBackupMd}`,
            triage: {
                type: triage.type,
                priority: triage.priority,
                title: triage.short_title,
                component: triage.component
            },
            message: githubConfigured
                ? `Issue GitHub #${issueNumber} créée avec succès !`
                : "Feedback enregistré et qualifié avec succès en local (configurez GITHUB_TOKEN pour la publication automatique sur GitHub)."
        });

    } catch (err) {
        console.error('[FEEDBACK ENDPOINT ERROR]', err);
        return res.status(500).json({
            success: false,
            error: `Erreur interne lors du traitement du feedback : ${err.message}`
        });
    }
});

const { FeedbackRating, isDbConnected, mongoose } = require('../models');
const RATINGS_FILE = path.join(ROOT_DIR, 'data', 'ratings.json');

function readRatingsFile() {
    try {
        if (!fs.existsSync(RATINGS_FILE)) return [];
        const data = fs.readFileSync(RATINGS_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (e) {
        return [];
    }
}

function writeRatingsFile(data) {
    try {
        const dataDir = path.dirname(RATINGS_FILE);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(RATINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('[FEEDBACK RATE] Erreur écriture ratings.json :', e.message);
    }
}

/**
 * POST /api/feedback/rate : Enregistre la note 1-5 étoiles attribuée par l'utilisateur
 */
router.post('/rate', async (req, res) => {
    try {
        const { rating, comment, serviceType, jobId, mediaFilename } = req.body;
        const numRating = parseInt(rating, 10);

        if (!numRating || numRating < 1 || numRating > 5) {
            return res.status(400).json({
                success: false,
                error: "La note doit être un entier compris entre 1 et 5."
            });
        }

        const sessionUser = (req.session && req.session.user) ? req.session.user : null;
        const userId = sessionUser ? (sessionUser.id || sessionUser._id || null) : null;
        const username = sessionUser ? (sessionUser.username || sessionUser.name || 'Anonyme') : 'Anonyme';
        const userEmail = sessionUser ? (sessionUser.email || null) : null;

        const ratingData = {
            id: `rate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            user: userId,
            username,
            userEmail,
            serviceType: serviceType || 'traduction',
            jobId: jobId || null,
            mediaFilename: mediaFilename || null,
            rating: numRating,
            comment: comment ? String(comment).trim() : '',
            aiAnalysis: {
                analyzed: false,
                faultType: 'UNKNOWN',
                diagnosis: '',
                refundRecommended: false,
                suggestedCredits: 1
            },
            refundStatus: 'none',
            createdAt: new Date().toISOString()
        };

        // 1. Sauvegarde Mongo si disponible
        if (isDbConnected()) {
            try {
                const doc = new FeedbackRating({
                    user: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
                    username,
                    userEmail,
                    serviceType: ratingData.serviceType,
                    jobId: ratingData.jobId,
                    mediaFilename: ratingData.mediaFilename,
                    rating: numRating,
                    comment: ratingData.comment,
                    aiAnalysis: ratingData.aiAnalysis,
                    refundStatus: 'none'
                });
                const saved = await doc.save();
                ratingData.id = saved._id.toString();
            } catch (mongoErr) {
                console.warn('[FEEDBACK RATE] Erreur Mongo, bascule JSON :', mongoErr.message);
            }
        }

        // 2. Sauvegarde JSON local (Double garantie persistance)
        const localRatings = readRatingsFile();
        localRatings.unshift(ratingData);
        writeRatingsFile(localRatings);

        console.log(`[FEEDBACK RATE] ⭐ Note enregistrée : ${numRating}/5 par @${username} (Service: ${ratingData.serviceType})`);

        return res.json({
            success: true,
            ratingId: ratingData.id,
            message: "Votre évaluation a bien été enregistrée. Merci pour votre retour !"
        });

    } catch (err) {
        console.error('[FEEDBACK RATE ERROR]', err);
        return res.status(500).json({
            success: false,
            error: `Erreur serveur lors de l'enregistrement de la note : ${err.message}`
        });
    }
});

module.exports = router;
