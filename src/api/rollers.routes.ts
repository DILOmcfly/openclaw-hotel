import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as rollerService from '../services/rollers.js';

const router = express.Router();

/**
 * POST /api/rooms/:roomId/rollers
 * Place a roller (room owner only)
 */
router.post('/api/rooms/:roomId/rollers', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { x, y, direction, speed } = req.body;

    // Validate required fields
    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({ error: 'x and y coordinates are required' });
    }

    if (!direction || !['north', 'south', 'east', 'west'].includes(direction)) {
      return res.status(400).json({ error: 'Valid direction is required (north, south, east, west)' });
    }

    const rollerSpeed = typeof speed === 'number' ? speed : 1;
    if (rollerSpeed < 1 || rollerSpeed > 3) {
      return res.status(400).json({ error: 'Speed must be between 1 and 3' });
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
      return res.status(403).json({ error: 'Only room owner can place rollers' });
    }

    const roller = await rollerService.placeRoller(
      roomId,
      x,
      y,
      direction,
      rollerSpeed,
      agentId,
      sql
    );

    res.status(201).json({ roller });
  } catch (error) {
    console.error('[Roller API] Error placing roller:', error);
    res.status(500).json({ error: 'Failed to place roller' });
  }
});

/**
 * GET /api/rooms/:roomId/rollers
 * List all rollers in a room
 */
router.get('/api/rooms/:roomId/rollers', async (req, res) => {
  try {
    const { roomId } = req.params;

    const rollers = await rollerService.getRollersInRoom(roomId, sql);

    res.json({ rollers });
  } catch (error) {
    console.error('[Roller API] Error listing rollers:', error);
    res.status(500).json({ error: 'Failed to list rollers' });
  }
});

/**
 * DELETE /api/rollers/:id
 * Remove a roller (creator or room owner)
 */
router.delete('/api/rollers/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await rollerService.removeRoller(id, agentId, sql);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove roller';
    console.error('[Roller API] Error removing roller:', error);
    
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    if (message.includes('Only the creator')) {
      return res.status(403).json({ error: message });
    }
    
    res.status(500).json({ error: message });
  }
});

export default router;
