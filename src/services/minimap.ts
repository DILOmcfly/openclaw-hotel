/**
 * Minimap Service - Room overview with agent positions
 */

export type MinimapSettings = {
  roomId: number;
  enabled: boolean;
  showFurniture: boolean;
  showAgents: boolean;
  zoomLevel: number;
  updatedAt: Date;
};

export type TileData = {
  x: number;
  y: number;
  walkable: boolean;
};

export type FurniturePosition = {
  x: number;
  y: number;
  name: string;
};

export type AgentPosition = {
  x: number;
  y: number;
  name: string;
  color: string;
};

export type MapBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type MapData = {
  tiles: TileData[];
  furniture: FurniturePosition[];
  agents: AgentPosition[];
  bounds: MapBounds;
};

/**
 * Get minimap settings for a room
 */
export async function getSettings(roomId: number, sql: any): Promise<MinimapSettings> {
  const result = await sql`
    SELECT room_id AS "roomId",
           enabled,
           show_furniture AS "showFurniture",
           show_agents AS "showAgents",
           zoom_level AS "zoomLevel",
           updated_at AS "updatedAt"
    FROM minimap_settings
    WHERE room_id = ${roomId}
  `;

  if (result.length === 0) {
    // Return defaults for rooms without settings
    return {
      roomId,
      enabled: true,
      showFurniture: true,
      showAgents: true,
      zoomLevel: 1.0,
      updatedAt: new Date(),
    };
  }

  return result[0];
}

/**
 * Update minimap settings (caller must verify ownership)
 */
export async function updateSettings(
  roomId: number,
  settings: Partial<Pick<MinimapSettings, 'enabled' | 'showFurniture' | 'showAgents' | 'zoomLevel'>>,
  sql: any
): Promise<MinimapSettings> {
  const { enabled, showFurniture, showAgents, zoomLevel } = settings;

  // Validate zoom level
  if (zoomLevel !== undefined && (zoomLevel < 0.5 || zoomLevel > 3.0)) {
    throw new Error('Zoom level must be between 0.5 and 3.0');
  }

  const updated = await sql`
    INSERT INTO minimap_settings (room_id, enabled, show_furniture, show_agents, zoom_level, updated_at)
    VALUES (
      ${roomId},
      ${enabled ?? true},
      ${showFurniture ?? true},
      ${showAgents ?? true},
      ${zoomLevel ?? 1.0},
      NOW()
    )
    ON CONFLICT (room_id) DO UPDATE SET
      enabled = COALESCE(${enabled}, minimap_settings.enabled),
      show_furniture = COALESCE(${showFurniture}, minimap_settings.show_furniture),
      show_agents = COALESCE(${showAgents}, minimap_settings.show_agents),
      zoom_level = COALESCE(${zoomLevel}, minimap_settings.zoom_level),
      updated_at = NOW()
    RETURNING 
      room_id AS "roomId",
      enabled,
      show_furniture AS "showFurniture",
      show_agents AS "showAgents",
      zoom_level AS "zoomLevel",
      updated_at AS "updatedAt"
  `;

  return updated[0];
}

/**
 * Generate complete map data for a room
 */
export async function generateMapData(roomId: number, sql: any): Promise<MapData> {
  // Get room tiles
  const tiles = await sql`
    SELECT x, y, walkable
    FROM room_tiles
    WHERE room_id = ${roomId}
  `;

  // Get furniture positions
  const furniture = await sql`
    SELECT x, y, name
    FROM room_furniture
    WHERE room_id = ${roomId}
  `;

  // Get agent positions
  const agents = await getAgentPositions(roomId, sql);

  // Calculate bounds
  const allX = tiles.map((t: TileData) => t.x);
  const allY = tiles.map((t: TileData) => t.y);

  const bounds: MapBounds = {
    minX: allX.length > 0 ? Math.min(...allX) : 0,
    maxX: allX.length > 0 ? Math.max(...allX) : 0,
    minY: allY.length > 0 ? Math.min(...allY) : 0,
    maxY: allY.length > 0 ? Math.max(...allY) : 0,
  };

  return { tiles, furniture, agents, bounds };
}

/**
 * Get current agent positions in a room
 */
export async function getAgentPositions(roomId: number, sql: any): Promise<AgentPosition[]> {
  const result = await sql`
    SELECT ra.x, ra.y, a.name, a.color
    FROM room_agents ra
    JOIN agents a ON ra.agent_id = a.id
    WHERE ra.room_id = ${roomId}
  `;

  return result.map((r: any) => ({
    x: r.x,
    y: r.y,
    name: r.name,
    color: r.color || '#000000',
  }));
}
