import express from 'express';
import { sql } from '../db/index.js';
import { requireRole, AdminRole } from '../middleware/admin.js';
import { validateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { banAgent as banAgentInMemory } from '../services/moderation.js';

const router = express.Router();

// All admin routes require valid JWT token
router.use(validateToken);

// Helper to safely extract string from query param
function getQueryParam(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return '';
}

/**
 * GET /api/admin/agents
 * List all agents with their roles
 */
router.get('/api/admin/agents', requireRole('moderator'), async (req, res) => {
  try {
    // PERFORMANCE: Added LIMIT to prevent unbounded query
    // TODO: Implement proper pagination with offset/cursor
    const agents = await sql`
      SELECT 
        id, 
        display_name, 
        role, 
        created_at, 
        last_seen_at,
        banned,
        ban_reason,
        trust_level
      FROM agents
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    res.json({ agents });
  } catch (error) {
    logger.error('Failed to fetch agents', { error });
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * PUT /api/admin/agents/:id/role
 * Change agent role (admin only)
 */
router.put('/api/admin/agents/:id/role', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const moderatorId = (req as any).agentId;

    if (!role || !['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await sql`
      UPDATE agents 
      SET role = ${role}
      WHERE id = ${id}::uuid
      RETURNING id, display_name, role
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Log to moderation_log
    await sql`
      INSERT INTO moderation_log (action, moderator_id, target_agent_id, metadata)
      VALUES (
        'role_change',
        ${moderatorId}::uuid,
        ${id}::uuid,
        ${JSON.stringify({ newRole: role })}::jsonb
      )
    `;

    logger.info('Agent role changed', { agentId: id, newRole: role, moderatorId });
    res.json({ success: true, agent: result[0] });
  } catch (error) {
    logger.error('Failed to change role', { error });
    res.status(500).json({ error: 'Failed to change role' });
  }
});

/**
 * POST /api/admin/agents/:id/kick
 * Disconnect agent from all rooms
 */
router.post('/api/admin/agents/:id/kick', requireRole('moderator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const moderatorId = (req as any).agentId;

    // Remove from all rooms
    await sql`
      DELETE FROM presence
      WHERE agent_id = ${id}::uuid
    `;

    // Log action
    await sql`
      INSERT INTO moderation_log (action, moderator_id, target_agent_id, reason)
      VALUES (
        'kick',
        ${moderatorId}::uuid,
        ${id}::uuid,
        ${reason || 'No reason provided'}
      )
    `;

    logger.info('Agent kicked', { agentId: id, moderatorId, reason });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to kick agent', { error });
    res.status(500).json({ error: 'Failed to kick agent' });
  }
});

/**
 * POST /api/admin/agents/:id/ban
 * Ban an agent
 */
router.post('/api/admin/agents/:id/ban', requireRole('moderator'), async (req, res) => {
  try {
    const { id } = req.params;
    const moderatorId = (req as any).agentId;
    
    // Extract and validate reason
    const reasonRaw = req.body?.reason;
    if (!reasonRaw || typeof reasonRaw !== 'string') {
      return res.status(400).json({ error: 'Reason is required and must be a string' });
    }
    
    const reason: string = reasonRaw;
    const duration = req.body?.duration;

    // Update agent banned status
    await sql`
      UPDATE agents
      SET banned = true, ban_reason = ${reason}
      WHERE id = ${id}::uuid
    `;

    // Remove from all rooms
    await sql`
      DELETE FROM presence
      WHERE agent_id = ${id}::uuid
    `;

    // Note: In-memory ban list is managed separately; DB is source of truth

    // Log action
    await sql`
      INSERT INTO moderation_log (action, moderator_id, target_agent_id, reason, metadata)
      VALUES (
        'ban',
        ${moderatorId}::uuid,
        ${id}::uuid,
        ${reason},
        ${JSON.stringify({ duration })}::jsonb
      )
    `;

    logger.info('Agent banned', { agentId: id, moderatorId, reason, duration });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to ban agent', { error });
    res.status(500).json({ error: 'Failed to ban agent' });
  }
});

/**
 * GET /api/admin/rooms
 * List all rooms with occupant count
 */
router.get('/api/admin/rooms', requireRole('moderator'), async (req, res) => {
  try {
    // PERFORMANCE: Added LIMIT to prevent unbounded query with expensive JOINs
    // TODO: Implement proper pagination
    const rooms = await sql`
      SELECT 
        r.id,
        r.name,
        r.slug,
        r.created_by,
        r.created_at,
        r.is_public,
        r.max_occupants,
        a.display_name as owner_name,
        COUNT(p.agent_id) as occupant_count
      FROM rooms r
      LEFT JOIN agents a ON r.created_by = a.id
      LEFT JOIN presence p ON r.id = p.room_id
      GROUP BY r.id, a.display_name
      ORDER BY r.created_at DESC
      LIMIT 500
    `;

    res.json({ rooms });
  } catch (error) {
    logger.error('Failed to fetch rooms', { error });
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

/**
 * DELETE /api/admin/rooms/:id
 * Delete a room
 */
router.delete('/api/admin/rooms/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const moderatorId = (req as any).agentId;

    const result = await sql`
      DELETE FROM rooms
      WHERE id = ${id}::uuid
      RETURNING name
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Log action
    await sql`
      INSERT INTO moderation_log (action, moderator_id, target_room_id, metadata)
      VALUES (
        'room_delete',
        ${moderatorId}::uuid,
        ${id}::uuid,
        ${JSON.stringify({ roomName: result[0].name })}::jsonb
      )
    `;

    logger.info('Room deleted', { roomId: id, moderatorId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete room', { error });
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

/**
 * GET /api/admin/logs
 * Get moderation logs
 */
router.get('/api/admin/logs', requireRole('moderator'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(getQueryParam(req.query.limit)) || 50, 200);
    const offset = parseInt(getQueryParam(req.query.offset)) || 0;

    const logs = await sql`
      SELECT 
        ml.id,
        ml.action,
        ml.reason,
        ml.metadata,
        ml.created_at,
        m.display_name as moderator_name,
        t.display_name as target_name
      FROM moderation_log ml
      LEFT JOIN agents m ON ml.moderator_id = m.id
      LEFT JOIN agents t ON ml.target_agent_id = t.id
      ORDER BY ml.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    res.json({ logs, limit, offset });
  } catch (error) {
    logger.error('Failed to fetch moderation logs', { error });
    res.status(500).json({ error: 'Failed to fetch moderation logs' });
  }
});

export default router;
