import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as leaderboardsService from '../services/roomLeaderboards.js';

const router = express.Router();

/**
 * POST /api/rooms/:roomId/leaderboards
 * Create a new leaderboard (owner only)
 */
router.post('/api/rooms/:roomId/leaderboards', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const roomId = parseInt(req.params.roomId);
    const leaderboard = await leaderboardsService.createLeaderboard(roomId, agentId, req.body, sql);

    res.json({ success: true, leaderboard });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create leaderboard' });
  }
});

/**
 * POST /api/leaderboards/:id/score
 * Submit a score to a leaderboard
 */
router.post('/api/leaderboards/:id/score', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const leaderboardId = parseInt(req.params.id);
    const { score } = req.body;

    const result = await leaderboardsService.submitScore(leaderboardId, agentId, score, sql);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to submit score' });
  }
});

/**
 * GET /api/leaderboards/:id
 * Get leaderboard entries (ranked)
 */
router.get('/api/leaderboards/:id', async (req, res) => {
  try {
    const leaderboardId = parseInt(req.params.id);
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    const entries = await leaderboardsService.getLeaderboard(leaderboardId, limit, sql);
    res.json({ entries });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/leaderboards/:id/rank/:agentId
 * Get agent's rank on a leaderboard
 */
router.get('/api/leaderboards/:id/rank/:agentId', async (req, res) => {
  try {
    const leaderboardId = parseInt(req.params.id);
    const { agentId } = req.params;

    const rank = await leaderboardsService.getAgentRank(leaderboardId, agentId, sql);
    res.json({ rank: rank || null });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch rank' });
  }
});

/**
 * POST /api/leaderboards/:id/reset
 * Reset a leaderboard (owner only)
 */
router.post('/api/leaderboards/:id/reset', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const leaderboardId = parseInt(req.params.id);

    await leaderboardsService.resetLeaderboard(leaderboardId, agentId, sql);
    res.json({ success: true });
  } catch (error: any) {
    res.status(403).json({ error: error.message || 'Failed to reset leaderboard' });
  }
});

/**
 * DELETE /api/leaderboards/:id
 * Delete a leaderboard (owner only)
 */
router.delete('/api/leaderboards/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const leaderboardId = parseInt(req.params.id);

    await leaderboardsService.deleteLeaderboard(leaderboardId, agentId, sql);
    res.json({ success: true });
  } catch (error: any) {
    res.status(403).json({ error: error.message || 'Failed to delete leaderboard' });
  }
});

/**
 * GET /api/rooms/:roomId/leaderboards
 * Get all leaderboards for a room
 */
router.get('/api/rooms/:roomId/leaderboards', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const leaderboards = await leaderboardsService.getRoomLeaderboards(roomId, sql);

    res.json({ leaderboards });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch room leaderboards' });
  }
});

/**
 * GET /api/agents/:agentId/scores
 * Get all leaderboards where an agent has scores
 */
router.get('/api/agents/:agentId/scores', async (req, res) => {
  try {
    const { agentId } = req.params;
    const scores = await leaderboardsService.getAgentScores(agentId, sql);

    res.json({ scores });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch agent scores' });
  }
});

export default router;
