import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type TargetType = 'room' | 'agent' | 'item' | 'guild';

export type Favorite = {
  id: string;
  agentId: string;
  targetType: TargetType;
  targetId: string;
  createdAt: Date;
};

const MAX_FAVORITES_PER_TYPE = 50;

/**
 * Add a favorite for an agent
 */
export async function addFavorite(
  agentId: string,
  targetType: TargetType,
  targetId: string,
  sql: Sql
): Promise<Favorite> {
  // Check current count
  const [{ count }] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count
    FROM agent_favorites
    WHERE agent_id = ${agentId} AND target_type = ${targetType}
  `;

  if (count >= MAX_FAVORITES_PER_TYPE) {
    throw new Error(`Cannot exceed ${MAX_FAVORITES_PER_TYPE} favorites per type`);
  }

  // Insert or return existing
  const id = randomUUID();
  const [favorite] = await sql<Favorite[]>`
    INSERT INTO agent_favorites (id, agent_id, target_type, target_id)
    VALUES (${id}, ${agentId}, ${targetType}, ${targetId})
    ON CONFLICT (agent_id, target_type, target_id) DO UPDATE
    SET agent_id = EXCLUDED.agent_id
    RETURNING id, agent_id AS "agentId", target_type AS "targetType", target_id AS "targetId", created_at AS "createdAt"
  `;

  return favorite;
}

/**
 * Remove a favorite
 */
export async function removeFavorite(
  agentId: string,
  targetType: TargetType,
  targetId: string,
  sql: Sql
): Promise<void> {
  await sql`
    DELETE FROM agent_favorites
    WHERE agent_id = ${agentId}
      AND target_type = ${targetType}
      AND target_id = ${targetId}
  `;
}

/**
 * Get favorites for an agent, optionally filtered by type
 */
export async function getFavorites(
  agentId: string,
  targetType: TargetType | undefined,
  sql: Sql
): Promise<Favorite[]> {
  if (targetType) {
    return await sql<Favorite[]>`
      SELECT id, agent_id AS "agentId", target_type AS "targetType", target_id AS "targetId", created_at AS "createdAt"
      FROM agent_favorites
      WHERE agent_id = ${agentId} AND target_type = ${targetType}
      ORDER BY created_at DESC
    `;
  }

  return await sql<Favorite[]>`
    SELECT id, agent_id AS "agentId", target_type AS "targetType", target_id AS "targetId", created_at AS "createdAt"
    FROM agent_favorites
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
  `;
}

/**
 * Check if an agent has favorited a target
 */
export async function isFavorite(
  agentId: string,
  targetType: TargetType,
  targetId: string,
  sql: Sql
): Promise<boolean> {
  const [result] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1 FROM agent_favorites
      WHERE agent_id = ${agentId}
        AND target_type = ${targetType}
        AND target_id = ${targetId}
    ) as exists
  `;

  return result.exists;
}

/**
 * Get count of favorites for an agent by type
 */
export async function getFavoriteCount(
  agentId: string,
  targetType: TargetType,
  sql: Sql
): Promise<number> {
  const [{ count }] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count
    FROM agent_favorites
    WHERE agent_id = ${agentId} AND target_type = ${targetType}
  `;

  return count;
}

/**
 * Get most favorited targets of a specific type
 */
export async function getPopularTargets(
  targetType: TargetType,
  limit: number,
  sql: Sql
): Promise<Array<{ targetId: string; count: number }>> {
  return await sql<Array<{ targetId: string; count: number }>>`
    SELECT target_id AS "targetId", COUNT(*)::int as count
    FROM agent_favorites
    WHERE target_type = ${targetType}
    GROUP BY target_id
    ORDER BY count DESC
    LIMIT ${limit}
  `;
}
