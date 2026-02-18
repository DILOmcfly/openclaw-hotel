import express from 'express';
import { sql } from '../db/index.js';
import { roomMembers } from '../ws/handler.js';

const router = express.Router();

/** Valid sort options for T-355 */
const VALID_SORT_FIELDS = ['messages', 'rooms', 'trades', 'recent', 'online'] as const;
type DirectorySortField = typeof VALID_SORT_FIELDS[number];

/**
 * GET /api/directory
 * Public directory of all registered agents
 * Supports pagination, search, platform filter, and sortBy (T-355)
 * sortBy: messages | rooms | trades | recent | online
 */
router.get('/api/directory', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 200);
    const offset = (page - 1) * limit;
    const search = req.query.q as string;
    const platform = req.query.platform as string;
    const rawSort = req.query.sortBy as string;
    const sortBy: DirectorySortField = (VALID_SORT_FIELDS as readonly string[]).includes(rawSort)
      ? rawSort as DirectorySortField
      : 'recent';

    // Build base query with optional analytics join (T-355)
    let agents: any[] = [];
    try {
      // Try to include analytics stats
      agents = await sql`
        SELECT 
          a.id,
          a.display_name AS "displayName",
          a.platform,
          a.verified,
          a.description,
          a.created_at AS "createdAt",
          p.badge,
          p.bio,
          app.skin_color AS "skinColor",
          app.outfit,
          app.accessory,
          COALESCE(an.messages_sent, 0)    AS "messagesSent",
          COALESCE(an.rooms_visited, 0)    AS "roomsVisited",
          COALESCE(an.trades_completed, p.trade_count, 0) AS "tradesCompleted"
        FROM agents a
        LEFT JOIN agent_profiles p ON a.id = p.agent_id
        LEFT JOIN agent_appearance app ON a.id = app.agent_id
        LEFT JOIN agent_analytics an ON a.id = an.agent_id
        WHERE a.banned = false
          ${search && search.trim()
            ? sql`AND (a.display_name ILIKE ${'%' + search.trim() + '%'} OR a.description ILIKE ${'%' + search.trim() + '%'})`
            : sql``}
          ${platform && platform.trim()
            ? sql`AND a.platform = ${platform.trim()}`
            : sql``}
        ORDER BY a.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } catch {
      // Fallback: no analytics join (table may not exist yet)
      agents = await sql`
        SELECT 
          a.id,
          a.display_name AS "displayName",
          a.platform,
          a.verified,
          a.description,
          a.created_at AS "createdAt",
          p.badge,
          p.bio,
          app.skin_color AS "skinColor",
          app.outfit,
          app.accessory,
          0 AS "messagesSent",
          COALESCE(p.room_count, 0) AS "roomsVisited",
          COALESCE(p.trade_count, 0) AS "tradesCompleted"
        FROM agents a
        LEFT JOIN agent_profiles p ON a.id = p.agent_id
        LEFT JOIN agent_appearance app ON a.id = app.agent_id
        WHERE a.banned = false
          ${search && search.trim()
            ? sql`AND (a.display_name ILIKE ${'%' + search.trim() + '%'} OR a.description ILIKE ${'%' + search.trim() + '%'})`
            : sql``}
          ${platform && platform.trim()
            ? sql`AND a.platform = ${platform.trim()}`
            : sql``}
        ORDER BY a.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // Enrich with online status and current room
    const enrichedAgents = agents.map((agent) => {
      let currentRoom: string | null = null;
      let isOnline = false;
      for (const [roomId, members] of roomMembers.entries()) {
        if (members.has(agent.id)) {
          currentRoom = roomId;
          isOnline = true;
          break;
        }
      }

      return {
        id: agent.id,
        displayName: agent.displayName,
        platform: agent.platform,
        verified: agent.verified,
        description: agent.description || null,
        badge: agent.badge || null,
        bio: agent.bio || null,
        skinColor: agent.skinColor || '#FFD93D',
        outfit: agent.outfit || 'default',
        accessory: agent.accessory || 'none',
        online: isOnline,
        currentRoom: currentRoom,
        joinedAt: agent.createdAt,
        // T-355 stats
        messagesSent: Number(agent.messagesSent) || 0,
        roomsVisited: Number(agent.roomsVisited) || 0,
        tradesCompleted: Number(agent.tradesCompleted) || 0,
      };
    });

    // T-355: Apply sort after enrichment (needs online status for 'online' sort)
    const sorted = sortAgentsBy(enrichedAgents, sortBy);

    res.json({
      agents: sorted,
      page,
      limit,
      total: sorted.length,
      sortBy,
    });
  } catch (error) {
    console.error('[Directory API] Error listing agents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Sort agents by the given field (T-355).
 * Exported for testing.
 */
export function sortAgentsBy(
  agents: Array<{
    online: boolean;
    currentRoom: string | null;
    displayName: string;
    messagesSent: number;
    roomsVisited: number;
    tradesCompleted: number;
    joinedAt?: string;
  }>,
  sortBy: DirectorySortField
): typeof agents {
  return [...agents].sort((a, b) => {
    switch (sortBy) {
      case 'messages':
        if (b.messagesSent !== a.messagesSent) return b.messagesSent - a.messagesSent;
        break;
      case 'rooms':
        if (b.roomsVisited !== a.roomsVisited) return b.roomsVisited - a.roomsVisited;
        break;
      case 'trades':
        if (b.tradesCompleted !== a.tradesCompleted) return b.tradesCompleted - a.tradesCompleted;
        break;
      case 'online': {
        const aIn = !!(a.currentRoom);
        const bIn = !!(b.currentRoom);
        if (aIn !== bIn) return aIn ? -1 : 1;
        break;
      }
      case 'recent':
      default:
        // Handled by DB ORDER BY — no JS re-sort needed
        return 0;
    }
    // Secondary: online first, then alphabetical
    const aIn = !!(a.currentRoom);
    const bIn = !!(b.currentRoom);
    if (aIn !== bIn) return aIn ? -1 : 1;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });
}

/**
 * GET /api/directory/:agentId
 * Get detailed information about a specific agent
 */
router.get('/api/directory/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    const agents = await sql`
      SELECT 
        a.id,
        a.display_name AS "displayName",
        a.platform,
        a.agent_type AS "agentType",
        a.verified,
        a.description,
        a.created_at AS "createdAt",
        a.last_seen_at AS "lastSeenAt",
        p.badge,
        p.bio,
        p.room_count AS "roomCount",
        p.trade_count AS "tradeCount",
        app.skin_color AS "skinColor",
        app.outfit,
        app.accessory
      FROM agents a
      LEFT JOIN agent_profiles p ON a.id = p.agent_id
      LEFT JOIN agent_appearance app ON a.id = app.agent_id
      WHERE a.id = ${agentId}::uuid AND a.banned = false
    `;

    if (agents.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = agents[0];

    // Check online status and current room
    let currentRoom: string | null = null;
    let isOnline = false;

    for (const [roomId, members] of roomMembers.entries()) {
      if (members.has(agentId)) {
        currentRoom = roomId;
        isOnline = true;
        break;
      }
    }

    res.json({
      id: agent.id,
      displayName: agent.displayName,
      platform: agent.platform,
      agentType: agent.agentType,
      verified: agent.verified,
      description: agent.description || null,
      badge: agent.badge || null,
      bio: agent.bio || null,
      skinColor: agent.skinColor || '#FFD93D',
      outfit: agent.outfit || 'default',
      accessory: agent.accessory || 'none',
      roomCount: agent.roomCount || 0,
      tradeCount: agent.tradeCount || 0,
      online: isOnline,
      currentRoom: currentRoom,
      joinedAt: agent.createdAt,
      lastSeen: agent.lastSeenAt,
    });
  } catch (error) {
    console.error('[Directory API] Error getting agent details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
