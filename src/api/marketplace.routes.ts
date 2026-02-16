import express, { Request, Response } from 'express';
import * as MarketplaceService from '../services/marketplace.js';
import { validateToken } from '../services/auth.js';

const router = express.Router();

/**
 * GET /api/marketplace
 * Get all active marketplace listings with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      status: (req.query.status as 'active' | 'sold' | 'cancelled') || 'active',
      item_type: req.query.item_type as string,
      min_price: req.query.min_price ? parseInt(req.query.min_price as string) : undefined,
      max_price: req.query.max_price ? parseInt(req.query.max_price as string) : undefined,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const listings = await MarketplaceService.getListings(filters);
    res.json({ listings });
  } catch (error: any) {
    console.error('[API] GET /marketplace error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch listings' });
  }
});

/**
 * GET /api/marketplace/stats
 * Get marketplace statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await MarketplaceService.getMarketplaceStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[API] GET /marketplace/stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  }
});

/**
 * GET /api/marketplace/my-listings
 * Get current agent's active listings
 */
router.get('/my-listings', validateToken, async (req: Request, res: Response) => {
  try {
    const agentId = req.agent?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const listings = await MarketplaceService.getMyListings(agentId);
    res.json({ listings });
  } catch (error: any) {
    console.error('[API] GET /marketplace/my-listings error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch listings' });
  }
});

/**
 * GET /api/marketplace/:id
 * Get a single listing by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await MarketplaceService.getListing(id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json(listing);
  } catch (error: any) {
    console.error('[API] GET /marketplace/:id error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch listing' });
  }
});

/**
 * POST /api/marketplace/list
 * Create a new marketplace listing
 */
router.post('/list', validateToken, async (req: Request, res: Response) => {
  try {
    const agentId = req.agent?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { item_id, price } = req.body;

    if (!item_id || !price) {
      return res.status(400).json({ error: 'Missing required fields: item_id, price' });
    }

    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    const listing = await MarketplaceService.createListing(item_id, agentId, priceNum);

    if (!listing) {
      return res.status(400).json({ error: 'Failed to create listing' });
    }

    res.status(201).json(listing);
  } catch (error: any) {
    console.error('[API] POST /marketplace/list error:', error);
    res.status(400).json({ error: error.message || 'Failed to create listing' });
  }
});

/**
 * POST /api/marketplace/:id/buy
 * Buy a marketplace listing
 */
router.post('/:id/buy', validateToken, async (req: Request, res: Response) => {
  try {
    const agentId = req.agent?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;
    const result = await MarketplaceService.buyListing(id as string, agentId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: 'Purchase successful' });
  } catch (error: any) {
    console.error('[API] POST /marketplace/:id/buy error:', error);
    res.status(500).json({ error: error.message || 'Purchase failed' });
  }
});

/**
 * DELETE /api/marketplace/:id
 * Cancel a marketplace listing (seller only)
 */
router.delete('/:id', validateToken, async (req: Request, res: Response) => {
  try {
    const agentId = req.agent?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;
    const result = await MarketplaceService.cancelListing(id as string, agentId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: 'Listing cancelled' });
  } catch (error: any) {
    console.error('[API] DELETE /marketplace/:id error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel listing' });
  }
});

export default router;
