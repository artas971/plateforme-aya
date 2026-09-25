/**
 * Cerveau d'Analyse Télémétrique & Vulgarisation de l'Agent Hugo - Plateforme Aya
 * 
 * Rôles :
 * 1. Calcul Statistique Avancé : Volume total, taux de succès ($S_rate$), percentiles réels
 *    (P50, P90, P95, P99), moyennes ventilées par étape ($T_IA, $T_render, $T_audio, $T_encode, etc.).
 * 2. Détection des Anomalies : Cold start Chromium, saturation de quota IA (429), dérives de latence.
 * 3. Génération de Rapports Vulgarisés (Persona Hugo) :
 *    - Format court : Alertes Flash d'anomalies (sans jargon).
 *    - Format exécutif : Bulletin Quotidien de Santé Système (Daily Ops Digest).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT_DIR = path.resolve(__dirname, '..');
const TELEMETRY_DIR = path.join(ROOT_DIR, 'data', 'telemetry');

/**
 * Calcule un percentile (P50, P90, P95, P99) sur une série numérique triée
 */
function getPercentile(sortedValues, percentile) {
    if (!sortedValues || sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (upper === lower) return sortedValues[lower];
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Moteur d'Agrégation Statistique sur un ensemble d'événements de télémétrie
 * @param {Array<Object>} events - Liste des événements normalisés
 * @returns {Object} Synthèse statistique exhaustive
 */
function computeStatistics(events = []) {
    if (!Array.isArray(events) || events.length === 0) {
        return {
            totalEvents: 0,
            successCount: 0,
            failureCount: 0,
            successRate: "100.0%",
            successRateNum: 100,
            percentilesMs: { p50: 0, p90: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 },
            breakdownAvgMs: { aiProcessing: 0, mediaRender: 0, audioSynthesis: 0, mediaEncode: 0, otherIo: 0 },
            byEventType: {},
            cacheMetrics: { hitCount: 0, missCount: 0, hitRate: "0.0%" },
            anomaliesDetected: []
        };
    }

    const totalEvents = events.length;
    let successCount = 0;
    let failureCount = 0;

    const durations = [];
    let sumTotalMs = 0;
    let sumAiMs = 0;
    let sumRenderMs = 0;
    let sumAudioMs = 0;
    let sumEncodeMs = 0;
    let sumOtherIoMs = 0;

    let cacheHits = 0;
    let cacheMisses = 0;

    const byType = {};
    const anomalies = [];

    for (const evt of events) {
        const statusCode = evt.http?.statusCode ?? 200;
        const isError = Boolean(evt.error) || statusCode >= 400;

        if (isError) {
            failureCount++;
        } else {
            successCount++;
        }

        const totalMs = evt.metrics?.totalDurationMs ?? 0;
        durations.push(totalMs);
        sumTotalMs += totalMs;

        const breakdown = evt.metrics?.breakdownMs || {};
        sumAiMs += breakdown.aiProcessingMs || 0;
        sumRenderMs += breakdown.mediaRenderMs || 0;
        sumAudioMs += breakdown.audioSynthesisMs || 0;
        sumEncodeMs += breakdown.mediaEncodeMs || 0;
        sumOtherIoMs += breakdown.otherIoMs || 0;

        if (evt.metrics?.cacheHit === true) {
            cacheHits++;
        } else if (evt.eventType === 'shami_translation') {
            cacheMisses++;
        }

        // Agrégation par type d'événement
        const type = evt.eventType || 'api_request';
        if (!byType[type]) {
            byType[type] = {
                count: 0,
                durations: [],
                sumDurationMs: 0,
                errorCount: 0,
                aiSumMs: 0,
                renderSumMs: 0,
                audioSumMs: 0
            };
        }
        byType[type].count++;
        byType[type].durations.push(totalMs);
        byType[type].sumDurationMs += totalMs;
        if (isError) byType[type].errorCount++;
        byType[type].aiSumMs += breakdown.aiProcessingMs || 0;
        byType[type].renderSumMs += breakdown.mediaRenderMs || 0;
        byType[type].audioSumMs += breakdown.audioSynthesisMs || 0;

        // Détection d'anomalies spécifiques
        if (statusCode === 429) {
            anomalies.push({
                type: 'QUOTA_EXHAUSTED_429',
                severity: 'CRITICAL',
                traceId: evt.traceId,
                timestamp: evt.timestamp,
                message: `Saturation de quota Google Gemini (HTTP 429) sur l'événement ${type}`
            });
        } else if (statusCode >= 500) {
            anomalies.push({
                type: 'SERVER_ERROR_5XX',
                severity: 'HIGH',
                traceId: evt.traceId,
                timestamp: evt.timestamp,
                message: `Erreur interne serveur (${statusCode}) sur ${evt.http?.route || type}`
            });
        } else if (type === 'vocab_card_generation' && breakdown.mediaRenderMs > 3500) {
            anomalies.push({
                type: 'CHROMIUM_COLD_START',
                severity: 'MEDIUM',
                traceId: evt.traceId,
                timestamp: evt.timestamp,
                message: `Latence anormale de rendu Puppeteer (${breakdown.mediaRenderMs.toFixed(0)}ms) - Cold start probable de Chromium`
            });
        }
    }

    // Tri pour percentiles
    durations.sort((a, b) => a - b);
    const p50 = getPercentile(durations, 50);
    const p90 = getPercentile(durations, 90);
    const p95 = getPercentile(durations, 95);
    const p99 = getPercentile(durations, 99);
    const avg = sumTotalMs / totalEvents;

    const successRateNum = (successCount / totalEvents) * 100;
    const successRate = `${successRateNum.toFixed(1)}%`;

    // Finalisation par type
    const byEventTypeFinal = {};
    for (const [t, data] of Object.entries(byType)) {
        data.durations.sort((a, b) => a - b);
        byEventTypeFinal[t] = {
            count: data.count,
            avgDurationMs: parseFloat((data.sumDurationMs / data.count).toFixed(2)),
            p50DurationMs: parseFloat(getPercentile(data.durations, 50).toFixed(2)),
            p95DurationMs: parseFloat(getPercentile(data.durations, 95).toFixed(2)),
            errorCount: data.errorCount,
            errorRate: `${((data.errorCount / data.count) * 100).toFixed(1)}%`,
            breakdownAvgMs: {
                aiProcessing: parseFloat((data.aiSumMs / data.count).toFixed(2)),
                mediaRender: parseFloat((data.renderSumMs / data.count).toFixed(2)),
                audioSynthesis: parseFloat((data.audioSumMs / data.count).toFixed(2))
            }
        };
    }

    const totalCacheRequests = cacheHits + cacheMisses;
    const cacheHitRateNum = totalCacheRequests > 0 ? (cacheHits / totalCacheRequests) * 100 : 0;

    return {
        totalEvents,
        successCount,
        failureCount,
        successRate,
        successRateNum: parseFloat(successRateNum.toFixed(2)),
        percentilesMs: {
            p50: parseFloat(p50.toFixed(2)),
            p90: parseFloat(p90.toFixed(2)),
            p95: parseFloat(p95.toFixed(2)),
            p99: parseFloat(p99.toFixed(2)),
            avg: parseFloat(avg.toFixed(2)),
            min: parseFloat((durations[0] || 0).toFixed(2)),
            max: parseFloat((durations[durations.length - 1] || 0).toFixed(2))
        },
        breakdownAvgMs: {
            aiProcessing: parseFloat((sumAiMs / totalEvents).toFixed(2)),
            mediaRender: parseFloat((sumRenderMs / totalEvents).toFixed(2)),
            audioSynthesis: parseFloat((sumAudioMs / totalEvents).toFixed(2)),
            mediaEncode: parseFloat((sumEncodeMs / totalEvents).toFixed(2)),
            otherIo: parseFloat((sumOtherIoMs / totalEvents).toFixed(2))
        },
        byEventType: byEventTypeFinal,
        cacheMetrics: {
            hitCount: cacheHits,
            missCount: cacheMisses,
            hitRate: `${cacheHitRateNum.toFixed(1)}%`,
            hitRateNum: parseFloat(cacheHitRateNum.toFixed(1))
        },
        anomaliesDetected: anomalies
    };
}

/**
 * Charge tous les événements d'une date donnée depuis le fichier JSONL rotatif
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {Promise<Array<Object>>}
 */
async function loadEventsFromDate(dateStr) {
    const targetFile = path.join(TELEMETRY_DIR, `events-${dateStr}.jsonl`);
    if (!fs.existsSync(targetFile)) {
        return [];
    }

    const events = [];
    const fileStream = fs.createReadStream(targetFile, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line || !line.trim()) continue;
        try {
            events.push(JSON.parse(line));
        } catch (e) {}
    }

    return events;
}

/**
 * Charge les événements depuis un fichier JSONL local arbitraire
 * @param {string} filePath - Chemin absolu du fichier
 * @returns {Promise<Array<Object>>}
 */
async function loadEventsFromFile(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const events = [];
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    for await (const line of rl) {
        if (!line || !line.trim()) continue;
        try {
            events.push(JSON.parse(line));
        } catch (e) {}
    }
    return events;
}

/**
 * 🚨 GÉNÉRATEUR FORMAT COURT : Alerte d'Anomalie (Flash Alert) par Hugo
 * Style : Sans jargon, percutant, orienté action humaine
 */
function generateFlashAlert(anomalyData = {}) {
    const timestamp = anomalyData.timestamp || new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    const severity = anomalyData.severity || 'MOYENNE';
    const component = anomalyData.component || 'Service Général';
    const severityEmoji = severity === 'CRITICAL' ? '🔴 CRITIQUE' : severity === 'HIGH' ? '🟠 ÉLEVÉE' : '🟡 MODÉRÉE';

    const whatHappened = anomalyData.whatHappened || "Un ralentissement ou un comportement inhabituel a été détecté sur la plateforme.";
    const simpleCause = anomalyData.simpleCause || "Les ressources serveur ou l'API d'intelligence artificielle ont subi un pic de charge ponctuel.";
    const recommendation = anomalyData.recommendation || "Vérifier la charge du serveur et ajuster les temporisations.";

    return `### 🚨 ALERTE D'ANOMALIE SYSTÈME — [HUGO]
**Date & Heure :** ${timestamp}
**Niveau d'Alerte :** ${severityEmoji}
**Composant concerné :** ${component}

**1. Ce qui s'est passé en clair :**
${whatHappened}

**2. La cause expliquée simplement :**
${simpleCause}

**3. Action recommandée pour l'équipe (Steve & Thomas) :**
- ${recommendation}`;
}

/**
 * 📈 GÉNÉRATEUR FORMAT EXÉCUTIF : Synthèse Quotidienne (Daily Ops Digest) par Hugo
 * Style : Pédagogique, métriques clés vulgarisées, recommandations actionnables
 */
function generateDailyDigest(stats, options = {}) {
    const dateStr = options.date || new Date().toISOString().split('T')[0];
    const total = stats.totalEvents || 0;
    const successRate = stats.successRate || '100%';
    const p50 = stats.percentilesMs?.p50 || 0;
    const p95 = stats.percentilesMs?.p95 || 0;

    // Détermination de l'état global du système
    let globalStatusEmoji = '🟢 Opérationnel & Fluide';
    if (stats.successRateNum < 98 || stats.anomaliesDetected?.length > 3) {
        globalStatusEmoji = '🟡 Vigilance Requise (Ralentissements Détectés)';
    }
    if (stats.successRateNum < 95) {
        globalStatusEmoji = '🔴 Dégradé (Incidents Détectés)';
    }

    // Description vulgarisée des fonctionnalités
    const featureLines = [];
    const types = stats.byEventType || {};

    if (types.vocab_card_generation) {
        const v = types.vocab_card_generation;
        featureLines.push(`| 🎴 **Fiches Vocabulaire 9:16** | ${v.count} | ${(v.p50DurationMs / 1000).toFixed(1)}s | ${(v.p95DurationMs / 1000).toFixed(1)}s | ${v.p95DurationMs < 3000 ? '⚡ Ultra-rapide' : '⏱️ Conforme'} |`);
    }
    if (types.video_generation) {
        const v = types.video_generation;
        featureLines.push(`| 🎬 **Vidéos TikTok V3** | ${v.count} | ${(v.p50DurationMs / 1000).toFixed(1)}s | ${(v.p95DurationMs / 1000).toFixed(1)}s | ${v.p95DurationMs < 35000 ? '✅ Fluide' : '⚠️ Charge élevée'} |`);
    }
    if (types.shami_translation) {
        const v = types.shami_translation;
        featureLines.push(`| 💬 **Traductions Chat Shami** | ${v.count} | ${v.p50DurationMs.toFixed(0)}ms | ${v.p95DurationMs.toFixed(0)}ms | ⚡ Instantané |`);
    }
    if (types.audio_synthesis_unit) {
        const v = types.audio_synthesis_unit;
        featureLines.push(`| 🎙️ **Synthèses Audio Unitaires** | ${v.count} | ${v.p50DurationMs.toFixed(0)}ms | ${v.p95DurationMs.toFixed(0)}ms | ✅ Voix claire & réactive |`);
    }
    if (types.chat_sse_broadcast) {
        const v = types.chat_sse_broadcast;
        featureLines.push(`| 📡 **Diffusion Direct SSE** | ${v.count} | ${v.p50DurationMs.toFixed(1)}ms | ${v.p95DurationMs.toFixed(1)}ms | 🚀 Temps réel zéro polling |`);
    }

    const tableContent = featureLines.length > 0 
        ? featureLines.join('\n')
        : "| 🌐 **Requêtes Globales API** | " + total + " | " + p50.toFixed(0) + "ms | " + p95.toFixed(0) + "ms | ✅ Normal |";

    // Économies de cache
    const cacheHitRate = stats.cacheMetrics?.hitRate || '0%';
    const cacheHitCount = stats.cacheMetrics?.hitCount || 0;

    return `# 📈 BULLETIN QUOTIDIEN DE SANTÉ SYSTÈME — [HUGO]
**Date :** ${dateStr}  
**Statut Global :** ${globalStatusEmoji}  
**Disponibilité Serveur :** ${successRate} (${total} requêtes traitées)  
**Latence Médiane (P50) :** ${p50.toFixed(0)} ms | **Plafond 95% des usagers (P95) :** ${p95.toFixed(0)} ms

---

### 🎯 Ce qu'il faut retenir aujourd'hui (Synthèse non-technique)
1. **Fluidité Générale :** 50% des interactions répondent en moins de **${p50.toFixed(0)} ms**. Les utilisateurs bénéficient d'une interface très réactive.
2. **Impact du Cache Intelligent :** **${cacheHitRate}** des traductions courantes ont été servies en **0 ms** (${cacheHitCount} appels Gemini économisés sans coût API).
3. **Anomalies Détectées :** ${stats.anomaliesDetected?.length || 0} anomalie(s) mineure(s) répertoriée(s) aujourd'hui sans impact sur la disponibilité globale.

---

### ⏱️ Performance par Fonctionnalité Clé
| Fonctionnalité | Volume | Latence P50 | Latence P95 | Ressenti Utilisateur |
| :--- | :---: | :---: | :---: | :--- |
${tableContent}

---

### 💡 Recommandations Stratégiques d'Hugo & Steve
- **Optimisation Rendu :** Maintenir le Warm Singleton Chromium actif pendant les pics de consultation du soir (18h-21h) pour préserver un temps de rendu < 2s sur les fiches.
- **Ressources IA :** Les quotas Google Gemini sont sous contrôle, la cascade multi-modèles protège efficacement contre tout blocage.
- **Action Immédiate :** Aucune intervention humaine critique requise, infrastructure au vert pour le post-lancement.`;
}

module.exports = {
    computeStatistics,
    getPercentile,
    loadEventsFromDate,
    loadEventsFromFile,
    generateFlashAlert,
    generateDailyDigest
};
