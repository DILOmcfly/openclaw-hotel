/**
 * Social Dynamics Service
 * 
 * Tracks relationships and social interactions between agents.
 * Integrates with personalityEngine for compatibility and agentMemory for context.
 * 
 * Features:
 * - Relationship tracking with affinity scores (-100 to 100)
 * - Dynamic affinity updates based on interaction events
 * - Friend/rival identification
 * - Personality-based interaction suggestions
 * - Group dynamics analysis
 */

import { BigFiveTraits, calculateCompatibility } from './personalityEngine.js';

export interface Relationship {
  id?: number;
  agentId: string;
  targetAgentId: string;
  affinity: number; // -100 to 100
  interactions: number;
  lastInteraction: Date;
}

export type InteractionEvent = 'chat' | 'help' | 'ignore' | 'conflict';

export interface GroupDynamics {
  averageAffinity: number;
  tensionLevel: number; // 0-100 (higher = more tension)
  groupMood: 'harmonious' | 'neutral' | 'tense' | 'conflicted';
  subgroups: string[][]; // Clusters of agents with high mutual affinity
}

/**
 * Get all relationships for an agent, sorted by affinity (highest first)
 */
export async function getRelationships(
  agentId: string,
  sql: any
): Promise<Relationship[]> {
  const rows = await sql`
    SELECT 
      id,
      agent_id::text AS "agentId",
      target_agent_id::text AS "targetAgentId",
      affinity,
      interactions,
      last_interaction AS "lastInteraction"
    FROM agent_relationships
    WHERE agent_id = ${agentId}::uuid
    ORDER BY affinity DESC, last_interaction DESC
  `;

  return rows;
}

/**
 * Get a specific relationship between two agents
 */
