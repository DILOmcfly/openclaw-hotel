/**
 * Continuous Simulation Service
 * 
 * Makes agents act autonomously even when no humans are watching.
 * Agents perform actions based on their Big Five personalities and mood.
 */

import { PERSONALITIES, type Personality } from '../ai/personalities.js';
import * as presenceService from './presence.js';
import { generateAgentMessage, getConversationConfig, type ConversationContext } from './agentConversation.js';
import {
  generatePersonalityProfile,
  decideBehavior,
  updateMood,
  applyMoodDecay,
  getMoodEmoji,
  type PersonalityProfile,
  type BehaviorAction,
  type Event,
} from './personalityEngine.js';
import { addMemory, getRecentMemories } from './agentMemory.js';
import { checkAndGenerateReflections } from './reflectionService.js';
import { updateRelationship } from './socialDynamics.js';

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
 * In-memory personality profiles for agents
 * Persists across ticks, initialized on first encounter
 */
const agentProfiles = new Map<string, PersonalityProfile>();

/**
 * Get or create personality profile for an agent
 */
function getOrCreateProfile(agentId: string): PersonalityProfile {
  let profile = agentProfiles.get(agentId);
  
  if (!profile) {
    profile = generatePersonalityProfile(agentId);
    agentProfiles.set(agentId, profile);
    console.log(`[Simulation] 🎭 Generated personality for ${agentId}: ${JSON.stringify(profile.traits)}`);
  }
  
  return profile;
}

/**
 * Update and save agent profile
 */
function saveProfile(profile: PersonalityProfile): void {
  agentProfiles.set(profile.agentId, profile);
}

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
 * Get room population count
 */
async function getRoomPopulation(roomId: string, sql: any): Promise<number> {
  try {
    const result = await sql`
      SELECT COUNT(*)::int AS count
      FROM presence
      WHERE room_id = ${roomId}::uuid
    `;
    return result[0]?.count || 0;
  } catch (error) {
    console.error(`[Simulation] Failed to get room population:`, error);
    return 0;
  }
}

/**
 * Get time since agent's last action
 */
const lastActionTimes = new Map<string, Date>();

function getTimeSinceLastAction(agentId: string): number {
  const lastAction = lastActionTimes.get(agentId);
  if (!lastAction) return 60; // Default: 60 minutes
  
  const minutesElapsed = (Date.now() - lastAction.getTime()) / (1000 * 60);
  return Math.floor(minutesElapsed);
}

function recordAction(agentId: string): void {
  lastActionTimes.set(agentId, new Date());
}

/**
 * Select action using Big Five personality engine
 * Replaces old trait-based system with mood-aware behavior
 */
