import express from 'express';
import { sql } from '../db/index.js';
import { roomMembers } from '../ws/handler.js';

const router = express.Router();

/**
 * GET /api/directory
 * Public directory of all registered agents
 * Supports pagination, search, and filtering by platform
 */
router.get('/api/directory', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.q as string;
    const platform = req.query.platform as string;

    let query = sql`
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
        app.accessory
      FROM agents a
      LEFT JOIN agent_profiles p ON a.id = p.agent_id
      LEFT JOIN agent_appearance app ON a.id = app.agent_id
      WHERE a.banned = false
    `;

    // Apply search filter
    if (search && search.trim()) {
      query = sql`${query} AND (a.display_name ILIKE ${'%' + search.trim() + '%'} OR a.description ILIKE ${'%' + search.trim() + '%'})`;
    }

    // Apply platform filter
    if (platform && platform.trim()) {
      query = sql`${query} AND a.platform = ${platform.trim()}`;
    }

    query = sql`${query} ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const agents = await query;

    // Enrich with online status and current room
    const enrichedAgents = agents.map((agent) => {
      // Find current room by checking all rooms
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
      };
    });

    res.json({
      agents: enrichedAgents,
      page,
      limit,
      total: enrichedAgents.length,
    });
  } catch (error) {
    console.error('[Directory API] Error listing agents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
