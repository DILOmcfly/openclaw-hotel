import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Validates heightmap format and dimensions
 * Format: rows separated by '|', each character is a tile (0-9)
 * Min: 10x10, Max: 50x50
 */
export function validateHeightmap(heightmap: string): { valid: boolean; error?: string; dimensions?: { width: number; height: number } } {
  const rows = heightmap.split('|');
  
  if (rows.length < 10) {
    return { valid: false, error: 'Minimum room height is 10 tiles' };
  }
  
  if (rows.length > 50) {
    return { valid: false, error: 'Maximum room height is 50 tiles' };
  }

  const width = rows[0].length;
  
  if (width < 10) {
    return { valid: false, error: 'Minimum room width is 10 tiles' };
  }
  
  if (width > 50) {
    return { valid: false, error: 'Maximum room width is 50 tiles' };
  }

  // Validate all rows have same width and contain only valid characters (0-9)
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].length !== width) {
      return { valid: false, error: `Row ${i + 1} has inconsistent width (expected ${width}, got ${rows[i].length})` };
    }
    
    if (!/^[0-9]+$/.test(rows[i])) {
      return { valid: false, error: `Row ${i + 1} contains invalid characters (only 0-9 allowed)` };
    }
  }

  return { valid: true, dimensions: { width, height: rows.length } };
}

/**
 * PUT /api/rooms/:roomId/layout
 * Update room layout (heightmap + metadata)
 * Only room creator can edit
 */
router.put('/api/rooms/:roomId/layout', validateToken, async (req, res) => {
  try {
    const agentId = req.agent!.id;
    const { roomId } = req.params;
    const { heightmap, floorType, wallColor } = req.body;

    if (!heightmap) {
      return res.status(400).json({ error: 'heightmap is required' });
    }

    // Validate heightmap format
    const validation = validateHeightmap(heightmap);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check room ownership
    const room = await sql`
      SELECT id, created_by, name, metadata
      FROM rooms
      WHERE id = ${roomId}::uuid
    `;

    if (room.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room[0].created_by !== agentId) {
      return res.status(403).json({ error: 'Only the room creator can edit layout' });
    }

    // Update room layout
    const updatedMetadata = {
      ...room[0].metadata,
      floorType: floorType || room[0].metadata.floorType || 'default',
      wallColor: wallColor || room[0].metadata.wallColor || '#cccccc',
      lastEditedAt: new Date().toISOString(),
      dimensions: validation.dimensions,
    };

    await sql`
      UPDATE rooms
      SET 
        heightmap = ${heightmap},
        metadata = ${JSON.stringify(updatedMetadata)}::jsonb
      WHERE id = ${roomId}::uuid
    `;

    // Audit log
    await sql`
      INSERT INTO audit_log (event_type, agent_id, room_id, details)
      VALUES (
        'room.edit_layout',
        ${agentId}::uuid,
        ${roomId}::uuid,
        ${JSON.stringify({ 
          dimensions: validation.dimensions,
          floorType: updatedMetadata.floorType,
          wallColor: updatedMetadata.wallColor 
        })}::jsonb
      )
    `;

    logger.info('Room layout updated', {
      roomId,
      agentId,
      dimensions: validation.dimensions,
    });

    res.json({
      success: true,
      room: {
        id: roomId,
        name: room[0].name,
        heightmap,
        metadata: updatedMetadata,
      },
    });
  } catch (error) {
    logger.error('Failed to update room layout', { error });
    res.status(500).json({ error: 'Failed to update room layout' });
  }
});

/**
 * GET /api/rooms/:roomId/layout
 * Get room layout (for editor)
 */
router.get('/api/rooms/:roomId/layout', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await sql`
      SELECT id, name, heightmap, metadata, created_by
      FROM rooms
      WHERE id = ${roomId}::uuid
    `;

    if (room.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const rows = room[0].heightmap.split('|');
    const dimensions = {
      width: rows[0]?.length || 0,
      height: rows.length,
    };

    res.json({
      id: room[0].id,
      name: room[0].name,
      heightmap: room[0].heightmap,
      dimensions,
      floorType: room[0].metadata?.floorType || 'default',
      wallColor: room[0].metadata?.wallColor || '#cccccc',
      createdBy: room[0].created_by,
    });
  } catch (error) {
    logger.error('Failed to fetch room layout', { error });
    res.status(500).json({ error: 'Failed to fetch room layout' });
  }
});

/**
 * PUT /api/rooms/:roomId/privacy
 * Update room privacy settings (owner only)
 */
