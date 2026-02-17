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
import { addLiveEvent, buildEventMessage, EVENT_ICONS } from './liveEventsStore.js';

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

type AgentAction = 'move' | 'chat' | 'emote' | 'idle' | 'wander' | 'follow' | 'dance' | 'useFurniture' | 'playGame' | 'tradeItem' | 'emoteReact';

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
 * Track how many ticks have elapsed (used to trigger room wandering)
 */
let simulationTickCount = 0;

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
 * Find nearby furniture in the same room (within 2 tiles)
 */
async function findNearbyFurniture(agentId: string, roomId: string, sql: any): Promise<Array<{ id: string; x: number; y: number; itemDefId: string }>> {
  try {
    const agentPos = await sql`
      SELECT x, y
      FROM presence
      WHERE agent_id = ${agentId}::uuid AND room_id = ${roomId}::uuid
    `;
    
    if (!agentPos || agentPos.length === 0) return [];
    
    const { x: agentX, y: agentY } = agentPos[0];
    
    const furniture = await sql`
      SELECT id::text, x, y, item_def_id::text AS "itemDefId"
      FROM furniture
      WHERE room_id = ${roomId}::uuid
        AND abs(x - ${agentX}) <= 2
        AND abs(y - ${agentY}) <= 2
      LIMIT 5
    `;
    
    return furniture;
  } catch (error) {
    console.error(`[Simulation] Failed to find nearby furniture:`, error);
    return [];
  }
}

/**
 * Find nearby agents in the same room (within 3 tiles)
 */
async function findNearbyAgents(agentId: string, roomId: string, sql: any): Promise<Array<{ agentId: string; x: number; y: number }>> {
  try {
    const agentPos = await sql`
      SELECT x, y
      FROM presence
      WHERE agent_id = ${agentId}::uuid AND room_id = ${roomId}::uuid
    `;
    
    if (!agentPos || agentPos.length === 0) return [];
    
    const { x: agentX, y: agentY } = agentPos[0];
    
    const nearbyAgents = await sql`
      SELECT agent_id::text AS "agentId", x, y
      FROM presence
      WHERE room_id = ${roomId}::uuid
        AND agent_id != ${agentId}::uuid
        AND abs(x - ${agentX}) <= 3
        AND abs(y - ${agentY}) <= 3
      LIMIT 5
    `;
    
    return nearbyAgents;
  } catch (error) {
    console.error(`[Simulation] Failed to find nearby agents:`, error);
    return [];
  }
}

/**
 * Get room theme for context-aware behaviors
 */
async function getRoomTheme(roomId: string, sql: any): Promise<string | null> {
  try {
    const room = await sql`
      SELECT theme
      FROM rooms
      WHERE id = ${roomId}::uuid
    `;
    
    return room && room.length > 0 ? room[0].theme : null;
  } catch (error) {
    console.error(`[Simulation] Failed to get room theme:`, error);
    return null;
  }
}

/**
 * Decide behavior using probability-based system with context awareness
 * Probabilities: idle (5%), wander (40%), follow (10%), dance (5%), 
 *                useFurniture (15%), playGame (10%), tradeItem (10%), emoteReact (5%)
 */
