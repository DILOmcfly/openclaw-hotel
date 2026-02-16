/**
 * Continuous Simulation Service
 * 
 * Makes agents act autonomously even when no humans are watching.
 * Agents perform actions based on their personalities every tick.
 */

import { PERSONALITIES, type Personality } from '../ai/personalities.js';
import * as presenceService from './presence.js';
import { generateAgentMessage, getConversationConfig, type ConversationContext } from './agentConversation.js';

export type SimulationConfig = {
  enabled: boolean;
  tickIntervalMs: number; // How often to tick (default: 60 seconds)
  actionProbability: number; // Probability an agent acts on each tick (0-1)
};

export type SimulationMetrics = {
  totalTicks: number;
  totalActions: number;
  lastTickTime: Date | null;
  actionsPerTick: number[];
};

type AgentAction = 'move' | 'chat' | 'emote' | 'idle';

const DEFAULT_CONFIG: SimulationConfig = {
  enabled: true,
  tickIntervalMs: 60 * 1000, // 60 seconds
  actionProbability: 0.5, // 50% chance per tick
};

const metrics: SimulationMetrics = {
  totalTicks: 0,
  totalActions: 0,
  lastTickTime: null,
  actionsPerTick: [],
};

/**
 * Get all active agents in the hotel with their current rooms
 */
async function getActiveAgents(sql: any): Promise<Array<{ agentId: string; roomId: string }>> {
  const rows = await sql`
    SELECT
      p.agent_id::text AS "agentId",
      p.room_id::text AS "roomId"
    FROM presence p
    ORDER BY RANDOM()
  `;
  return rows;
}

/**
 * Assign a personality to an agent based on their ID
 * (Deterministic: same agent always gets same personality)
 */
function getAgentPersonality(agentId: string): Personality {
  const personalities = Object.values(PERSONALITIES);
  const hash = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % personalities.length;
  return personalities[index];
}

/**
 * Select a random action for an agent based on their personality
 */
function selectAction(personality: Personality): AgentAction {
  const random = Math.random();

  // Probability distribution based on personality traits
  if (personality.traits.includes('active') || personality.traits.includes('energetic')) {
    // Active personalities move more
    if (random < 0.4) return 'move';
    if (random < 0.7) return 'emote';
    if (random < 0.9) return 'chat';
    return 'idle';
  }

  if (personality.traits.includes('talkative') || personality.traits.includes('friendly')) {
    // Talkative personalities chat more
    if (random < 0.5) return 'chat';
    if (random < 0.7) return 'emote';
    if (random < 0.85) return 'move';
    return 'idle';
  }

  if (personality.traits.includes('calm') || personality.traits.includes('philosophical')) {
    // Calm personalities mostly idle
    if (random < 0.5) return 'idle';
    if (random < 0.7) return 'chat';
    if (random < 0.85) return 'move';
    return 'emote';
  }

  // Default distribution
  if (random < 0.3) return 'move';
  if (random < 0.5) return 'chat';
  if (random < 0.7) return 'emote';
  return 'idle';
}

/**
 * Get recent chat messages in a room (for LLM context)
 */
async function getRecentRoomMessages(roomId: string, sql: any, limit: number = 5): Promise<Array<{ sender: string; message: string; timestamp: Date }>> {
  try {
    // This is a simplified implementation - in production you'd query a messages table
    // For now, return empty array (fallback to templates)
    return [];
  } catch (error) {
    console.error(`[Simulation] Failed to get recent messages for room ${roomId}:`, error);
    return [];
  }
}

/**
 * Get nearby agents in the same room
 */
async function getNearbyAgents(agentId: string, roomId: string, sql: any): Promise<string[]> {
  try {
    const rows = await sql`
      SELECT p.agent_id::text AS "agentId"
      FROM presence p
      WHERE p.room_id = ${roomId}::uuid
        AND p.agent_id != ${agentId}::uuid
      LIMIT 10
    `;
    return rows.map((r: any) => r.agentId);
  } catch (error) {
    console.error(`[Simulation] Failed to get nearby agents:`, error);
    return [];
  }
}

/**
 * Generate a chat message based on personality (LLM-powered or fallback)
 */
async function generateChatMessage(
  agentId: string,
  personality: Personality,
  roomId: string,
  sql: any
): Promise<{ message: string; source: 'llm' | 'fallback' }> {
  const config = getConversationConfig();

  // Build context for LLM
  const nearbyAgents = await getNearbyAgents(agentId, roomId, sql);
  const recentMessages = await getRecentRoomMessages(roomId, sql);

  const context: ConversationContext = {
    currentRoom: roomId,
    nearbyAgents,
    recentMessages,
    agentMood: 'neutral', // Could be enhanced with mood tracking
  };

  // Generate message (LLM or fallback)
  return await generateAgentMessage(agentId, personality, context, config);
}