router.put('/api/rooms/:roomId/privacy', validateToken, async (req, res) => {
  try {
    const agentId = req.agent!.id;
    const { roomId } = req.params;
    const { visibility, password, maxOccupants } = req.body;

    // Validate visibility
    if (visibility && !['public', 'private', 'password'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility type' });
    }

    // Check room ownership
    const room = await sql`
      SELECT id, created_by
      FROM rooms
      WHERE id = ${roomId}::uuid
    `;

    if (room.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room[0].created_by !== agentId) {
      return res.status(403).json({ error: 'Only the room creator can modify privacy settings' });
    }

    // Update privacy settings using the service
    const { setRoomVisibility } = await import('../services/roomPrivacy.js');
    
    if (visibility) {
      await setRoomVisibility(roomId as string, visibility as any, sql, password);
    }

    // Update max occupants if provided
    if (maxOccupants !== undefined) {
      if (typeof maxOccupants !== 'number' || maxOccupants < 1 || maxOccupants > 100) {
        return res.status(400).json({ error: 'Max occupants must be between 1 and 100' });
      }

      await sql`
        UPDATE rooms
        SET max_occupants = ${maxOccupants}
        WHERE id = ${roomId}::uuid
      `;
    }

    // Audit log
    await sql`
      INSERT INTO audit_log (event_type, agent_id, room_id, details)
      VALUES (
        'room.privacy_updated',
        ${agentId}::uuid,
        ${roomId}::uuid,
        ${JSON.stringify({ visibility, maxOccupants })}::jsonb
      )
    `;

    logger.info('Room privacy updated', { roomId, agentId, visibility, maxOccupants });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update room privacy', { error });
    res.status(500).json({ error: 'Failed to update room privacy' });
  }
});

/**
 * GET /api/rooms/:roomId/info
 * Get room info including privacy status and occupancy
 */
router.get('/api/rooms/:roomId/info', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await sql`
      SELECT 
        id, 
        name, 
        description,
        visibility, 
        max_occupants,
        created_by
      FROM rooms
      WHERE id = ${roomId}::uuid
    `;

    if (room.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get current occupancy
    const occupants = await sql`
      SELECT COUNT(*)::int as count
      FROM presence
      WHERE room_id = ${roomId}::uuid
    `;

    const currentOccupants = occupants[0].count;
    const isFull = currentOccupants >= room[0].max_occupants;

    res.json({
      id: room[0].id,
      name: room[0].name,
      description: room[0].description,
      visibility: room[0].visibility,
      maxOccupants: room[0].max_occupants,
      currentOccupants,
      isFull,
      requiresPassword: room[0].visibility === 'password',
      createdBy: room[0].created_by,
    });
  } catch (error) {
    logger.error('Failed to fetch room info', { error });
    res.status(500).json({ error: 'Failed to fetch room info' });
  }
});

/**
 * POST /api/rooms
 * Create a new room
 */
router.post('/api/rooms', validateToken, async (req, res) => {
  try {
    const agentId = req.agent!.id;
    const { name, description, category, visibility, maxOccupants } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    if (name.length > 128) {
      return res.status(400).json({ error: 'Room name must be 128 characters or less' });
    }

    // Generate slug from name (lowercase, replace spaces with hyphens, remove special chars)
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 128);

    // Check if slug exists, add suffix if needed
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await sql`
        SELECT id FROM rooms WHERE slug = ${slug} LIMIT 1
      `;
      if (existing.length === 0) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    // Default heightmap: 15x15 flat grid
    const defaultHeightmap = Array(15).fill('0'.repeat(15)).join('|');

    // Validate category
    const validCategories = ['public', 'official', 'roleplay', 'games', 'trading', 'hangout', 'custom'];
    const roomCategory = validCategories.includes(category) ? category : 'public';

    // Validate visibility
    const validVisibilities = ['public', 'private'];
    const roomVisibility = validVisibilities.includes(visibility) ? visibility : 'public';

    // Validate max occupants (10-100)
    const maxOcc = Math.max(10, Math.min(100, maxOccupants || 50));

    // Create room
    const result = await sql`
      INSERT INTO rooms (
        name,
        slug,
        description,
        heightmap,
        created_by,
        max_occupants,
        category,
        visibility,
        metadata
      )
      VALUES (
        ${name.trim()},
        ${slug},
        ${description || ''},
        ${defaultHeightmap},
        ${agentId}::uuid,
        ${maxOcc},
        ${roomCategory},
        ${roomVisibility},
        ${JSON.stringify({ createdAt: new Date().toISOString() })}::jsonb
      )
      RETURNING id, name, slug, description, max_occupants, category, visibility
    `;

    const room = result[0];

    // Update agent's room_count in profiles
    await sql`
      UPDATE agent_profiles
      SET room_count = room_count + 1
      WHERE agent_id = ${agentId}::uuid
    `;

    // Track personality: creating rooms increases curiosity
    const { updateTraitFromAction, calculateActionImpacts } = await import('../services/personality.js');
    const impacts = calculateActionImpacts('room_created');
    if (impacts.length > 0) {
      updateTraitFromAction(sql, agentId, impacts).catch((err) => {
        console.error('[PERSONALITY] Error updating traits:', err);
      });
    }

    logger.info('Room created', {
      roomId: room.id,
      name: room.name,
      createdBy: agentId,
    });

    res.status(201).json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        slug: room.slug,
        description: room.description,
        maxOccupants: room.max_occupants,
        category: room.category,
        visibility: room.visibility,
      },
    });
  } catch (error) {
    logger.error('Failed to create room', { error });
    res.status(500).json({ error: 'Failed to create room' });
  }
});

export default router;
