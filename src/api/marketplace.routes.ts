/**
 * Marketplace API Routes
 */

import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import {
  createListing,
  buyListing,
  cancelListing,
  getListings,
  getMyListings,
  getListingById,
} from '../services/marketplace.js';

const router = express.Router();

/**
 * POST /api/marketplace/list
 * Create a new marketplace listing
 */
router.post('/api/marketplace/list', async (req, res) => {
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

  const { itemId, itemType, price } = req.body;

  if (!itemId || !itemType || price === undefined) {
    return res.status(400).json({ error: 'Missing required fields: itemId, itemType, price' });
  }

  const priceNum = Number(price);
  if (isNaN(priceNum) || priceNum <= 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }

  try {
    const listing = await createListing(itemId, agentId, itemType, priceNum, sql);
    res.status(201).json({ listing });
  } catch (error: any) {
    console.error('[Marketplace API] Create listing error:', error);
    res.status(400).json({ error: error.message || 'Failed to create listing' });
  }
});

/**
 * GET /api/marketplace
 * Browse marketplace listings
 */
router.get('/api/marketplace', async (req, res) => {
  try {
    const filters = {
      status: req.query.status as 'active' | 'sold' | 'cancelled' | undefined,
      itemType: req.query.itemType as string | undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      search: req.query.search as string | undefined,
    };

    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const listings = await getListings(filters, page, limit, sql);
    res.json({ listings });
  } catch (error: any) {
    console.error('[Marketplace API] Get listings error:', error);
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

/**
 * GET /api/marketplace/mine
 * Get current user's listings
 */
router.get('/api/marketplace/mine', async (req, res) => {
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
    const listings = await getMyListings(agentId, sql);
    res.json({ listings });
  } catch (error: any) {
    console.error('[Marketplace API] Get my listings error:', error);
    res.status(500).json({ error: 'Failed to get your listings' });
  }
});

/**
 * POST /api/marketplace/:id/buy
 * Buy a marketplace listing
 */
router.post('/api/marketplace/:id/buy', async (req, res) => {
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
    await buyListing(id, agentId, sql);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Marketplace API] Buy listing error:', error);
    res.status(400).json({ error: error.message || 'Failed to buy listing' });
  }
});

/**
 * DELETE /api/marketplace/:id
 * Cancel a marketplace listing (seller only)
 */
router.delete('/api/marketplace/:id', async (req, res) => {
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
    await cancelListing(id, agentId, sql);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Marketplace API] Cancel listing error:', error);
    res.status(400).json({ error: error.message || 'Failed to cancel listing' });
  }
});

export default router;
