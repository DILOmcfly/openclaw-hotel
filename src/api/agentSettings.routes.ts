import { Router } from 'express';
import { z } from 'zod';
import { getSettings, updateSettings, resetSettings } from '../services/agentSettings.js';
import { validateToken } from '../services/auth.js';
import { sql } from '../db/index.js';

const router = Router();

const updateSettingsSchema = z.object({
  chatColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  notificationSounds: z.boolean().optional(),
  showOnlineStatus: z.boolean().optional(),
  allowFriendRequests: z.boolean().optional(),
  allowTrades: z.boolean().optional(),
  allowWhispers: z.boolean().optional(),
  language: z.enum(['en', 'es', 'de', 'fr', 'pt', 'ja', 'ko', 'zh']).optional(),
  theme: z.enum(['dark', 'light', 'retro', 'neon']).optional(),
});

/**
 * GET /api/settings
 * Get my settings (requires auth)
 */
router.get('/api/settings', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { agentId } = validateToken(token);

  try {
    const settings = await getSettings(agentId, sql);
    res.status(200).json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch settings';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/settings
 * Update settings (requires auth, partial update)
 */
router.put('/api/settings', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { agentId } = validateToken(token);

  const parsed = updateSettingsSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  try {
    const settings = await updateSettings(agentId, parsed.data, sql);
    res.status(200).json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    res.status(400).json({ error: message });
  }
});

/**
 * DELETE /api/settings
 * Reset to defaults (requires auth)
 */
router.delete('/api/settings', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { agentId } = validateToken(token);

  try {
    const settings = await resetSettings(agentId, sql);
    res.status(200).json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset settings';
    res.status(500).json({ error: message });
  }
});

export default router;
