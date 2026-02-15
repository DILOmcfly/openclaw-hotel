import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as warpService from '../services/warpZones.js';

const router = express.Router();

// GET /api/warps - List active warps (optional ?category=)
router.get('/api/warps', async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const warps = await warpService.getActiveWarps(category, sql);
    res.json({ warps });
  } catch (error) {
    console.error('[Warp API] Error listing warps:', error);
    res.status(500).json({ error: 'Failed to list warps' });
  }
});

// GET /api/warps/popular - Get popular warps sorted by use_count
router.get('/api/warps/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const warps = await warpService.getPopularWarps(limit, sql);
    res.json({ warps });
  } catch (error) {
    console.error('[Warp API] Error getting popular warps:', error);
    res.status(500).json({ error: 'Failed to get popular warps' });
  }
});

// POST /api/warps - Create a warp (admin only)
router.post('/api/warps', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const [agent] = await sql<{ isAdmin: boolean }[]>`
      SELECT is_admin AS "isAdmin" FROM agents WHERE id = ${agentId}
    `;
    if (!agent || !agent.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, description, targetRoomId, targetX, targetY, icon, category } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!targetRoomId || typeof targetRoomId !== 'string') {
      return res.status(400).json({ error: 'Target room ID is required' });
    }
    if (typeof targetX !== 'number' || typeof targetY !== 'number') {
      return res.status(400).json({ error: 'Target coordinates are required' });
    }

    const warp = await warpService.createWarp(
      name, description || '', targetRoomId, targetX, targetY,
      icon || '🚪', category || 'general', agentId, sql
    );
    res.status(201).json({ warp });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create warp';
    console.error('[Warp API] Error creating warp:', error);
    if (message.includes('duplicate') || message.includes('unique')) {
      return res.status(409).json({ error: 'Warp name already exists' });
    }
    res.status(500).json({ error: message });
  }
});

// POST /api/warps/:id/use - Use a warp (authenticated agents)
router.post('/api/warps/:id/use', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    validateToken(token);
    const destination = await warpService.useWarp(req.params.id, sql);
    res.json({ destination });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to use warp';
    console.error('[Warp API] Error using warp:', error);
    if (message.includes('not found') || message.includes('inactive')) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

// DELETE /api/warps/:id - Deactivate a warp (admin only)
router.delete('/api/warps/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const [agent] = await sql<{ isAdmin: boolean }[]>`
      SELECT is_admin AS "isAdmin" FROM agents WHERE id = ${agentId}
    `;
    if (!agent || !agent.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await warpService.deactivateWarp(req.params.id, sql);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate warp';
    console.error('[Warp API] Error deactivating warp:', error);
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

export default router;