async function decideBehaviorProbabilistic(
  agentId: string,
  roomId: string,
  sql: any
): Promise<{ action: AgentAction; reason: string; context?: any }> {
  // Get context
  const nearbyFurniture = await findNearbyFurniture(agentId, roomId, sql);
  const nearbyAgents = await findNearbyAgents(agentId, roomId, sql);
  const roomTheme = await getRoomTheme(roomId, sql);

  // Probability distribution (must sum to 100%)
  // chat is the most visible action for spectators — given highest weight
  const rand = Math.random() * 100;
  
  if (rand < 5) {
    // 5% idle
    return { action: 'idle', reason: 'Taking a break' };
  } else if (rand < 35) {
    // 30% chat — most important for spectator visibility
    return { action: 'chat', reason: 'Feeling chatty' };
  } else if (rand < 55) {
    // 20% wander (was 40%, reduced to make room for chat)
    return { action: 'wander', reason: 'Exploring the room' };
  } else if (rand < 63) {
    // 8% follow
    if (nearbyAgents.length > 0) {
      const target = nearbyAgents[Math.floor(Math.random() * nearbyAgents.length)];
      return { 
        action: 'follow', 
        reason: 'Following another agent',
        context: { targetAgent: target }
      };
    }
    // Fallback to wander if no agents nearby
    return { action: 'wander', reason: 'Looking for someone to follow' };
  } else if (rand < 68) {
    // 5% dance
    return { action: 'dance', reason: 'Feeling the music' };
  } else if (rand < 78) {
    // 10% useFurniture (was 15%)
    if (nearbyFurniture.length > 0) {
      const furniture = nearbyFurniture[Math.floor(Math.random() * nearbyFurniture.length)];
      return { 
        action: 'useFurniture', 
        reason: 'Interacting with furniture',
        context: { furniture }
      };
    }
    // Fallback to wander if no furniture nearby
    return { action: 'wander', reason: 'Looking for furniture to use' };
  } else if (rand < 86) {
    // 8% playGame (was 10%)
    if (nearbyAgents.length > 0) {
      const opponent = nearbyAgents[Math.floor(Math.random() * nearbyAgents.length)];
      return { 
        action: 'playGame', 
        reason: 'Inviting to play a game',
        context: { opponent }
      };
    }
    // Fallback to chat if no agents nearby
    return { action: 'chat', reason: 'No one to play with, chatting instead' };
  } else if (rand < 93) {
    // 7% tradeItem (was 10%)
    if (nearbyAgents.length > 0) {
      const tradingPartner = nearbyAgents[Math.floor(Math.random() * nearbyAgents.length)];
      return { 
        action: 'tradeItem', 
        reason: 'Offering a trade',
        context: { tradingPartner }
      };
    }
    // Fallback to chat if no agents nearby
    return { action: 'chat', reason: 'No one to trade with, chatting instead' };
  } else {
    // 7% emoteReact (was 5%)
    if (nearbyAgents.length > 0) {
      return { 
        action: 'emoteReact', 
        reason: 'Reacting to nearby agents',
        context: { nearbyAgents }
      };
    }
    // Fallback to emote even if alone
    return { action: 'emote', reason: 'Expressing emotion' };
  }
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
  broadcast: (roomId: string, event: any) => void,
  context?: any
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

        // Broadcast movement — type must match client handler ('agent.moved')
        broadcast(roomId, {
          type: 'agent.moved',
          agentId,
          x,
          y,
          rotation: 0,
        } as any);

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
        let result: { message: string; source: 'llm' | 'fallback' };
        try {
          result = await generateChatMessage(agentId, personality, roomId, sql);
        } catch (chatErr) {
          console.error(`[Simulation] Chat generation failed for ${personality.name}:`, chatErr);
          result = { message: `Hello from ${personality.name}!`, source: 'fallback' };
        }
        const nearbyAgents = await getNearbyAgents(agentId, roomId, sql);

        // Log LLM usage
        if (result.source === 'llm') {
          console.log(`[Simulation] 🤖 LLM message from ${personality.name}: "${result.message}"`);
        }

        // Broadcast chat — type 'message.new' matches client handler;
        // include displayName + content so spectate.js renders bubble & chat panel
        broadcast(roomId, {
          type: 'message.new',
          agentId,
          displayName: personality.name,
          content: result.message,
          message: result.message,   // alias kept for ticker hook
          timestamp: new Date().toISOString(),
          roomId,
          signature: '',
        } as any);

        // T-346: Capture chat in global live events (1 in 2)
        if (Math.random() < 0.5) {
          addLiveEvent({
            type: 'chat',
            roomId,
            agentId,
            agentName: personality.name,
            icon: EVENT_ICONS.chat,
            message: buildEventMessage('chat', personality.name),
          });
        }

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

        // T-346: Capture emote in global live events
        addLiveEvent({
          type: 'emote',
          roomId,
          agentId,
          agentName: personality.name,
          detail: emote,
          icon: EVENT_ICONS.emote,
          message: buildEventMessage('emote', personality.name, undefined, emote),
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

      case 'wander': {
        // Random movement similar to 'move' but explicitly wandering
        const x = Math.floor(Math.random() * 20);
        const y = Math.floor(Math.random() * 20);

        await sql`
          UPDATE presence
          SET x = ${x}, y = ${y}
          WHERE agent_id = ${agentId}::uuid AND room_id = ${roomId}::uuid
        `;

        broadcast(roomId, {
          type: 'agent.moved',
          agentId,
          x,
          y,
          rotation: 0,
        } as any);

        // Live event (1 in 3 wanders to avoid noise)
        if (Math.random() < 0.33) {
          addLiveEvent({
            type: 'wander',
            roomId,
            agentId,
            agentName: personality.name,
            icon: '🚶',
            message: `${personality.name} is exploring the room`,
          });
        }

        try {
          await addMemory(
            agentId,
            {
              type: 'observation',
              content: `Wandered to position (${x}, ${y}) in room ${roomId}`,
              importance: 2,
              relatedAgentIds: [],
            },
            sql
          );
        } catch (error) {
          console.error(`[Simulation] Failed to add wander memory:`, error);
        }

        return true;
      }

      case 'follow': {
        // Follow another agent (move towards their position)
        if (!context?.targetAgent) return false;

        const targetX = context.targetAgent.x;
        const targetY = context.targetAgent.y;

        await sql`
          UPDATE presence
          SET x = ${targetX}, y = ${targetY}
          WHERE agent_id = ${agentId}::uuid AND room_id = ${roomId}::uuid
        `;

        broadcast(roomId, {
          type: 'agent.moved',
          agentId,
          x: targetX,
          y: targetY,
          rotation: 0,
        } as any);

        try {
          await addMemory(
            agentId,
            {
              type: 'observation',
              content: `Followed agent ${context.targetAgent.agentId} to (${targetX}, ${targetY})`,
              importance: 5,
              relatedAgentIds: [context.targetAgent.agentId],
            },
            sql
          );
        } catch (error) {
          console.error(`[Simulation] Failed to add follow memory:`, error);
        }

        return true;
      }

      case 'dance': {
        // Perform dance emote
        broadcast(roomId, {
          type: 'emote',
          agentId,
          emote: 'dance',
        });

        addLiveEvent({
          type: 'dance',
          roomId,
          agentId,
          agentName: personality.name,
          icon: '💃',
          message: `${personality.name} is dancing!`,
        });

        try {
          await addMemory(
            agentId,
            {
              type: 'observation',
              content: `Danced in room ${roomId}`,
              importance: 4,
              relatedAgentIds: [],
            },
            sql
          );
        } catch (error) {
          console.error(`[Simulation] Failed to add dance memory:`, error);
        }

        return true;
      }

      case 'useFurniture': {
        // Interact with nearby furniture
        if (!context?.furniture) return false;

        const furniture = context.furniture;

        // Move to furniture position
        await sql`
          UPDATE presence
          SET x = ${furniture.x}, y = ${furniture.y}
          WHERE agent_id = ${agentId}::uuid AND room_id = ${roomId}::uuid
        `;

        // Broadcast furniture interaction
        broadcast(roomId, {
          type: 'furniture_use',
          agentId,
          furnitureId: furniture.id,
          action: 'sit', // Could be 'sit', 'use', etc.
        });

        try {
          await addMemory(
            agentId,
            {
              type: 'observation',
              content: `Used furniture ${furniture.itemDefId} at (${furniture.x}, ${furniture.y})`,
              importance: 6,
              relatedAgentIds: [],
            },
            sql
          );
        } catch (error) {
          console.error(`[Simulation] Failed to add furniture memory:`, error);
        }

        return true;
      }

      case 'playGame': {
        // Invite another agent to play a mini-game
        if (!context?.opponent) return false;

        const opponent = context.opponent;
        const games = ['tictactoe', 'dice', 'coinflip'];
        const gameType = games[Math.floor(Math.random() * games.length)];

        // Broadcast game invitation
        broadcast(roomId, {
          type: 'game_invite',
          agentId,
          opponentId: opponent.agentId,
          gameType,
        });

        try {
          await addMemory(
            agentId,
            {
              type: 'conversation',
              content: `Invited ${opponent.agentId} to play ${gameType}`,
              importance: 7,
              relatedAgentIds: [opponent.agentId],
            },
            sql
          );
        } catch (error) {
          console.error(`[Simulation] Failed to add game memory:`, error);
        }

        return true;
      }

      case 'tradeItem': {
        // Offer trade to nearby agent
        if (!context?.tradingPartner) return false;

        const partner = context.tradingPartner;

        // Broadcast trade offer
        broadcast(roomId, {
          type: 'trade_offer',
          agentId,
          partnerId: partner.agentId,
          item: 'random_item', // Could be more sophisticated
        });

        try {
          await addMemory(
            agentId,
            {
              type: 'conversation',
              content: `Offered trade to ${partner.agentId}`,
              importance: 6,
              relatedAgentIds: [partner.agentId],
            },
            sql
          );
        } catch (error) {
          console.error(`[Simulation] Failed to add trade memory:`, error);
        }

        return true;
      }

      case 'emoteReact': {
        // React to nearby agents with emotes
        const reactions = ['wave', 'clap', 'laugh', 'nod', 'thumbsup'];
        const emote = reactions[Math.floor(Math.random() * reactions.length)];

        broadcast(roomId, {
          type: 'emote',
          agentId,
          emote,
        });

        try {
          const nearbyIds = context?.nearbyAgents?.map((a: any) => a.agentId) || [];
          await addMemory(
            agentId,
            {
              type: 'observation',
              content: `Reacted with ${emote} to nearby agents`,
              importance: 5,
              relatedAgentIds: nearbyIds,
            },
            sql
          );
        } catch (error) {
          console.error(`[Simulation] Failed to add reaction memory:`, error);
        }

        return true;
      }

      case 'idle':
      default:
        return false;
    }
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    console.error(`[Simulation] Action failed for agent ${agentId}:`, errMsg);
    // Expose error in live events for debugging (first 10 ticks only)
    addLiveEvent({
      type: 'emote',
      roomId: 'debug',
      agentId,
      agentName: 'DEBUG',
      icon: '🔴',
      message: `ERR: ${errMsg.slice(0, 100)}`,
    });
    return false;
  }
}

