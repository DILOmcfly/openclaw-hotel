/**
 * Inventory API Routes
 */

import { Router } from 'express';
import { getInventory, sellItem, getInventoryCount } from '../services/inventory.js';
import { validateToken } from '../middleware/auth.js';
import { sql } from '../db/index.js';

const router = Router();

/**
 * GET /api/inventory
 * Get agent's inventory with optional filters
 */
router.get('/', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const filter = {
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
      inRoom: req.query.inRoom === 'true' ? true : req.query.inRoom === 'false' ? false : undefined,
    };

    const items = await getInventory(agentId, filter, sql);

    res.json({ items });
  } catch (error: any) {
    console.error('[Inventory API] Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

/**
 * GET /api/inventory/count
 * Get count of items in inventory
 */
router.get('/count', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const inRoom = req.query.inRoom === 'true' ? true : req.query.inRoom === 'false' ? false : null;

    const count = await getInventoryCount(agentId, inRoom, sql);

    res.json({ count });
  } catch (error: any) {
    console.error('[Inventory API] Error counting inventory:', error);
    res.status(500).json({ error: 'Failed to count inventory' });
  }
});

/**
 * POST /api/inventory/sell/:itemId
 * Sell an item for 50% refund
 */
router.post('/sell/:itemId', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { itemId } = req.params;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!itemId) {
      res.status(400).json({ error: 'Missing itemId' });
      return;
    }

    const result = await sellItem(agentId, itemId, sql);

    res.json(result);
  } catch (error: any) {
    console.error('[Inventory API] Error selling item:', error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.message.includes('Unauthorized') || error.message.includes('placed in a room')) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to sell item' });
  }
});

export default router;
