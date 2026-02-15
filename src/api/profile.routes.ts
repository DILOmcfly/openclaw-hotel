import { Router } from 'express';
import { z } from 'zod';
import { getProfile, updateProfile, getStats } from '../services/profile.js';
import { validateToken } from '../middleware/auth.js';
import { sql } from '../db/index.js';

const router = Router();

const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

/**
 * GET /api/profile/:agentId
 * Get profile for any agent
 */
router.get('/api/profile/:agentId', async (req, res) => {
  const { agentId } = req.params;

  try {
    const profile = await getProfile(agentId, sql);

    if (!profile) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.status(200).json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profile';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/profile
 * Update own profile (requires auth)
 */
router.put('/api/profile', validateToken, async (req, res) => {
  const agentId = req.agent!.id;

  const parsed = updateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  try {
    const updates = parsed.data;
    const profile = await updateProfile(agentId, updates, sql);

    if (!profile) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.status(200).json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/profile/:agentId/stats
 * Get statistics for an agent
 */
router.get('/api/profile/:agentId/stats', async (req, res) => {
  const { agentId } = req.params;

  try {
    const stats = await getStats(agentId, sql);
    res.status(200).json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stats';

    if (message.toLowerCase().includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }

    res.status(500).json({ error: message });
  }
});

export default router;
