/**
 * Floor Patterns Service - Manages room floor tile painting and patterns
 */

export type FloorTile = {
  roomId: string;
  x: number;
  y: number;
  pattern: string;
  color: string;
  secondaryColor: string;
};

export const VALID_PATTERNS = [
  'solid',
  'checkerboard',
  'stripes',
  'dots',
  'diamond',
  'wood',
  'marble',
  'grass',
  'carpet',
  'tile',
] as const;

export type Pattern = typeof VALID_PATTERNS[number];

/**
 * Validate hex color format (#RRGGBB)
 */
export function validateColor(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Validate pattern type
 */
export function validatePattern(pattern: string): boolean {
  return VALID_PATTERNS.includes(pattern as Pattern);
}

/**
 * Set a single floor tile
 */
export async function setTile(
  roomId: string,
  x: number,
  y: number,
  pattern: string,
  color: string,
  secondaryColor: string,
  sql: any
): Promise<FloorTile> {
  if (!validatePattern(pattern)) {
    throw new Error(`Invalid pattern. Must be one of: ${VALID_PATTERNS.join(', ')}`);
  }

  if (!validateColor(color)) {
    throw new Error('Invalid color format. Must be hex color (#RRGGBB)');
  }

  if (!validateColor(secondaryColor)) {
    throw new Error('Invalid secondary color format. Must be hex color (#RRGGBB)');
  }

  const result = await sql`
    INSERT INTO room_floor_tiles (room_id, x, y, pattern, color, secondary_color)
    VALUES (${roomId}, ${x}, ${y}, ${pattern}, ${color}, ${secondaryColor})
    ON CONFLICT (room_id, x, y) 
    DO UPDATE SET 
      pattern = EXCLUDED.pattern,
      color = EXCLUDED.color,
      secondary_color = EXCLUDED.secondary_color
    RETURNING 
      room_id AS "roomId", 
      x, 
      y, 
      pattern, 
      color, 
      secondary_color AS "secondaryColor"
  `;

  return result[0];
}

/**
 * Set a rectangular area of floor tiles (bulk fill)
 */
export async function setArea(
  roomId: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pattern: string,
  color: string,
  secondaryColor: string,
  sql: any
): Promise<number> {
  if (!validatePattern(pattern)) {
    throw new Error(`Invalid pattern. Must be one of: ${VALID_PATTERNS.join(', ')}`);
  }

  if (!validateColor(color)) {
    throw new Error('Invalid color format. Must be hex color (#RRGGBB)');
  }

  if (!validateColor(secondaryColor)) {
    throw new Error('Invalid secondary color format. Must be hex color (#RRGGBB)');
  }

  // Ensure coordinates are in the right order
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  // Generate tiles for the area
  const tiles: Array<{ x: number; y: number }> = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ x, y });
    }
  }

  // Batch insert/update all tiles
  let count = 0;
  for (const tile of tiles) {
    await sql`
      INSERT INTO room_floor_tiles (room_id, x, y, pattern, color, secondary_color)
      VALUES (${roomId}, ${tile.x}, ${tile.y}, ${pattern}, ${color}, ${secondaryColor})
      ON CONFLICT (room_id, x, y) 
      DO UPDATE SET 
        pattern = EXCLUDED.pattern,
        color = EXCLUDED.color,
        secondary_color = EXCLUDED.secondary_color
    `;
    count++;
  }

  return count;
}

/**
 * Get a single floor tile
 */
export async function getTile(
  roomId: string,
  x: number,
  y: number,
  sql: any
): Promise<FloorTile | null> {
  const result = await sql`
    SELECT 
      room_id AS "roomId", 
      x, 
      y, 
      pattern, 
      color, 
      secondary_color AS "secondaryColor"
    FROM room_floor_tiles
    WHERE room_id = ${roomId} AND x = ${x} AND y = ${y}
  `;

  return result.length > 0 ? result[0] : null;
}

/**
 * Get all floor tiles for a room
 */
export async function getRoomFloor(roomId: string, sql: any): Promise<FloorTile[]> {
  const result = await sql`
    SELECT 
      room_id AS "roomId", 
      x, 
      y, 
      pattern, 
      color, 
      secondary_color AS "secondaryColor"
    FROM room_floor_tiles
    WHERE room_id = ${roomId}
    ORDER BY y, x
  `;

  return result;
}

/**
 * Clear a single floor tile (reset to default)
 */
export async function clearTile(roomId: string, x: number, y: number, sql: any): Promise<void> {
  await sql`
    DELETE FROM room_floor_tiles
    WHERE room_id = ${roomId} AND x = ${x} AND y = ${y}
  `;
}

/**
 * Clear all floor tiles for a room
 */
export async function clearRoom(roomId: string, sql: any): Promise<number> {
  const result = await sql`
    DELETE FROM room_floor_tiles
    WHERE room_id = ${roomId}
  `;

  return result.count;
}
