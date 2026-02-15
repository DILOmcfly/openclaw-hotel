import express from 'express';
import { sql } from '../db/index.js';
import * as dailyCalendarService from '../services/dailyCalendar.js';

const router = express.Router();

/** POST /api/agents/:agentId/calendar/claim - Claim today's reward */
router.post('/api/agents/:agentId/calendar/claim', async (req, res) => {
  try {
    const { agentId } = req.params;
    const result = await dailyCalendarService.claimToday(agentId, sql);
    res.json({
      success: true,
      day: result.day,
      rewardType: result.rewardType,
      rewardValue: result.rewardValue,
      coinsAwarded: result.coinsAwarded,
      message: `Day ${result.day} claimed! +${result.coinsAwarded} coins`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to claim reward';
    res.status(400).json({ error: message });
  }
});

/** GET /api/agents/:agentId/calendar - Get full month calendar with claimed status */
router.get('/api/agents/:agentId/calendar', async (req, res) => {
  try {
    const { agentId } = req.params;
    const calendar = await dailyCalendarService.getCalendar(agentId, sql);
    const streak = await dailyCalendarService.getStreakBonus(agentId, sql);
    res.json({
      calendar,
      streak: streak.streak,
      bonusPercent: streak.bonusPercent,
    });
  } catch (error) {
    console.error('[Daily Calendar API] Error fetching calendar:', error);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
});

/** GET /api/agents/:agentId/calendar/progress - Get monthly progress */
router.get('/api/agents/:agentId/calendar/progress', async (req, res) => {
  try {
    const { agentId } = req.params;
    const progress = await dailyCalendarService.getMonthlyProgress(agentId, sql);
    res.json(progress);
  } catch (error) {
    console.error('[Daily Calendar API] Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

/** GET /api/agents/:agentId/calendar/missed - Get missed days */
router.get('/api/agents/:agentId/calendar/missed', async (req, res) => {
  try {
    const { agentId } = req.params;
    const missed = await dailyCalendarService.getMissedDays(agentId, sql);
    const claimedDays = await dailyCalendarService.getClaimedDays(agentId, sql);
    res.json({
      missedDays: missed,
      claimedDays,
      totalMissed: missed.length,
      totalClaimed: claimedDays.length,
    });
  } catch (error) {
    console.error('[Daily Calendar API] Error fetching missed days:', error);
    res.status(500).json({ error: 'Failed to fetch missed days' });
  }
});

export default router;