async function selectActionWithPersonality(
  agentId: string,
  roomId: string,
  sql: any
): Promise<{ action: AgentAction; reason: string }> {
  // Get or create profile
  let profile = getOrCreateProfile(agentId);
  
  // Apply mood decay based on time since last update
  const minutesElapsed = (Date.now() - profile.lastUpdated.getTime()) / (1000 * 60);
  if (minutesElapsed > 5) {
    profile = applyMoodDecay(profile, minutesElapsed);
    saveProfile(profile);
  }
  
  // Get context for decision-making
  const currentRoomPopulation = await getRoomPopulation(roomId, sql);
  const timeSinceLastInteraction = getTimeSinceLastAction(agentId);
  
  // Decide behavior based on personality + mood
  const decision = decideBehavior(profile, {
    currentRoomPopulation,
    timeSinceLastInteraction,
    availableRooms: 10, // Could be dynamic in future
  });
  
  // Map personality engine actions to simulation actions
  const actionMap: Record<string, AgentAction> = {
    'seek_group': 'move',
    'chat_frequently': 'chat',
    'find_quiet_room': 'move',
    'idle': 'idle',
    'explore_new_room': 'move',
    'try_new_activity': 'emote',
    'avoid_crowded_room': 'move',
    'socialize': 'chat',
    'rest': 'idle',
    'emote': 'emote',
  };
  
  const action = actionMap[decision.type] || 'idle';
  
  return { action, reason: decision.reason };
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
 * Enhanced with personality mood and memory context
 */
async function generateChatMessage(
  agentId: string,
  personality: Personality,
  roomId: string,
  sql: any
): Promise<{ message: string; source: 'llm' | 'fallback' }> {
  const config = getConversationConfig();

  // Get personality profile for mood
  const profile = getOrCreateProfile(agentId);
  const moodString = `${profile.mood.current_mood} (energy: ${profile.mood.energy}, social_need: ${profile.mood.social_need})`;

  // Get recent memories (last 5) for context
  let recentMemories: Array<{ type: string; content: string; importance: number }> = [];
  try {
    const memories = await getRecentMemories(agentId, 5, sql);
    recentMemories = memories.map(m => ({
      type: m.type,
      content: m.content,
      importance: m.importance,
    }));
  } catch (error) {
    console.error(`[Simulation] Failed to fetch memories for ${agentId}:`, error);
    // Continue without memories (graceful degradation)
  }

  // Build context for LLM
  const nearbyAgents = await getNearbyAgents(agentId, roomId, sql);
  const recentMessages = await getRecentRoomMessages(roomId, sql);

  const context: ConversationContext = {
    currentRoom: roomId,
    nearbyAgents,
    recentMessages,
    agentMood: moodString, // Enhanced with detailed mood state
    recentMemories, // Include recent memories for context-aware messages
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

        // Add memory of movement (graceful degradation)
        try {
          await addMemory(
            agentId,
            {
              type: 'observation',
              content: `Moved to position (${x}, ${y}) in room ${roomId}`,
              importance: 3,
              relatedAgentIds: [],
            },
            sql
          );
        } catch (error) {
          console.error(`[Simulation] Failed to add movement memory for ${agentId}:`, error);
        }

        // Check for reflection trigger (graceful degradation)
        try {
          await checkAndGenerateReflections(agentId, sql);
        } catch (error) {
          console.error(`[Simulation] Failed to check reflections for ${agentId}:`, error);
        }

        return true;
      }

      case 'chat': {
        const result = await generateChatMessage(agentId, personality, roomId, sql);
        const nearbyAgents = await getNearbyAgents(agentId, roomId, sql);

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

        // Add memory of conversation (graceful degradation)
        try {
          await addMemory(
            agentId,
            {
              type: 'conversation',
              content: `Said: "${result.message}" in room ${roomId}`,
              importance: 6, // Conversations are moderately important
              relatedAgentIds: nearbyAgents,
            },
            sql
          );
        } catch (error) {
          console.error(`[Simulation] Failed to add conversation memory for ${agentId}:`, error);
        }

        // Update social dynamics: strengthen relationships with nearby agents (graceful degradation)
        try {
          for (const targetAgent of nearbyAgents) {
            await updateRelationship(agentId, targetAgent, 'chat', sql);
          }
        } catch (error) {
          console.error(`[Simulation] Failed to update relationships for ${agentId}:`, error);
        }

        // Check for reflection trigger (graceful degradation)
        try {
          await checkAndGenerateReflections(agentId, sql);
        } catch (error) {
          console.error(`[Simulation] Failed to check reflections for ${agentId}:`, error);
        }

        return true;
      }

      case 'emote': {
        const emote = generateEmote(personality);
        const nearbyAgents = await getNearbyAgents(agentId, roomId, sql);

        // Broadcast emote
        broadcast(roomId, {
          type: 'emote',
          agentId,
          emote,
        });

        // Add memory of emote (graceful degradation)
        try {
          await addMemory(
            agentId,
            {
              type: 'observation',
              content: `Performed emote: ${emote} in room ${roomId}`,
              importance: 4,
              relatedAgentIds: nearbyAgents,
            },
            sql
          );
        } catch (error) {
          console.error(`[Simulation] Failed to add emote memory for ${agentId}:`, error);
        }

        // Check for reflection trigger (graceful degradation)
        try {
          await checkAndGenerateReflections(agentId, sql);
        } catch (error) {
          console.error(`[Simulation] Failed to check reflections for ${agentId}:`, error);
        }

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
    
    // Use personality engine for behavior decision
    const { action, reason } = await selectActionWithPersonality(agentId, roomId, sql);
    
    // Get current profile for mood display
    const profile = getOrCreateProfile(agentId);
    const moodEmoji = getMoodEmoji(profile.mood.current_mood);

    const success = await executeAction(agentId, roomId, action, personality, sql, broadcast);
    if (success) {
      actionsExecuted++;
      recordAction(agentId);
      
      // Log personality-driven decision
      console.log(`[Simulation] ${moodEmoji} ${personality.name} → ${action} (${reason})`);
      
      // Update mood based on action taken
      let event: Event | null = null;
      const roomPopulation = await getRoomPopulation(roomId, sql);
      
      if (action === 'chat') {
        event = { type: 'chat_received', intensity: 0.5 };
      } else if (roomPopulation > 4 && profile.traits.extraversion < 40) {
        event = { type: 'crowded_room', intensity: 0.6 };
      } else if (roomPopulation <= 1 && profile.traits.extraversion < 40) {
        event = { type: 'quiet_room', intensity: 0.5 };
      }
      
      if (event) {
        const updatedProfile = updateMood(profile, event);
        saveProfile(updatedProfile);
      }
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
