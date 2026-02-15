/**
 * Personality API Routes
 */

import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as personalityService from '../services/personality.js';
import type { PersonalityTrait } from '../services/personality.js';

const router = express.Router();

/**
 * GET /api/agents/:agentId/personality
 * Get agent's personality profile
 */
router.get('/:agentId/personality', async (req, res) => {
  try {
    const { agentId } = req.params;

    const personality = await personalityService.getPersonality(agentId, sql);
    if (!personality) {
      return res.status(404).json({ error: 'Personality profile not found' });
    }

    // Calculate archetype
    const archetype = personalityService.calculateArchetype(personality);

    res.json({
      ...personality,
      archetype,
    });
  } catch (error) {
    console.error('[Personality API] Error fetching personality:', error);
    res.status(500).json({ error: 'Failed to fetch personality' });
  }
});

/**
 * PUT /api/agents/:agentId/personality/:trait
 * Update a specific personality trait (owner or admin only)
 */
router.put('/:agentId/personality/:trait', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId: requesterId } = validateToken(token);
    const { agentId, trait } = req.params;
    const { delta } = req.body;

    // Authorization: must be owner or admin
    const roleCheck = await sql`
      SELECT role FROM agents WHERE id = ${requesterId}::uuid
    `;
    const role = roleCheck.length > 0 ? roleCheck[0].role : 'user';
    
    if (requesterId !== agentId && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: must be owner or admin' });
    }

    // Validate trait
    const validTraits: PersonalityTrait[] = [
      'sociability',
      'curiosity',
      'competitiveness',
      'generosity',
      'volatility',
    ];
    if (!validTraits.includes(trait as PersonalityTrait)) {
      return res.status(400).json({ error: 'Invalid trait' });
    }

    // Validate delta
    if (typeof delta !== 'number' || delta < -100 || delta > 100) {
      return res.status(400).json({ error: 'Delta must be a number between -100 and 100' });
    }

    const updated = await personalityService.updateTrait(
      agentId,
      trait as PersonalityTrait,
      delta,
      sql
    );

    res.json(updated);
  } catch (error) {
    console.error('[Personality API] Error updating trait:', error);
    res.status(500).json({ error: 'Failed to update trait' });
  }
});

/**
 * GET /api/agents/:agentId/personality/recommendations
 * Get personality-driven action recommendations
 */
router.get('/:agentId/personality/recommendations', async (req, res) => {
  try {
    const { agentId } = req.params;

    const recommendations = await personalityService.getRecommendedActions(agentId, sql);

    res.json({ recommendations });
  } catch (error) {
    console.error('[Personality API] Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

export default router;
