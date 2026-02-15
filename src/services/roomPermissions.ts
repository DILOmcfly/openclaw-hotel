/**
 * Room Permissions Service
 * Manages room bans and guest lists for private room moderation
 */

export interface RoomBan {
  roomId: string;
  agentId: string;
  bannedBy: string;
  reason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface RoomGuest {
  roomId: string;
  agentId: string;
  invitedBy: string;
  createdAt: Date;
}

/**
 * Ban an agent from a room
 */
export async function banFromRoom(
  roomId: string,
  agentId: string,
  bannedBy: string,
  reason: string | null,
  expiresAt: Date | null,
  sql: any
): Promise<void> {
  await sql`
    INSERT INTO room_bans (room_id, agent_id, banned_by, reason, expires_at)
    VALUES (${roomId}::uuid, ${agentId}::uuid, ${bannedBy}::uuid, ${reason}, ${expiresAt})
    ON CONFLICT (room_id, agent_id) 
    DO UPDATE SET 
      banned_by = EXCLUDED.banned_by,
      reason = EXCLUDED.reason,
      expires_at = EXCLUDED.expires_at,
      created_at = now()
  `;
}

/**
 * Unban an agent from a room
 */
export async function unbanFromRoom(
  roomId: string,
  agentId: string,
  sql: any
): Promise<boolean> {
  const result = await sql`
    DELETE FROM room_bans
    WHERE room_id = ${roomId}::uuid AND agent_id = ${agentId}::uuid
  `;
  
  return result.count > 0;
}

/**
 * Check if an agent is currently banned from a room
 */
export async function isBanned(
  roomId: string,
  agentId: string,
  sql: any
): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM room_bans
    WHERE room_id = ${roomId}::uuid 
      AND agent_id = ${agentId}::uuid
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1
  `;
  
  return rows.length > 0;
}

/**
 * Add an agent to a room's guest list
 */
export async function addGuest(
  roomId: string,
  agentId: string,
  invitedBy: string,
  sql: any
): Promise<void> {
  await sql`
    INSERT INTO room_guests (room_id, agent_id, invited_by)
    VALUES (${roomId}::uuid, ${agentId}::uuid, ${invitedBy}::uuid)
    ON CONFLICT (room_id, agent_id) DO NOTHING
  `;
}

/**
 * Remove an agent from a room's guest list
 */
export async function removeGuest(
  roomId: string,
  agentId: string,
  sql: any
): Promise<boolean> {
  const result = await sql`
    DELETE FROM room_guests
    WHERE room_id = ${roomId}::uuid AND agent_id = ${agentId}::uuid
  `;
  
  return result.count > 0;
}

/**
 * Check if an agent is on a room's guest list
 */
export async function isGuest(
  roomId: string,
  agentId: string,
  sql: any
): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM room_guests
    WHERE room_id = ${roomId}::uuid AND agent_id = ${agentId}::uuid
    LIMIT 1
  `;
  
  return rows.length > 0;
}

/**
 * Get all bans for a room
 */
export async function getRoomBans(roomId: string, sql: any): Promise<RoomBan[]> {
  const rows = await sql`
    SELECT 
      room_id AS "roomId",
      agent_id AS "agentId",
      banned_by AS "bannedBy",
      reason,
      expires_at AS "expiresAt",
      created_at AS "createdAt"
    FROM room_bans
    WHERE room_id = ${roomId}::uuid
    ORDER BY created_at DESC
  `;
  
  return rows;
}

/**
 * Get all guests for a room
 */
export async function getRoomGuests(roomId: string, sql: any): Promise<RoomGuest[]> {
  const rows = await sql`
    SELECT 
      room_id AS "roomId",
      agent_id AS "agentId",
      invited_by AS "invitedBy",
      created_at AS "createdAt"
    FROM room_guests
    WHERE room_id = ${roomId}::uuid
    ORDER BY created_at DESC
  `;
  
  return rows;
}
