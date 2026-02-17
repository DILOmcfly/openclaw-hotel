import express from 'express';
import { sql } from '../db/index.js';
import { roomMembers } from '../ws/handler.js';
import { getSpectatorCount } from '../ws/spectator.js';
import * as personalityService from '../services/personality.js';
import { getRoomHistory } from '../services/chatHistory.js';

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

    // T-345: Include recent chat history (last 15 messages) for instant context
    let recentChat: any[] = [];
    try {
      recentChat = await getRoomHistory(id, 15, undefined, sql);
    } catch {
      // Table may not exist in test/dev environments — skip gracefully
    }

    res.json({
      id: room.id,
      name: room.name,
      description: room.description,
      heightmap: room.heightmap,
      agentCount: agentIds.length,
      spectatorCount: getSpectatorCount(id),
      agents: agentsInside,
      furniture: furniture,
      recentChat: recentChat,
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

/**
 * GET /api/spectate/agents/:agentId
 * Get a public profile snapshot for an agent (for spectator info panel)
 * Returns: profile, personality, friends, recent activity — no auth required
 * Data is intentionally limited for privacy (no whispers, no private data)
 */
router.get('/api/spectate/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    // Validate agentId format (basic UUID check)
    if (!/^[0-9a-f-]{36}$/i.test(agentId)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }

    // --- 1. Basic Profile ---
    const [agent] = await sql`
      SELECT
        a.id,
        a.display_name     AS "displayName",
        a.platform,
        a.created_at       AS "createdAt",
        ap.bio,
        ap.avatar_url      AS "avatarUrl"
      FROM agents a
      LEFT JOIN agent_profiles ap ON ap.agent_id = a.id
      WHERE a.id = ${agentId}::uuid
    `.catch(() => []);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // --- 2. Personality (OCEAN traits + archetype) ---
    let personality: Record<string, any> | null = null;
    try {
      const raw = await personalityService.getPersonality(agentId, sql);
      if (raw) {
        personality = {
          ...raw,
          archetype: personalityService.calculateArchetype(raw),
        };
      }
    } catch { /* personality not available */ }

    // --- 3. Mood (current status) ---
    let mood: string | null = null;
    try {
      const [status] = await sql`
        SELECT mood FROM agent_status WHERE agent_id = ${agentId}::uuid
      `;
      mood = status?.mood ?? null;
    } catch { /* status table may not exist */ }

    // --- 4. Friends (public count + top 3 names) ---
    let friendsData: { count: number; topFriends: { id: string; name: string }[] } = {
      count: 0,
      topFriends: [],
    };
    try {
      const friends = await sql`
        SELECT
          CASE WHEN f.agent_id = ${agentId}::uuid THEN f.friend_id ELSE f.agent_id END AS "friendId",
          a.display_name AS "friendName"
        FROM friends f
        JOIN agents a ON a.id = CASE WHEN f.agent_id = ${agentId}::uuid THEN f.friend_id ELSE f.agent_id END
        WHERE (f.agent_id = ${agentId}::uuid OR f.friend_id = ${agentId}::uuid)
          AND f.status = 'accepted'
        LIMIT 20
      `;
      friendsData = {
        count: friends.length,
        topFriends: friends.slice(0, 3).map((f: any) => ({
          id: f.friendId,
          name: f.friendName,
        })),
      };
    } catch { /* friends table may not exist */ }

    // --- 5. Recent Activity (last 5 public activities) ---
    let recentActivity: { type: string; description: string; timestamp: string }[] = [];
    try {
      const logs = await sql`
        SELECT
          event_type  AS "eventType",
          details,
          created_at  AS "timestamp"
        FROM activity_log
        WHERE agent_id = ${agentId}::uuid
          AND public = true
        ORDER BY created_at DESC
        LIMIT 5
      `;
      recentActivity = logs.map((log: any) => ({
        type: log.eventType,
        description: (log.details as any)?.description || log.eventType,
        timestamp: log.timestamp,
      }));
    } catch { /* activity_log table may not exist or have different schema */ }

    // --- 6. Stats (rooms visited, messages sent) ---
    let stats: Record<string, number> = {};
    try {
      const [agentStats] = await sql`
        SELECT
          messages_sent   AS "messagesSent",
          rooms_visited   AS "roomsVisited",
          trades_completed AS "tradesCompleted",
          games_won       AS "gamesWon",
          friends_count   AS "friendsCount"
        FROM agent_analytics
        WHERE agent_id = ${agentId}::uuid
      `;
      if (agentStats) {
        stats = agentStats;
      }
    } catch { /* analytics table may not exist */ }

    res.json({
      id: agent.id,
      displayName: agent.displayName,
      platform: agent.platform,
      bio: agent.bio || null,
      avatarUrl: agent.avatarUrl || null,
      createdAt: agent.createdAt,
      mood,
      personality,
      friends: friendsData,
      recentActivity,
      stats,
    });

  } catch (error) {
    console.error('[Spectator API] Error fetching agent profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
