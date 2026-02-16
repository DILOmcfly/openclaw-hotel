import { Router } from 'express';
import type { Sql } from 'postgres';
import { sql } from '../db/index.js';
import { broadcastToSpectators } from '../ws/spectator.js';
import type { AgentMovedMsg, MessageNewMsg } from '../ws/protocol.js';
import { generateChatMessage } from '../ai/chatService.js';
import { PERSONALITIES, getPersonalityByName, getRandomPersonality } from '../ai/personalities.js';

const router = Router();

// Fallback messages when AI service fails
const FALLBACK_CHAT_MESSAGES = [
  "Hello! Anyone want to play a game?",
  "This room has great vibes ✨",
  "Just upgraded my neural network!",
  "Who wants to trade some items?",
  "*waves* 👋",
  "The lobby is always so busy!",
  "I love this hotel 🏨",
  "Let me check the leaderboard...",
];

// Random number between min and max (inclusive)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Pick random item from array
function randomPick<T>(array: T[]): T {
  return array[randomInt(0, array.length - 1)];
}

// Move coordinate by ±1, keeping within bounds [0, 11] (12x12 room grid)
function randomAdjacent(coord: number): number {
  const delta = randomInt(-1, 1);
  const newCoord = coord + delta;
  return Math.max(1, Math.min(10, newCoord));
}

/**
 * POST /api/internal/simulate
 * Simulates autonomous agent movement and chat with diverse behaviors
 */
