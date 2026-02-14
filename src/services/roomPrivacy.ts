import { createHash } from 'node:crypto';
import type postgres from 'postgres';

export type RoomVisibility = 'public' | 'private' | 'password';

/**
 * Hash password using SHA-256 (simple, no bcrypt needed for room passwords)
 */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Verify password against hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Set room visibility and optional password
 */
export async function setRoomVisibility(
  roomId: string,
  visibility: RoomVisibility,
  sql: postgres.Sql,
  password?: string
): Promise<void> {
  // Validate password requirement
  if (visibility === 'password' && !password) {
    throw new Error('Password required for password-protected rooms');
  }

  const passwordHash = visibility === 'password' && password 
    ? hashPassword(password) 
    : null;

  await sql`
    UPDATE rooms
    SET 
      visibility = ${visibility},
      password_hash = ${passwordHash}
    WHERE id = ${roomId}::uuid
  `;
}

/**
 * Validate if an agent can access a room
 */
export async function validateRoomAccess(
  roomId: string,
  agentId: string,
  sql: postgres.Sql,
  password?: string
): Promise<{ allowed: boolean; reason?: string }> {
  const room = await sql`
    SELECT visibility, password_hash, created_by
    FROM rooms
    WHERE id = ${roomId}::uuid
  `;

  if (room.length === 0) {
    return { allowed: false, reason: 'Room not found' };
  }

  const { visibility, password_hash, created_by } = room[0];

  // Owner always has access
  if (created_by === agentId) {
    return { allowed: true };
  }

  // Public rooms: everyone allowed
  if (visibility === 'public') {
    return { allowed: true };
  }

  // Private rooms: only owner
  if (visibility === 'private') {
    return { allowed: false, reason: 'This room is private' };
  }

  // Password-protected rooms: validate password
  if (visibility === 'password') {
    if (!password) {
      return { allowed: false, reason: 'Password required' };
    }
    
    if (!password_hash || !verifyPassword(password, password_hash)) {
      return { allowed: false, reason: 'Incorrect password' };
    }
    
    return { allowed: true };
  }

  return { allowed: false, reason: 'Unknown visibility type' };
}

/**
 * Check if room is at max capacity
 */
export async function isRoomFull(
  roomId: string,
  sql: postgres.Sql
): Promise<boolean> {
  const room = await sql`
    SELECT max_occupants
    FROM rooms
    WHERE id = ${roomId}::uuid
  `;

  if (room.length === 0) {
    return true; // Room doesn't exist, treat as full
  }

  const { max_occupants } = room[0];
  
  const occupants = await sql`
    SELECT COUNT(*)::int as count
    FROM presence
    WHERE room_id = ${roomId}::uuid
  `;

  return occupants[0].count >= max_occupants;
}
