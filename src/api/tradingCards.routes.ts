import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as tradingCardsService from '../services/tradingCards.js';

const router = express.Router();

/**
 * GET /api/cards
 * Get all available trading cards (public)
 */
router.get('/api/cards', async (_req, res) => {
  try {
    const cards = await tradingCardsService.getAllCards(sql);
    res.json({ cards });
  } catch (error) {
    console.error('[Trading Cards API] Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

/**
 * POST /api/agents/:agentId/cards/:cardId/mint
 * Mint a card for an agent (authenticated)
 */
router.post('/api/agents/:agentId/cards/:cardId/mint', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId: authenticatedAgentId } = validateToken(token);
    const { agentId, cardId } = req.params;

    if (authenticatedAgentId !== agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const agentCard = await tradingCardsService.mintCard(agentId, parseInt(cardId), sql);
    res.json({ success: true, card: agentCard });
  } catch (error: any) {
    console.error('[Trading Cards API] Error minting card:', error);
    if (error.message === 'Card not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Card supply exhausted') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to mint card' });
  }
});

/**
 * GET /api/agents/:agentId/cards
 * Get cards owned by an agent (public, optional rarity filter)
 */
router.get('/api/agents/:agentId/cards', async (req, res) => {
  try {
    const { agentId } = req.params;
    const rarity = req.query.rarity as string | undefined;

    const cards = await tradingCardsService.getAgentCards(agentId, sql, rarity);
    res.json({ cards });
  } catch (error) {
    console.error('[Trading Cards API] Error fetching agent cards:', error);
    res.status(500).json({ error: 'Failed to fetch agent cards' });
  }
});

/**
 * POST /api/cards/trade
 * Trade cards between two agents (authenticated)
 */
router.post('/api/cards/trade', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId: authenticatedAgentId } = validateToken(token);
    const { receiverAgentId, senderCardIds, receiverCardIds } = req.body;

    if (!receiverAgentId || !senderCardIds || !receiverCardIds) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await tradingCardsService.tradeCards(
      authenticatedAgentId,
      receiverAgentId,
      senderCardIds,
      receiverCardIds,
      sql
    );

    res.json(result);
  } catch (error: any) {
    console.error('[Trading Cards API] Error trading cards:', error);
    res.status(400).json({ error: error.message || 'Failed to trade cards' });
  }
});

/**
 * GET /api/cards/stats
 * Get statistics for a specific card
 */
router.get('/api/cards/stats', async (req, res) => {
  try {
    const cardId = parseInt(req.query.cardId as string);
    if (isNaN(cardId)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    const stats = await tradingCardsService.getCardStats(cardId, sql);
    res.json(stats);
  } catch (error: any) {
    console.error('[Trading Cards API] Error fetching card stats:', error);
    if (error.message === 'Card not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch card stats' });
  }
});

/**
 * GET /api/cards/rarest
 * Get rarest cards by mint count
 */
router.get('/api/cards/rarest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const cards = await tradingCardsService.getRarestCards(limit, sql);
    res.json({ cards });
  } catch (error) {
    console.error('[Trading Cards API] Error fetching rarest cards:', error);
    res.status(500).json({ error: 'Failed to fetch rarest cards' });
  }
});

/**
 * GET /api/agents/:agentId/cards/progress
 * Get collection progress for an agent
 */
router.get('/api/agents/:agentId/cards/progress', async (req, res) => {
  try {
    const { agentId } = req.params;
    const progress = await tradingCardsService.getCollectionProgress(agentId, sql);
    res.json(progress);
  } catch (error) {
    console.error('[Trading Cards API] Error fetching collection progress:', error);
    res.status(500).json({ error: 'Failed to fetch collection progress' });
  }
});

/**
 * GET /api/cards/leaderboard
 * Get collection leaderboard
 */
router.get('/api/cards/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const leaderboard = await tradingCardsService.getLeaderboard(limit, sql);
    res.json({ leaderboard });
  } catch (error) {
    console.error('[Trading Cards API] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
