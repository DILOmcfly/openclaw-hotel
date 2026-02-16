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
  getTradePartnersCount,
  TransactionType,
} from '../services/tradeHistory.js';
import { validateToken } from '../middleware/auth.js';
import { sql } from '../db/index.js';

const router = Router();

// Helper to parse pagination params
function getPaginationParams(query: any): { limit: number; offset: number } {
  const limit = Math.min(parseInt(query.limit) || 50, 100); // Max 100
  const offset = Math.max(parseInt(query.offset) || 0, 0); // Min 0
  return { limit, offset };
}

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
 * Query params: ?limit=50&offset=0
 */
router.get('/api/history/partners', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { limit, offset } = getPaginationParams(req.query);
    
    // Get total count and results
    const [total, partners] = await Promise.all([
      getTradePartnersCount(agentId, sql),
      getTradePartners(agentId, limit, offset, sql)
    ]);

    res.json({
      partners,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
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