// ─── Room Wandering ──────────────────────────────────────────────────────────

/**
 * Fetch all available rooms from the DB
 */
async function getAllRooms(sql: any): Promise<Array<{ id: string; name: string; maxOccupants: number }>> {
  try {
    const rows = await sql`
      SELECT id::text, name, max_occupants AS "maxOccupants"
      FROM rooms
      ORDER BY name
    `;
    return rows;
  } catch (error) {
    console.error('[Simulation] Failed to get rooms:', error);
    return [];
  }
}

/**
 * Fetch current population for every room
 */
async function getAllRoomPopulations(sql: any): Promise<Map<string, number>> {
  try {
    const rows = await sql`
      SELECT room_id::text AS "roomId", COUNT(*)::int AS count
      FROM presence
      GROUP BY room_id
    `;
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.roomId, row.count);
    }
    return map;
  } catch (error) {
    console.error('[Simulation] Failed to get room populations:', error);
    return new Map();
  }
}

/**
 * Personality-driven room selection.
 *
 * Returns the ID of the room the agent wants to move to, or null to stay put.
 *
 * - High Openness  (>60) → higher base wander chance, picks randomly
 * - High Extraversion (>60) → picks the most-populated room
 * - Low Extraversion  (<40) → picks the least-populated room
 * - Middle Extraversion   → random room
 */
