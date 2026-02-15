import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as notificationsService from '../services/notifications.js';

const router = express.Router();

/**
 * GET /api/agents/:agentId/notifications
 * Get notifications for an agent (paginated, optional unread filter)
 */
router.get('/api/agents/:agentId/notifications', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    if (agentId !== req.params.agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread === 'true';

    const notifications = await notificationsService.getAll(agentId, limit, offset, unreadOnly, sql);

    res.json({ notifications, limit, offset, unreadOnly });
  } catch (error) {
    console.error('[Notifications API] Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/agents/:agentId/notifications/count
 * Get unread notification count
 */
router.get('/api/agents/:agentId/notifications/count', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    if (agentId !== req.params.agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const count = await notificationsService.getUnreadCount(agentId, sql);

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('[Notifications API] Error fetching count:', error);
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

/**
 * PUT /api/agents/:agentId/notifications/:id/read
 * Mark a notification as read
 */
router.put('/api/agents/:agentId/notifications/:id/read', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    if (agentId !== req.params.agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const id = parseInt(req.params.id);
    const success = await notificationsService.markRead(id, agentId, sql);

    res.json({ success });
  } catch (error) {
    console.error('[Notifications API] Error marking read:', error);
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

/**
 * PUT /api/agents/:agentId/notifications/read-all
 * Mark all notifications as read
 */
router.put('/api/agents/:agentId/notifications/read-all', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    if (agentId !== req.params.agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const count = await notificationsService.markAllRead(agentId, sql);

    res.json({ success: true, markedCount: count });
  } catch (error) {
    console.error('[Notifications API] Error marking all read:', error);
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

/**
 * DELETE /api/agents/:agentId/notifications/old
 * Delete notifications older than 30 days (admin/system endpoint)
 */
router.delete('/api/agents/:agentId/notifications/old', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    if (agentId !== req.params.agentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const count = await notificationsService.deleteOld(sql);

    res.json({ success: true, deletedCount: count });
  } catch (error) {
    console.error('[Notifications API] Error deleting old:', error);
    res.status(500).json({ error: 'Failed to delete old notifications' });
  }
});

export default router;
