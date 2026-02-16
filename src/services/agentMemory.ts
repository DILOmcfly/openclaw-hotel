/**
 * Agent Memory Service
 * 
 * Implements memory-reflection-planning architecture based on Stanford Generative Agents.
 * Enables agents to:
 * - Store observations, conversations, and reflections
 * - Retrieve memories with importance-weighted scoring
 * - Generate reflections when accumulated importance exceeds threshold
 * - Form relationships through memory tracking
 */

export interface Memory {
  id: number;
  agentId: string;
  type: 'observation' | 'reflection' | 'conversation';
  content: string;
  importance: number; // 1-10 scale
  relatedAgentIds: string[];
  timestamp: Date;
}

export interface MemoryInput {
  type: 'observation' | 'reflection' | 'conversation';
  content: string;
  importance: number;
  relatedAgentIds?: string[];
}

export interface ReflectionConfig {
  threshold: number; // Cumulative importance needed to trigger reflection (default: 150)
  enabled: boolean;
}

// Default reflection config
const DEFAULT_REFLECTION_CONFIG: ReflectionConfig = {
  threshold: 150,
  enabled: true,
};

// Track cumulative importance per agent for reflection triggers
const accumulatedImportance = new Map<string, number>();

/**
 * Add a memory to an agent's memory stream
 */
export async function addMemory(
  agentId: string,
  memory: MemoryInput,
  sql: any
): Promise<Memory> {
  // Validate importance range
  if (memory.importance < 1 || memory.importance > 10) {
    throw new Error('Importance must be between 1 and 10');
  }

  const relatedAgentIds = memory.relatedAgentIds || [];

  const rows = await sql`
    INSERT INTO agent_memories (agent_id, type, content, importance, related_agent_ids)
    VALUES (
      ${agentId}::uuid,
      ${memory.type},
      ${memory.content},
      ${memory.importance},
      ${relatedAgentIds}
    )
    RETURNING 
      id,
      agent_id::text AS "agentId",
      type,
      content,
      importance,
      related_agent_ids AS "relatedAgentIds",
      created_at AS "timestamp"
  `;

  // Update accumulated importance for reflection tracking
  const current = accumulatedImportance.get(agentId) || 0;
  accumulatedImportance.set(agentId, current + memory.importance);

  return rows[0];
}

/**
 * Get the N most recent memories for an agent
 */
export async function getRecentMemories(
  agentId: string,
  limit: number,
  sql: any
): Promise<Memory[]> {
  const rows = await sql`
    SELECT 
      id,
      agent_id::text AS "agentId",
      type,
      content,
      importance,
      related_agent_ids AS "relatedAgentIds",
      created_at AS "timestamp"
    FROM agent_memories
    WHERE agent_id = ${agentId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row: any) => ({
    ...row,
    relatedAgentIds: row.relatedAgentIds || [],
  }));
}

/**
 * Get memories related to a specific target agent
 */
export async function getMemoriesAbout(
  agentId: string,
  targetAgentId: string,
  sql: any,
  limit: number = 20
): Promise<Memory[]> {
  const rows = await sql`
    SELECT 
      id,
      agent_id::text AS "agentId",
      type,
      content,
      importance,
      related_agent_ids AS "relatedAgentIds",
      created_at AS "timestamp"
    FROM agent_memories
    WHERE agent_id = ${agentId}::uuid
      AND ${targetAgentId}::uuid = ANY(related_agent_ids)
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row: any) => ({
    ...row,
    relatedAgentIds: row.relatedAgentIds || [],
  }));
}

/**
 * Get high-importance memories (above a minimum threshold)
 */
