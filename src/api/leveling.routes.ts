import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as levelingService from '../services/leveling.js';

const router = express.Router();

// GET /api/agents/:agentId/level - Get agent's current level and progress
router.get('/api/agents/:agentId/level', async (req, res) => {
  try {
    const levelProgress = await levelingService.getLevel(req.params.agentId, sql);
    res.json(levelProgress);
  } catch (error) {
    console.error('[Leveling API] Error fetching level:', error);
    res.status(500).json({ error: 'Failed to fetch level' });
  }
});

// POST /api/agents/:agentId/xp - Add XP to agent (authenticated)
router.post('/api/agents/:agentId/xp', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId } = req.params;
    const { amount } = req.body;
    
    if (tokenAgentId !== agentId) return res.status(403).json({ error: 'Cannot add XP to other agents' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid XP amount' });
    
    const result = await levelingService.addXP(agentId, amount, sql);
    res.json({
      success: true,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      reward: result.reward,
      message: result.leveledUp ? `Level up! You are now level ${result.newLevel}!` : `Added ${amount} XP`,
    });
  } catch (error) {
    console.error('[Leveling API] Error adding XP:', error);
    res.status(500).json({ error: 'Failed to add XP' });
  }
});

// GET /api/levels/leaderboard - Get level leaderboard (public)
router.get('/api/levels/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const leaderboard = await levelingService.getLeaderboard(limit, sql);
    res.json({
      leaderboard: leaderboard.map((entry) => ({
        agentId: entry.agentId,
        level: entry.level,
        totalXpEarned: entry.totalXpEarned,
      })),
    });
  } catch (error) {
    console.error('[Leveling API] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/levels/:level/reward - Get reward info for a specific level (public)
router.get('/api/levels/:level/reward', async (req, res) => {
  try {
    const level = parseInt(req.params.level);
    if (isNaN(level) || level < 1) return res.status(400).json({ error: 'Invalid level' });
    
    const reward = await levelingService.getLevelReward(level, sql);
    if (!reward) return res.status(404).json({ error: 'No reward for this level' });
    
    res.json(reward);
  } catch (error) {
    console.error('[Leveling API] Error fetching reward:', error);
    res.status(500).json({ error: 'Failed to fetch reward' });
  }
});

export default router;
