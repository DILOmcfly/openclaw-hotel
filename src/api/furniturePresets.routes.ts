/**
 * Furniture Presets API Routes
 */

import { Router } from 'express';
import { validateToken } from '../middleware/auth.js';
import { sql } from '../db/index.js';
import { savePreset, loadPreset, deletePreset, getPresets, renamePreset } from '../services/furniturePresets.js';

const router = Router();

/**
 * POST /api/rooms/:roomId/presets - Save a furniture preset (auth, owner only)
 */
router.post('/api/rooms/:roomId/presets', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { roomId } = req.params;
    const { name, layout } = req.body;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!name || !layout) {
      res.status(400).json({ error: 'name and layout are required' });
      return;
    }

    const roomResults = await sql`
      SELECT created_by AS "createdBy" FROM rooms WHERE id = ${sql.typed.uuid(roomId)}
    `;

    if (roomResults.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (roomResults[0].createdBy !== agentId) {
      res.status(403).json({ error: 'Only room owner can save presets' });
      return;
    }

    const preset = await savePreset(roomId, agentId, name, layout, sql);
    res.status(201).json({ preset });
  } catch (error: any) {
    console.error('[Furniture Presets API] Error saving preset:', error);
    if (error.message.includes('Maximum')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to save preset' });
  }
});

/**
 * GET /api/rooms/:roomId/presets - List presets for a room (auth required)
 */
router.get('/api/rooms/:roomId/presets', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { roomId } = req.params;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const presets = await getPresets(roomId, sql);
    res.json({ presets });
  } catch (error: any) {
    console.error('[Furniture Presets API] Error listing presets:', error);
    res.status(500).json({ error: 'Failed to list presets' });
  }
});

/**
 * POST /api/presets/:id/load - Load a preset (auth, owner only)
 */
router.post('/api/presets/:id/load', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { id } = req.params;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const layout = await loadPreset(id, agentId, sql);
    res.json({ layout });
  } catch (error: any) {
    console.error('[Furniture Presets API] Error loading preset:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to load preset' });
  }
});

/**
 * DELETE /api/presets/:id - Delete a preset (auth, owner only)
 */
router.delete('/api/presets/:id', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { id } = req.params;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await deletePreset(id, agentId, sql);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Furniture Presets API] Error deleting preset:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete preset' });
  }
});

/**
 * PUT /api/presets/:id/rename - Rename a preset (auth, owner only)
 */
router.put('/api/presets/:id/rename', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { id } = req.params;
    const { name } = req.body;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    await renamePreset(id, agentId, name, sql);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Furniture Presets API] Error renaming preset:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
      return;
    }
    if (error.message.includes('50 characters')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to rename preset' });
  }
});

export default router;
