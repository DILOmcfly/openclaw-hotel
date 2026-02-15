import { Router } from 'express';
import { validateToken } from '../services/auth.js';
import { sql } from '../db/index.js';
import * as floorService from '../services/floorPatterns.js';

const router = Router();

/**
 * Check if the agent is the room owner
 */
async function checkRoomOwnership(roomId: string, agentId: string): Promise<boolean> {
  const room = await sql`SELECT id, created_by FROM rooms WHERE id = ${roomId}::uuid`;
  if (room.length === 0) throw new Error('Room not found');
  return room[0].created_by === agentId;
}

/**
 * GET /api/rooms/:roomId/floor
 * Get all floor tiles for a room (public)
 */
router.get('/api/rooms/:roomId/floor', async (req, res) => {
  try {
    const { roomId } = req.params;
    const tiles = await floorService.getRoomFloor(roomId, sql);
    res.json({ tiles });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch floor tiles';
    console.error('[Floor Patterns API] Error fetching floor:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/rooms/:roomId/floor/tile
 * Set a single floor tile (owner only)
 */
router.put('/api/rooms/:roomId/floor/tile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { x, y, pattern, color, secondaryColor } = req.body;

    // Validate required fields
    if (x === undefined || y === undefined || !pattern || !color || !secondaryColor) {
      return res.status(400).json({ 
        error: 'Missing required fields: x, y, pattern, color, secondaryColor' 
      });
    }

    // Check ownership
    const isOwner = await checkRoomOwnership(roomId, agentId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only the room owner can paint floor tiles' });
    }

    const tile = await floorService.setTile(
      roomId,
      parseInt(x),
      parseInt(y),
      pattern,
      color,
      secondaryColor,
      sql
    );

    res.json({ success: true, tile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set floor tile';
    console.error('[Floor Patterns API] Error setting tile:', error);
    res.status(400).json({ error: message });
  }
});

/**
 * PUT /api/rooms/:roomId/floor/area
 * Fill a rectangular area with a pattern (owner only)
 */
router.put('/api/rooms/:roomId/floor/area', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { x1, y1, x2, y2, pattern, color, secondaryColor } = req.body;

    // Validate required fields
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined || 
        !pattern || !color || !secondaryColor) {
      return res.status(400).json({ 
        error: 'Missing required fields: x1, y1, x2, y2, pattern, color, secondaryColor' 
      });
    }

    // Check ownership
    const isOwner = await checkRoomOwnership(roomId, agentId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only the room owner can paint floor tiles' });
    }

    const count = await floorService.setArea(
      roomId,
      parseInt(x1),
      parseInt(y1),
      parseInt(x2),
      parseInt(y2),
      pattern,
      color,
      secondaryColor,
      sql
    );

    res.json({ success: true, tilesSet: count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set floor area';
    console.error('[Floor Patterns API] Error setting area:', error);
    res.status(400).json({ error: message });
  }
});

/**
 * DELETE /api/rooms/:roomId/floor/tile
 * Clear a single floor tile (owner only)
 */
router.delete('/api/rooms/:roomId/floor/tile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { x, y } = req.query;

    // Validate required fields
    if (x === undefined || y === undefined) {
      return res.status(400).json({ error: 'Missing required query params: x, y' });
    }

    // Check ownership
    const isOwner = await checkRoomOwnership(roomId, agentId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only the room owner can clear floor tiles' });
    }

    await floorService.clearTile(roomId, parseInt(x as string), parseInt(y as string), sql);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear floor tile';
    console.error('[Floor Patterns API] Error clearing tile:', error);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/rooms/:roomId/floor
 * Clear all floor tiles for a room (owner only)
 */
router.delete('/api/rooms/:roomId/floor', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;

    // Check ownership
    const isOwner = await checkRoomOwnership(roomId, agentId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only the room owner can clear floor tiles' });
    }

    const count = await floorService.clearRoom(roomId, sql);

    res.json({ success: true, tilesCleared: count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear room floor';
    console.error('[Floor Patterns API] Error clearing room floor:', error);
    res.status(500).json({ error: message });
  }
});

export default router;
