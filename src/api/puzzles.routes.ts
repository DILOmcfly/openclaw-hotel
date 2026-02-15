import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as puzzlesService from '../services/puzzles.js';

const router = express.Router();

router.post('/api/rooms/:roomId/puzzles', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const { title, puzzleType, answer, hint, maxAttempts = 10, rewardCoins = 50 } = req.body;
    const puzzle = await puzzlesService.createPuzzle(parseInt(req.params.roomId), agentId, title, puzzleType, answer, hint, maxAttempts, rewardCoins, sql);
    res.status(201).json({ success: true, puzzle });
  } catch (error) { res.status(500).json({ error: 'Failed to create puzzle' }); }
});

router.post('/api/puzzles/:id/guess', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const result = await puzzlesService.submitGuess(parseInt(req.params.id), agentId, req.body.guess, sql);
    res.json({ success: true, ...result });
  } catch (error) { res.status(500).json({ error: 'Failed to submit guess' }); }
});

router.get('/api/puzzles/:id/hint', async (req, res) => {
  try {
    const hint = await puzzlesService.getHint(parseInt(req.params.id), sql);
    if (!hint) return res.status(403).json({ error: 'Hint not available yet (need 3 failed attempts)' });
    res.json({ hint });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch hint' }); }
});

router.get('/api/puzzles/:id', async (req, res) => {
  try {
    const puzzle = await puzzlesService.getPuzzle(parseInt(req.params.id), sql);
    if (!puzzle) return res.status(404).json({ error: 'Puzzle not found' });
    res.json(puzzle);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch puzzle' }); }
});

router.get('/api/rooms/:roomId/puzzles', async (req, res) => {
  try {
    const puzzles = await puzzlesService.getRoomPuzzles(parseInt(req.params.roomId), sql);
    res.json({ puzzles });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch room puzzles' }); }
});

router.get('/api/agents/:agentId/puzzles/solved', async (req, res) => {
  try {
    const puzzles = await puzzlesService.getAgentSolvedPuzzles(req.params.agentId, sql);
    res.json({ puzzles });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch solved puzzles' }); }
});

router.get('/api/puzzles/stats', async (req, res) => {
  try {
    const stats = await puzzlesService.getPuzzleStats(sql);
    res.json(stats);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch stats' }); }
});

router.get('/api/puzzles/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const leaderboard = await puzzlesService.getLeaderboard(limit, sql);
    res.json({ leaderboard });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch leaderboard' }); }
});

export default router;
