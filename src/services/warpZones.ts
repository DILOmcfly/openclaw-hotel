import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type WarpZone = {
  id: string;
  name: string;
  description: string;
  targetRoomId: string;
  targetX: number;
  targetY: number;
  icon: string;
  category: 'general' | 'social' | 'games' | 'shops' | 'events' | 'vip';
  isActive: boolean;
  useCount: number;
  createdBy: string;
  createdAt: Date;
};

export type WarpDestination = {
  roomId: string;
  x: number;
  y: number;
};

/**
 * Create a warp zone
 */
export async function createWarp(
  name: string,
  description: string,
  targetRoomId: string,
  targetX: number,
  targetY: number,
  icon: string,
  category: string,
  createdBy: string,
  sql: Sql
): Promise<WarpZone> {
  const id = randomUUID();

  const [warp] = await sql<WarpZone[]>`
    INSERT INTO warp_zones (id, name, description, target_room_id, target_x, target_y, icon, category, created_by)
    VALUES (${id}, ${name}, ${description}, ${targetRoomId}, ${targetX}, ${targetY}, ${icon}, ${category}, ${createdBy})
    RETURNING 
      id, 
      name, 
      description, 
      target_room_id AS "targetRoomId", 
      target_x AS "targetX", 
      target_y AS "targetY", 
      icon, 
      category, 
      is_active AS "isActive", 
      use_count AS "useCount", 
      created_by AS "createdBy", 
      created_at AS "createdAt"
  `;

  return warp;
}

/**
 * Get active warp zones with optional category filter
 */
export async function getActiveWarps(category: string | undefined, sql: Sql): Promise<WarpZone[]> {
  if (category) {
    return await sql<WarpZone[]>`
      SELECT 
        id, 
        name, 
        description, 
        target_room_id AS "targetRoomId", 
        target_x AS "targetX", 
        target_y AS "targetY", 
        icon, 
        category, 
        is_active AS "isActive", 
        use_count AS "useCount", 
        created_by AS "createdBy", 
        created_at AS "createdAt"
      FROM warp_zones
      WHERE is_active = true AND category = ${category}
      ORDER BY name ASC
    `;
  }

  return await sql<WarpZone[]>`
    SELECT 
      id, 
      name, 
      description, 
      target_room_id AS "targetRoomId", 
      target_x AS "targetX", 
      target_y AS "targetY", 
      icon, 
      category, 
      is_active AS "isActive", 
      use_count AS "useCount", 
      created_by AS "createdBy", 
      created_at AS "createdAt"
    FROM warp_zones
    WHERE is_active = true
    ORDER BY name ASC
  `;
}

/**
 * Use a warp zone (increment use_count and return destination)
 */
export async function useWarp(warpId: string, sql: Sql): Promise<WarpDestination> {
  const [warp] = await sql<WarpZone[]>`
    SELECT 
      id, 
      name, 
      description, 
      target_room_id AS "targetRoomId", 
      target_x AS "targetX", 
      target_y AS "targetY", 
      icon, 
      category, 
      is_active AS "isActive", 
      use_count AS "useCount", 
      created_by AS "createdBy", 
      created_at AS "createdAt"
    FROM warp_zones
    WHERE id = ${warpId} AND is_active = true
  `;

  if (!warp) {
    throw new Error('Warp zone not found or inactive');
  }

  // Increment use count
  await sql`
    UPDATE warp_zones
    SET use_count = use_count + 1
    WHERE id = ${warpId}
  `;

  return {
    roomId: warp.targetRoomId,
    x: warp.targetX,
    y: warp.targetY,
  };
}

/**
 * Deactivate a warp zone
 */
export async function deactivateWarp(warpId: string, sql: Sql): Promise<void> {
  const result = await sql`
    UPDATE warp_zones
    SET is_active = false
    WHERE id = ${warpId}
  `;

  if (result.count === 0) {
    throw new Error('Warp zone not found');
  }
}

/**
 * Get popular warp zones sorted by use_count
 */
export async function getPopularWarps(limit: number, sql: Sql): Promise<WarpZone[]> {
  return await sql<WarpZone[]>`
    SELECT 
      id, 
      name, 
      description, 
      target_room_id AS "targetRoomId", 
      target_x AS "targetX", 
      target_y AS "targetY", 
      icon, 
      category, 
      is_active AS "isActive", 
      use_count AS "useCount", 
      created_by AS "createdBy", 
      created_at AS "createdAt"
    FROM warp_zones
    WHERE is_active = true
    ORDER BY use_count DESC, name ASC
    LIMIT ${limit}
  `;
}
