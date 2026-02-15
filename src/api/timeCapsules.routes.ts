import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as timeCapsules from '../services/timeCapsules.js';

const router = express.Router();

router.post('/api/time-capsules', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const { message, opensAt, title, roomId, items } = req.body;
    if (!message || !opensAt) return res.status(400).json({ error: 'Message and opensAt are required' });
    const capsule = await timeCapsules.createCapsule(agentId, message, new Date(opensAt), sql, title, roomId, items);
    res.json({ success: true, capsule });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/api/time-capsules/:id/open', async (req, res) => {
  try {
    const capsule = await timeCapsules.openCapsule(parseInt(req.params.id), sql);
    res.json({ success: true, capsule });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/api/time-capsules/:id', async (req, res) => {
  try {
    const capsule = await timeCapsules.getCapsule(parseInt(req.params.id), sql);
    if (!capsule) return res.status(404).json({ error: 'Capsule not found' });
    res.json({ capsule });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/agents/:agentId/time-capsules', async (req, res) => {
  try {
    const capsules = await timeCapsules.getAgentCapsules(req.params.agentId, sql);
    res.json({ capsules });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/rooms/:roomId/time-capsules', async (req, res) => {
  try {
    const capsules = await timeCapsules.getRoomCapsules(parseInt(req.params.roomId), sql);
    res.json({ capsules });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/time-capsules/upcoming', async (req, res) => {
  try {
    const capsules = await timeCapsules.getUpcoming(sql);
    res.json({ capsules });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/time-capsules/stats', async (req, res) => {
  try {
    const stats = await timeCapsules.getCapsuleStats(sql);
    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