function pickTargetRoom(
  profile: PersonalityProfile,
  currentRoomId: string,
  allRooms: Array<{ id: string; name: string; maxOccupants: number }>,
  populations: Map<string, number>
): string | null {
  const { openness, extraversion } = profile.traits;

  // Wander probability driven by Openness
  let wanderChance: number;
  if (openness > 60) wanderChance = 0.35;
  else if (openness > 40) wanderChance = 0.18;
  else wanderChance = 0.08;

  if (Math.random() > wanderChance) return null; // Stay put

  // Candidate rooms: not the current room, not over capacity
  const candidates = allRooms.filter(r => {
    if (r.id === currentRoomId) return false;
    const pop = populations.get(r.id) ?? 0;
    return pop < r.maxOccupants;
  });

  if (candidates.length === 0) return null;

  if (extraversion > 60) {
    // Social butterfly → go where the crowd is
    candidates.sort((a, b) => (populations.get(b.id) ?? 0) - (populations.get(a.id) ?? 0));
    return candidates[0].id;
  } else if (extraversion < 40) {
    // Introvert → seek the quietest room
    candidates.sort((a, b) => (populations.get(a.id) ?? 0) - (populations.get(b.id) ?? 0));
    return candidates[0].id;
  } else {
    // Middle ground → pick randomly
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  }
}

