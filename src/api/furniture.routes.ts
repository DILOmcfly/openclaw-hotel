import express from 'express';
import { sql } from '../db/index.js';
import { CATALOG } from '../data/furniture-catalog.js';
import { validateToken } from '../services/auth.js';

const router = express.Router();

/**
 * GET /api/furniture/catalog
 * Returns the full furniture catalog with prices
 */
router.get('/api/furniture/catalog', (_req, res) => {
  const catalogWithPrices = Object.entries(CATALOG).map(([itemDefId, def]) => ({
    itemDefId,
    ...def,
    price: calculatePrice(def), // Simple pricing based on size/features
  }));

  res.json({ items: catalogWithPrices });
});

/**
 * GET /api/furniture/inventory
 * Returns authenticated user's furniture inventory
 */
router.get('/api/furniture/inventory', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);

    const inventory = await sql`
      SELECT item_def_id AS "itemDefId", quantity
      FROM user_inventory
      WHERE agent_id = ${agentId}
      ORDER BY acquired_at DESC
    `;

    // Enrich with catalog data
    const enrichedInventory = inventory.map((item: any) => ({
      itemDefId: item.itemDefId,
      quantity: item.quantity,
      definition: CATALOG[item.itemDefId],
    }));

    res.json({ items: enrichedInventory });
  } catch (error) {
    console.error('[Furniture API] Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

/**
 * POST /api/furniture/purchase
 * Purchase furniture item (for now, just adds to inventory - no currency system yet)
 */
router.post('/api/furniture/purchase', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { itemDefId, quantity = 1 } = req.body;

    if (!itemDefId || !CATALOG[itemDefId]) {
      return res.status(400).json({ error: 'Invalid itemDefId' });
    }

    if (quantity < 1 || quantity > 100) {
      return res.status(400).json({ error: 'Invalid quantity (1-100)' });
    }

    // For now, just add to inventory (no currency check)
    // In future: check agent's currency balance and deduct
    await sql`
      INSERT INTO user_inventory (agent_id, item_def_id, quantity)
      VALUES (${agentId}, ${itemDefId}, ${quantity})
      ON CONFLICT (agent_id, item_def_id)
      DO UPDATE SET quantity = user_inventory.quantity + EXCLUDED.quantity
    `;

    const updated = await sql`
      SELECT item_def_id AS "itemDefId", quantity
      FROM user_inventory
      WHERE agent_id = ${agentId} AND item_def_id = ${itemDefId}
    `;

    res.json({
      success: true,
      item: {
        itemDefId: updated[0].itemDefId,
        quantity: updated[0].quantity,
        definition: CATALOG[itemDefId],
      },
    });
  } catch (error) {
    console.error('[Furniture API] Error purchasing item:', error);
    res.status(500).json({ error: 'Failed to purchase item' });
  }
});

/**
 * Simple pricing algorithm based on furniture properties
 */
function calculatePrice(def: any): number {
  const basePrice = 100;
  const sizeMultiplier = (def.width * def.depth * def.height) / 2;
  const featureBonus = (def.canSit ? 50 : 0) + (def.walkable ? 0 : 20);
  
  return Math.round(basePrice + sizeMultiplier * 10 + featureBonus);
}

export default router;
