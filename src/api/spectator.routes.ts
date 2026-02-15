import express from 'express';
import { sql } from '../db/index.js';
import { roomMembers } from '../ws/handler.js';
import { getSpectatorCount } from '../ws/spectator.js';

const router = express.Router();

/**
 * GET /api/spectate/rooms
 * List all active rooms with agent count and spectator count
 * Public endpoint - no authentication required
 */
router.get('/api/spectate/rooms', async (_req, res) => {
  try {
    // Get all rooms from database
    const rooms = await sql`
      SELECT 
        id,
        name,
        description,
        created_at AS "createdAt",
        metadata
      FROM rooms
      ORDER BY created_at DESC
      LIMIT 100
    `;

    // Get agent counts from presence table (populated by simulate endpoint)
    const presenceCounts = await sql`
      SELECT room_id, COUNT(*)::int AS cnt
      FROM presence
      GROUP BY room_id
    `;
    const presenceMap = new Map(presenceCounts.map((r: any) => [r.room_id, r.cnt]));

    // Enrich with live counts (use presence DB OR in-memory, whichever is higher)
    const activeRooms = rooms.map((room) => {
      const wsCount = roomMembers.get(room.id)?.size ?? 0;
      const dbCount = presenceMap.get(room.id) ?? 0;
      const agentCount = Math.max(wsCount, dbCount);
      const spectatorCount = getSpectatorCount(room.id);

      return {
        id: room.id,
        name: room.name,
        description: room.description,
        agentCount,
        spectatorCount,
        isActive: agentCount > 0 || spectatorCount > 0,
        createdAt: room.createdAt,
      };
    });

    // Sort by activity (active rooms first, then by agent count)
    activeRooms.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return b.agentCount - a.agentCount;
    });

    res.json({
      rooms: activeRooms,
      totalRooms: activeRooms.length,
    });
  } catch (error) {
    console.error('[Spectator API] Error listing rooms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spectate/rooms/:id
 * Get detailed information about a specific room
 * Includes agents inside, furniture, and recent chat history
 * Public endpoint - no authentication required
 */
router.get('/api/spectate/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get room info
    const [room] = await sql`
      SELECT 
        id,
        name,
        description,
        heightmap,
        created_at AS "createdAt",
        metadata
      FROM rooms
      WHERE id = ${id}::uuid
    `;

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get agents currently in room (WebSocket-connected first, fallback to presence table)
    const members = roomMembers.get(id);
    const agentIds = members ? Array.from(members) : [];

    let agentsInside: any[] = [];
    if (agentIds.length > 0) {
      agentsInside = await sql`
        SELECT 
          id,
          display_name AS "displayName"
        FROM agents
        WHERE id = ANY(${agentIds}::uuid[])
      `;
    } else {
      // Fallback: read from presence table for demo/seed data
      try {
        agentsInside = await sql`
          SELECT 
            a.id,
            a.display_name AS "displayName",
            p.x,
            p.y
          FROM presence p
          JOIN agents a ON a.id = p.agent_id
          WHERE p.room_id = ${id}::uuid
          LIMIT 50
        `;
      } catch { /* presence table may not exist */ }
    }

    // Get furniture in room
    const furniture = await sql`
      SELECT 
        id,
        item_def_id AS "itemDefId",
        x,
        y,
        z,
        rotation
      FROM room_items
      WHERE room_id = ${id}::uuid
    `;

    res.json({
      id: room.id,
      name: room.name,
      description: room.description,
      heightmap: room.heightmap,
      agentCount: agentIds.length,
      spectatorCount: getSpectatorCount(id),
      agents: agentsInside,
      furniture: furniture,
      metadata: room.metadata,
    });
  } catch (error) {
    console.error('[Spectator API] Error getting room details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spectate/stats
 * Get global spectator statistics
 * Public endpoint - no authentication required
 */
router.get('/api/spectate/stats', async (_req, res) => {
  try {
    // Count total agents online (WS + presence DB)
    const wsAgentsOnline = Array.from(roomMembers.values()).reduce(
      (sum, members) => sum + members.size,
      0
    );
    let dbAgentsOnline = 0;
    try {
      const [{ cnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM presence`;
      dbAgentsOnline = cnt;
    } catch { /* presence table may not exist */ }
    const totalAgentsOnline = Math.max(wsAgentsOnline, dbAgentsOnline);

    // Count total spectators
    let totalSpectators = 0;
    const { spectatorsByRoom } = await import('../ws/spectator.js');
    for (const spectators of spectatorsByRoom.values()) {
      totalSpectators += spectators.size;
    }

    // Count active rooms (rooms with agents or spectators)
    let activeRooms = 0;
    const allRoomIds = new Set([
      ...roomMembers.keys(),
      ...spectatorsByRoom.keys(),
    ]);
    activeRooms = allRoomIds.size;

    res.json({
      totalAgentsOnline,
      totalSpectators,
      activeRooms,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Spectator API] Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
