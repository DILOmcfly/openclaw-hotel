import { Router } from 'express';
import {
  getAgentTimeline,
  getRoomTimeline,
  getGlobalFeed,
  getActivityStats,
} from '../services/activityLog.js';
import { sql } from '../db/index.js';

const router = Router();

/**
 * GET /api/activity/me
 * Get authenticated agent's timeline
 */
router.get('/api/activity/me', async (req, res) => {
  const agentId = (req as any).agentId;

  if (!agentId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;

    const timeline = await getAgentTimeline(agentId, limit, offset, sql);
    res.status(200).json(timeline);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch timeline';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/activity/room/:roomId
 * Get room activity timeline
 */
router.get('/api/activity/room/:roomId', async (req, res) => {
  const { roomId } = req.params;

  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const timeline = await getRoomTimeline(roomId, limit, sql);
    res.status(200).json(timeline);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch room timeline';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/activity/feed
 * Get global activity feed
 */
router.get('/api/activity/feed', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const feed = await getGlobalFeed(limit, sql);
    res.status(200).json(feed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch activity feed';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/activity/stats/:agentId
 * Get activity statistics for an agent
 */
router.get('/api/activity/stats/:agentId', async (req, res) => {
  const { agentId } = req.params;

  try {
    const stats = await getActivityStats(agentId, sql);
    res.status(200).json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch activity stats';
    res.status(500).json({ error: message });
  }
});

export default router;