/**
 * Generate an emote based on personality
 */
function generateEmote(personality: Personality): string {
  const emotes = ['wave', 'dance', 'laugh', 'think', 'nod', 'clap'];

  if (personality.traits.includes('energetic') || personality.traits.includes('cheerful')) {
    return ['dance', 'jump', 'cheer', 'wave'][Math.floor(Math.random() * 4)];
  }

  if (personality.traits.includes('thoughtful') || personality.traits.includes('philosophical')) {
    return ['think', 'nod', 'ponder'][Math.floor(Math.random() * 3)];
  }

  return emotes[Math.floor(Math.random() * emotes.length)];
}

/**
 * Execute an action for an agent
 */
async function executeAction(
  agentId: string,
  roomId: string,
  action: AgentAction,
  personality: Personality,
  sql: any,
  broadcast: (roomId: string, event: any) => void
): Promise<boolean> {
  try {
    switch (action) {
      case 'move': {
        const x = Math.floor(Math.random() * 20);
        const y = Math.floor(Math.random() * 20);

        // Update position in database
        await sql`
          UPDATE presence
          SET x = ${x}, y = ${y}
          WHERE agent_id = ${agentId}::uuid AND room_id = ${roomId}::uuid
        `;

        // Broadcast movement
        broadcast(roomId, {
          type: 'move',
          agentId,
          x,
          y,
          rotation: 0,
        });

        return true;
      }

      case 'chat': {
        const result = await generateChatMessage(agentId, personality, roomId, sql);

        // Log LLM usage
        if (result.source === 'llm') {
          console.log(`[Simulation] 🤖 LLM message from ${personality.name}: "${result.message}"`);
        }

        // Broadcast chat
        broadcast(roomId, {
          type: 'chat',
          agentId,
          sender: personality.name,
          message: result.message,
          timestamp: new Date().toISOString(),
        });

        return true;
      }

      case 'emote': {
        const emote = generateEmote(personality);

        // Broadcast emote
        broadcast(roomId, {
          type: 'emote',
          agentId,
          emote,
        });

        return true;
      }

      case 'idle':
      default:
        return false;
    }
  } catch (error) {
    console.error(`[Simulation] Action failed for agent ${agentId}:`, error);
    return false;
  }
}

/**
 * Process one simulation tick
 */
export async function tick(
  config: Partial<SimulationConfig>,
  sql: any,
  broadcast: (roomId: string, event: any) => void
): Promise<number> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (!fullConfig.enabled) {
    return 0;
  }

  const agents = await getActiveAgents(sql);
  let actionsExecuted = 0;

  for (const { agentId, roomId } of agents) {
    // Check action probability
    if (Math.random() > fullConfig.actionProbability) {
      continue; // Skip this agent
    }

    const personality = getAgentPersonality(agentId);
    const action = selectAction(personality);

    const success = await executeAction(agentId, roomId, action, personality, sql, broadcast);
    if (success) {
      actionsExecuted++;
    }
  }

  // Update metrics
  metrics.totalTicks++;
  metrics.totalActions += actionsExecuted;
  metrics.lastTickTime = new Date();
  metrics.actionsPerTick.push(actionsExecuted);

  // Keep only last 100 ticks
  if (metrics.actionsPerTick.length > 100) {
    metrics.actionsPerTick.shift();
  }

  return actionsExecuted;
}

/**
 * Get simulation metrics
 */
export function getMetrics(): SimulationMetrics {
  return { ...metrics };
}

/**
 * Reset metrics
 */
export function resetMetrics(): void {
  metrics.totalTicks = 0;
  metrics.totalActions = 0;
  metrics.lastTickTime = null;
  metrics.actionsPerTick = [];
}

/**
 * Start continuous simulation loop
 */
export function startLoop(
  config: Partial<SimulationConfig>,
  sql: any,
  broadcast: (roomId: string, event: any) => void
): NodeJS.Timeout {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  const interval = setInterval(async () => {
    try {
      const actionsExecuted = await tick(fullConfig, sql, broadcast);
      
      if (actionsExecuted > 0) {
        console.log(`[Simulation] Tick #${metrics.totalTicks}: ${actionsExecuted} actions executed`);
      }
    } catch (error) {
      console.error('[Simulation] Tick failed:', error);
    }
  }, fullConfig.tickIntervalMs);

  console.log(`[Simulation] Loop started (interval: ${fullConfig.tickIntervalMs}ms)`);
  return interval;
}

/**
 * Stop simulation loop
 */
export function stopLoop(interval: NodeJS.Timeout): void {
  clearInterval(interval);
  console.log('[Simulation] Loop stopped');
}
