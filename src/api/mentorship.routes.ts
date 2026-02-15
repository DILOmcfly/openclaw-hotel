import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as svc from '../services/mentorship.js';

const router = express.Router();

router.post('/api/mentorship/start', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    if (!req.body.menteeId) return res.status(400).json({ error: 'menteeId is required' });
    res.json({ success: true, mentorship: await svc.startMentorship(agentId, req.body.menteeId, sql) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to start mentorship' });
  }
});

router.post('/api/mentorship/:id/complete', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    validateToken(token);
    const { rating, feedback } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid rating (1-5) is required' });
    }
    const mentorship = await svc.completeMentorship(parseInt(req.params.id), rating, feedback || null, sql);
    res.json({ success: true, mentorship });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to complete mentorship' });
  }
});

router.delete('/api/mentorship/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    validateToken(token);
    res.json({ success: true, mentorship: await svc.cancelMentorship(parseInt(req.params.id), sql) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to cancel mentorship' });
  }
});

router.get('/api/agents/:agentId/mentorships', async (req, res) => {
  try {
    res.json({ mentorships: await svc.getActiveMentorships(req.params.agentId, sql) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch mentorships' });
  }
});

router.get('/api/agents/:agentId/mentor-stats', async (req, res) => {
  try {
    res.json({ stats: await svc.getMentorStats(req.params.agentId, sql) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch mentor stats' });
  }
});

router.get('/api/mentors/top', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    res.json({ mentors: await svc.getTopMentors(limit, sql) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top mentors' });
  }
});

router.get('/api/mentors/available', async (req, res) => {
  try {
    res.json({ mentors: await svc.findMentor(sql) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to find mentors' });
  }
});

export default router;
