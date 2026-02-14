import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import {
  createTrade,
  getTrade,
  getTradeItems,
  updateTradeItems,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  getTradeHistory,
  validateSameRoom,
} from '../services/trading.js';

const router = express.Router();

/**
 * POST /api/trades
 * Create a new trade request
 */
router.post('/api/trades', async (req, res) => {
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

  const { targetAgentId } = req.body;
  if (!targetAgentId) {
    return res.status(400).json({ error: 'targetAgentId is required' });
  }

  try {
    // Validate both agents are in the same room
    const roomId = await validateSameRoom(agentId, targetAgentId, sql);
    if (!roomId) {
      return res.status(400).json({ error: 'Both agents must be in the same room' });
    }

    const trade = await createTrade(agentId, targetAgentId, sql);
    
    res.status(201).json({ trade });
  } catch (error: any) {
    console.error('[Trade API] Create error:', error);
    res.status(400).json({ error: error.message || 'Failed to create trade' });
  }
});

/**
 * GET /api/trades/:id
 * Get a specific trade with items
 */
router.get('/api/trades/:id', async (req, res) => {
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

  const { id } = req.params;

  try {
    const trade = await getTrade(id, sql);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Verify agent is part of this trade
    if (trade.initiatorId !== agentId && trade.targetId !== agentId) {
      return res.status(403).json({ error: 'Not authorized to view this trade' });
    }

    const items = await getTradeItems(id, sql);

    res.json({ trade, items });
  } catch (error: any) {
    console.error('[Trade API] Get error:', error);
    res.status(500).json({ error: 'Failed to get trade' });
  }
});

/**
 * PUT /api/trades/:id/items
 * Update items offered in a trade
 */
router.put('/api/trades/:id/items', async (req, res) => {
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

  const { id } = req.params;
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array is required' });
  }

  try {
    await updateTradeItems(id, agentId, items, sql);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Trade API] Update items error:', error);
    res.status(400).json({ error: error.message || 'Failed to update trade items' });
  }
});

/**
 * PUT /api/trades/:id/accept
 * Accept a trade
 */
router.put('/api/trades/:id/accept', async (req, res) => {
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

  const { id } = req.params;

  try {
    await acceptTrade(id, agentId, sql);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Trade API] Accept error:', error);
    res.status(400).json({ error: error.message || 'Failed to accept trade' });
  }
});

/**
 * PUT /api/trades/:id/reject
 * Reject a trade
 */
router.put('/api/trades/:id/reject', async (req, res) => {
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

  const { id } = req.params;

  try {
    await rejectTrade(id, agentId, sql);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Trade API] Reject error:', error);
    res.status(400).json({ error: error.message || 'Failed to reject trade' });
  }
});

/**
 * PUT /api/trades/:id/cancel
 * Cancel a trade
 */
router.put('/api/trades/:id/cancel', async (req, res) => {
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

  const { id } = req.params;

  try {
    await cancelTrade(id, agentId, sql);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Trade API] Cancel error:', error);
    res.status(400).json({ error: error.message || 'Failed to cancel trade' });
  }
});

/**
 * GET /api/trades/history
 * Get trade history for the authenticated agent
 */
router.get('/api/trades/history', async (req, res) => {
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

  try {
    const trades = await getTradeHistory(agentId, sql, 20);
    res.json({ trades });
  } catch (error: any) {
    console.error('[Trade API] History error:', error);
    res.status(500).json({ error: 'Failed to get trade history' });
  }
});

export default router;
