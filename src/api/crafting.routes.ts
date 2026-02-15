import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as craftingService from '../services/crafting.js';

const router = express.Router();

// GET /api/crafting/recipes - Get all recipes (public)
router.get('/api/crafting/recipes', async (_req, res) => {
  try {
    const recipes = await craftingService.getRecipes(sql);
    res.json({ recipes });
  } catch (error) {
    console.error('[Crafting API] Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// GET /api/crafting/recipes/:recipeId - Get recipe details (public)
router.get('/api/crafting/recipes/:recipeId', async (req, res) => {
  try {
    const recipeId = parseInt(req.params.recipeId);
    if (isNaN(recipeId)) return res.status(400).json({ error: 'Invalid recipe ID' });

    const recipe = await craftingService.getRecipeById(recipeId, sql);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    res.json({ recipe });
  } catch (error) {
    console.error('[Crafting API] Error fetching recipe:', error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

// POST /api/agents/:agentId/craft - Start crafting (authenticated)
router.post('/api/agents/:agentId/craft', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: authAgentId } = validateToken(token);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });

    const { recipeId } = req.body;
    if (!recipeId) return res.status(400).json({ error: 'Recipe ID required' });

    const craft = await craftingService.startCraft(req.params.agentId, recipeId, sql);
    res.status(201).json({ success: true, craft });
  } catch (error: any) {
    console.error('[Crafting API] Error starting craft:', error);
    if (error.message === 'Recipe not found') return res.status(404).json({ error: error.message });
    res.status(500).json({ error: 'Failed to start craft' });
  }
});

// POST /api/agents/:agentId/craft/:craftId/complete - Complete craft (authenticated)
router.post('/api/agents/:agentId/craft/:craftId/complete', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: authAgentId } = validateToken(token);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });

    const result = await craftingService.completeCraft(parseInt(req.params.craftId), req.params.agentId, sql);
    if (!result.success) return res.status(400).json({ error: result.message });

    res.json(result);
  } catch (error) {
    console.error('[Crafting API] Error completing craft:', error);
    res.status(500).json({ error: 'Failed to complete craft' });
  }
});

// GET /api/agents/:agentId/craft/queue - Get craft queue (authenticated)
router.get('/api/agents/:agentId/craft/queue', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: authAgentId } = validateToken(token);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });

    const queue = await craftingService.getCraftQueue(req.params.agentId, sql);
    res.json({ queue });
  } catch (error) {
    console.error('[Crafting API] Error fetching craft queue:', error);
    res.status(500).json({ error: 'Failed to fetch craft queue' });
  }
});

// DELETE /api/agents/:agentId/craft/:craftId - Cancel craft (authenticated)
router.delete('/api/agents/:agentId/craft/:craftId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: authAgentId } = validateToken(token);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });

    const success = await craftingService.cancelCraft(parseInt(req.params.craftId), req.params.agentId, sql);
    if (!success) return res.status(404).json({ error: 'Craft not found or already completed' });

    res.json({ success: true, message: 'Craft cancelled' });
  } catch (error) {
    console.error('[Crafting API] Error cancelling craft:', error);
    res.status(500).json({ error: 'Failed to cancel craft' });
  }
});

export default router;
