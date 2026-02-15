import type { Sql } from 'postgres';

export type RelationshipType = 'rival' | 'partner' | 'mentor' | 'mentee' | 'blocked';

export type Relationship = {
  id: string;
  agentId: string;
  targetId: string;
  relationshipType: RelationshipType;
  createdAt: Date;
};

/**
 * Set a relationship between two agents
 */
export async function setRelationship(
  agentId: string,
  targetId: string,
  type: RelationshipType,
  sql: Sql
): Promise<Relationship> {
  if (agentId === targetId) {
    throw new Error('Cannot create relationship with yourself');
  }

  const [relationship] = await sql<Relationship[]>`
    INSERT INTO agent_relationships (agent_id, target_id, relationship_type)
    VALUES (${agentId}, ${targetId}, ${type})
    ON CONFLICT (agent_id, target_id, relationship_type) DO UPDATE
    SET created_at = NOW()
    RETURNING id, agent_id AS "agentId", target_id AS "targetId", 
              relationship_type AS "relationshipType", created_at AS "createdAt"
  `;

  return relationship;
}

/**
 * Remove a specific relationship type between two agents
 */
export async function removeRelationship(
  agentId: string,
  targetId: string,
  type: RelationshipType,
  sql: Sql
): Promise<void> {
  await sql`
    DELETE FROM agent_relationships
    WHERE agent_id = ${agentId}
      AND target_id = ${targetId}
      AND relationship_type = ${type}
  `;
}

/**
 * Get all relationships for an agent, optionally filtered by type
 */
export async function getRelationships(
  agentId: string,
  type: RelationshipType | undefined,
  sql: Sql
): Promise<Relationship[]> {
  if (type) {
    return await sql<Relationship[]>`
      SELECT id, agent_id AS "agentId", target_id AS "targetId",
             relationship_type AS "relationshipType", created_at AS "createdAt"
      FROM agent_relationships
      WHERE agent_id = ${agentId}
        AND relationship_type = ${type}
      ORDER BY created_at DESC
    `;
  }

  return await sql<Relationship[]>`
    SELECT id, agent_id AS "agentId", target_id AS "targetId",
           relationship_type AS "relationshipType", created_at AS "createdAt"
    FROM agent_relationships
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
  `;
}

/**
 * Get the relationship between two specific agents (one direction)
 */
export async function getRelationshipBetween(
  agentId: string,
  targetId: string,
  sql: Sql
): Promise<Relationship[]> {
  return await sql<Relationship[]>`
    SELECT id, agent_id AS "agentId", target_id AS "targetId",
           relationship_type AS "relationshipType", created_at AS "createdAt"
    FROM agent_relationships
    WHERE agent_id = ${agentId}
      AND target_id = ${targetId}
    ORDER BY created_at DESC
  `;
}

/**
 * Check if an agent is blocked by another
 */
export async function isBlocked(
  agentId: string,
  targetId: string,
  sql: Sql
): Promise<boolean> {
  const [result] = await sql`
    SELECT id
    FROM agent_relationships
    WHERE agent_id = ${agentId}
      AND target_id = ${targetId}
      AND relationship_type = 'blocked'
  `;

  return !!result;
}

/**
 * Get mutual relationships between two agents (both directions)
 */
export async function getMutualRelationships(
  agentId: string,
  targetId: string,
  sql: Sql
): Promise<{ from: Relationship[], to: Relationship[] }> {
  const from = await getRelationshipBetween(agentId, targetId, sql);
  const to = await getRelationshipBetween(targetId, agentId, sql);

  return { from, to };
}
