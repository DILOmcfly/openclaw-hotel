import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import {
  sendCoins,
  sendFurniture,
  getReceivedGifts,
  getSentGifts,
} from '../services/gifts.js';

const router = express.Router();

/**
 * POST /api/gifts/coins
 * Send coins to another agent
 */
router.post('/api/gifts/coins', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let agentId: string;
  try {
    ({ agentId } = validateToken(token));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { receiverId, amount, message = '' } = req.body;

  if (!receiverId) {
    return res.status(400).json({ error: 'receiverId is required' });
  }

  if (!amount || typeof amount !== 'number') {
    return res.status(400).json({ error: 'amount is required and must be a number' });
  }

  try {
    const gift = await sendCoins(agentId, receiverId, amount, message, sql);
    res.status(201).json({ gift });
  } catch (error: any) {
    console.error('[Gifts API] Send coins error:', error);
    res.status(400).json({ error: error.message || 'Failed to send coins' });
  }
});

/**
 * POST /api/gifts/furniture
 * Send furniture item to another agent
 */
router.post('/api/gifts/furniture', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let agentId: string;
  try {
    ({ agentId } = validateToken(token));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { receiverId, itemId, message = '' } = req.body;

  if (!receiverId) {
    return res.status(400).json({ error: 'receiverId is required' });
  }

  if (!itemId) {
    return res.status(400).json({ error: 'itemId is required' });
  }

  try {
    const gift = await sendFurniture(agentId, receiverId, itemId, message, sql);
    res.status(201).json({ gift });
  } catch (error: any) {
    console.error('[Gifts API] Send furniture error:', error);
    res.status(400).json({ error: error.message || 'Failed to send furniture' });
  }
});

/**
 * GET /api/gifts/received
 * Get gifts received by the authenticated agent
 */
router.get('/api/gifts/received', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let agentId: string;
  try {
    ({ agentId } = validateToken(token));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const gifts = await getReceivedGifts(agentId, limit, sql);
    res.json({ gifts });
  } catch (error: any) {
    console.error('[Gifts API] Get received gifts error:', error);
    res.status(500).json({ error: 'Failed to get received gifts' });
  }
});

/**
 * GET /api/gifts/sent
 * Get gifts sent by the authenticated agent
 */
router.get('/api/gifts/sent', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let agentId: string;
  try {
    ({ agentId } = validateToken(token));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const gifts = await getSentGifts(agentId, limit, sql);
    res.json({ gifts });
  } catch (error: any) {
    console.error('[Gifts API] Get sent gifts error:', error);
    res.status(500).json({ error: 'Failed to get sent gifts' });
  }
});

export default router;
