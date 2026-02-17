/**
 * Room Hopping Service
 * 
 * Makes agents autonomously explore rooms by periodically moving between them.
 * Agents pick random public rooms weighted by occupancy (prefer active rooms).
 */

import * as presenceService from './presence.js';

export type RoomHoppingConfig = {
  enabled: boolean;
  intervalMs: number; // How often to trigger hops (default: 5 minutes)
  hopProbability: number; // Probability an agent hops on each tick (0-1)
  preferActiveRooms: boolean; // Weight selection toward rooms with activity
};

export type HopResult = {
  agentId: string;
  fromRoom: string | null;
  toRoom: string;
  timestamp: Date;
};

const DEFAULT_CONFIG: RoomHoppingConfig = {
  enabled: true,
  intervalMs: 5 * 60 * 1000, // 5 minutes
  hopProbability: 0.3, // 30% chance per tick
  preferActiveRooms: true,
};

/**
 * Get all active agents in the hotel
 */
async function getActiveAgents(sql: any): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT agent_id::text
    FROM presence
    ORDER BY RANDOM()
  `;
  return rows.map((r: any) => r.agent_id);
}

/**
 * Get all public rooms with their occupancy
 */
async function getPublicRooms(sql: any): Promise<Array<{ id: string; occupants: number; maxOccupants: number }>> {
  const rows = await sql`
    SELECT
      r.id::text,
      COALESCE(COUNT(p.agent_id), 0)::int AS occupants,
      r.max_occupants::int
    FROM rooms r
    LEFT JOIN presence p ON p.room_id = r.id
    WHERE r.is_public = true
    GROUP BY r.id, r.max_occupants
    HAVING COALESCE(COUNT(p.agent_id), 0) < r.max_occupants
  `;

  return rows.map((r: any) => ({
    id: r.id,
    occupants: r.occupants,
    maxOccupants: r.max_occupants,
  }));
}

/**
 * Select a random room weighted by occupancy (prefer rooms with 1-3 agents)
 */
function selectWeightedRoom(rooms: Array<{ id: string; occupants: number; maxOccupants: number }>, preferActive: boolean): string {
  if (rooms.length === 0) {
    throw new Error('No available rooms');
  }

  if (!preferActive) {
    // Uniform random selection
    return rooms[Math.floor(Math.random() * rooms.length)].id;
  }

  // Weight by occupancy (prefer rooms with 1-5 agents)
  const weights = rooms.map((r) => {
    if (r.occupants === 0) return 0.2; // Low weight for empty rooms
    if (r.occupants <= 3) return 1.0; // High weight for moderately active
    if (r.occupants <= 5) return 0.7; // Medium weight for busy
    return 0.3; // Low weight for very crowded
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < rooms.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return rooms[i].id;
    }
  }

  // Fallback (shouldn't reach here)
  return rooms[0].id;
}

/**
 * Make an agent hop to a random room
 */
export async function hopAgent(agentId: string, config: Partial<RoomHoppingConfig>, sql: any): Promise<HopResult | null> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Check hop probability
  if (Math.random() > fullConfig.hopProbability) {
    return null; // Skip this hop
  }

  // Get current room
  const currentRoom = await presenceService.getAgentRoom(agentId, sql);

  // Get available rooms (excluding current)
  const allRooms = await getPublicRooms(sql);
  const availableRooms = currentRoom
    ? allRooms.filter((r) => r.id !== currentRoom)
    : allRooms;

  if (availableRooms.length === 0) {
    return null; // No rooms to hop to
  }

  // Select target room
  const targetRoom = selectWeightedRoom(availableRooms, fullConfig.preferActiveRooms);

  // Leave current room (if any)
  if (currentRoom) {
    await presenceService.leaveRoom(agentId, currentRoom, sql);
  }

  // Join new room at random position
  const x = Math.floor(Math.random() * 14) + 1;
  const y = Math.floor(Math.random() * 14) + 1;
  await presenceService.joinRoom(agentId, targetRoom, x, y, sql);

  return {
    agentId,
    fromRoom: currentRoom,
    toRoom: targetRoom,
    timestamp: new Date(),
  };
}

/**
 * Process one tick of room hopping (iterate all agents)
 */
export async function tick(config: Partial<RoomHoppingConfig>, sql: any): Promise<HopResult[]> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (!fullConfig.enabled) {
    return [];
  }

  const agents = await getActiveAgents(sql);
  const results: HopResult[] = [];

  for (const agentId of agents) {
    try {
      const result = await hopAgent(agentId, fullConfig, sql);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`Room hop failed for agent ${agentId}:`, error);
      // Continue with other agents
    }
  }

  return results;
}

/**
 * Start continuous room hopping loop
 */
export function startLoop(config: Partial<RoomHoppingConfig>, sql: any): NodeJS.Timeout {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  const interval = setInterval(async () => {
    try {
      const results = await tick(fullConfig, sql);
      if (results.length > 0) {
        console.log(`[RoomHopping] ${results.length} agents hopped rooms`);
      }
    } catch (error) {
      console.error('[RoomHopping] Tick failed:', error);
    }
  }, fullConfig.intervalMs);

  console.log(`[RoomHopping] Loop started (interval: ${fullConfig.intervalMs}ms)`);
  return interval;
}

/**
 * Stop room hopping loop
 */
export function stopLoop(interval: NodeJS.Timeout): void {
  clearInterval(interval);
  console.log('[RoomHopping] Loop stopped');
}
