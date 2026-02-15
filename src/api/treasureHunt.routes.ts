import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as treasureHunt from '../services/treasureHunt.js';

const router = express.Router();

router.post('/api/rooms/:roomId/hunts', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const { name, totalTreasures = 5, rewardPerFind = 20, bonusCompletion = 100 } = req.body;
    const hunt = await treasureHunt.createHunt(parseInt(req.params.roomId), agentId, name, totalTreasures, rewardPerFind, bonusCompletion, sql);
    res.json(hunt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create hunt' });
  }
});

router.post('/api/hunts/:huntId/join', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const participant = await treasureHunt.joinHunt(parseInt(req.params.huntId), agentId, sql);
    res.json(participant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to join hunt' });
  }
});

router.post('/api/hunts/:huntId/search', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const { x, y } = req.body;
    const result = await treasureHunt.searchTile(parseInt(req.params.huntId), agentId, x, y, sql);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search tile' });
  }
});

router.get('/api/hunts/:huntId/progress/:agentId', async (req, res) => {
  try {
    const progress = await treasureHunt.getHuntProgress(parseInt(req.params.huntId), req.params.agentId, sql);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

router.get('/api/hunts/:huntId/leaderboard', async (req, res) => {
  try {
    const leaderboard = await treasureHunt.getLeaderboard(parseInt(req.params.huntId), sql);
    res.json({ leaderboard });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.post('/api/hunts/:huntId/end', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const result = await treasureHunt.endHunt(parseInt(req.params.huntId), sql);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to end hunt' });
  }
});

router.get('/api/rooms/:roomId/hunts/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const history = await treasureHunt.getHuntHistory(parseInt(req.params.roomId), limit, sql);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
