/**
 * Reflection Service
 * 
 * Template-based reflection generation for agents.
 * Analyzes memory patterns and synthesizes higher-level insights.
 */

import {
  type Memory,
  getRecentMemories,
  addMemory,
  getAccumulatedImportance,
  resetAccumulatedImportance,
} from './agentMemory.js';

export interface ReflectionThreshold {
  default: number;
  min: number;
  max: number;
}

export const REFLECTION_THRESHOLD: ReflectionThreshold = {
  default: 150,
  min: 50,
  max: 500,
};

/**
 * Pattern analysis for memory reflection
 */
interface MemoryPattern {
  // Action patterns
  frequentActions: Map<string, number>; // action -> count
  frequentRooms: Map<string, number>; // room -> count
  
  // Social patterns
  agentInteractions: Map<string, number>; // agentId -> count
  positiveInteractions: number;
  negativeInteractions: number;
  
  // Temporal patterns
  recentMemoryCount: number;
  highImportanceCount: number;
  conversationRatio: number; // conversations / total
}

/**
 * Extract patterns from a set of memories
 */
function analyzeMemoryPatterns(memories: Memory[]): MemoryPattern {
  const pattern: MemoryPattern = {
    frequentActions: new Map(),
    frequentRooms: new Map(),
    agentInteractions: new Map(),
    positiveInteractions: 0,
    negativeInteractions: 0,
    recentMemoryCount: memories.length,
    highImportanceCount: 0,
    conversationRatio: 0,
  };

  let conversationCount = 0;

  for (const memory of memories) {
    // Count high importance
    if (memory.importance >= 7) {
      pattern.highImportanceCount++;
    }

    // Count conversations
    if (memory.type === 'conversation') {
      conversationCount++;
    }

    // Extract actions from content (simple keyword matching)
    const content = memory.content.toLowerCase();
    
    // Action patterns
    const actionKeywords = ['moved', 'talked', 'chatted', 'explored', 'visited', 'met', 'saw', 'heard'];
    for (const action of actionKeywords) {
      if (content.includes(action)) {
        pattern.frequentActions.set(action, (pattern.frequentActions.get(action) || 0) + 1);
      }
    }

    // Room patterns (extract room mentions)
    const roomMatch = content.match(/room[_\s]?(\w+)/i);
    if (roomMatch) {
      const room = roomMatch[1];
      pattern.frequentRooms.set(room, (pattern.frequentRooms.get(room) || 0) + 1);
    }

    // Social patterns
    for (const agentId of memory.relatedAgentIds) {
      pattern.agentInteractions.set(agentId, (pattern.agentInteractions.get(agentId) || 0) + 1);
    }

    // Sentiment detection (simple keyword-based)
    const positiveKeywords = ['enjoyed', 'happy', 'pleasant', 'friendly', 'fun', 'interesting'];
    const negativeKeywords = ['avoid', 'uncomfortable', 'boring', 'difficult', 'annoying'];
    
    if (positiveKeywords.some(kw => content.includes(kw))) {
      pattern.positiveInteractions++;
    }
    if (negativeKeywords.some(kw => content.includes(kw))) {
      pattern.negativeInteractions++;
    }
  }

  pattern.conversationRatio = memories.length > 0 ? conversationCount / memories.length : 0;

  return pattern;
}

/**
 * Generate reflection content from memory patterns using templates
 */
export function buildReflectionPrompt(memories: Memory[]): string {
  const pattern = analyzeMemoryPatterns(memories);

  // Select reflection template based on patterns
  const reflections: string[] = [];

  // Social relationship reflections
  if (pattern.agentInteractions.size > 0) {
    const topAgent = Array.from(pattern.agentInteractions.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topAgent && topAgent[1] >= 3) {
      const sentiment = pattern.positiveInteractions > pattern.negativeInteractions 
        ? 'positive' 
        : pattern.negativeInteractions > pattern.positiveInteractions 
        ? 'challenging' 
        : 'neutral';
      
      reflections.push(
        `My relationship with ${topAgent[0]} has been ${sentiment}. We've interacted ${topAgent[1]} times recently.`
      );
    }

    if (pattern.agentInteractions.size >= 3) {
      reflections.push(
        `I've been socializing actively with ${pattern.agentInteractions.size} different agents.`
      );
    }
  }

  // Activity pattern reflections
  if (pattern.frequentActions.size > 0) {
    const topAction = Array.from(pattern.frequentActions.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topAction && topAction[1] >= 3) {
      reflections.push(
        `I notice I've been ${topAction[0]} a lot recently (${topAction[1]} times).`
      );
    }
  }

  // Room/location reflections
  if (pattern.frequentRooms.size > 0) {
    const topRoom = Array.from(pattern.frequentRooms.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topRoom && topRoom[1] >= 3) {
      reflections.push(
        `I seem to be spending a lot of time in ${topRoom[0]}.`
      );
    }
  }

  // Conversation intensity reflection
  if (pattern.conversationRatio > 0.6) {
    reflections.push(
      `I've been very talkative lately, with conversations making up most of my recent experiences.`
    );
  } else if (pattern.conversationRatio < 0.2 && pattern.recentMemoryCount > 5) {
    reflections.push(
      `I've been relatively quiet, mostly observing rather than conversing.`
    );
  }

  // High-importance events reflection
  if (pattern.highImportanceCount >= 3) {
    reflections.push(
      `Several significant events have occurred recently that I should remember.`
    );
  }

  // Sentiment reflection
  if (pattern.positiveInteractions >= 3 && pattern.positiveInteractions > pattern.negativeInteractions * 2) {
    reflections.push(
      `My recent interactions have been mostly positive and enjoyable.`
    );
  } else if (pattern.negativeInteractions >= 2 && pattern.negativeInteractions > pattern.positiveInteractions) {
    reflections.push(
      `I've encountered some challenging situations lately that require attention.`
    );
  }

  // Fallback reflection if no patterns detected
  if (reflections.length === 0) {
    reflections.push(
      `Reflecting on recent events, I notice patterns emerging in my interactions and environment.`
    );
  }

  // Combine reflections into coherent insight
  return reflections.join(' ');
}

