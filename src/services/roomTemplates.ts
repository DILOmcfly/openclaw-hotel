/**
 * Room Templates Service
 * Manages room template creation, retrieval, and instantiation
 */

export interface RoomTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  creator_id: string | null;
  heightmap: string;
  furniture_layout: FurnitureItem[];
  is_official: boolean;
  use_count: number;
  created_at: Date;
}

export interface FurnitureItem {
  furnitureId: string;
  x: number;
  y: number;
  rotation: number;
}

/**
 * Get all templates, optionally filtered by category
 */
export async function getTemplates(category: string | undefined, sql: any): Promise<RoomTemplate[]> {
  let query: any[];

  if (category) {
    query = await sql`
      SELECT * FROM room_templates
      WHERE category = ${category}
      ORDER BY is_official DESC, use_count DESC, created_at DESC
    `;
  } else {
    query = await sql`
      SELECT * FROM room_templates
      ORDER BY is_official DESC, use_count DESC, created_at DESC
    `;
  }

  return query.map(row => ({
    ...row,
    furniture_layout: typeof row.furniture_layout === 'string' 
      ? JSON.parse(row.furniture_layout) 
      : row.furniture_layout,
    is_official: Boolean(row.is_official),
  }));
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(id: string, sql: any): Promise<RoomTemplate | null> {
  const rows = await sql`
    SELECT * FROM room_templates WHERE id = ${id}
  `;

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    ...row,
    furniture_layout: typeof row.furniture_layout === 'string'
      ? JSON.parse(row.furniture_layout)
      : row.furniture_layout,
    is_official: Boolean(row.is_official),
  };
}

/**
 * Create a room from a template
 */
export async function createFromTemplate(
  templateId: string,
  agentId: string,
  roomName: string,
  sql: any
): Promise<string> {
  const template = await getTemplateById(templateId, sql);
  
  if (!template) {
    throw new Error('Template not found');
  }

  // Parse heightmap
  const heightmapData = JSON.parse(template.heightmap);
  const height = heightmapData.length;
  const width = heightmapData[0]?.length || 0;

  if (!width || !height) {
    throw new Error('Invalid template heightmap');
  }

  // Generate room slug from name
  const slug = roomName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + Date.now();
  
  // Create room (using UUID compatible with existing schema)
  const roomResult = await sql`
    INSERT INTO rooms (name, slug, description, heightmap, created_by, is_public)
    VALUES (
      ${roomName},
      ${slug},
      ${template.description || ''},
      ${template.heightmap},
      ${agentId},
      true
    )
    RETURNING id
  `;

  const roomId = roomResult[0].id;

  // Place furniture from template
  for (const item of template.furniture_layout) {
    await sql`
      INSERT INTO furniture (room_id, furniture_id, x, y, rotation, owner_id)
      VALUES (
        ${roomId},
        ${item.furnitureId},
        ${item.x},
        ${item.y},
        ${item.rotation},
        ${agentId}
      )
    `;
  }

  // Increment use count
  await incrementUseCount(templateId, sql);

  return roomId;
}

/**
 * Create a custom template
 */
export async function createTemplate(
  name: string,
  description: string,
  category: string,
  heightmap: string,
  furnitureLayout: FurnitureItem[],
  creatorId: string,
  sql: any
): Promise<string> {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

  await sql`
    INSERT INTO room_templates (id, name, description, category, heightmap, furniture_layout, creator_id, is_official)
    VALUES (
      ${id},
      ${name},
      ${description},
      ${category},
      ${heightmap},
      ${JSON.stringify(furnitureLayout)},
      ${creatorId},
      false
    )
  `;

  return id;
}

/**
 * Increment template use count
 */
export async function incrementUseCount(templateId: string, sql: any): Promise<void> {
  await sql`
    UPDATE room_templates
    SET use_count = use_count + 1
    WHERE id = ${templateId}
  `;
}
