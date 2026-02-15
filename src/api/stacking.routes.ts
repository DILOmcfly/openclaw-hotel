/**
 * Stacking API Routes - Furniture height/z-level management
 */

import { Router } from 'express';
import { sql } from '../db/index.js';
import {
  getStackHeight,
  getItemsAtPosition,
  placeOnTop,
  removeFromStack,
} from '../services/stacking.js';

const router = Router();

/**
 * GET /api/rooms/:roomId/stack/:x/:y
 * Get stack info at a specific position
 */
router.get('/api/rooms/:roomId/stack/:x/:y', async (req, res) => {
  try {
    const { roomId, x, y } = req.params;

    if (!roomId || x === undefined || y === undefined) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    const xNum = parseInt(x, 10);
    const yNum = parseInt(y, 10);

    if (isNaN(xNum) || isNaN(yNum)) {
      res.status(400).json({ error: 'Invalid coordinates' });
      return;
    }

    const [height, items] = await Promise.all([
      getStackHeight(roomId, xNum, yNum, sql),
      getItemsAtPosition(roomId, xNum, yNum, sql),
    ]);

    res.json({
      roomId,
      x: xNum,
      y: yNum,
      stackHeight: height,
      items,
    });
  } catch (error: any) {
    console.error('[Stacking API] Error getting stack info:', error);
    res.status(500).json({ error: 'Failed to get stack info' });
  }
});

/**
 * POST /api/rooms/:roomId/stack
 * Place an item on top of a stack
 * Body: { itemId, x, y }
 */
router.post('/api/rooms/:roomId/stack', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { itemId, x, y } = req.body;

    if (!roomId || !itemId || x === undefined || y === undefined) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      res.status(400).json({ error: 'Coordinates must be integers' });
      return;
    }

    const result = await placeOnTop(roomId, itemId, x, y, sql);

    res.json(result);
  } catch (error: any) {
    console.error('[Stacking API] Error placing item:', error);

    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.message.includes('Cannot stack')) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to place item' });
  }
});

/**
 * DELETE /api/rooms/:roomId/stack/:itemId
 * Remove an item from a stack
 */
router.delete('/api/rooms/:roomId/stack/:itemId', async (req, res) => {
  try {
    const { roomId, itemId } = req.params;

    if (!roomId || !itemId) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    const result = await removeFromStack(roomId, itemId, sql);

    res.json(result);
  } catch (error: any) {
    console.error('[Stacking API] Error removing item:', error);

    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to remove item' });
  }
});

export default router;
