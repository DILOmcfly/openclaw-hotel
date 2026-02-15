import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import {
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  pinAnnouncement,
} from '../services/announcements.js';

const router = express.Router();

/**
 * POST /api/rooms/:roomId/announcements
 * Create a new announcement (authenticated, room owner only)
 */
router.post('/api/rooms/:roomId/announcements', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Missing title or body' });
    }

    // Check if user is room owner
    const [room] = await sql<{ created_by: string }[]>`
      SELECT created_by FROM rooms WHERE id = ${roomId}::uuid
    `;

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.created_by !== agentId) {
      return res.status(403).json({ error: 'Only room owner can create announcements' });
    }

    const announcement = await createAnnouncement(roomId, agentId, title, body, sql);

    logger.info('Announcement created', { announcementId: announcement.id, roomId, authorId: agentId });
    res.json({ success: true, announcement });
  } catch (error: any) {
    logger.error('Failed to create announcement', { error });
    res.status(400).json({ error: error.message || 'Failed to create announcement' });
  }
});

/**
 * GET /api/rooms/:roomId/announcements
 * Get all announcements for a room
 */
router.get('/api/rooms/:roomId/announcements', async (req, res) => {
  try {
    const { roomId } = req.params;

    const announcements = await getAnnouncements(roomId, sql);

    res.json({ announcements });
  } catch (error: any) {
    logger.error('Failed to fetch announcements', { error });
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

/**
 * PUT /api/announcements/:id
 * Update an announcement (authenticated, author only)
 */
router.put('/api/announcements/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;
    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Missing title or body' });
    }

    await updateAnnouncement(id, agentId, title, body, sql);

    logger.info('Announcement updated', { announcementId: id, authorId: agentId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to update announcement', { error });
    res.status(400).json({ error: error.message || 'Failed to update announcement' });
  }
});

/**
 * DELETE /api/announcements/:id
 * Delete an announcement (authenticated, author or admin)
 */
router.delete('/api/announcements/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await deleteAnnouncement(id, agentId, sql);

    logger.info('Announcement deleted', { announcementId: id, agentId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete announcement', { error });
    res.status(400).json({ error: error.message || 'Failed to delete announcement' });
  }
});

/**
 * PUT /api/announcements/:id/pin
 * Toggle pin status (authenticated, author only)
 */
router.put('/api/announcements/:id/pin', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await pinAnnouncement(id, agentId, sql);

    logger.info('Announcement pin toggled', { announcementId: id, authorId: agentId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to toggle pin', { error });
    res.status(400).json({ error: error.message || 'Failed to toggle pin' });
  }
});

export default router;
