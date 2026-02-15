import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as streaksService from '../services/streaks.js';

const router = express.Router();

/**
 * POST /api/streaks/login
 * Record login and update streak (authenticated)
 */
router.post('/api/streaks/login', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const result = await streaksService.recordLogin(agentId, sql);

    res.json({
      success: true,
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      coinsAwarded: result.coinsAwarded,
      totalLogins: result.totalLogins,
      message: result.coinsAwarded > 0 
        ? `Login streak: ${result.currentStreak} days! +${result.coinsAwarded} coins` 
        : 'Already logged in today',
    });
  } catch (error) {
    console.error('[Streaks API] Error recording login:', error);
    res.status(500).json({ error: 'Failed to record login' });
  }
});

/**
 * GET /api/streaks
 * Get authenticated user's streak info
 */
router.get('/api/streaks', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const streak = await streaksService.getStreak(agentId, sql);

    res.json({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      totalLogins: streak.totalLogins,
      streakCoinsEarned: streak.streakCoinsEarned,
      lastLoginDate: streak.lastLoginDate,
      nextReward: streaksService.getStreakReward(streak.currentStreak + 1),
    });
  } catch (error) {
    console.error('[Streaks API] Error fetching streak:', error);
    res.status(500).json({ error: 'Failed to fetch streak' });
  }
});

/**
 * GET /api/streaks/top
 * Get streak leaderboard (public)
 */
router.get('/api/streaks/top', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const topStreaks = await streaksService.getTopStreaks(limit, sql);

    res.json({
      leaderboard: topStreaks.map(s => ({
        agentId: s.agentId,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        totalLogins: s.totalLogins,
      })),
    });
  } catch (error) {
    console.error('[Streaks API] Error fetching top streaks:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