/**
 * Check if reflection should be triggered and generate if threshold met
 * 
 * Returns the generated reflection memory, or null if threshold not met
 */
export async function checkAndGenerateReflections(
  agentId: string,
  sql: any,
  threshold: number = REFLECTION_THRESHOLD.default
): Promise<Memory | null> {
  // Check accumulated importance
  const accumulated = getAccumulatedImportance(agentId);
  
  if (accumulated < threshold) {
    return null;
  }

  console.log(`[Reflection] 🧠 Agent ${agentId} reached threshold (${accumulated}/${threshold}), generating reflection...`);

  // Get recent memories to reflect on
  const recentMemories = await getRecentMemories(agentId, 30, sql);
  
  if (recentMemories.length === 0) {
    console.log(`[Reflection] No memories found for agent ${agentId}, skipping reflection`);
    return null;
  }

  // Filter for high-importance and recent memories
  const significantMemories = recentMemories.filter(
    m => m.importance >= 5 || m.type === 'conversation'
  ).slice(0, 20);

  if (significantMemories.length === 0) {
    console.log(`[Reflection] No significant memories for agent ${agentId}, skipping reflection`);
    return null;
  }

  // Generate reflection content
  const reflectionContent = buildReflectionPrompt(significantMemories);

  // Extract unique related agents from source memories
  const relatedAgents = new Set<string>();
  significantMemories.forEach(m => {
    m.relatedAgentIds.forEach(id => relatedAgents.add(id));
  });

  // Determine reflection importance (8-10 based on source memory importance)
  const avgImportance = significantMemories.reduce((sum, m) => sum + m.importance, 0) / significantMemories.length;
  const reflectionImportance = Math.min(10, Math.max(8, Math.round(avgImportance + 1)));

  // Add reflection as a high-importance memory
  const reflection = await addMemory(
    agentId,
    {
      type: 'reflection',
      content: reflectionContent,
      importance: reflectionImportance,
      relatedAgentIds: Array.from(relatedAgents),
    },
    sql
  );

  console.log(`[Reflection] ✨ Generated reflection for ${agentId}: "${reflectionContent}"`);

  // Reset accumulated importance counter
  resetAccumulatedImportance(agentId);

  return reflection;
}

/**
 * Generate multiple reflections if accumulated importance is very high
 * (e.g., 2x or 3x threshold)
 */
export async function checkAndGenerateMultipleReflections(
  agentId: string,
  sql: any,
  threshold: number = REFLECTION_THRESHOLD.default
): Promise<Memory[]> {
  const reflections: Memory[] = [];
  const accumulated = getAccumulatedImportance(agentId);
  
  // Calculate how many reflections to generate
  const reflectionCount = Math.floor(accumulated / threshold);
  
  if (reflectionCount === 0) {
    return reflections;
  }

  console.log(`[Reflection] 🧠 Agent ${agentId} has accumulated ${accumulated} importance, generating ${reflectionCount} reflection(s)...`);

  // Generate reflections one at a time
  for (let i = 0; i < reflectionCount; i++) {
    const reflection = await checkAndGenerateReflections(agentId, sql, threshold);
    if (reflection) {
      reflections.push(reflection);
    } else {
      break; // Stop if we can't generate more
    }
  }

  return reflections;
}

/**
 * Get reflection statistics for an agent
 */
export async function getReflectionStats(agentId: string, sql: any): Promise<{
  totalReflections: number;
  accumulatedImportance: number;
  distanceToThreshold: number;
  readyForReflection: boolean;
}> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM agent_memories
    WHERE agent_id = ${agentId}::uuid AND type = 'reflection'
  `;

  const accumulated = getAccumulatedImportance(agentId);
  const threshold = REFLECTION_THRESHOLD.default;

  return {
    totalReflections: rows[0]?.count || 0,
    accumulatedImportance: accumulated,
    distanceToThreshold: Math.max(0, threshold - accumulated),
    readyForReflection: accumulated >= threshold,
  };
}
