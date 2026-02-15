import { Router } from 'express';
import { z } from 'zod';
import {
  createCompetitiveEvent,
  getCompetitiveEventById,
  getActiveCompetitiveEvents,
  getAllCompetitiveEvents,
  joinCompetitiveEvent,
  submitEventScore,
  getEventLeaderboard,
  endCompetitiveEvent,
  cancelCompetitiveEvent,
  getEventParticipants,
} from '../services/competitiveEvents.js';
import { sql } from '../db/index.js';
import { requireAgent } from '../middleware/agentOnly.js';
import { requireRole } from '../middleware/admin.js';

const router = Router();

const createEventSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['rps_tournament', 'trivia', 'room_decoration_contest']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable(),
  config: z.record(z.any()).optional(),
});

const submitScoreSchema = z.object({
  score: z.number().int().min(0),
});

/**
 * GET /api/events
 * Get all active/scheduled competitive events
 */
router.get('/api/events', async (req, res) => {
  try {
    const events = await getAllCompetitiveEvents(sql);
    res.status(200).json(events);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch events';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/events/active
 * Get only currently active events
 */
router.get('/api/events/active', async (req, res) => {
  try {
    const events = await getActiveCompetitiveEvents(sql);
    res.status(200).json(events);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch active events';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/events/:id
 * Get event details by ID
 */
router.get('/api/events/:id', async (req, res) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ error: 'Invalid event ID format' });
    return;
  }

  try {
    const event = await getCompetitiveEventById(id, sql);

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.status(200).json(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch event';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/events/:id/leaderboard
 * Get event leaderboard
 */
router.get('/api/events/:id/leaderboard', async (req, res) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ error: 'Invalid event ID format' });
    return;
  }

  try {
    const leaderboard = await getEventLeaderboard(id, sql);
    res.status(200).json(leaderboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/events/:id/participants
 * Get all participants of an event
 */
router.get('/api/events/:id/participants', async (req, res) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ error: 'Invalid event ID format' });
    return;
  }

  try {
    const participants = await getEventParticipants(id, sql);
    res.status(200).json(participants);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch participants';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/events/:id/join
 * Join a competitive event
 */
router.post('/api/events/:id/join', requireAgent, async (req, res) => {
  const { id } = req.params;
  const agentId = (req as any).agentId; // Extract from auth middleware

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ error: 'Invalid event ID format' });
    return;
  }

  try {
    await joinCompetitiveEvent(id, agentId, sql);
    res.status(200).json({ success: true, message: 'Joined event successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to join event';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/events/:id/score
 * Submit score for an event (agent only, during active event)
 */
router.post('/api/events/:id/score', requireAgent, async (req, res) => {
  const { id } = req.params;

  const parsed = submitScoreSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  const { score } = parsed.data;
  const agentId = (req as any).agentId; // Extract from auth middleware

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ error: 'Invalid event ID format' });
    return;
  }

  try {
    await submitEventScore(id, agentId, score, sql);
    res.status(200).json({ success: true, message: 'Score submitted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit score';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/admin/events
 * Create a new competitive event (admin only)
 */
router.post('/api/admin/events', requireRole('admin'), async (req, res) => {
  const parsed = createEventSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  const { name, type, startTime, endTime, config } = parsed.data;
  const createdBy = (req as any).agentId; // Extract from auth middleware

  try {
    const event = await createCompetitiveEvent(
      name,
      type,
      new Date(startTime),
      endTime ? new Date(endTime) : null,
      config || {},
      createdBy,
      sql
    );

    res.status(201).json(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create event';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/admin/events/:id/end
 * End an event and calculate rankings (admin only)
 */
router.put('/api/admin/events/:id/end', requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ error: 'Invalid event ID format' });
    return;
  }

  try {
    await endCompetitiveEvent(id, sql);
    res.status(200).json({ success: true, message: 'Event ended successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to end event';
    res.status(400).json({ error: message });
  }
});

/**
 * DELETE /api/admin/events/:id
 * Cancel an event (admin only)
 */
router.delete('/api/admin/events/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    res.status(400).json({ error: 'Invalid event ID format' });
    return;
  }

  try {
    await cancelCompetitiveEvent(id, sql);
    res.status(200).json({ success: true, message: 'Event cancelled successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel event';
    res.status(400).json({ error: message });
  }
});

export default router;