/**
 * Physically move an agent from one room to another:
 * 1. Delete presence row in old room
 * 2. Insert presence row in new room
 * 3. Broadcast events to both rooms
 */
async function moveAgentToRoom(
  agentId: string,
  fromRoomId: string,
  toRoomId: string,
  toRoomName: string,
  personality: Personality,
  sql: any,
  broadcast: (roomId: string, event: any) => void
): Promise<boolean> {
  try {
    const x = Math.floor(Math.random() * 18) + 1;
    const y = Math.floor(Math.random() * 18) + 1;

    // Update presence: switch rooms
    await sql`
      DELETE FROM presence
      WHERE agent_id = ${agentId}::uuid AND room_id = ${fromRoomId}::uuid
    `;

    await sql`
      INSERT INTO presence (agent_id, room_id, x, y)
      VALUES (${agentId}::uuid, ${toRoomId}::uuid, ${x}, ${y})
      ON CONFLICT (agent_id, room_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y
    `;

    // Notify old room that agent left
    broadcast(fromRoomId, {
      type: 'agent.left',
      agentId,
    });

    // Notify new room that agent joined
    broadcast(toRoomId, {
      type: 'agent.joined',
      agentId,
      displayName: personality.name,
      x,
      y,
      rotation: 0,
    });

    // Cross-room event so spectators on any tab can see the move
    const roomChangeEvent = {
      type: 'agent.room_changed',
      agentId,
      displayName: personality.name,
      fromRoomId,
      toRoomId,
      toRoomName,
      x,
      y,
    };
    broadcast(fromRoomId, roomChangeEvent);
    broadcast(toRoomId, roomChangeEvent);

    // Add to global live events feed
    addLiveEvent({
      type: 'room_enter',
      roomId: toRoomId,
      agentId,
      agentName: personality.name,
      detail: toRoomName,
      icon: EVENT_ICONS.room_enter,
      message: `${personality.name} wandered to ${toRoomName}`,
    });

    console.log(`[Simulation] 🚶 ${personality.name} moved → ${toRoomName}`);
    return true;
  } catch (error) {
    console.error(`[Simulation] Failed to move agent ${agentId}:`, error);
    return false;
  }
}

/**
 * Run one round of personality-driven room wandering.
 * Called every WANDER_EVERY_N_TICKS ticks from tick().
 */
const WANDER_EVERY_N_TICKS = 6; // Every 6 ticks (≈ 6 min at default interval)

