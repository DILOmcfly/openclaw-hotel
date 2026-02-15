import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as diceService from '../services/dice.js';

const router = express.Router();

router.post('/api/dice/roll', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { bet, diceCount = 2, targetType, targetValue } = req.body;

    if (!bet || !targetType) {
      return res.status(400).json({ error: 'Missing required fields: bet, targetType' });
    }

    const game = await diceService.rollDice(agentId, bet, diceCount, targetType, targetValue, sql);
    res.json({
      success: true,
      game,
      message: game.won ? `You won ${game.payout} coins!` : 'Better luck next time!',
    });
  } catch (error: any) {
    console.error('[Dice API] Error rolling dice:', error);
    res.status(500).json({ error: error.message || 'Failed to roll dice' });
  }
});

router.get('/api/agents/:agentId/dice/stats', async (req, res) => {
  try {
    const { agentId } = req.params;
    const stats = await diceService.getStats(agentId, sql);
    res.json(stats);
  } catch (error) {
    console.error('[Dice API] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/api/agents/:agentId/dice/history', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const history = await diceService.getHistory(agentId, limit, offset, sql);
    res.json({ history, limit, offset });
  } catch (error) {
    console.error('[Dice API] Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.get('/api/dice/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const leaderboard = await diceService.getLeaderboard(limit, sql);
    res.json({ leaderboard });
  } catch (error) {
    console.error('[Dice API] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.get('/api/dice/odds/:diceCount/:targetType/:targetValue?', async (req, res) => {
  try {
    const diceCount = parseInt(req.params.diceCount);
    const targetType = req.params.targetType;
    const targetValue = req.params.targetValue ? parseInt(req.params.targetValue) : null;
    const odds = diceService.calculateOdds(diceCount, targetType, targetValue);
    res.json({ diceCount, targetType, targetValue, odds, percentage: (odds * 100).toFixed(2) + '%' });
  } catch (error) {
    console.error('[Dice API] Error calculating odds:', error);
    res.status(500).json({ error: 'Failed to calculate odds' });
  }
});

export default router;
