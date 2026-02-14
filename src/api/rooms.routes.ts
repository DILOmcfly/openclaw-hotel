import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
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
router.put('/api/rooms/:roomId/layout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
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

export default router;