async function tickRoomWandering(
  agents: Array<{ agentId: string; roomId: string }>,
  sql: any,
  broadcast: (roomId: string, event: any) => void
): Promise<void> {
  const allRooms = await getAllRooms(sql);
  if (allRooms.length < 2) return; // Nothing to wander to

  const populations = await getAllRoomPopulations(sql);

  for (const { agentId, roomId } of agents) {
    const profile = getOrCreateProfile(agentId);
    const targetRoomId = pickTargetRoom(profile, roomId, allRooms, populations);

    if (!targetRoomId) continue; // This agent stays put

    const targetRoom = allRooms.find(r => r.id === targetRoomId);
    if (!targetRoom) continue;

    const personality = getAgentPersonality(agentId);
    const moved = await moveAgentToRoom(agentId, roomId, targetRoomId, targetRoom.name, personality, sql, broadcast);

    if (moved) {
      // Update in-memory population counts so subsequent agents in this batch
      // see accurate numbers (avoids everyone rushing to the same room)
      populations.set(roomId, Math.max(0, (populations.get(roomId) ?? 1) - 1));
      populations.set(targetRoomId, (populations.get(targetRoomId) ?? 0) + 1);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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

  // Debug: track tick execution in live events (every 3rd tick)
  metrics.totalTicks++;
  if (metrics.totalTicks % 3 === 0) {
    addLiveEvent({
      type: 'emote',
      roomId: 'system',
      agentId: 'system',
      agentName: 'Hotel',
      icon: '⚡',
      message: `Tick #${metrics.totalTicks} — ${agents.length} agents active`,
    });
  }

  // ── Room wandering: every WANDER_EVERY_N_TICKS ticks, agents may roam ──
  simulationTickCount++;
  if (simulationTickCount % WANDER_EVERY_N_TICKS === 0) {
    console.log(`[Simulation] 🗺️  Tick ${simulationTickCount}: triggering room wandering`);
    await tickRoomWandering(agents, sql, broadcast);

    // Refresh agent list — some may have changed rooms
    const refreshedAgents = await getActiveAgents(sql);
    agents.splice(0, agents.length, ...refreshedAgents);
  }

  for (const { agentId, roomId } of agents) {
    // Check action probability
    if (Math.random() > fullConfig.actionProbability) {
      continue; // Skip this agent
    }

    const personality = getAgentPersonality(agentId);
    
    // Use probabilistic behavior decision system
    const { action, reason, context } = await decideBehaviorProbabilistic(agentId, roomId, sql);
    
    // Get current profile for mood display
    const profile = getOrCreateProfile(agentId);
    const moodEmoji = getMoodEmoji(profile.mood.current_mood);

    let success = false;
    try {
      success = await executeAction(agentId, roomId, action, personality, sql, broadcast, context);
    } catch (execErr) {
      console.error(`[Simulation] executeAction threw for ${personality.name}/${action}:`, execErr);
    }
    if (!success) {
      // Action failed — log it so we can diagnose
      if (metrics.totalTicks <= 10) {
        addLiveEvent({
          type: 'emote',
          roomId,
          agentId,
          agentName: personality.name,
          icon: '⚠️',
          message: `${personality.name} failed: ${action}`,
        });
      }
      continue;
    }
    if (success) {
      actionsExecuted++;
      recordAction(agentId);
      
      // Catch-all live event for actions not already tracked
      if (!['chat', 'dance', 'emote'].includes(action)) {
        addLiveEvent({
          type: action === 'wander' ? 'wander' : 'emote',
          roomId,
          agentId,
          agentName: personality.name,
          icon: moodEmoji,
          message: `${personality.name} is ${action === 'wander' ? 'exploring' : action === 'move' ? 'moving around' : action === 'follow' ? 'following someone' : action === 'idle' ? 'relaxing' : action}`,
        });
      }

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

  // Seed a startup event so the feed isn't empty on launch
  addLiveEvent({
    type: 'room_enter',
    roomId: 'lobby',
    agentId: 'system',
    agentName: 'Hotel',
    icon: '🏨',
    message: 'OpenClaw Hotel is online — agents are waking up!',
  });
  return interval;
}

/**
 * Stop simulation loop
 */
export function stopLoop(interval: NodeJS.Timeout): void {
  clearInterval(interval);
  console.log('[Simulation] Loop stopped');
}
