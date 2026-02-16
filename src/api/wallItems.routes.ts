// @ts-nocheck - TODO: fix type errors
/**
 * Wall Items API Routes
 */

import { Router } from 'express';
import { placeItem, removeItem, getWallItems, moveItem, updateContent } from '../services/wallItems.js';
import { validateToken } from '../middleware/auth.js';
import { sql } from '../db/index.js';

const router = Router();

// POST /api/rooms/:roomId/walls - Place an item on a wall
router.post('/api/rooms/:roomId/walls', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    if (!agentId) return res.status(401).json({ error: 'Unauthorized' });

    const { wall, positionX, positionY, itemType, content } = req.body;
    if (!wall || positionX === undefined || positionY === undefined || !itemType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const item = await placeItem(req.params.roomId, wall, positionX, positionY, itemType, content || '', agentId, sql);
    res.status(201).json({ item });
  } catch (error: any) {
    const status = error.message.includes('Invalid') || error.message.includes('Position') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to place wall item' });
  }
});

// GET /api/rooms/:roomId/walls - List wall items
router.get('/api/rooms/:roomId/walls', async (req, res) => {
  try {
    const items = await getWallItems(req.params.roomId, req.query.wall as string | undefined, sql);
    res.json({ items });
  } catch (error: any) {
    const status = error.message.includes('Invalid') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to fetch wall items' });
  }
});

// DELETE /api/walls/:id - Remove a wall item
router.delete('/api/walls/:id', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    if (!agentId) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.params.id) return res.status(400).json({ error: 'Missing wall item ID' });

    await removeItem(req.params.id, agentId, sql);
    res.json({ success: true });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('Unauthorized') ? 403 : 500;
    res.status(status).json({ error: error.message || 'Failed to remove wall item' });
  }
});

// PUT /api/walls/:id/move - Move a wall item
router.put('/api/walls/:id/move', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    if (!agentId) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.params.id) return res.status(400).json({ error: 'Missing wall item ID' });

    const { positionX, positionY } = req.body;
    if (positionX === undefined || positionY === undefined) {
      return res.status(400).json({ error: 'Missing positionX or positionY' });
    }

    const item = await moveItem(req.params.id, positionX, positionY, agentId, sql);
    res.json({ item });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 
                   error.message.includes('Unauthorized') ? 403 : 
                   error.message.includes('Position') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to move wall item' });
  }
});

// PUT /api/walls/:id/content - Update wall item content
router.put('/api/walls/:id/content', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    if (!agentId) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.params.id) return res.status(400).json({ error: 'Missing wall item ID' });
    if (req.body.content === undefined) return res.status(400).json({ error: 'Missing content' });

    const item = await updateContent(req.params.id, req.body.content, agentId, sql);
    res.json({ item });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('Unauthorized') ? 403 : 500;
    res.status(status).json({ error: error.message || 'Failed to update wall item content' });
  }
});

export default router;