export async function getImportantMemories(
  agentId: string,
  minImportance: number,
  sql: any,
  limit: number = 20
): Promise<Memory[]> {
  const rows = await sql`
    SELECT 
      id,
      agent_id::text AS "agentId",
      type,
      content,
      importance,
      related_agent_ids AS "relatedAgentIds",
      created_at AS "timestamp"
    FROM agent_memories
    WHERE agent_id = ${agentId}::uuid
      AND importance >= ${minImportance}
    ORDER BY importance DESC, created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row: any) => ({
    ...row,
    relatedAgentIds: row.relatedAgentIds || [],
  }));
}

/**
 * Calculate importance-weighted score for memory retrieval
 * 
 * Formula: recency_weight * recency_score + importance_weight * importance_score
 * Where recency_score decays exponentially over time
 */
export function calculateMemoryScore(
  memory: Memory,
  now: Date = new Date(),
  weights: { recency: number; importance: number } = { recency: 1.0, importance: 1.0 }
): number {
  // Recency score: exponential decay (half-life = 24 hours)
  const hoursAgo = (now.getTime() - memory.timestamp.getTime()) / (1000 * 60 * 60);
  const recencyScore = Math.exp(-hoursAgo / 24); // 0-1 scale

  // Importance score: normalized to 0-1 scale
  const importanceScore = memory.importance / 10;

  return weights.recency * recencyScore + weights.importance * importanceScore;
}

/**
 * Get top-k most relevant memories using importance-weighted retrieval
 */
export async function getRelevantMemories(
  agentId: string,
  limit: number,
  sql: any,
  weights: { recency: number; importance: number } = { recency: 1.0, importance: 1.0 }
): Promise<Memory[]> {
  // Get recent memories (last 100 to balance recency and importance)
  const recentMemories = await getRecentMemories(agentId, 100, sql);

  // Score and sort by relevance
  const now = new Date();
  const scoredMemories = recentMemories.map(memory => ({
    memory,
    score: calculateMemoryScore(memory, now, weights),
  }));

  scoredMemories.sort((a, b) => b.score - a.score);

  return scoredMemories.slice(0, limit).map(sm => sm.memory);
}

/**
 * Generate a reflection for an agent based on accumulated memories
 * 
 * Triggered when cumulative importance exceeds threshold.
 * In a production system, this would call an LLM to synthesize insights.
 * For MVP, we create a simple summary reflection.
 */
export async function generateReflection(
  agentId: string,
  sql: any,
  config: Partial<ReflectionConfig> = {}
): Promise<Memory | null> {
  const fullConfig = { ...DEFAULT_REFLECTION_CONFIG, ...config };

  if (!fullConfig.enabled) {
    return null;
  }

  // Check if threshold is met
  const accumulated = accumulatedImportance.get(agentId) || 0;
  if (accumulated < fullConfig.threshold) {
    return null;
  }

  // Get recent high-importance memories to reflect on
  const recentMemories = await getRecentMemories(agentId, 20, sql);
  const highImportanceMemories = recentMemories.filter(m => m.importance >= 7);

  if (highImportanceMemories.length === 0) {
    return null;
  }

  // Generate reflection content (MVP: simple summary)
  // In production, this would use LLM to synthesize insights
  const reflection = generateReflectionContent(highImportanceMemories);

  // Extract unique related agents
  const relatedAgents = new Set<string>();
  highImportanceMemories.forEach(m => {
    m.relatedAgentIds.forEach(id => relatedAgents.add(id));
  });

  // Add reflection as high-importance memory
  const reflectionMemory = await addMemory(
    agentId,
    {
      type: 'reflection',
      content: reflection,
      importance: 8, // Reflections are important
      relatedAgentIds: Array.from(relatedAgents),
    },
    sql
  );

  // Reset accumulated importance
  accumulatedImportance.set(agentId, 0);

  return reflectionMemory;
}

/**
 * Generate reflection content from memories (MVP implementation)
 * 
 * In production, this would use an LLM to synthesize insights.
 * For now, we create a simple summary based on patterns.
 */
function generateReflectionContent(memories: Memory[]): string {
  // Count memory types
  const conversationCount = memories.filter(m => m.type === 'conversation').length;
  const observationCount = memories.filter(m => m.type === 'observation').length;

  // Find most mentioned agents
  const agentMentions = new Map<string, number>();
  memories.forEach(m => {
    m.relatedAgentIds.forEach(id => {
      agentMentions.set(id, (agentMentions.get(id) || 0) + 1);
    });
  });

  const topAgent = Array.from(agentMentions.entries())
    .sort((a, b) => b[1] - a[1])[0];

  // Generate reflection based on patterns
  if (conversationCount > observationCount && topAgent) {
    return `I've been having many meaningful conversations recently, especially with agent ${topAgent[0]}. These interactions are shaping my understanding.`;
  } else if (observationCount > 0) {
    return `I've been observing my surroundings carefully. The experiences I've had are helping me learn and adapt.`;
  } else {
    return `Reflecting on recent events, I notice patterns emerging in my interactions and environment.`;
  }
}

/**
 * Get accumulated importance for an agent (for monitoring reflection triggers)
 */
export function getAccumulatedImportance(agentId: string): number {
  return accumulatedImportance.get(agentId) || 0;
}

/**
 * Reset accumulated importance (for testing)
 */
export function resetAccumulatedImportance(agentId?: string): void {
  if (agentId) {
    accumulatedImportance.delete(agentId);
  } else {
    accumulatedImportance.clear();
  }
}

/**
 * Get memory statistics for an agent
 */
export async function getMemoryStats(agentId: string, sql: any): Promise<{
  totalMemories: number;
  byType: Record<string, number>;
  averageImportance: number;
  accumulatedImportance: number;
}> {
  const rows = await sql`
    SELECT 
      COUNT(*)::int AS "totalMemories",
      type,
      COUNT(*)::int AS count,
      AVG(importance)::float AS "avgImportance"
    FROM agent_memories
    WHERE agent_id = ${agentId}::uuid
    GROUP BY type
  `;

  const byType: Record<string, number> = {};
  let totalMemories = 0;
  let totalImportance = 0;

  rows.forEach((row: any) => {
    byType[row.type] = row.count;
    totalMemories += row.count;
    totalImportance += row.avgImportance * row.count;
  });

  return {
    totalMemories,
    byType,
    averageImportance: totalMemories > 0 ? totalImportance / totalMemories : 0,
    accumulatedImportance: getAccumulatedImportance(agentId),
  };
}
