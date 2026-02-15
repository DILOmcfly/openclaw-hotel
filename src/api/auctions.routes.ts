/**
 * Auctions API Routes
 */

import { Router } from 'express';
import {
  createAuction,
  placeBid,
  getActiveAuctions,
  getAuctionById,
  endAuction,
  cancelAuction,
  getMyAuctions,
} from '../services/auctions.js';
import { validateToken } from '../middleware/auth.js';
import { sql } from '../db/index.js';

const router = Router();

/**
 * POST /api/auctions
 * Create a new auction (requires auth)
 */
router.post('/api/auctions', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { itemId, itemType, startingPrice, durationHours } = req.body;

    if (!itemId || !itemType || !startingPrice || !durationHours) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const auction = await createAuction(
      agentId,
      itemId,
      itemType,
      startingPrice,
      durationHours,
      sql
    );

    res.status(201).json({ auction });
  } catch (error: any) {
    console.error('[Auctions API] Error creating auction:', error);

    if (
      error.message.includes('Duration') ||
      error.message.includes('price') ||
      error.message.includes('not found') ||
      error.message.includes('not belong')
    ) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to create auction' });
  }
});

/**
 * GET /api/auctions
 * Get all active auctions
 */
router.get('/api/auctions', async (req, res) => {
  try {
    const auctions = await getActiveAuctions(sql);
    res.json({ auctions });
  } catch (error: any) {
    console.error('[Auctions API] Error fetching auctions:', error);
    res.status(500).json({ error: 'Failed to fetch auctions' });
  }
});

/**
 * GET /api/auctions/:id
 * Get auction details with bid history
 */
router.get('/api/auctions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Missing auction ID' });
      return;
    }

    const result = await getAuctionById(id, sql);

    if (!result) {
      res.status(404).json({ error: 'Auction not found' });
      return;
    }

    res.json(result);
  } catch (error: any) {
    console.error('[Auctions API] Error fetching auction:', error);
    res.status(500).json({ error: 'Failed to fetch auction' });
  }
});

/**
 * POST /api/auctions/:id/bid
 * Place a bid on an auction (requires auth)
 */
router.post('/api/auctions/:id/bid', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { amount } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Missing auction ID' });
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid bid amount' });
      return;
    }

    const bid = await placeBid(id, agentId, amount, sql);

    res.status(201).json({ bid });
  } catch (error: any) {
    console.error('[Auctions API] Error placing bid:', error);

    if (
      error.message.includes('not found') ||
      error.message.includes('not active') ||
      error.message.includes('ended') ||
      error.message.includes('own auction') ||
      error.message.includes('must be at least')
    ) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to place bid' });
  }
});

/**
 * DELETE /api/auctions/:id
 * Cancel an auction (requires auth, seller only, no bids)
 */
router.delete('/api/auctions/:id', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Missing auction ID' });
      return;
    }

    await cancelAuction(id, agentId, sql);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Auctions API] Error cancelling auction:', error);

    if (
      error.message.includes('not found') ||
      error.message.includes('Only seller') ||
      error.message.includes('not active') ||
      error.message.includes('with bids')
    ) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to cancel auction' });
  }
});

/**
 * GET /api/auctions/mine
 * Get auctions where agent is seller or bidder (requires auth)
 */
router.get('/api/auctions/mine', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const auctions = await getMyAuctions(agentId, sql);

    res.json({ auctions });
  } catch (error: any) {
    console.error('[Auctions API] Error fetching my auctions:', error);
    res.status(500).json({ error: 'Failed to fetch auctions' });
  }
});

export default router;
