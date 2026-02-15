import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as wardrobeService from '../services/wardrobe.js';

const router = express.Router();

// POST /api/agents/:agentId/outfits - Create outfit
router.post('/api/agents/:agentId/outfits', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: authId } = validateToken(token);
    if (authId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });

    const outfit = await wardrobeService.createOutfit(authId, req.body.name, req.body, sql);
    res.json(outfit);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create outfit' });
  }
});

// GET /api/agents/:agentId/outfits - Get all outfits
router.get('/api/agents/:agentId/outfits', async (req, res) => {
  try {
    const outfits = await wardrobeService.getOutfits(req.params.agentId, sql);
    res.json(outfits);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch outfits' });
  }
});

// GET /api/agents/:agentId/outfits/active - Get active outfit
router.get('/api/agents/:agentId/outfits/active', async (req, res) => {
  try {
    const outfit = await wardrobeService.getActiveOutfit(req.params.agentId, sql);
    if (!outfit) return res.status(404).json({ error: 'No active outfit' });
    res.json(outfit);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch active outfit' });
  }
});

// PUT /api/agents/:agentId/outfits/:id/activate - Activate outfit
router.put('/api/agents/:agentId/outfits/:id/activate', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: authId } = validateToken(token);
    if (authId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });

    const outfit = await wardrobeService.activateOutfit(authId, parseInt(req.params.id), sql);
    res.json(outfit);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to activate outfit' });
  }
});

// PUT /api/agents/:agentId/outfits/:id - Update outfit
router.put('/api/agents/:agentId/outfits/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: authId } = validateToken(token);
    if (authId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });

    const outfit = await wardrobeService.updateOutfit(authId, parseInt(req.params.id), req.body, sql);
    res.json(outfit);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update outfit' });
  }
});

// DELETE /api/agents/:agentId/outfits/:id - Delete outfit
router.delete('/api/agents/:agentId/outfits/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: authId } = validateToken(token);
    if (authId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });

    await wardrobeService.deleteOutfit(authId, parseInt(req.params.id), sql);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete outfit' });
  }
});

// POST /api/agents/:agentId/outfits/copy/:sourceAgentId/:outfitId - Copy outfit
router.post('/api/agents/:agentId/outfits/copy/:sourceAgentId/:outfitId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: authId } = validateToken(token);
    if (authId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });

    const outfit = await wardrobeService.copyOutfit(
      authId,
      req.params.sourceAgentId,
      parseInt(req.params.outfitId),
      sql
    );
    res.json(outfit);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to copy outfit' });
  }
});

// GET /api/outfits/popular - Get popular outfits
router.get('/api/outfits/popular', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const outfits = await wardrobeService.getPopularOutfits(limit, sql);
    res.json(outfits);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch popular outfits' });
  }
});

export default router;
