/**
 * Notifications Service - Manages agent in-app notifications
 */

export type NotificationType = 'trade' | 'bid' | 'gift' | 'achievement' | 'level_up' | 'friend' | 'guild' | 'system' | 'event' | 'quest';

export type Notification = {
  id: number;
  agentId: string;
  type: NotificationType;
  title: string | null;
  body: string | null;
  read: boolean;
  actionUrl: string | null;
  createdAt: Date;
};

/**
 * Convenience wrapper: send a notification to an agent from a structured object.
 */
export async function notifyAgent(
  opts: { agentId: string; type: string; title: string; message: string; link?: string },
  sql: any
): Promise<void> {
  try {
    await create(opts.agentId, opts.type as NotificationType, opts.title, opts.message, opts.link ?? null, sql);
  } catch {
    // Best-effort notification — don't break the caller
  }
}

/**
 * Create a single notification for an agent
 */
export async function create(
  agentId: string,
  type: NotificationType,
  title: string | null,
  body: string | null,
  actionUrl: string | null,
  sql: any
): Promise<Notification> {
  const result = await sql`
    INSERT INTO notifications (agent_id, type, title, body, action_url)
    VALUES (${agentId}, ${type}, ${title}, ${body}, ${actionUrl})
    RETURNING 
      id,
      agent_id AS "agentId",
      type,
      title,
      body,
      read,
      action_url AS "actionUrl",
      created_at AS "createdAt"
  `;
  return result[0];
}

/**
 * Create notifications for multiple agents (broadcast)
 */
export async function createBulk(
  agentIds: string[],
  type: NotificationType,
  title: string | null,
  body: string | null,
  actionUrl: string | null,
  sql: any
): Promise<number> {
  if (agentIds.length === 0) return 0;

  const values = agentIds.map(agentId => ({ agentId, type, title, body, actionUrl }));
  
  const result = await sql`
    INSERT INTO notifications ${sql(values, 'agentId', 'type', 'title', 'body', 'actionUrl')}
    RETURNING id
  `;
  
  return result.length;
}

/**
 * Get unread notifications for an agent (newest first)
 */
export async function getUnread(agentId: string, sql: any): Promise<Notification[]> {
  const result = await sql`
    SELECT 
      id,
      agent_id AS "agentId",
      type,
      title,
      body,
      read,
      action_url AS "actionUrl",
      created_at AS "createdAt"
    FROM notifications
    WHERE agent_id = ${agentId} AND read = false
    ORDER BY created_at DESC
  `;
  return result;
}

/**
 * Get all notifications for an agent (paginated with optional filter)
 */
export async function getAll(
  agentId: string,
  limit: number,
  offset: number,
  unreadOnly: boolean,
  sql: any
): Promise<Notification[]> {
  const result = unreadOnly
    ? await sql`
        SELECT 
          id,
          agent_id AS "agentId",
          type,
          title,
          body,
          read,
          action_url AS "actionUrl",
          created_at AS "createdAt"
        FROM notifications
        WHERE agent_id = ${agentId} AND read = false
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    : await sql`
        SELECT 
          id,
          agent_id AS "agentId",
          type,
          title,
          body,
          read,
          action_url AS "actionUrl",
          created_at AS "createdAt"
        FROM notifications
        WHERE agent_id = ${agentId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
  return result;
}

/**
 * Mark a single notification as read
 */
export async function markRead(id: number, agentId: string, sql: any): Promise<boolean> {
  const result = await sql`
    UPDATE notifications
    SET read = true
    WHERE id = ${id} AND agent_id = ${agentId}
    RETURNING id
  `;
  return result.length > 0;
}

/**
 * Mark all notifications as read for an agent
 */
export async function markAllRead(agentId: string, sql: any): Promise<number> {
  const result = await sql`
    UPDATE notifications
    SET read = true
    WHERE agent_id = ${agentId} AND read = false
    RETURNING id
  `;
  return result.length;
}

/**
 * Delete notifications older than 30 days
 */
export async function deleteOld(sql: any): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await sql`
    DELETE FROM notifications
    WHERE created_at < ${thirtyDaysAgo}
    RETURNING id
  `;
  return result.length;
}

/**
 * Get count of unread notifications for an agent
 */
export async function getUnreadCount(agentId: string, sql: any): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) AS count
    FROM notifications
    WHERE agent_id = ${agentId} AND read = false
  `;
  return parseInt(result[0].count, 10);
}
