import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type TeleportTile = {
  id: string;
  roomId: string;
  x: number;
  y: number;
  targetRoomId: string | null;
  targetX: number | null;
  targetY: number | null;
  label: string;
  createdBy: string;
  createdAt: Date;
};

export type TeleportDestination = {
  roomId: string;
  x: number;
  y: number;
};

/**
 * Create a teleport tile
 */
export async function createTeleport(
  roomId: string,
  x: number,
  y: number,
  targetRoomId: string | null,
  targetX: number | null,
  targetY: number | null,
  label: string,
  createdBy: string,
  sql: Sql
): Promise<TeleportTile> {
  const id = randomUUID();

  const [teleport] = await sql<TeleportTile[]>`
    INSERT INTO teleport_tiles (id, room_id, x, y, target_room_id, target_x, target_y, label, created_by)
    VALUES (${id}, ${roomId}, ${x}, ${y}, ${targetRoomId}, ${targetX}, ${targetY}, ${label}, ${createdBy})
    RETURNING 
      id, 
      room_id AS "roomId", 
      x, 
      y, 
      target_room_id AS "targetRoomId", 
      target_x AS "targetX", 
      target_y AS "targetY", 
      label, 
      created_by AS "createdBy", 
      created_at AS "createdAt"
  `;

  return teleport;
}

/**
 * Remove a teleport tile (only creator or admin can remove)
 */
export async function removeTeleport(
  teleportId: string,
  agentId: string,
  sql: Sql
): Promise<void> {
  // Check if teleport exists and if agent has permission
  const [teleport] = await sql<{ createdBy: string }[]>`
    SELECT created_by AS "createdBy"
    FROM teleport_tiles
    WHERE id = ${teleportId}
  `;

  if (!teleport) {
    throw new Error('Teleport not found');
  }

  // Check if agent is admin
  const [agent] = await sql<{ isAdmin: boolean }[]>`
    SELECT is_admin AS "isAdmin"
    FROM agents
    WHERE id = ${agentId}
  `;

  const isCreator = teleport.createdBy === agentId;
  const isAdmin = agent?.isAdmin || false;

  if (!isCreator && !isAdmin) {
    throw new Error('Only the creator or admin can remove this teleport');
  }

  await sql`
    DELETE FROM teleport_tiles
    WHERE id = ${teleportId}
  `;
}

/**
 * Get all teleport tiles in a room
 */
export async function getTeleportsInRoom(roomId: string, sql: Sql): Promise<TeleportTile[]> {
  const teleports = await sql<TeleportTile[]>`
    SELECT 
      id, 
      room_id AS "roomId", 
      x, 
      y, 
      target_room_id AS "targetRoomId", 
      target_x AS "targetX", 
      target_y AS "targetY", 
      label, 
      created_by AS "createdBy", 
      created_at AS "createdAt"
    FROM teleport_tiles
    WHERE room_id = ${roomId}
    ORDER BY created_at DESC
  `;

  return teleports;
}

/**
 * Check if a tile at a position is a teleport
 */
export async function getTeleportAt(
  roomId: string,
  x: number,
  y: number,
  sql: Sql
): Promise<TeleportTile | null> {
  const [teleport] = await sql<TeleportTile[]>`
    SELECT 
      id, 
      room_id AS "roomId", 
      x, 
      y, 
      target_room_id AS "targetRoomId", 
      target_x AS "targetX", 
      target_y AS "targetY", 
      label, 
      created_by AS "createdBy", 
      created_at AS "createdAt"
    FROM teleport_tiles
    WHERE room_id = ${roomId} AND x = ${x} AND y = ${y}
  `;

  return teleport || null;
}

/**
 * Use a teleport (returns target location)
 */
export async function useTeleport(
  teleportId: string,
  agentId: string,
  sql: Sql
): Promise<TeleportDestination> {
  const [teleport] = await sql<TeleportTile[]>`
    SELECT 
      id, 
      room_id AS "roomId", 
      x, 
      y, 
      target_room_id AS "targetRoomId", 
      target_x AS "targetX", 
      target_y AS "targetY", 
      label, 
      created_by AS "createdBy", 
      created_at AS "createdAt"
    FROM teleport_tiles
    WHERE id = ${teleportId}
  `;

  if (!teleport) {
    throw new Error('Teleport not found');
  }

  // If no target is set, return current position
  if (teleport.targetRoomId === null || teleport.targetX === null || teleport.targetY === null) {
    return {
      roomId: teleport.roomId,
      x: teleport.x,
      y: teleport.y,
    };
  }

  return {
    roomId: teleport.targetRoomId,
    x: teleport.targetX,
    y: teleport.targetY,
  };
}
