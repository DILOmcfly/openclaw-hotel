import express from 'express';
import { sql } from '../db/index.js';
import { requireRole } from '../middleware/admin.js';
import { logger } from '../utils/logger.js';
import { spawnBot, despawnBot, getBots } from '../services/botManager.js';

const router = express.Router();

/**
 * POST /api/admin/bots
 * Spawn a bot in a room (admin only)
 */
router.post('/api/admin/bots', requireRole('admin'), async (req, res) => {
  try {
    const { roomId, name, personality } = req.body;
    const adminId = (req as any).agentId;

    if (!roomId || !name || !personality) {
      return res.status(400).json({ error: 'Missing required fields: roomId, name, personality' });
    }

    if (!['greeter', 'guide', 'shopkeeper'].includes(personality)) {
      return res.status(400).json({ error: 'Invalid personality type' });
    }

    const bot = await spawnBot(roomId, { name, personality }, sql);

    logger.info('Bot spawned', { botId: bot.id, roomId, name, personality, adminId });
    res.json({ success: true, bot });
  } catch (error: any) {
    logger.error('Failed to spawn bot', { error });
    res.status(500).json({ error: error.message || 'Failed to spawn bot' });
  }
});

/**
 * DELETE /api/admin/bots/:id
 * Despawn a bot (admin only)
 */
router.delete('/api/admin/bots/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const adminId = (req as any).agentId;

    const success = await despawnBot(id, sql);

    if (!success) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    logger.info('Bot despawned', { botId: id, adminId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to despawn bot', { error });
    res.status(500).json({ error: error.message || 'Failed to despawn bot' });
  }
});

/**
 * GET /api/admin/bots
 * List all bots (admin only)
 */
router.get('/api/admin/bots', requireRole('admin'), async (req, res) => {
  try {
    const bots = await sql`
      SELECT 
        b.id,
        b.room_id AS "roomId",
        b.name,
        b.personality,
        b.x,
        b.y,
        b.rotation,
        b.spawned_at AS "spawnedAt",
        r.name AS "roomName"
      FROM bots b
      LEFT JOIN rooms r ON b.room_id = r.id
      ORDER BY b.spawned_at DESC
    `;

    res.json({ bots });
  } catch (error) {
    logger.error('Failed to fetch bots', { error });
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

export default router;
