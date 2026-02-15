import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as skillsService from '../services/agentSkills.js';

const router = express.Router();

/**
 * GET /api/skills
 * Get all available skills (public)
 */
router.get('/api/skills', async (_req, res) => {
  try {
    const skills = await skillsService.getAllSkills(sql);
    res.json({ skills });
  } catch (error) {
    console.error('[Skills API] Error fetching skills:', error);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

/**
 * POST /api/agents/:agentId/skills/:skillId/learn
 * Learn a new skill (authenticated)
 */
router.post('/api/agents/:agentId/skills/:skillId/learn', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId: authAgentId } = validateToken(token);
    const { agentId, skillId } = req.params;

    if (authAgentId !== agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await skillsService.learnSkill(agentId, parseInt(skillId), sql);
    res.json({ success: true, skill: result, message: 'Skill learned successfully!' });
  } catch (error: any) {
    console.error('[Skills API] Error learning skill:', error);
    if (error.message === 'Skill already learned') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Skill not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Insufficient coins') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to learn skill' });
  }
});

/**
 * POST /api/agents/:agentId/skills/:skillId/xp
 * Add XP to a skill (authenticated)
 */
router.post('/api/agents/:agentId/skills/:skillId/xp', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId: authAgentId } = validateToken(token);
    const { agentId, skillId } = req.params;
    const { amount } = req.body;

    if (authAgentId !== agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid XP amount' });
    }

    const result = await skillsService.addSkillXP(agentId, parseInt(skillId), amount, sql);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Skills API] Error adding XP:', error);
    if (error.message === 'Skill not learned yet') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to add XP' });
  }
});

/**
 * GET /api/agents/:agentId/skills
 * Get all skills for an agent (public)
 */
router.get('/api/agents/:agentId/skills', async (req, res) => {
  try {
    const { agentId } = req.params;
    const skills = await skillsService.getAgentSkills(agentId, sql);
    res.json({ skills });
  } catch (error) {
    console.error('[Skills API] Error fetching agent skills:', error);
    res.status(500).json({ error: 'Failed to fetch agent skills' });
  }
});

/**
 * GET /api/skills/leaderboard
 * Get top skilled agents (public)
 */
router.get('/api/skills/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const leaderboard = await skillsService.getTopSkilledAgents(limit, sql);
    res.json({ leaderboard });
  } catch (error) {
    console.error('[Skills API] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/agents/:agentId/skills/recommendations
 * Get skill recommendations for an agent (authenticated)
 */
router.get('/api/agents/:agentId/skills/recommendations', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId: authAgentId } = validateToken(token);
    const { agentId } = req.params;

    if (authAgentId !== agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const recommendations = await skillsService.getSkillRecommendations(agentId, sql);
    res.json({ recommendations });
  } catch (error) {
    console.error('[Skills API] Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

export default router;
