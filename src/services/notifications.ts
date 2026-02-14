import type { Sql } from 'postgres';
import { sendToAgent } from '../ws/handler.js';
import type { NotificationNewMsg } from '../ws/protocol.js';

export type NotificationType = 'friend_request' | 'trade_offer' | 'whisper' | 'achievement' | 'system';

export interface Notification {
  id: string;
  agentId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  readAt?: string;
  createdAt: string;
}

export interface CreateNotificationParams {
  agentId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Create a new notification for an agent
 */
export async function createNotification(
  params: CreateNotificationParams,
  sql: Sql
): Promise<Notification | null> {
  const { agentId, type, title, message, link } = params;

  // Validation
  if (!agentId || !type || !title || !message) {
    return null;
  }

  const validTypes: NotificationType[] = ['friend_request', 'trade_offer', 'whisper', 'achievement', 'system'];
  if (!validTypes.includes(type)) {
    return null;
  }

  // Sanitize inputs (basic XSS prevention)
  const sanitizedTitle = title.slice(0, 100);
  const sanitizedMessage = message.slice(0, 500);

  try {
    const [notification] = await sql<Notification[]>`
      INSERT INTO notifications (agent_id, type, title, message, link)
      VALUES (${agentId}, ${type}, ${sanitizedTitle}, ${sanitizedMessage}, ${link || null})
      RETURNING 
        id::text,
        agent_id AS "agentId",
        type,
        title,
        message,
        link,
        read_at AS "readAt",
        created_at AS "createdAt"
    `;

    return notification;
  } catch (error) {
    console.error('[Notifications] Failed to create notification:', error);
    return null;
  }
}

/**
 * Get unread notifications for an agent
 */
export async function getUnreadNotifications(agentId: string, sql: Sql): Promise<Notification[]> {
  const notifications = await sql<Notification[]>`
    SELECT 
      id::text,
      agent_id AS "agentId",
      type,
      title,
      message,
      link,
      read_at AS "readAt",
      created_at AS "createdAt"
    FROM notifications 
    WHERE agent_id = ${agentId} AND read_at IS NULL 
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return notifications;
}

/**
 * Get all notifications for an agent (read + unread)
 */
export async function getAllNotifications(agentId: string, sql: Sql, limit = 50): Promise<Notification[]> {
  const notifications = await sql<Notification[]>`
    SELECT 
      id::text,
      agent_id AS "agentId",
      type,
      title,
      message,
      link,
      read_at AS "readAt",
      created_at AS "createdAt"
    FROM notifications 
    WHERE agent_id = ${agentId} 
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `;

  return notifications;
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string, agentId: string, sql: Sql): Promise<boolean> {
  try {
    const result = await sql`
      UPDATE notifications 
      SET read_at = NOW()
      WHERE id = ${notificationId} AND agent_id = ${agentId} AND read_at IS NULL
    `;

    return result.count > 0;
  } catch (error) {
    console.error('[Notifications] Failed to mark as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for an agent
 */
export async function markAllAsRead(agentId: string, sql: Sql): Promise<number> {
  try {
    const result = await sql`
      UPDATE notifications 
      SET read_at = NOW()
      WHERE agent_id = ${agentId} AND read_at IS NULL
    `;

    return result.count;
  } catch (error) {
    console.error('[Notifications] Failed to mark all as read:', error);
    return 0;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, agentId: string, sql: Sql): Promise<boolean> {
  try {
    const result = await sql`
      DELETE FROM notifications 
      WHERE id = ${notificationId} AND agent_id = ${agentId}
    `;

    return result.count > 0;
  } catch (error) {
    console.error('[Notifications] Failed to delete notification:', error);
    return false;
  }
}

/**
 * Get unread count for an agent
 */
export async function getUnreadCount(agentId: string, sql: Sql): Promise<number> {
  const [result] = await sql<{ count: string }[]>`
    SELECT COUNT(*) as count 
    FROM notifications 
    WHERE agent_id = ${agentId} AND read_at IS NULL
  `;

  return parseInt(result?.count || '0', 10);
}

/**
 * Helper to create notification and broadcast via WebSocket
 * This function should be called by other services (friends, trades, etc.)
 */
export async function notifyAgent(params: CreateNotificationParams, sql: Sql): Promise<Notification | null> {
  const notification = await createNotification(params, sql);

  if (!notification) {
    return null;
  }

  // Get unread count for the badge
  const unreadCount = await getUnreadCount(params.agentId, sql);

  // Broadcast to the agent via WebSocket
  const message: NotificationNewMsg = {
    type: 'notification.new',
    notification: {
      id: parseInt(notification.id, 10),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      createdAt: new Date(notification.createdAt).getTime() / 1000,
    },
    unreadCount,
  };

  sendToAgent(params.agentId, message);

  return notification;
}
