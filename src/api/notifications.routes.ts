import type { FastifyPluginAsync } from 'fastify';
import * as NotificationService from '../services/notifications.js';
import { sql } from '../db/index.js';

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/notifications
   * Get all notifications for the authenticated agent
   */
  fastify.get('/api/notifications', async (request, reply) => {
    const agentId = request.session?.agentId;

    if (!agentId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const limit = parseInt(request.query?.limit as string) || 20;
    const notifications = await NotificationService.getAllNotifications(agentId, sql, limit);

    return { notifications };
  });

  /**
   * GET /api/notifications/unread
   * Get unread notifications and count
   */
  fastify.get('/api/notifications/unread', async (request, reply) => {
    const agentId = request.session?.agentId;

    if (!agentId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const notifications = await NotificationService.getUnreadNotifications(agentId, sql);
    const unreadCount = await NotificationService.getUnreadCount(agentId, sql);

    return { notifications, unreadCount };
  });

  /**
   * PUT /api/notifications/:id/read
   * Mark a notification as read
   */
  fastify.put<{ Params: { id: string } }>('/api/notifications/:id/read', async (request, reply) => {
    const agentId = request.session?.agentId;

    if (!agentId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const notificationId = request.params.id;

    if (!notificationId) {
      return reply.status(400).send({ error: 'Invalid notification ID' });
    }

    const success = await NotificationService.markAsRead(notificationId, agentId, sql);

    if (!success) {
      return reply.status(404).send({ error: 'Notification not found or already read' });
    }

    return { success: true };
  });

  /**
   * PUT /api/notifications/read-all
   * Mark all notifications as read for the authenticated agent
   */
  fastify.put('/api/notifications/read-all', async (request, reply) => {
    const agentId = request.session?.agentId;

    if (!agentId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const count = await NotificationService.markAllAsRead(agentId, sql);

    return { success: true, markedCount: count };
  });

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  fastify.delete<{ Params: { id: string } }>('/api/notifications/:id', async (request, reply) => {
    const agentId = request.session?.agentId;

    if (!agentId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const notificationId = request.params.id;

    if (!notificationId) {
      return reply.status(400).send({ error: 'Invalid notification ID' });
    }

    const success = await NotificationService.deleteNotification(notificationId, agentId, sql);

    if (!success) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    return { success: true };
  });
};

export default notificationsRoutes;
