import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as minimapService from '../services/minimap.js';

const router = express.Router();

/**
 * GET /api/rooms/:roomId/minimap
 * Get complete map data for a room
 */
router.get('/api/rooms/:roomId/minimap', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const mapData = await minimapService.generateMapData(roomId, sql);
    res.json({ success: true, mapData });
  } catch (error) {
    console.error('[Minimap API] Error generating map data:', error);
    res.status(500).json({ error: 'Failed to generate map data' });
  }
});

/**
 * GET /api/rooms/:roomId/minimap/settings
 * Get minimap settings for a room
 */
router.get('/api/rooms/:roomId/minimap/settings', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const settings = await minimapService.getSettings(roomId, sql);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('[Minimap API] Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PUT /api/rooms/:roomId/minimap/settings
 * Update minimap settings (room owner only)
 */
router.put('/api/rooms/:roomId/minimap/settings', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const roomId = parseInt(req.params.roomId);

    // Verify room ownership
    const [room] = await sql<{ created_by: string }[]>`
      SELECT created_by FROM rooms WHERE id = ${roomId}
    `;

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.created_by !== agentId) {
      return res.status(403).json({ error: 'Only room owner can update minimap settings' });
    }

    const { enabled, showFurniture, showAgents, zoomLevel } = req.body;
    const settings = await minimapService.updateSettings(
      roomId,
      { enabled, showFurniture, showAgents, zoomLevel },
      sql
    );

    res.json({ success: true, settings });
  } catch (error) {
    console.error('[Minimap API] Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/rooms/:roomId/minimap/agents
 * Get live agent positions in a room
 */
router.get('/api/rooms/:roomId/minimap/agents', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const agents = await minimapService.getAgentPositions(roomId, sql);
    res.json({ success: true, agents });
  } catch (error) {
    console.error('[Minimap API] Error fetching agent positions:', error);
    res.status(500).json({ error: 'Failed to fetch agent positions' });
  }
});

export default router;
