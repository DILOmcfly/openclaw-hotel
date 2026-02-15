import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as achievementsV2 from '../services/achievementsV2.js';

const router = express.Router();

/**
 * GET /api/achievements
 * Get all available achievements (public)
 */
router.get('/api/achievements', async (req, res) => {
  try {
    const achievements = await achievementsV2.getAllAchievements(sql);
    res.json({ achievements });
  } catch (error) {
    console.error('[Achievements V2 API] Error fetching all achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

/**
 * GET /api/agents/:agentId/achievements
 * Get agent's unlocked achievements
 */
router.get('/api/agents/:agentId/achievements', async (req, res) => {
  try {
    const { agentId } = req.params;
    const achievements = await achievementsV2.getAgentAchievements(agentId, sql);
    res.json({ achievements });
  } catch (error) {
    console.error('[Achievements V2 API] Error fetching agent achievements:', error);
    res.status(500).json({ error: 'Failed to fetch agent achievements' });
  }
});

/**
 * GET /api/agents/:agentId/achievements/progress
 * Get achievement progress for an agent
 */
router.get('/api/agents/:agentId/achievements/progress', async (req, res) => {
  try {
    const { agentId } = req.params;
    const progress = await achievementsV2.getAchievementProgress(agentId, sql);
    res.json({ progress });
  } catch (error) {
    console.error('[Achievements V2 API] Error fetching achievement progress:', error);
    res.status(500).json({ error: 'Failed to fetch achievement progress' });
  }
});

/**
 * POST /api/agents/:agentId/achievements/check
 * Trigger achievement check for an agent (authenticated)
 */
router.post('/api/agents/:agentId/achievements/check', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId } = req.params;

    if (tokenAgentId !== agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const newlyUnlocked = await achievementsV2.checkAndUnlock(agentId, sql);
    
    res.json({
      success: true,
      newlyUnlocked,
      count: newlyUnlocked.length,
    });
  } catch (error) {
    console.error('[Achievements V2 API] Error checking achievements:', error);
    res.status(500).json({ error: 'Failed to check achievements' });
  }
});

/**
 * GET /api/achievements/leaderboard
 * Get achievements leaderboard by total points (public)
 */
router.get('/api/achievements/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const leaderboard = await achievementsV2.getLeaderboard(limit, sql);
    res.json({ leaderboard });
  } catch (error) {
    console.error('[Achievements V2 API] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
