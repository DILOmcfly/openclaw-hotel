/**
 * Collectible Cards API Routes
 */

import { Router } from 'express';
import {
  getAllCards,
  getMyCards,
  tradeCards,
  getCollectionCompletion,
} from '../services/cards.js';
import { validateToken } from '../middleware/auth.js';
import { sql } from '../db/index.js';

const router = Router();

/**
 * GET /api/cards
 * Get all cards in the catalog (public)
 */
router.get('/api/cards', async (_req, res) => {
  try {
    const cards = await getAllCards(sql);
    res.json({ cards });
  } catch (error: any) {
    console.error('[Cards API] Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

/**
 * GET /api/cards/mine
 * Get authenticated agent's card collection
 */
router.get('/api/cards/mine', validateToken, async (_req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const cards = await getMyCards(agentId, sql);
    res.json({ cards });
  } catch (error: any) {
    console.error('[Cards API] Error fetching my cards:', error);
    res.status(500).json({ error: 'Failed to fetch your cards' });
  }
});

/**
 * POST /api/cards/trade
 * Trade cards between agents
 * Body: { toAgentId: string, cardId: string, quantity: number }
 */
router.post('/api/cards/trade', validateToken, async (req, res) => {
  try {
    const fromAgentId = res.locals.agentId;

    if (!fromAgentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { toAgentId, cardId, quantity } = req.body;

    if (!toAgentId || !cardId || quantity === undefined) {
      res.status(400).json({ error: 'Missing required fields: toAgentId, cardId, quantity' });
      return;
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      res.status(400).json({ error: 'Quantity must be a positive number' });
      return;
    }

    if (fromAgentId === toAgentId) {
      res.status(400).json({ error: 'Cannot trade with yourself' });
      return;
    }

    await tradeCards(fromAgentId, toAgentId, cardId, quantity, sql);

    res.json({ success: true, message: 'Trade completed' });
  } catch (error: any) {
    console.error('[Cards API] Error trading cards:', error);

    if (
      error.message.includes('do not own') ||
      error.message.includes('Insufficient') ||
      error.message.includes('Quantity must')
    ) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to trade cards' });
  }
});

/**
 * GET /api/cards/completion
 * Get collection completion percentage for authenticated agent
 */
router.get('/api/cards/completion', validateToken, async (_req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const completion = await getCollectionCompletion(agentId, sql);
    res.json(completion);
  } catch (error: any) {
    console.error('[Cards API] Error fetching completion:', error);
    res.status(500).json({ error: 'Failed to fetch collection completion' });
  }
});

export default router;
