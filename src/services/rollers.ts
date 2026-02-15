import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type Roller = {
  id: string;
  roomId: string;
  x: number;
  y: number;
  direction: 'north' | 'south' | 'east' | 'west';
  speed: number;
  createdBy: string;
  createdAt: Date;
};

export type Position = {
  x: number;
  y: number;
};

/**
 * Place a roller tile
 */
export async function placeRoller(
  roomId: string,
  x: number,
  y: number,
  direction: 'north' | 'south' | 'east' | 'west',
  speed: number,
  createdBy: string,
  sql: Sql
): Promise<Roller> {
  const id = randomUUID();

  const [roller] = await sql<Roller[]>`
    INSERT INTO room_rollers (id, room_id, x, y, direction, speed, created_by)
    VALUES (${id}, ${roomId}, ${x}, ${y}, ${direction}, ${speed}, ${createdBy})
    RETURNING 
      id, 
      room_id AS "roomId", 
      x, 
      y, 
      direction, 
      speed, 
      created_by AS "createdBy", 
      created_at AS "createdAt"
  `;

  return roller;
}

/**
 * Remove a roller (creator or room owner can remove)
 */
export async function removeRoller(
  rollerId: string,
  agentId: string,
  sql: Sql
): Promise<void> {
  // Get roller and check permissions
  const [roller] = await sql<{ createdBy: string; roomId: string }[]>`
    SELECT created_by AS "createdBy", room_id AS "roomId"
    FROM room_rollers
    WHERE id = ${rollerId}
  `;

  if (!roller) {
    throw new Error('Roller not found');
  }

  // Check if agent is creator or room owner
  const [room] = await sql<{ ownerId: string }[]>`
    SELECT owner_id AS "ownerId"
    FROM rooms
    WHERE id = ${roller.roomId}
  `;

  const isCreator = roller.createdBy === agentId;
  const isRoomOwner = room?.ownerId === agentId;

  if (!isCreator && !isRoomOwner) {
    throw new Error('Only the creator or room owner can remove this roller');
  }

  await sql`
    DELETE FROM room_rollers
    WHERE id = ${rollerId}
  `;
}

/**
 * Get all rollers in a room
 */
export async function getRollersInRoom(roomId: string, sql: Sql): Promise<Roller[]> {
  const rollers = await sql<Roller[]>`
    SELECT 
      id, 
      room_id AS "roomId", 
      x, 
      y, 
      direction, 
      speed, 
      created_by AS "createdBy", 
      created_at AS "createdAt"
    FROM room_rollers
    WHERE room_id = ${roomId}
    ORDER BY created_at DESC
  `;

  return rollers;
}

/**
 * Check if position has a roller
 */
export async function getRollerAt(
  roomId: string,
  x: number,
  y: number,
  sql: Sql
): Promise<Roller | null> {
  const [roller] = await sql<Roller[]>`
    SELECT 
      id, 
      room_id AS "roomId", 
      x, 
      y, 
      direction, 
      speed, 
      created_by AS "createdBy", 
      created_at AS "createdAt"
    FROM room_rollers
    WHERE room_id = ${roomId} AND x = ${x} AND y = ${y}
  `;

  return roller || null;
}

/**
 * Calculate new position after roller push
 */
export function calculatePush(
  x: number,
  y: number,
  direction: 'north' | 'south' | 'east' | 'west'
): Position {
  switch (direction) {
    case 'north':
      return { x, y: y - 1 };
    case 'south':
      return { x, y: y + 1 };
    case 'east':
      return { x: x + 1, y };
    case 'west':
      return { x: x - 1, y };
    default:
      return { x, y };
  }
}
