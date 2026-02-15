import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as rpsService from '../services/rps.js';

const router = express.Router();

router.post('/api/rps/new', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const bet = parseInt(req.body.bet) || 0;
    const game = await rpsService.createGame(agentId, bet, sql);
    res.json({ success: true, game });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create game' });
  }
});

router.post('/api/rps/:gameId/join', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const gameId = parseInt(req.params.gameId);
    const game = await rpsService.joinGame(gameId, agentId, sql);
    res.json({ success: true, game });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to join game' });
  }
});

router.post('/api/rps/:gameId/move', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const gameId = parseInt(req.params.gameId);
    const { move } = req.body;
    const game = await rpsService.makeMove(gameId, agentId, move, sql);
    res.json({ success: true, game });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to make move' });
  }
});

router.get('/api/rps/:gameId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const gameId = parseInt(req.params.gameId);
    const game = await rpsService.getGame(gameId, agentId, sql);
    res.json(game);
  } catch (error: any) {
    res.status(404).json({ error: error.message || 'Game not found' });
  }
});

router.get('/api/agents/:agentId/rps/stats', async (req, res) => {
  try {
    const stats = await rpsService.getStats(req.params.agentId, sql);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/api/rps/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const games = await rpsService.getRecentGames(limit, sql);
    res.json(games);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch recent games' });
  }
});

export default router;
