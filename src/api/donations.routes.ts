import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as donationsService from '../services/donations.js';

const router = express.Router();
const auth = (req: express.Request) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  return validateToken(token);
};

router.post('/api/rooms/:roomId/donation-box', async (req, res) => {
  try {
    const { agentId } = auth(req);
    res.json(await donationsService.createBox(parseInt(req.params.roomId), agentId, req.body.name, req.body.goal || 0, req.body.message || null, sql));
  } catch (error) {
    res.status(error instanceof Error && error.message === 'Unauthorized' ? 401 : 500).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.post('/api/donation-boxes/:id/donate', async (req, res) => {
  try {
    const { agentId } = auth(req);
    res.json(await donationsService.donate(parseInt(req.params.id), agentId, req.body.amount, req.body.message || null, sql));
  } catch (error) {
    res.status(error instanceof Error && error.message === 'Unauthorized' ? 401 : 400).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.get('/api/donation-boxes/:id', async (req, res) => {
  try {
    const box = await donationsService.getBox(parseInt(req.params.id), sql);
    if (!box) return res.status(404).json({ error: 'Box not found' });
    res.json(box);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch box' });
  }
});

router.get('/api/donation-boxes/:id/top-donors', async (req, res) => {
  try {
    res.json(await donationsService.getTopDonors(parseInt(req.params.id), 10, sql));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch donors' });
  }
});

router.get('/api/rooms/:roomId/donation-boxes', async (req, res) => {
  try {
    res.json(await donationsService.getRoomBoxes(parseInt(req.params.roomId), sql));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch boxes' });
  }
});

router.post('/api/donation-boxes/:id/close', async (req, res) => {
  try {
    await donationsService.closeBox(parseInt(req.params.id), auth(req).agentId, sql);
    res.json({ success: true });
  } catch (error) {
    res.status(error instanceof Error && error.message === 'Unauthorized' ? 401 : 400).json({ error: error instanceof Error ? error.message : 'Failed' });
  }
});

router.get('/api/agents/:agentId/donations', async (req, res) => {
  try { res.json(await donationsService.getAgentDonations(req.params.agentId, sql)); }
  catch (error) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/api/donations/stats', async (req, res) => {
  try { res.json(await donationsService.getGlobalStats(sql)); }
  catch (error) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
