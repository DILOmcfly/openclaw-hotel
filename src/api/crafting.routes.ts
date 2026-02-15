/**
 * Crafting API Routes
 */

import { Router } from 'express';
import { getRecipes, getRecipeById, canCraft, craft } from '../services/crafting.js';
import { validateToken } from '../middleware/auth.js';
import { sql } from '../db/index.js';

const router = Router();

/**
 * GET /api/crafting/recipes
 * Get all crafting recipes
 */
router.get('/api/crafting/recipes', async (req, res) => {
  try {
    const recipes = await getRecipes(sql);
    res.json({ recipes });
  } catch (error: any) {
    console.error('[Crafting API] Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

/**
 * GET /api/crafting/recipes/:id
 * Get recipe details by ID
 */
router.get('/api/crafting/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Missing recipe ID' });
      return;
    }

    const recipe = await getRecipeById(id, sql);

    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }

    res.json({ recipe });
  } catch (error: any) {
    console.error('[Crafting API] Error fetching recipe:', error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

/**
 * POST /api/crafting/craft/:id
 * Craft an item (requires auth)
 */
router.post('/api/crafting/craft/:id', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { id } = req.params;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!id) {
      res.status(400).json({ error: 'Missing recipe ID' });
      return;
    }

    const result = await craft(agentId, id, sql);

    res.json(result);
  } catch (error: any) {
    console.error('[Crafting API] Error crafting item:', error);

    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.message.includes('Insufficient')) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to craft item' });
  }
});

/**
 * GET /api/crafting/available
 * Get recipes the current agent can craft (requires auth)
 */
router.get('/api/crafting/available', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const allRecipes = await getRecipes(sql);

    const availableRecipes = [];

    for (const recipe of allRecipes) {
      const craftable = await canCraft(agentId, recipe.id, sql);
      if (craftable) {
        availableRecipes.push(recipe);
      }
    }

    res.json({ recipes: availableRecipes });
  } catch (error: any) {
    console.error('[Crafting API] Error fetching available recipes:', error);
    res.status(500).json({ error: 'Failed to fetch available recipes' });
  }
});

export default router;