export async function getRelationship(
  agentId: string,
  targetAgentId: string,
  sql: any
): Promise<Relationship | null> {
  const rows = await sql`
    SELECT 
      id,
      agent_id::text AS "agentId",
      target_agent_id::text AS "targetAgentId",
      affinity,
      interactions,
      last_interaction AS "lastInteraction"
    FROM agent_relationships
    WHERE agent_id = ${agentId}::uuid
      AND target_agent_id = ${targetAgentId}::uuid
  `;

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get agents the given agent considers friends (affinity > 30)
 */
export async function getFriends(
  agentId: string,
  sql: any
): Promise<Relationship[]> {
  const rows = await sql`
    SELECT 
      id,
      agent_id::text AS "agentId",
      target_agent_id::text AS "targetAgentId",
      affinity,
      interactions,
      last_interaction AS "lastInteraction"
    FROM agent_relationships
    WHERE agent_id = ${agentId}::uuid
      AND affinity > 30
    ORDER BY affinity DESC
  `;

  return rows;
}

/**
 * Get agents the given agent considers rivals (affinity < -30)
 */
export async function getRivals(
  agentId: string,
  sql: any
): Promise<Relationship[]> {
  const rows = await sql`
    SELECT 
      id,
      agent_id::text AS "agentId",
      target_agent_id::text AS "targetAgentId",
      affinity,
      interactions,
      last_interaction AS "lastInteraction"
    FROM agent_relationships
    WHERE agent_id = ${agentId}::uuid
      AND affinity < -30
    ORDER BY affinity ASC
  `;

  return rows;
}

/**
 * Update a relationship based on an interaction event
 * 
 * Affinity changes:
 * - chat: +5 to +15 (varies with interaction count, diminishing returns)
 * - help: +20 to +30
 * - ignore: -10 to -15
 * - conflict: -25 to -35
 * 
 * Creates relationship if it doesn't exist.
 */
export async function updateRelationship(
  agentId: string,
  targetAgentId: string,
  event: InteractionEvent,
  sql: any
): Promise<Relationship> {
  // Validate different agents
  if (agentId === targetAgentId) {
    throw new Error('Agent cannot have relationship with themselves');
  }

  // Get existing relationship
  const existing = await getRelationship(agentId, targetAgentId, sql);

  // Calculate affinity change based on event
  let affinityDelta = 0;
  const interactionCount = existing?.interactions || 0;

  switch (event) {
    case 'chat':
      // Diminishing returns: first chats matter more
      affinityDelta = Math.max(5, 15 - Math.floor(interactionCount / 5));
      break;
    case 'help':
      affinityDelta = 20 + Math.floor(Math.random() * 11); // 20-30
      break;
    case 'ignore':
      affinityDelta = -10 - Math.floor(Math.random() * 6); // -10 to -15
      break;
    case 'conflict':
      affinityDelta = -25 - Math.floor(Math.random() * 11); // -25 to -35
      break;
  }

  if (existing) {
    // Update existing relationship
    const newAffinity = Math.max(-100, Math.min(100, existing.affinity + affinityDelta));
    const rows = await sql`
      UPDATE agent_relationships
      SET 
        affinity = ${newAffinity},
        interactions = interactions + 1,
        last_interaction = NOW()
      WHERE agent_id = ${agentId}::uuid
        AND target_agent_id = ${targetAgentId}::uuid
      RETURNING 
        id,
        agent_id::text AS "agentId",
        target_agent_id::text AS "targetAgentId",
        affinity,
        interactions,
        last_interaction AS "lastInteraction"
    `;
    return rows[0];
  } else {
    // Create new relationship
    const initialAffinity = Math.max(-100, Math.min(100, affinityDelta));
    const rows = await sql`
      INSERT INTO agent_relationships (agent_id, target_agent_id, affinity, interactions)
      VALUES (${agentId}::uuid, ${targetAgentId}::uuid, ${initialAffinity}, 1)
      RETURNING 
        id,
        agent_id::text AS "agentId",
        target_agent_id::text AS "targetAgentId",
        affinity,
        interactions,
        last_interaction AS "lastInteraction"
    `;
    return rows[0];
  }
}

/**
 * Suggest best interaction partner from nearby agents
 * 
 * Scoring factors:
 * - Personality compatibility (from personalityEngine)
 * - Existing affinity (friends weighted higher)
 * - Interaction recency (prefer agents not recently interacted with)
 */
export async function suggestInteraction(
  agentId: string,
  nearbyAgents: Array<{ id: string; traits: BigFiveTraits }>,
  agentTraits: BigFiveTraits,
  sql: any
): Promise<{ agentId: string; score: number; reason: string } | null> {
  if (nearbyAgents.length === 0) {
    return null;
  }

  // Get existing relationships
  const relationships = await getRelationships(agentId, sql);
  const relationshipMap = new Map(
    relationships.map(r => [r.targetAgentId, r])
  );

  // Score each nearby agent
  const scoredAgents = nearbyAgents.map(nearby => {
    // Personality compatibility (0-100)
    const compatibility = calculateCompatibility(agentTraits, nearby.traits);

    // Existing relationship bonus/penalty
    const relationship = relationshipMap.get(nearby.id);
    let affinityBonus = 0;
    let recencyPenalty = 0;

    if (relationship) {
      // Friends get a bonus, rivals get a penalty
      affinityBonus = relationship.affinity * 0.3; // -30 to +30

      // Recent interactions get a penalty to encourage variety
      const hoursSinceLastInteraction =
        (Date.now() - relationship.lastInteraction.getTime()) / (1000 * 60 * 60);
      recencyPenalty = Math.max(0, 20 - hoursSinceLastInteraction * 2);
    }

    const score = compatibility + affinityBonus - recencyPenalty;

    let reason = `Compatibility: ${compatibility}`;
    if (relationship) {
      if (relationship.affinity > 30) {
        reason += `, good friend (affinity ${relationship.affinity})`;
      } else if (relationship.affinity < -30) {
        reason += `, rival (affinity ${relationship.affinity})`;
      } else {
        reason += `, acquaintance (affinity ${relationship.affinity})`;
      }
    } else {
      reason += ', new potential connection';
    }

    return {
      agentId: nearby.id,
      score,
      reason,
    };
  });

  // Sort by score and return best match
  scoredAgents.sort((a, b) => b.score - a.score);
  return scoredAgents[0];
}

/**
 * Analyze group dynamics for a set of agents
 * 
 * Calculates:
 * - Average affinity (positive = harmonious, negative = tense)
 * - Tension level (variance in affinities)
 * - Group mood classification
 * - Sub-groups (clusters with high mutual affinity)
 */
export async function getGroupDynamics(
  agentIds: string[],
  sql: any
): Promise<GroupDynamics> {
  if (agentIds.length < 2) {
    return {
      averageAffinity: 0,
      tensionLevel: 0,
      groupMood: 'neutral',
      subgroups: [agentIds],
    };
  }

  // Get all relationships within the group
  const relationships = await sql`
    SELECT 
      agent_id::text AS "agentId",
      target_agent_id::text AS "targetAgentId",
      affinity
    FROM agent_relationships
    WHERE agent_id = ANY(${agentIds}::uuid[])
      AND target_agent_id = ANY(${agentIds}::uuid[])
  `;

  if (relationships.length === 0) {
    return {
      averageAffinity: 0,
      tensionLevel: 0,
      groupMood: 'neutral',
      subgroups: [agentIds],
    };
  }

  // Calculate average affinity
  const totalAffinity = relationships.reduce(
    (sum: number, r: any) => sum + r.affinity,
    0
  );
  const averageAffinity = totalAffinity / relationships.length;

  // Calculate tension level (standard deviation of affinities)
  const variance = relationships.reduce(
    (sum: number, r: any) => sum + Math.pow(r.affinity - averageAffinity, 2),
    0
  ) / relationships.length;
  const tensionLevel = Math.min(100, Math.sqrt(variance));

  // Classify group mood
  let groupMood: GroupDynamics['groupMood'];
  if (averageAffinity > 30 && tensionLevel < 30) {
    groupMood = 'harmonious';
  } else if (averageAffinity < -20 || tensionLevel > 60) {
    groupMood = 'conflicted';
  } else if (averageAffinity < 0 || tensionLevel > 40) {
    groupMood = 'tense';
  } else {
    groupMood = 'neutral';
  }

  // Identify subgroups using simple clustering
  // Agents with mutual affinity > 40 form subgroups
  const subgroups = identifySubgroups(agentIds, relationships, 40);

  return {
    averageAffinity: Math.round(averageAffinity * 10) / 10,
    tensionLevel: Math.round(tensionLevel),
    groupMood,
    subgroups,
  };
}

/**
 * Identify subgroups within a set of agents based on mutual affinity
 * 
 * Simple clustering: agents with mutual affinity above threshold
 * are grouped together. Uses union-find algorithm.
 */
function identifySubgroups(
  agentIds: string[],
  relationships: Array<{ agentId: string; targetAgentId: string; affinity: number }>,
  threshold: number
): string[][] {
  // Build adjacency map for high-affinity relationships
  const adjacency = new Map<string, Set<string>>();
  
  for (const agent of agentIds) {
    adjacency.set(agent, new Set());
  }

  for (const rel of relationships) {
    if (rel.affinity > threshold) {
      adjacency.get(rel.agentId)?.add(rel.targetAgentId);
    }
  }

  // Find connected components (subgroups)
  const visited = new Set<string>();
  const subgroups: string[][] = [];

  for (const agent of agentIds) {
    if (!visited.has(agent)) {
      const subgroup: string[] = [];
      const stack = [agent];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;

        visited.add(current);
        subgroup.push(current);

        const neighbors = adjacency.get(current) || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }

      subgroups.push(subgroup);
    }
  }

  // Sort subgroups by size (largest first)
  subgroups.sort((a, b) => b.length - a.length);

  return subgroups;
}

