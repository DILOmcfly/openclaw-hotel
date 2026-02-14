import express from 'express';
import * as NotificationService from '../services/notifications.js';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';

const router = express.Router();

/**
 * GET /api/notifications
 * Get all notifications for the authenticated agent
 */
router.get('/api/notifications', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { agentId } = validateToken(token);
    const limit = parseInt(req.query?.limit as string) || 20;
    const notifications = await NotificationService.getAllNotifications(agentId, sql, limit);

    return res.json({ notifications });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/unread
 * Get unread notifications and count
 */
router.get('/api/notifications/unread', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { agentId } = validateToken(token);
    const notifications = await NotificationService.getUnreadNotifications(agentId, sql);
    const unreadCount = await NotificationService.getUnreadCount(agentId, sql);

    return res.json({ notifications, unreadCount });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch unread notifications' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { agentId } = validateToken(token);
    const notificationId = req.params.id;

    if (!notificationId) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const success = await NotificationService.markAsRead(notificationId, agentId, sql);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found or already read' });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read for the authenticated agent
 */
router.put('/api/notifications/read-all', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { agentId } = validateToken(token);
    const count = await NotificationService.markAllAsRead(agentId, sql);

    return res.json({ success: true, markedCount: count });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to mark all as read' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/api/notifications/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { agentId } = validateToken(token);
    const notificationId = req.params.id;

    if (!notificationId) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const success = await NotificationService.deleteNotification(notificationId, agentId, sql);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete notification' });
  }
});

export default router;
