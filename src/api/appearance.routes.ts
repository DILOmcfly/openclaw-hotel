import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as appearanceService from '../services/appearance.js';
import { broadcastToRoom, roomMembers } from '../ws/handler.js';

const router = express.Router();

/**
 * GET /api/appearance/me
 * Get authenticated user's appearance
 */
router.get('/api/appearance/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const appearance = await appearanceService.getAppearance(agentId, sql);

    res.json(appearance);
  } catch (error) {
    console.error('[Appearance API] Error fetching own appearance:', error);
    res.status(500).json({ error: 'Failed to fetch appearance' });
  }
});

/**
 * GET /api/appearance/:agentId
 * Get any agent's appearance (public info)
 */
router.get('/api/appearance/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const appearance = await appearanceService.getAppearance(agentId, sql);

    res.json(appearance);
  } catch (error) {
    console.error('[Appearance API] Error fetching appearance:', error);
    res.status(500).json({ error: 'Failed to fetch appearance' });
  }
});

/**
 * PUT /api/appearance
 * Update authenticated user's appearance
 */
router.put('/api/appearance', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { skinColor, outfit, accessory } = req.body;

    const appearance = await appearanceService.updateAppearance(
      agentId,
      { skinColor, outfit, accessory },
      sql
    );

    // Broadcast appearance change to all rooms where agent is present
    for (const [roomId, members] of roomMembers.entries()) {
      if (members.has(agentId)) {
        broadcastToRoom(roomId, {
          type: 'agent.appearance',
          agentId,
          appearance: {
            skinColor: appearance.skinColor,
            outfit: appearance.outfit,
            accessory: appearance.accessory,
          },
        });
      }
    }

    res.json({
      success: true,
      appearance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update appearance';
    console.error('[Appearance API] Error updating appearance:', error);
    res.status(400).json({ error: message });
  }
});

export default router;
