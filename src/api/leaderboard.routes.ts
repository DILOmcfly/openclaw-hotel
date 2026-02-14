/**
 * Leaderboard API Routes
 */
import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as leaderboardService from '../services/leaderboard.js';

const router = express.Router();

/**
 * GET /api/leaderboard/:category
 * Get leaderboard for a specific category
 * Query params: ?limit=10 (default 10, max 100)
 */
router.get('/api/leaderboard/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

    if (!leaderboardService.isValidCategory(category)) {
      return res.status(400).json({ 
        error: 'Invalid category. Must be one of: coins, trades, friends, achievements, games_won' 
      });
    }

    const leaderboard = await leaderboardService.getLeaderboard(
      category as leaderboardService.LeaderboardCategory,
      limit,
      sql
    );

    res.json({
      category,
      limit,
      entries: leaderboard,
    });
  } catch (error) {
    console.error('[Leaderboard API] Error fetching leaderboard:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/leaderboard/:category/rank/:agentId
 * Get agent's rank in a specific category
 */
router.get('/api/leaderboard/:category/rank/:agentId', async (req, res) => {
  try {
    const { category, agentId } = req.params;

    if (!leaderboardService.isValidCategory(category)) {
      return res.status(400).json({ 
        error: 'Invalid category. Must be one of: coins, trades, friends, achievements, games_won' 
      });
    }

    const rank = await leaderboardService.getAgentRank(
      agentId,
      category as leaderboardService.LeaderboardCategory,
      sql
    );

    res.json({
      category,
      agentId,
      rank,
    });
  } catch (error) {
    console.error('[Leaderboard API] Error fetching rank:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch rank';
    res.status(500).json({ error: message });
  }
});

export default router;
