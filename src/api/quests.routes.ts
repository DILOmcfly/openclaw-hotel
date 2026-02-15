import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as questsService from '../services/quests.js';

const router = express.Router();

// GET /api/quests - List all available quests (public)
router.get('/api/quests', async (req, res) => {
  try {
    const questType = req.query.type as 'daily' | 'weekly' | 'special' | undefined;
    const quests = await questsService.getAvailableQuests(sql, questType);
    res.json({ quests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quests' });
  }
});

// GET /api/agents/:agentId/quests - Get agent's assigned quests
router.get('/api/agents/:agentId/quests', async (req, res) => {
  try {
    const { agentId } = req.params;
    const questType = req.query.type as 'daily' | 'weekly' | 'special' | undefined;
    const quests = await questsService.getAgentQuests(agentId, sql, questType);
    res.json({ quests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agent quests' });
  }
});

// POST /api/agents/:agentId/quests/assign - Assign daily quests to agent
router.post('/api/agents/:agentId/quests/assign', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId } = req.params;
    if (tokenAgentId !== agentId) return res.status(403).json({ error: 'Forbidden' });

    const assigned = await questsService.assignDailyQuests(agentId, sql);
    res.json({ success: true, assigned, message: `Assigned ${assigned} daily quests` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign quests' });
  }
});

// PUT /api/agents/:agentId/quests/:questId/progress - Update quest progress
router.put('/api/agents/:agentId/quests/:questId/progress', async (req, res) => {
  try {
    const { agentId, questId } = req.params;
    const { increment = 1 } = req.body;
    const quest = await questsService.updateProgress(agentId, parseInt(questId), increment, sql);
    if (!quest) return res.status(404).json({ error: 'Quest not found or already completed' });
    res.json({ success: true, quest, completed: quest.completed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// POST /api/agents/:agentId/quests/:questId/claim - Claim quest reward
router.post('/api/agents/:agentId/quests/:questId/claim', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId, questId } = req.params;
    if (tokenAgentId !== agentId) return res.status(403).json({ error: 'Forbidden' });

    const reward = await questsService.claimReward(agentId, parseInt(questId), sql);
    if (!reward) return res.status(400).json({ error: 'Quest not completed or already claimed' });
    res.json({ success: true, reward, message: `Claimed +${reward.coins} coins, +${reward.xp} XP` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to claim reward' });
  }
});

export default router;
