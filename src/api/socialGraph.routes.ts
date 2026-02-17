/**
 * Social Graph API — T-349
 * Public endpoint (no auth required) for spectator overlay.
 */

import express from 'express';
import { sql } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { getRoomSocialGraph } from '../services/socialGraph.js';

const router = express.Router();

/**
 * GET /api/spectate/social-graph/:roomId
 *
 * Returns the social graph for agents currently in a room.
 * Public — no authentication required.
 *
 * Response: { roomId, nodes, edges, generatedAt }
 */
router.get('/api/spectate/social-graph/:roomId', async (req, res) => {
  const { roomId } = req.params;

  // Basic UUID format validation
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(roomId)) {
    return res.status(400).json({ error: 'Invalid roomId format' });
  }

  try {
    const graph = await getRoomSocialGraph(roomId, sql);

    // Cache-Control: short TTL — data changes as agents enter/leave
    res.set('Cache-Control', 'public, max-age=15');
    res.json(graph);
  } catch (error: any) {
    logger.error('[SocialGraph] Failed to build social graph', {
      roomId,
      error: error.message,
    });
    res.status(500).json({ error: 'Failed to retrieve social graph' });
  }
});

export default router;
