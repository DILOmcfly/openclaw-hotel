import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import {
  createEvent,
  getUpcomingEvents,
  getActiveEvents,
  getEventById,
  joinEvent,
  leaveEvent,
  startEvent,
  endEvent,
  cancelEvent,
  getParticipants,
} from '../services/events.js';

const router = express.Router();

/**
 * POST /api/events
 * Create a new event (authenticated)
 */
router.post('/api/events', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { roomId, title, description, eventType, startsAt, endsAt, maxParticipants } = req.body;

    if (!roomId || !title || !eventType || !startsAt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const event = await createEvent(
      roomId,
      agentId,
      title,
      description || '',
      eventType,
      new Date(startsAt),
      endsAt ? new Date(endsAt) : null,
      maxParticipants || 50,
      sql
    );

    logger.info('Event created', { eventId: event.id, hostId: agentId });
    res.json({ success: true, event });
  } catch (error: any) {
    logger.error('Failed to create event', { error });
    res.status(400).json({ error: error.message || 'Failed to create event' });
  }
});

/**
 * GET /api/events
 * List upcoming and active events
 */
router.get('/api/events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    const upcoming = await getUpcomingEvents(limit, sql);
    const active = await getActiveEvents(sql);

    res.json({ upcoming, active });
  } catch (error: any) {
    logger.error('Failed to fetch events', { error });
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/events/:id
 * Get event details with participants
 */
router.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await getEventById(id, sql);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const participants = await getParticipants(id, sql);

    res.json({ event, participants });
  } catch (error: any) {
    logger.error('Failed to fetch event', { error });
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/**
 * POST /api/events/:id/join
 * Join an event (authenticated)
 */
router.post('/api/events/:id/join', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await joinEvent(id, agentId, sql);

    logger.info('Agent joined event', { eventId: id, agentId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to join event', { error });
    res.status(400).json({ error: error.message || 'Failed to join event' });
  }
});

/**
 * DELETE /api/events/:id/leave
 * Leave an event (authenticated)
 */
router.delete('/api/events/:id/leave', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await leaveEvent(id, agentId, sql);

    logger.info('Agent left event', { eventId: id, agentId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to leave event', { error });
    res.status(400).json({ error: error.message || 'Failed to leave event' });
  }
});

/**
 * PUT /api/events/:id/start
 * Start an event (host only)
 */
router.put('/api/events/:id/start', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await startEvent(id, agentId, sql);

    logger.info('Event started', { eventId: id, hostId: agentId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to start event', { error });
    res.status(400).json({ error: error.message || 'Failed to start event' });
  }
});

/**
 * PUT /api/events/:id/end
 * End an event (host only)
 */
router.put('/api/events/:id/end', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await endEvent(id, agentId, sql);

    logger.info('Event ended', { eventId: id, hostId: agentId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to end event', { error });
    res.status(400).json({ error: error.message || 'Failed to end event' });
  }
});

/**
 * DELETE /api/events/:id
 * Cancel an event (host only)
 */
router.delete('/api/events/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await cancelEvent(id, agentId, sql);

    logger.info('Event cancelled', { eventId: id, hostId: agentId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to cancel event', { error });
    res.status(400).json({ error: error.message || 'Failed to cancel event' });
  }
});

export default router;
