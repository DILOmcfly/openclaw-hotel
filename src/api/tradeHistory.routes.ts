/**
 * Trade History API Routes
 */

import { Router } from 'express';
import {
  getHistory,
  getTransactionById,
  getTotalCoinsEarned,
  getTotalCoinsSpent,
  getTradePartners,
  TransactionType,
} from '../services/tradeHistory.js';
import { validateToken } from '../middleware/auth.js';
import { sql } from '../db/index.js';

const router = Router();

/**
 * GET /api/history
 * Get agent's transaction history with optional filters
 */
router.get('/api/history', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const type = req.query.type as TransactionType | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await getHistory(
      agentId,
      type || null,
      limit,
      offset,
      sql
    );

    res.json({ history });
  } catch (error: any) {
    console.error('[Trade History API] Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

/**
 * GET /api/history/stats
 * Get agent's coin statistics
 */
router.get('/api/history/stats', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [earned, spent] = await Promise.all([
      getTotalCoinsEarned(agentId, sql),
      getTotalCoinsSpent(agentId, sql),
    ]);

    res.json({
      totalCoinsEarned: earned,
      totalCoinsSpent: spent,
      netCoins: earned - spent,
    });
  } catch (error: any) {
    console.error('[Trade History API] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch coin statistics' });
  }
});

/**
 * GET /api/history/partners
 * Get agent's trade partners
 */
router.get('/api/history/partners', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const partners = await getTradePartners(agentId, sql);

    res.json({ partners });
  } catch (error: any) {
    console.error('[Trade History API] Error fetching partners:', error);
    res.status(500).json({ error: 'Failed to fetch trade partners' });
  }
});

/**
 * GET /api/history/:id
 * Get a single transaction by ID
 */
router.get('/api/history/:id', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { id } = req.params;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!id) {
      res.status(400).json({ error: 'Missing transaction ID' });
      return;
    }

    const transaction = await getTransactionById(id, sql);

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Only allow viewing own transactions
    if (transaction.agentId !== agentId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json({ transaction });
  } catch (error: any) {
    console.error('[Trade History API] Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

export default router;
