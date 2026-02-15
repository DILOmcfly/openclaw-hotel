import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as blackjackService from '../services/blackjack.js';

const router = express.Router();

/**
 * POST /api/blackjack/new
 * Start a new blackjack game
 */
router.post('/api/blackjack/new', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { bet } = req.body;

    if (!bet || bet < 1) {
      return res.status(400).json({ error: 'Bet must be at least 1 coin' });
    }

    const game = await blackjackService.newGame(agentId, bet, sql);
    res.json({ success: true, game });
  } catch (error: any) {
    console.error('[Blackjack API] Error creating game:', error);
    res.status(500).json({ error: error.message || 'Failed to create game' });
  }
});

/**
 * POST /api/blackjack/:gameId/hit
 * Draw another card
 */
router.post('/api/blackjack/:gameId/hit', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    validateToken(token);
    const gameId = parseInt(req.params.gameId);
    const game = await blackjackService.hit(gameId, sql);
    res.json({ success: true, game });
  } catch (error: any) {
    console.error('[Blackjack API] Error hitting:', error);
    res.status(500).json({ error: error.message || 'Failed to hit' });
  }
});

/**
 * POST /api/blackjack/:gameId/stand
 * End turn, dealer plays
 */
router.post('/api/blackjack/:gameId/stand', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    validateToken(token);
    const gameId = parseInt(req.params.gameId);
    const game = await blackjackService.stand(gameId, sql);
    res.json({ success: true, game });
  } catch (error: any) {
    console.error('[Blackjack API] Error standing:', error);
    res.status(500).json({ error: error.message || 'Failed to stand' });
  }
});

/**
 * GET /api/blackjack/:gameId
 * Get game state
 */
router.get('/api/blackjack/:gameId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    validateToken(token);
    const gameId = parseInt(req.params.gameId);
    const game = await blackjackService.getGame(gameId, sql);
    res.json({ game });
  } catch (error: any) {
    console.error('[Blackjack API] Error fetching game:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch game' });
  }
});

/**
 * GET /api/agents/:agentId/blackjack/stats
 * Get agent blackjack stats
 */
router.get('/api/agents/:agentId/blackjack/stats', async (req, res) => {
  try {
    const { agentId } = req.params;
    const stats = await blackjackService.getStats(agentId, sql);
    res.json({ stats });
  } catch (error: any) {
    console.error('[Blackjack API] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