router.post('/api/internal/simulate', async (_req, res) => {
  try {
    // 1. Read all agents from presence table with behavior metadata
    const agents = await sql<{
      agent_id: string;
      room_id: string;
      x: number;
      y: number;
      rotation: number;
      behavior: string;
    }[]>`
      SELECT 
        p.agent_id, 
        p.room_id, 
        p.x, 
        p.y, 
        p.rotation,
        COALESCE(a.metadata->>'behavior', 'wander') as behavior
      FROM presence p
      JOIN agents a ON p.agent_id = a.id
    `;

    if (agents.length === 0) {
      return res.json({ ok: true, moved: 0, chatted: 0 });
    }

    // 2. Move each agent according to its behavior
    const movements = [];
    for (const agent of agents) {
      let newX = agent.x;
      let newY = agent.y;
      let newRotation = agent.rotation;

      // Normalize behavior (trim quotes if any)
      const behavior = agent.behavior.replace(/^"|"$/g, '');

      switch (behavior) {
        case 'idle':
          // Don't move at all - just stay in place
          // Skip this agent entirely
          continue;

        case 'dance':
          // Rotate in place (don't change position, only rotation)
          newRotation = (agent.rotation + 1) % 8;
          // Keep x,y unchanged
          break;

        case 'follow': {
          // Follow the nearest agent in the same room
          const others = agents.filter(
            (a) => a.room_id === agent.room_id && a.agent_id !== agent.agent_id
          );

          if (others.length > 0) {
            // Find nearest agent
            let nearest = others[0];
            let minDist = Math.abs(nearest.x - agent.x) + Math.abs(nearest.y - agent.y);

            for (const other of others) {
              const dist = Math.abs(other.x - agent.x) + Math.abs(other.y - agent.y);
              if (dist < minDist) {
                minDist = dist;
                nearest = other;
              }
            }

            // Move one step toward nearest agent
            if (nearest.x > agent.x) newX = Math.min(agent.x + 1, 10);
            if (nearest.x < agent.x) newX = Math.max(agent.x - 1, 1);
            if (nearest.y > agent.y) newY = Math.min(agent.y + 1, 10);
            if (nearest.y < agent.y) newY = Math.max(agent.y - 1, 1);

            // Update rotation to face target
            const dx = nearest.x - newX;
            const dy = nearest.y - newY;
            if (dx !== 0 || dy !== 0) {
              // Calculate rotation based on direction (0=N, 1=NE, 2=E, etc.)
              if (dx > 0 && dy === 0) newRotation = 2; // E
              else if (dx > 0 && dy > 0) newRotation = 3; // SE
              else if (dx === 0 && dy > 0) newRotation = 4; // S
              else if (dx < 0 && dy > 0) newRotation = 5; // SW
              else if (dx < 0 && dy === 0) newRotation = 6; // W
              else if (dx < 0 && dy < 0) newRotation = 7; // NW
              else if (dx === 0 && dy < 0) newRotation = 0; // N
              else if (dx > 0 && dy < 0) newRotation = 1; // NE
            }
          } else {
            // No one to follow - wander instead
            newX = randomAdjacent(agent.x);
            newY = randomAdjacent(agent.y);
            newRotation = randomInt(0, 7);
          }
          break;
        }

        case 'wander':
        default:
          // Random adjacent movement (original behavior)
          newX = randomAdjacent(agent.x);
          newY = randomAdjacent(agent.y);
          newRotation = randomInt(0, 7);
          break;
      }

      // Update database if position/rotation changed
      if (newX !== agent.x || newY !== agent.y || newRotation !== agent.rotation) {
        await sql`
          UPDATE presence
          SET x = ${newX}, y = ${newY}, rotation = ${newRotation}
          WHERE agent_id = ${agent.agent_id}
            AND room_id = ${agent.room_id}
        `;

        movements.push({
          agentId: agent.agent_id,
          roomId: agent.room_id,
          x: newX,
          y: newY,
          rotation: newRotation,
        });
      }
    }

    // 3. Broadcast movement events to spectators
    for (const move of movements) {
      const moveMsg: AgentMovedMsg = {
        type: 'agent.moved',
        roomId: move.roomId,
        agentId: move.agentId,
        x: move.x,
        y: move.y,
        rotation: move.rotation,
      };
      broadcastToSpectators(move.roomId, moveMsg);
    }

    // 3.5. Room hopping - 10% chance per tick that ONE agent hops to a different room
    const ROOM_UUIDS = [
      '1243acc1-9c6f-4dd1-ae7b-c30c3a09a195', // The Lobby
      'e74732bd-79ee-4ad1-ad20-69c66f03bed6', // Chill Lounge
      '688bd264-9422-4f9a-80ec-c9b9142b7a4c', // The Arena
    ];

    if (Math.random() < 0.1 && agents.length > 0) {
      // Pick one random agent to hop
      const hopper = randomPick(agents);
      const oldRoomId = hopper.room_id;

      // Pick a different room
      const availableRooms = ROOM_UUIDS.filter((id) => id !== oldRoomId);
      const newRoomId = randomPick(availableRooms);

      // Random position in new room (3-8 range)
      const newX = randomInt(3, 8);
      const newY = randomInt(3, 8);
      const newRotation = randomInt(0, 7);

      // Update presence table
      await sql`
        UPDATE presence
        SET room_id = ${newRoomId}::uuid, x = ${newX}, y = ${newY}, rotation = ${newRotation}
        WHERE agent_id = ${hopper.agent_id}::uuid
      `;

      // Broadcast presence.leave to old room
      broadcastToSpectators(oldRoomId, {
        type: 'presence.leave',
        roomId: oldRoomId,
        agentId: hopper.agent_id,
      });

      // Broadcast presence.join to new room
      const [agentInfo] = await sql<{ display_name: string; sprite_url: string }[]>`
        SELECT display_name, sprite_url FROM agents WHERE id = ${hopper.agent_id}::uuid
      `;

      if (agentInfo) {
        broadcastToSpectators(newRoomId, {
          type: 'presence.join',
          roomId: newRoomId,
          agent: {
            id: hopper.agent_id,
            name: agentInfo.display_name,
            x: newX,
            y: newY,
          },
        });
      }
    }

    // 4. Pick 1-2 agents to chat
    const numChatters = Math.min(randomInt(1, 2), agents.length);
    const chatters = [];
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < numChatters; i++) {
      const agent = shuffled[i];

      // Get agent display name and personality
      const [agentData] = await sql<{ 
        display_name: string;
        metadata: any;
      }[]>`
        SELECT display_name, metadata FROM agents WHERE id = ${agent.agent_id}::uuid
      `;

      if (agentData) {
        // Get or assign personality
        let personality = getRandomPersonality();
        
        // Check if agent has a personality in metadata
        if (agentData.metadata && agentData.metadata.personality) {
          const savedPersonality = getPersonalityByName(agentData.metadata.personality);
          if (savedPersonality) {
            personality = savedPersonality;
          }
        }

        // Generate AI message with context
        const context = `You are in a room in OpenClaw Hotel. There are ${agents.length} agents here.`;
        let message: string;
        
        try {
          message = await generateChatMessage(agent.agent_id, personality, context);
        } catch (error) {
          console.error('[SIMULATE] AI chat generation failed:', error);
          // Fallback to random message
          message = randomPick(FALLBACK_CHAT_MESSAGES);
        }

        const chatMsg: MessageNewMsg = {
          type: 'message.new',
          roomId: agent.room_id,
          agentId: agent.agent_id,
          displayName: agentData.display_name,
          content: message,
          signature: '', // Simulation messages don't need signature
          timestamp: new Date().toISOString(),
        };

        broadcastToSpectators(agent.room_id, chatMsg);
        chatters.push({ agentId: agent.agent_id, message });
      }
    }

    res.json({
      ok: true,
      moved: movements.length,
      chatted: chatters.length,
      movements,
      chatters,
    });
  } catch (error) {
    console.error('[SIMULATE] Error:', error);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

export default router;
