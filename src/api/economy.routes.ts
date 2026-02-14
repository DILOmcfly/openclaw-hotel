import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as economyService from '../services/economy.js';

const router = express.Router();

/**
 * GET /api/economy/balance
 * Get authenticated user's balance
 */
router.get('/api/economy/balance', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const balance = await economyService.getBalance(agentId, sql);

    res.json({
      coins: balance.coins,
      lastDailyClaim: balance.lastDailyClaim,
      canClaimDaily: economyService.canClaimDailyBonus(balance.lastDailyClaim),
    });
  } catch (error) {
    console.error('[Economy API] Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

/**
 * POST /api/economy/daily
 * Claim daily bonus (100 coins, once per 24h)
 */
router.post('/api/economy/daily', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const balance = await economyService.grantDailyBonus(agentId, sql);

    res.json({
      success: true,
      coins: balance.coins,
      bonusAmount: 100,
      message: 'Daily bonus claimed! +100 coins',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to claim daily bonus';
    console.error('[Economy API] Error claiming daily bonus:', error);
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/economy/balance/:agentId
 * Get any agent's balance (public info)
 */
router.get('/api/economy/balance/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const balance = await economyService.getBalance(agentId, sql);

    res.json({
      agentId: balance.agentId,
      coins: balance.coins,
    });
  } catch (error) {
    console.error('[Economy API] Error fetching agent balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

export default router;
