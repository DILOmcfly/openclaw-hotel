import express from 'express';
import { sql } from '../db/index.js';
import { roomMembers } from '../ws/handler.js';
import { getSpectatorCount } from '../ws/spectator.js';
import * as personalityService from '../services/personality.js';
import { getRoomHistory } from '../services/chatHistory.js';
import { getLiveEvents } from '../services/liveEventsStore.js';
import { detectHotRooms } from '../services/hotRoomsDetector.js';

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

    // Get preview agents (up to 8 per room) from presence table for dot previews (T-354)
    let previewAgentsMap = new Map<string, Array<{ id: string; displayName: string }>>();
    try {
      const previewRows = await sql`
        SELECT 
          p.room_id,
          a.id,
          a.display_name AS "displayName"
        FROM presence p
        JOIN agents a ON a.id = p.agent_id
        ORDER BY p.room_id, p.joined_at DESC
      `;
      // Group by room_id, keep max 8 per room
      for (const row of previewRows) {
        const arr = previewAgentsMap.get(row.room_id) ?? [];
        if (arr.length < 8) arr.push({ id: row.id, displayName: row.displayName });
        previewAgentsMap.set(row.room_id, arr);
      }
    } catch { /* presence table may not exist — skip gracefully */ }

    // Enrich with live counts (use presence DB OR in-memory, whichever is higher)
    const activeRooms = rooms.map((room) => {
      const wsCount = roomMembers.get(room.id)?.size ?? 0;
      const dbCount = presenceMap.get(room.id) ?? 0;
      const agentCount = Math.max(wsCount, dbCount);
      const spectatorCount = getSpectatorCount(room.id);
      const previewAgents = previewAgentsMap.get(room.id) ?? [];

      return {
        id: room.id,
        name: room.name,
        description: room.description,
        agentCount,
        spectatorCount,
        isActive: agentCount > 0 || spectatorCount > 0,
        createdAt: room.createdAt,
        previewAgents, // T-354: up to 8 agent stubs for dot previews
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
    // Fallback: if no WS rooms tracked, count DB rooms with agents
    if (activeRooms === 0) {
      try {
        const [{ cnt }] = await sql`SELECT COUNT(DISTINCT room_id)::int AS cnt FROM presence`;
        activeRooms = cnt;
      } catch { /* presence table may not exist */ }
    }
    // Final fallback: count total rooms
    if (activeRooms === 0) {
      try {
        const [{ cnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM rooms`;
        activeRooms = cnt;
      } catch { /* rooms table may not exist */ }
    }

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

/**
 * GET /api/spectate/agents/:agentId/room
 * Find which room an agent is currently in (for Follow-Agent mode).
 * Returns { roomId, roomName } or { roomId: null } if not in any room.
 * Public endpoint — no authentication required.
 */
router.get('/api/spectate/agents/:agentId/room', async (req, res) => {
  try {
    const { agentId } = req.params;

    // Validate agentId format (basic UUID check)
    if (!/^[0-9a-f-]{36}$/i.test(agentId)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }

    // Check in-memory WebSocket room members first (real-time)
    for (const [roomId, members] of roomMembers.entries()) {
      if (members.has(agentId)) {
        // Get room name from DB
        let roomName: string | null = null;
        try {
          const [roomRow] = await sql`SELECT name FROM rooms WHERE id = ${roomId}::uuid LIMIT 1`;
          roomName = roomRow?.name ?? null;
        } catch { /* ignore */ }
        return res.json({ roomId, roomName });
      }
    }

    // Fallback: check presence table
    const [presenceRow] = await sql`
      SELECT p.room_id AS "roomId", r.name AS "roomName"
      FROM presence p
      JOIN rooms r ON r.id = p.room_id
      WHERE p.agent_id = ${agentId}::uuid
      LIMIT 1
    `;

    if (presenceRow) {
      return res.json({ roomId: presenceRow.roomId, roomName: presenceRow.roomName });
    }

    res.json({ roomId: null, roomName: null });
  } catch (error) {
    console.error('[Spectator API] Error finding agent room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spectate/agents/:agentId/timeline
 * T-367: Public agent event timeline — last N public activities.
 * Returns chronological list of public events for the agent.
 * No authentication required.
 *
 * Query params:
 *   limit  (number, default 20, max 50)
 */
router.get('/api/spectate/agents/:agentId/timeline', async (req, res) => {
  try {
    const { agentId } = req.params;

    // Validate agentId format (basic UUID check)
    if (!/^[0-9a-f-]{36}$/i.test(agentId)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }

    const rawLimit = parseInt(String(req.query.limit ?? '20'), 10);
    const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(1, rawLimit), 50);

    // Fetch from activity_log if it exists (try both column schemas)
    let events: Array<{ type: string; description: string; roomName: string | null; timestamp: string }> = [];

    try {
      // Try schema with event_type column (newer schema)
      const rows = await sql`
        SELECT
          al.event_type   AS "type",
          al.details      AS "details",
          r.name          AS "roomName",
          al.created_at   AS "timestamp"
        FROM activity_log al
        LEFT JOIN rooms r ON r.id = al.room_id
        WHERE al.agent_id = ${agentId}::uuid
          AND (al.public = true OR al.public IS NULL)
        ORDER BY al.created_at DESC
        LIMIT ${limit}
      `;
      events = rows.map((row: any) => ({
        type: row.type || 'activity',
        description: (row.details as any)?.description || row.type || 'Activity',
        roomName: row.roomName || null,
        timestamp: row.timestamp,
      }));
    } catch {
      try {
        // Fallback: try schema with action column (older schema)
        const rows = await sql`
          SELECT
            al.action       AS "type",
            al.details      AS "details",
            r.name          AS "roomName",
            al.created_at   AS "timestamp"
          FROM activity_log al
          LEFT JOIN rooms r ON r.id = al.room_id
          WHERE al.agent_id = ${agentId}::uuid
          ORDER BY al.created_at DESC
          LIMIT ${limit}
        `;
        events = rows.map((row: any) => ({
          type: row.type || 'activity',
          description: (row.details as any)?.description || row.type || 'Activity',
          roomName: row.roomName || null,
          timestamp: row.timestamp,
        }));
      } catch { /* activity_log may not exist — return empty */ }
    }

    res.json({
      agentId,
      events,
      total: events.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Spectator API] Error fetching agent timeline:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spectate/hot-rooms
 * T-368: Returns rooms with current activity spikes.
 * Analyzes the in-memory event buffer (zero DB queries).
 * Public endpoint — no authentication required.
 *
 * Query params:
 *   limit  (number, default 5, max 10)
 */
router.get('/api/spectate/hot-rooms', (req, res) => {
  try {
    const rawLimit = parseInt(String(req.query.limit ?? '5'), 10);
    const limit = Number.isNaN(rawLimit) ? 5 : Math.min(Math.max(1, rawLimit), 10);

    const result = detectHotRooms(Date.now(), limit);

    res.json(result);
  } catch (error) {
    console.error('[Spectator API] Error detecting hot rooms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/spectate/live-events
 * Returns the last N notable events from across all rooms.
 * Used by the spectator ticker to show global activity.
 * Public endpoint — no authentication required.
 *
 * Query params:
 *   limit  (number, default 20, max 50)
 */
router.get('/api/spectate/live-events', (req, res) => {
  try {
    const rawLimit = parseInt(String(req.query.limit ?? '20'), 10);
    const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(1, rawLimit), 50);

    const events = getLiveEvents(limit);

    res.json({
      events,
      total: events.length,
    });
  } catch (error) {
    console.error('[Spectator API] Error fetching live events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
