const express = require('express');
const router = express.Router();
const agentSupervisor = require('../services/agentSupervisor');

/**
 * GET /api/agents/list : Obtenir la liste des 7 agents et leurs spécialités
 */
router.get('/list', (req, res) => {
    return res.json({
        success: true,
        agents: Object.values(agentSupervisor.AGENTS)
    });
});

/**
 * POST /api/agents/audit : Lancer un audit automatique complet sur un média finalisé
 */
router.post('/audit', (req, res) => {
    try {
        const { ass_filename, mp4_filename, media_info } = req.body;

        if (!ass_filename && !mp4_filename) {
            return res.status(400).json({
                success: false,
                error: "Le nom du fichier .ass ou .mp4 est obligatoire pour réaliser l'audit."
            });
        }

        const report = agentSupervisor.runAutomatedAudit({
            assFilename: ass_filename,
            mp4Filename: mp4_filename,
            mediaInfo: media_info || {}
        });

        return res.json({
            success: true,
            audit: report
        });
    } catch (err) {
        console.error('[API AGENTS AUDIT ERROR]', err);
        return res.status(500).json({
            success: false,
            error: `Erreur lors de l'audit des agents : ${err.message}`
        });
    }
});

/**
 * POST /api/agents/consult : Poser une question au Conseil ou à un Agent en direct
 */
router.post('/consult', async (req, res) => {
    try {
        const { agent_id, question, context } = req.body;

        if (!question || !question.trim()) {
            return res.status(400).json({
                success: false,
                error: "La question ne peut pas être vide."
            });
        }

        const consultation = await agentSupervisor.consultAgentCouncil({
            agentId: agent_id || 'all',
            question: question.trim(),
            context: context || {}
        });

        return res.json(consultation);
    } catch (err) {
        console.error('[API AGENTS CONSULT ERROR]', err);
        return res.status(500).json({
            success: false,
            error: `Erreur lors de la consultation des agents : ${err.message}`
        });
    }
});

module.exports = router;
