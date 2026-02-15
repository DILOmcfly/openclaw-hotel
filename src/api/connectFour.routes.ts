import express from 'express';
import { sql } from '../db/index.js';
import * as connectFourService from '../services/connectFour.js';

const router = express.Router();

router.post('/api/connect-four/new', async (req, res) => {
  try {
    const { player1Id } = req.body;
    if (!player1Id) return res.status(400).json({ error: 'player1Id is required' });
    const game = await connectFourService.createGame(player1Id, sql);
    res.json(game);
  } catch (error) {
    console.error('[Connect Four API] Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

router.post('/api/connect-four/:gameId/join', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { player2Id } = req.body;
    if (!player2Id) return res.status(400).json({ error: 'player2Id is required' });
    const game = await connectFourService.joinGame(gameId, player2Id, sql);
    res.json(game);
  } catch (error: any) {
    console.error('[Connect Four API] Error joining game:', error);
    res.status(400).json({ error: error.message || 'Failed to join game' });
  }
});

router.post('/api/connect-four/:gameId/drop', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { playerId, column } = req.body;
    if (!playerId || column === undefined) return res.status(400).json({ error: 'playerId and column are required' });
    const game = await connectFourService.dropPiece(gameId, playerId, column, sql);
    res.json(game);
  } catch (error: any) {
    console.error('[Connect Four API] Error dropping piece:', error);
    res.status(400).json({ error: error.message || 'Failed to drop piece' });
  }
});

router.post('/api/connect-four/:gameId/forfeit', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId is required' });
    const game = await connectFourService.forfeit(gameId, playerId, sql);
    res.json(game);
  } catch (error: any) {
    console.error('[Connect Four API] Error forfeiting game:', error);
    res.status(400).json({ error: error.message || 'Failed to forfeit game' });
  }
});

router.get('/api/connect-four/:gameId', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const game = await connectFourService.getGame(gameId, sql);
    res.json(game);
  } catch (error: any) {
    console.error('[Connect Four API] Error fetching game:', error);
    res.status(404).json({ error: error.message || 'Game not found' });
  }
});

router.get('/api/agents/:agentId/connect-four/stats', async (req, res) => {
  try {
    const { agentId } = req.params;
    const stats = await connectFourService.getStats(agentId, sql);
    res.json(stats);
  } catch (error) {
    console.error('[Connect Four API] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
