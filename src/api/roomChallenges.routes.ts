import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as cs from '../services/roomChallenges.js';

const router = express.Router();

router.post('/api/rooms/:roomId/challenges', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const challenge = await cs.createChallenge(parseInt(req.params.roomId), agentId, req.body, sql);
    res.json({ success: true, challenge });
  } catch (error) { res.status(500).json({ error: 'Failed to create challenge' }); }
});

router.post('/api/challenges/:id/start', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    validateToken(token);
    const challenge = await cs.startChallenge(parseInt(req.params.id), sql);
    res.json({ success: true, challenge });
  } catch (error) { res.status(400).json({ error: (error as Error).message }); }
});

router.post('/api/challenges/:id/join', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const participant = await cs.joinChallenge(parseInt(req.params.id), agentId, sql);
    res.json({ success: true, participant });
  } catch (error) { res.status(400).json({ error: (error as Error).message }); }
});

router.put('/api/challenges/:id/progress', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const participant = await cs.updateProgress(parseInt(req.params.id), agentId, req.body.increment || 1, sql);
    res.json({ success: true, participant });
  } catch (error) { res.status(400).json({ error: (error as Error).message }); }
});

router.get('/api/challenges/:id', async (req, res) => {
  try {
    const challenge = await cs.getChallenge(parseInt(req.params.id), sql);
    res.json({ challenge });
  } catch (error) { res.status(404).json({ error: 'Challenge not found' }); }
});

router.get('/api/challenges/:id/leaderboard', async (req, res) => {
  try {
    const leaderboard = await cs.getLeaderboard(parseInt(req.params.id), sql);
    res.json({ leaderboard });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch leaderboard' }); }
});

router.post('/api/challenges/:id/end', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    validateToken(token);
    const result = await cs.endChallenge(parseInt(req.params.id), sql);
    res.json({ success: true, winnersCount: result.winnersCount });
  } catch (error) { res.status(400).json({ error: (error as Error).message }); }
});

router.get('/api/rooms/:roomId/challenges/history', async (req, res) => {
  try {
    const challenges = await cs.getChallengeHistory(parseInt(req.params.roomId), sql);
    res.json({ challenges });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch challenge history' }); }
});

export default router;
