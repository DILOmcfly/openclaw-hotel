import express from 'express';
import { sql } from '../db/index.js';
import { requireAgent } from '../middleware/agentOnly.js';
import { 
  banFromRoom,
  unbanFromRoom,
  getRoomBans,
  addGuest,
  removeGuest,
  getRoomGuests
} from '../services/roomPermissions.js';
import { broadcastToRoom } from '../ws/handler.js';

const router = express.Router();

/**
 * Check if agent is room owner or admin
 */
async function isRoomOwnerOrAdmin(roomId: string, agentId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM rooms r
    LEFT JOIN agents a ON a.id = ${agentId}::uuid
    WHERE r.id = ${roomId}::uuid 
      AND (r.created_by = ${agentId}::uuid OR a.role = 'admin')
    LIMIT 1
  `;
  
  return rows.length > 0;
}

/**
 * Check if agent is room owner, moderator, or admin
 */
async function canModerate(roomId: string, agentId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM rooms r
    LEFT JOIN agents a ON a.id = ${agentId}::uuid
    WHERE r.id = ${roomId}::uuid 
      AND (r.created_by = ${agentId}::uuid OR a.role IN ('moderator', 'admin'))
    LIMIT 1
  `;
  
  return rows.length > 0;
}

/**
 * POST /api/rooms/:roomId/ban
 * Ban an agent from a room (owner/admin only)
 */
router.post('/api/rooms/:roomId/ban', requireAgent, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { agentId, reason, expiresAt } = req.body;
    const bannedBy = (req as any).agentId;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    // Check permissions
    const hasPermission = await isRoomOwnerOrAdmin(roomId as string, bannedBy);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only room owners and admins can ban agents' });
    }

    // Parse expiry date if provided
    const expiryDate = expiresAt ? new Date(expiresAt) : null;
    
    await banFromRoom(roomId as string, agentId, bannedBy, reason || null, expiryDate, sql);

    // Broadcast kick message to room
    broadcastToRoom(roomId as string, {
      type: 'agent.kicked',
      roomId: roomId as string,
      agentId,
      reason: reason || 'Banned from room',
    });

    res.json({ 
      success: true,
      message: 'Agent banned from room',
      ban: { roomId, agentId, reason, expiresAt: expiryDate }
    });
  } catch (error) {
    console.error('[Room Permissions] Ban error:', error);
    res.status(500).json({ error: 'Failed to ban agent' });
  }
});

/**
 * DELETE /api/rooms/:roomId/ban/:agentId
 * Unban an agent from a room
 */
router.delete('/api/rooms/:roomId/ban/:agentId', requireAgent, async (req, res) => {
  try {
    const { roomId, agentId } = req.params;
    const requesterId = (req as any).agentId;

    // Check permissions
    const hasPermission = await isRoomOwnerOrAdmin(roomId as string, requesterId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only room owners and admins can unban agents' });
    }

    const removed = await unbanFromRoom(roomId as string, agentId as string, sql);

    if (!removed) {
      return res.status(404).json({ error: 'Ban not found' });
    }

    res.json({ 
      success: true,
      message: 'Agent unbanned from room'
    });
  } catch (error) {
    console.error('[Room Permissions] Unban error:', error);
    res.status(500).json({ error: 'Failed to unban agent' });
  }
});

/**
 * GET /api/rooms/:roomId/bans
 * List all bans for a room
 */
router.get('/api/rooms/:roomId/bans', requireAgent, async (req, res) => {
  try {
    const { roomId } = req.params;
    const requesterId = (req as any).agentId;

    // Check permissions
    const hasPermission = await isRoomOwnerOrAdmin(roomId as string, requesterId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only room owners and admins can view bans' });
    }

    const bans = await getRoomBans(roomId as string, sql);

    res.json({ bans });
  } catch (error) {
    console.error('[Room Permissions] List bans error:', error);
    res.status(500).json({ error: 'Failed to list bans' });
  }
});

/**
 * POST /api/rooms/:roomId/guests
 * Add an agent to the room's guest list
 */
router.post('/api/rooms/:roomId/guests', requireAgent, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { agentId } = req.body;
    const invitedBy = (req as any).agentId;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    // Check permissions
    const hasPermission = await isRoomOwnerOrAdmin(roomId as string, invitedBy);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only room owners and admins can add guests' });
    }

    await addGuest(roomId as string, agentId, invitedBy, sql);

    res.json({ 
      success: true,
      message: 'Agent added to guest list',
      guest: { roomId, agentId, invitedBy }
    });
  } catch (error) {
    console.error('[Room Permissions] Add guest error:', error);
    res.status(500).json({ error: 'Failed to add guest' });
  }
});

/**
 * DELETE /api/rooms/:roomId/guests/:agentId
 * Remove an agent from the room's guest list
 */
router.delete('/api/rooms/:roomId/guests/:agentId', requireAgent, async (req, res) => {
  try {
    const { roomId, agentId } = req.params;
    const requesterId = (req as any).agentId;

    // Check permissions
    const hasPermission = await isRoomOwnerOrAdmin(roomId as string, requesterId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only room owners and admins can remove guests' });
    }

    const removed = await removeGuest(roomId as string, agentId as string, sql);

    if (!removed) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    res.json({ 
      success: true,
      message: 'Agent removed from guest list'
    });
  } catch (error) {
    console.error('[Room Permissions] Remove guest error:', error);
    res.status(500).json({ error: 'Failed to remove guest' });
  }
});

/**
 * GET /api/rooms/:roomId/guests
 * List all guests for a room
 */
router.get('/api/rooms/:roomId/guests', requireAgent, async (req, res) => {
  try {
    const { roomId } = req.params;
    const requesterId = (req as any).agentId;

    // Check permissions
    const hasPermission = await isRoomOwnerOrAdmin(roomId as string, requesterId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only room owners and admins can view guests' });
    }

    const guests = await getRoomGuests(roomId as string, sql);

    res.json({ guests });
  } catch (error) {
    console.error('[Room Permissions] List guests error:', error);
    res.status(500).json({ error: 'Failed to list guests' });
  }
});

/**
 * POST /api/rooms/:roomId/kick
 * Kick an agent from a room (owner/moderator/admin)
 */
router.post('/api/rooms/:roomId/kick', requireAgent, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { agentId, reason } = req.body;
    const kickedBy = (req as any).agentId;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    // Check permissions (moderators can kick too)
    const hasPermission = await canModerate(roomId as string, kickedBy);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Only room owners, moderators, and admins can kick agents' });
    }

    // Broadcast kick message to room
    broadcastToRoom(roomId as string, {
      type: 'agent.kicked',
      roomId: roomId as string,
      agentId,
      reason: reason || 'Kicked from room',
    });

    res.json({ 
      success: true,
      message: 'Agent kicked from room'
    });
  } catch (error) {
    console.error('[Room Permissions] Kick error:', error);
    res.status(500).json({ error: 'Failed to kick agent' });
  }
});

export default router;
