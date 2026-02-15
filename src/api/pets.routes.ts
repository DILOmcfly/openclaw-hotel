/**
 * Pets API Routes
 */

import { Router } from 'express';
import {
  adoptPet,
  getMyPets,
  activatePet,
  deactivatePet,
  feedPet,
  renamePet,
  releasePet,
} from '../services/pets.js';
import { validateToken } from '../middleware/auth.js';
import { sql } from '../db/index.js';

const router = Router();

/**
 * POST /api/pets/adopt
 * Adopt a new pet (max 3 per agent)
 */
router.post('/api/pets/adopt', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, petType, color } = req.body;

    if (!name || !petType) {
      res.status(400).json({ error: 'Missing required fields: name, petType' });
      return;
    }

    const pet = await adoptPet(agentId, name, petType, color || '#FFFFFF', sql);

    res.status(201).json({ pet });
  } catch (error: any) {
    console.error('[Pets API] Error adopting pet:', error);

    if (
      error.message.includes('Maximum 3 pets') ||
      error.message.includes('Invalid pet type') ||
      error.message.includes('Pet name')
    ) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to adopt pet' });
  }
});

/**
 * GET /api/pets
 * List agent's pets
 */
router.get('/api/pets', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pets = await getMyPets(agentId, sql);

    res.json({ pets });
  } catch (error: any) {
    console.error('[Pets API] Error fetching pets:', error);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

/**
 * PUT /api/pets/:id/activate
 * Set a pet as active (deactivates others)
 */
router.put('/api/pets/:id/activate', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { id } = req.params;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!id) {
      res.status(400).json({ error: 'Missing pet ID' });
      return;
    }

    const pet = await activatePet(id, agentId, sql);

    res.json({ pet });
  } catch (error: any) {
    console.error('[Pets API] Error activating pet:', error);

    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to activate pet' });
  }
});

/**
 * PUT /api/pets/:id/deactivate
 * Deactivate a pet
 */
router.put('/api/pets/:id/deactivate', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { id } = req.params;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!id) {
      res.status(400).json({ error: 'Missing pet ID' });
      return;
    }

    const pet = await deactivatePet(id, agentId, sql);

    res.json({ pet });
  } catch (error: any) {
    console.error('[Pets API] Error deactivating pet:', error);

    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to deactivate pet' });
  }
});

/**
 * POST /api/pets/:id/feed
 * Feed a pet (costs 10 coins, +20 happiness)
 */
router.post('/api/pets/:id/feed', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { id } = req.params;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!id) {
      res.status(400).json({ error: 'Missing pet ID' });
      return;
    }

    const pet = await feedPet(id, agentId, sql);

    res.json({ pet });
  } catch (error: any) {
    console.error('[Pets API] Error feeding pet:', error);

    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
      return;
    }

    if (error.message.includes('Insufficient coins')) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to feed pet' });
  }
});

/**
 * PUT /api/pets/:id/rename
 * Rename a pet
 */
router.put('/api/pets/:id/rename', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { id } = req.params;
    const { name } = req.body;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!id) {
      res.status(400).json({ error: 'Missing pet ID' });
      return;
    }

    if (!name) {
      res.status(400).json({ error: 'Missing name in request body' });
      return;
    }

    const pet = await renamePet(id, agentId, name, sql);

    res.json({ pet });
  } catch (error: any) {
    console.error('[Pets API] Error renaming pet:', error);

    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
      return;
    }

    if (error.message.includes('Pet name')) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to rename pet' });
  }
});

/**
 * DELETE /api/pets/:id
 * Release (delete) a pet
 */
router.delete('/api/pets/:id', validateToken, async (req, res) => {
  try {
    const agentId = res.locals.agentId;
    const { id } = req.params;

    if (!agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!id) {
      res.status(400).json({ error: 'Missing pet ID' });
      return;
    }

    await releasePet(id, agentId, sql);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Pets API] Error releasing pet:', error);

    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Failed to release pet' });
  }
});

export default router;
