import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as cal from '../services/roomCalendar.js';

const router = express.Router();
const auth = (req: any) => { const t = req.headers.authorization?.replace('Bearer ', ''); if (!t) throw new Error('Unauthorized'); return validateToken(t).agentId; };

router.post('/api/rooms/:roomId/calendar', async (req, res) => {
  try {
    const agentId = auth(req);
    const { title, description, startsAt, endsAt, eventType, recurring, maxAttendees } = req.body;
    const event = await cal.createEvent(parseInt(req.params.roomId), title, new Date(startsAt), 
      new Date(endsAt), agentId, sql, { description, eventType, recurring, maxAttendees });
    res.json({ success: true, event });
  } catch (error: any) { res.status(error.message === 'Unauthorized' ? 401 : 400).json({ error: error.message || 'Failed' }); }
});

router.put('/api/rooms/:roomId/calendar/:eventId', async (req, res) => {
  try {
    const agentId = auth(req), updates: any = {};
    if (req.body.title) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.startsAt) updates.startsAt = new Date(req.body.startsAt);
    if (req.body.endsAt) updates.endsAt = new Date(req.body.endsAt);
    const event = await cal.updateEvent(parseInt(req.params.eventId), agentId, updates, sql);
    res.json({ success: true, event });
  } catch (error: any) { res.status(error.message === 'Unauthorized' ? 401 : 400).json({ error: error.message || 'Failed' }); }
});

router.delete('/api/rooms/:roomId/calendar/:eventId', async (req, res) => {
  try {
    await cal.cancelEvent(parseInt(req.params.eventId), auth(req), sql);
    res.json({ success: true });
  } catch (error: any) { res.status(error.message === 'Unauthorized' ? 401 : 400).json({ error: error.message || 'Failed' }); }
});

router.get('/api/rooms/:roomId/calendar', async (req, res) => {
  try {
    res.json({ events: await cal.getUpcoming(parseInt(req.params.roomId), sql) });
  } catch (error: any) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/api/calendar/:eventId/rsvp', async (req, res) => {
  try {
    const rsvp = await cal.rsvp(parseInt(req.params.eventId), auth(req), req.body.status, sql);
    res.json({ success: true, rsvp });
  } catch (error: any) { res.status(error.message === 'Unauthorized' ? 401 : 400).json({ error: error.message || 'Failed' }); }
});

router.get('/api/calendar/:eventId/attendees', async (req, res) => {
  try {
    res.json(await cal.getAttendees(parseInt(req.params.eventId), sql));
  } catch (error: any) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/api/agents/:agentId/schedule', async (req, res) => {
  try {
    res.json({ schedule: await cal.getAgentSchedule(req.params.agentId, sql) });
  } catch (error: any) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/api/rooms/:roomId/calendar/conflicts', async (req, res) => {
  try {
    const { startsAt, endsAt, excludeEventId } = req.query;
    if (!startsAt || !endsAt) return res.status(400).json({ error: 'startsAt and endsAt required' });
    res.json({ conflicts: await cal.checkConflicts(parseInt(req.params.roomId), 
      new Date(startsAt as string), new Date(endsAt as string), sql, 
      excludeEventId ? parseInt(excludeEventId as string) : undefined) });
  } catch (error: any) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
