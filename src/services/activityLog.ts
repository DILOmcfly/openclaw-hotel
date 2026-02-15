import { randomUUID } from 'node:crypto';

export type ActivityAction =
  | 'joined_room'
  | 'left_room'
  | 'sent_message'
  | 'traded'
  | 'purchased'
  | 'gifted'
  | 'achievement'
  | 'created_room'
  | 'adopted_pet'
  | 'took_photo';

export type ActivityLog = {
  id: string;
  agent_id: string;
  action: ActivityAction;
  details: Record<string, any>;
  room_id: string | null;
  created_at: Date;
};

export type ActivityStats = {
  action: ActivityAction;
  count: number;
};

/**
 * Log an activity event
 */
export async function logActivity(
  agentId: string,
  action: ActivityAction,
  details: Record<string, any>,
  roomId: string | null,
  sql: any
): Promise<{ id: string }> {
  const id = randomUUID();

  await sql`
    INSERT INTO activity_log (id, agent_id, action, details, room_id)
    VALUES (
      ${id},
      ${agentId},
      ${action},
      ${JSON.stringify(details)}::jsonb,
      ${roomId}
    )
  `;

  return { id };
}

/**
 * Get agent's activity timeline with pagination
 */
export async function getAgentTimeline(
  agentId: string,
  limit: number = 20,
  offset: number = 0,
  sql: any
): Promise<ActivityLog[]> {
  const rows = await sql`
    SELECT id, agent_id, action, details, room_id, created_at
    FROM activity_log
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return rows.map((row: any) => ({
    id: row.id,
    agent_id: row.agent_id,
    action: row.action,
    details: row.details,
    room_id: row.room_id,
    created_at: row.created_at,
  }));
}

/**
 * Get room activity timeline
 */
export async function getRoomTimeline(
  roomId: string,
  limit: number = 20,
  sql: any
): Promise<ActivityLog[]> {
  const rows = await sql`
    SELECT id, agent_id, action, details, room_id, created_at
    FROM activity_log
    WHERE room_id = ${roomId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row: any) => ({
    id: row.id,
    agent_id: row.agent_id,
    action: row.action,
    details: row.details,
    room_id: row.room_id,
    created_at: row.created_at,
  }));
}

/**
 * Get global activity feed
 */
export async function getGlobalFeed(
  limit: number = 50,
  sql: any
): Promise<ActivityLog[]> {
  const rows = await sql`
    SELECT id, agent_id, action, details, room_id, created_at
    FROM activity_log
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row: any) => ({
    id: row.id,
    agent_id: row.agent_id,
    action: row.action,
    details: row.details,
    room_id: row.room_id,
    created_at: row.created_at,
  }));
}

/**
 * Get activity statistics for an agent
 */
export async function getActivityStats(
  agentId: string,
  sql: any
): Promise<ActivityStats[]> {
  const rows = await sql`
    SELECT action, COUNT(*)::int as count
    FROM activity_log
    WHERE agent_id = ${agentId}
    GROUP BY action
    ORDER BY count DESC
  `;

  return rows.map((row: any) => ({
    action: row.action,
    count: row.count,
  }));
}