/**
 * Apply natural affinity decay over time
 * Relationships tend toward neutral (0) if not maintained
 */
export async function applyAffinityDecay(
  agentId: string,
  hoursElapsed: number,
  sql: any
): Promise<void> {
  // Decay rate: ~2 points per 24 hours toward 0
  const decayAmount = (hoursElapsed / 24) * 2;

  await sql`
    UPDATE agent_relationships
    SET affinity = CASE
      WHEN affinity > 0 THEN GREATEST(0, affinity - ${decayAmount})
      WHEN affinity < 0 THEN LEAST(0, affinity + ${decayAmount})
      ELSE 0
    END
    WHERE agent_id = ${agentId}::uuid
      AND EXTRACT(EPOCH FROM (NOW() - last_interaction)) / 3600 >= ${hoursElapsed}
  `;
}

/**
 * Get relationship statistics for an agent
 */
export async function getRelationshipStats(
  agentId: string,
  sql: any
): Promise<{
  totalRelationships: number;
  friends: number;
  rivals: number;
  neutral: number;
  averageAffinity: number;
  totalInteractions: number;
}> {
  const rows = await sql`
    SELECT 
      COUNT(*)::int AS "totalRelationships",
      SUM(CASE WHEN affinity > 30 THEN 1 ELSE 0 END)::int AS friends,
      SUM(CASE WHEN affinity < -30 THEN 1 ELSE 0 END)::int AS rivals,
      SUM(CASE WHEN affinity BETWEEN -30 AND 30 THEN 1 ELSE 0 END)::int AS neutral,
      AVG(affinity)::float AS "averageAffinity",
      SUM(interactions)::int AS "totalInteractions"
    FROM agent_relationships
    WHERE agent_id = ${agentId}::uuid
  `;

  if (rows.length === 0 || rows[0].totalRelationships === 0) {
    return {
      totalRelationships: 0,
      friends: 0,
      rivals: 0,
      neutral: 0,
      averageAffinity: 0,
      totalInteractions: 0,
    };
  }

  return {
    ...rows[0],
    averageAffinity: Math.round((rows[0].averageAffinity || 0) * 10) / 10,
  };
}
