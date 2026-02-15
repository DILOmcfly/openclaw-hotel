import { Router } from 'express';
import { z } from 'zod';
import {
  setMood,
  setStatusText,
  getStatus,
  clearStatus,
  toggleVisibility,
  type Mood,
} from '../services/agentStatus.js';
import { validateToken } from '../services/auth.js';
import { sql } from '../db/index.js';

const router = Router();

const setMoodSchema = z.object({
  mood: z.enum([
    'happy',
    'sad',
    'excited',
    'busy',
    'away',
    'neutral',
    'angry',
    'sleepy',
    'creative',
    'social',
  ]),
});

const setStatusTextSchema = z.object({
  text: z.string().max(100),
});

const toggleVisibilitySchema = z.object({
  isVisible: z.boolean(),
});

/**
 * PUT /api/status/mood
 * Set agent mood (requires auth)
 */
router.put('/api/status/mood', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { agentId } = validateToken(token);

  const parsed = setMoodSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  try {
    const status = await setMood(agentId, parsed.data.mood as Mood, sql);
    res.status(200).json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set mood';
    res.status(400).json({ error: message });
  }
});

/**
 * PUT /api/status/text
 * Set status text (requires auth)
 */
router.put('/api/status/text', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { agentId } = validateToken(token);

  const parsed = setStatusTextSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  try {
    const status = await setStatusText(agentId, parsed.data.text, sql);
    res.status(200).json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set status text';
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/status/:agentId
 * Get agent status
 */
router.get('/api/status/:agentId', async (req, res) => {
  const { agentId } = req.params;

  try {
    const status = await getStatus(agentId, sql);
    res.status(200).json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch status';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/status
 * Clear status (requires auth)
 */
router.delete('/api/status', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { agentId } = validateToken(token);

  try {
    const status = await clearStatus(agentId, sql);
    res.status(200).json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear status';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/status/visibility
 * Toggle status visibility (requires auth)
 */
router.put('/api/status/visibility', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { agentId } = validateToken(token);

  const parsed = toggleVisibilitySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  try {
    const status = await toggleVisibility(agentId, parsed.data.isVisible, sql);
    res.status(200).json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle visibility';
    res.status(500).json({ error: message });
  }
});

export default router;
