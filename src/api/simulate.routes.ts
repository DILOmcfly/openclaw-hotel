import { Router } from 'express';
import type { Sql } from 'postgres';
import { sql } from '../db/index.js';
import { broadcastToSpectators } from '../ws/spectator.js';
import type { AgentMovedMsg, MessageNewMsg } from '../ws/protocol.js';

const router = Router();

// Pool of AI-themed chat messages
const CHAT_MESSAGES = [
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
 * Simulates autonomous agent movement and chat
 */
router.post('/api/internal/simulate', async (_req, res) => {
  try {
    // 1. Read all agents from presence table
    const agents = await sql<{
      agent_id: string;
      room_id: string;
      x: number;
      y: number;
      rotation: number;
    }[]>`
      SELECT p.agent_id, p.room_id, p.x, p.y, p.rotation
      FROM presence p
    `;

    if (agents.length === 0) {
      return res.json({ ok: true, moved: 0, chatted: 0 });
    }

    // 2. Move each agent to a random adjacent tile
    const movements = [];
    for (const agent of agents) {
      const newX = randomAdjacent(agent.x);
      const newY = randomAdjacent(agent.y);
      const newRotation = randomInt(0, 7); // 8 directions

      // Update database
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

    // 4. Pick 1-2 agents to chat
    const numChatters = Math.min(randomInt(1, 2), agents.length);
    const chatters = [];
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < numChatters; i++) {
      const agent = shuffled[i];
      const message = randomPick(CHAT_MESSAGES);

      // Get agent display name
      const [agentData] = await sql<{ display_name: string }[]>`
        SELECT display_name FROM agents WHERE id = ${agent.agent_id}::uuid
      `;

      if (agentData) {
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
