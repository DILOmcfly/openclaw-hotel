import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as teleportService from '../services/teleport.js';

const router = express.Router();

/**
 * POST /api/rooms/:roomId/teleports
 * Create a teleport tile (room owner only)
 */
router.post('/api/rooms/:roomId/teleports', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { x, y, targetRoomId, targetX, targetY, label } = req.body;

    // Validate required fields
    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({ error: 'x and y coordinates are required' });
    }

    // Check if agent owns the room
    const [room] = await sql<{ ownerId: string }[]>`
      SELECT owner_id AS "ownerId"
      FROM rooms
      WHERE id = ${roomId}
    `;

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.ownerId !== agentId) {
      return res.status(403).json({ error: 'Only room owner can create teleports' });
    }

    const teleport = await teleportService.createTeleport(
      roomId,
      x,
      y,
      targetRoomId || null,
      targetX ?? null,
      targetY ?? null,
      label || '',
      agentId,
      sql
    );

    res.status(201).json({ teleport });
  } catch (error) {
    console.error('[Teleport API] Error creating teleport:', error);
    res.status(500).json({ error: 'Failed to create teleport' });
  }
});

/**
 * GET /api/rooms/:roomId/teleports
 * List all teleports in a room
 */
router.get('/api/rooms/:roomId/teleports', async (req, res) => {
  try {
    const { roomId } = req.params;

    const teleports = await teleportService.getTeleportsInRoom(roomId, sql);

    res.json({ teleports });
  } catch (error) {
    console.error('[Teleport API] Error listing teleports:', error);
    res.status(500).json({ error: 'Failed to list teleports' });
  }
});

/**
 * DELETE /api/teleports/:id
 * Remove a teleport (creator or admin only)
 */
router.delete('/api/teleports/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await teleportService.removeTeleport(id, agentId, sql);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove teleport';
    console.error('[Teleport API] Error removing teleport:', error);
    
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    if (message.includes('Only the creator')) {
      return res.status(403).json({ error: message });
    }
    
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/teleports/:id/use
 * Use a teleport (returns destination)
 */
router.post('/api/teleports/:id/use', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    const destination = await teleportService.useTeleport(id, agentId, sql);

    res.json({ destination });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to use teleport';
    console.error('[Teleport API] Error using teleport:', error);
    
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    
    res.status(500).json({ error: message });
  }
});

export default router;
