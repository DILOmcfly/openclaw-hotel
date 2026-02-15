import { Router } from 'express';
import { z } from 'zod';
import {
  getAllAchievements,
  getAchievementsWithStatus,
  awardBadge,
} from '../services/achievements.js';
import { sql } from '../db/index.js';
import { validateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/admin.js';

const router = Router();

const awardBadgeSchema = z.object({
  agentId: z.string().uuid(),
  achievementId: z.string().uuid(),
});

/**
 * GET /api/achievements
 * Get all available achievements
 */
router.get('/api/achievements', async (req, res) => {
  try {
    const achievements = await getAllAchievements(sql);
    res.status(200).json(achievements);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch achievements';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/achievements/:agentId
 * Get achievements with earned status for a specific agent
 */
router.get('/api/achievements/:agentId', async (req, res) => {
  const { agentId } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(agentId)) {
    res.status(400).json({ error: 'Invalid agent ID format' });
    return;
  }

  try {
    const achievements = await getAchievementsWithStatus(agentId, sql);
    res.status(200).json(achievements);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch agent achievements';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/admin/achievements/award
 * Manually award a badge to an agent (admin only)
 */
router.post('/api/admin/achievements/award', validateToken, requireRole('admin'), async (req, res) => {
  const parsed = awardBadgeSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  const { agentId, achievementId } = parsed.data;

  try {
    const wasAwarded = await awardBadge(agentId, achievementId, sql);

    res.status(200).json({
      success: true,
      awarded: wasAwarded,
      message: wasAwarded ? 'Achievement awarded' : 'Agent already has this achievement',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to award achievement';
    res.status(500).json({ error: message });
  }
});

export default router;
