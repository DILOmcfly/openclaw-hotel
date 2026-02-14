import { v4 as uuidv4 } from 'uuid';
import { sql } from '../db/index.js';

export interface RoomTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  layout: number[][];
  furniture_preset: Array<{
    furnitureId: string;
    x: number;
    y: number;
    rotation: number;
  }>;
  thumbnail_url: string | null;
  is_premium: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRoomFromTemplateParams {
  templateId: string;
  ownerId: string;
  roomName?: string;
}

/**
 * Get all available room templates
 */
export async function getAllTemplates(category?: string, includePremium: boolean = false): Promise<RoomTemplate[]> {
  let query = `
    SELECT 
      id, name, description, category, layout, furniture_preset,
      thumbnail_url, is_premium, use_count, created_at, updated_at
    FROM room_templates
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;

  if (category) {
    query += ` AND category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (!includePremium) {
    query += ` AND is_premium = FALSE`;
  }

  query += ` ORDER BY use_count DESC, created_at DESC`;

  const rows = await sql.unsafe(query, params);

  return rows.map((row: any) => ({
    ...row,
    layout: JSON.parse(row.layout),
    furniture_preset: JSON.parse(row.furniture_preset),
    is_premium: Boolean(row.is_premium),
  }));
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(templateId: string): Promise<RoomTemplate | null> {
  const rows = await sql`
    SELECT * FROM room_templates WHERE id = ${templateId}
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    ...row,
    layout: JSON.parse(row.layout),
    furniture_preset: JSON.parse(row.furniture_preset),
    is_premium: Boolean(row.is_premium),
  } as RoomTemplate;
}

/**
 * Create a new room from a template
 */
export async function createRoomFromTemplate(params: CreateRoomFromTemplateParams): Promise<string> {
  const template = await getTemplateById(params.templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  const roomId = uuidv4();
  const roomName = params.roomName || template.name;

  const height = template.layout.length;
  const width = template.layout[0]?.length || 0;

  if (!width || !height) {
    throw new Error('Invalid template layout');
  }

  // Create room record
  await sql`
    INSERT INTO rooms (id, name, owner_id, heightmap, width, height, category)
    VALUES (${roomId}, ${roomName}, ${params.ownerId}, ${JSON.stringify(template.layout)}, ${width}, ${height}, ${template.category})
  `;

  // Create furniture items from preset
  for (const item of template.furniture_preset) {
    await sql`
      INSERT INTO furniture (id, room_id, furniture_id, x, y, rotation, owner_id)
      VALUES (${uuidv4()}, ${roomId}, ${item.furnitureId}, ${item.x}, ${item.y}, ${item.rotation}, ${params.ownerId})
    `;
  }

  // Increment use_count
  await sql`
    UPDATE room_templates SET use_count = use_count + 1 WHERE id = ${params.templateId}
  `;

  return roomId;
}

/**
 * Save current room as a custom template
 */
export async function saveRoomAsTemplate(
  roomId: string,
  templateName: string,
  description?: string,
  isPrivate: boolean = false
): Promise<string> {
  // Get room data
  const rooms = await sql`
    SELECT heightmap, width, height, category FROM rooms WHERE id = ${roomId}
  `;

  if (rooms.length === 0) {
    throw new Error('Room not found');
  }

  const room = rooms[0];

  // Get furniture in room
  const furniture = await sql`
    SELECT furniture_id, x, y, rotation FROM furniture WHERE room_id = ${roomId}
  `;

  const furniturePreset = furniture.map((item: any) => ({
    furnitureId: item.furniture_id,
    x: item.x,
    y: item.y,
    rotation: item.rotation,
  }));

  const templateId = uuidv4();

  await sql`
    INSERT INTO room_templates (id, name, description, category, layout, furniture_preset, is_premium)
    VALUES (${templateId}, ${templateName}, ${description || null}, ${'custom'}, ${room.heightmap}, ${JSON.stringify(furniturePreset)}, ${isPrivate})
  `;

  return templateId;
}

/**
 * Delete a custom template
 */
export async function deleteTemplate(templateId: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM room_templates WHERE id = ${templateId} AND category = 'custom'
  `;

  return result.count > 0;
}

/**
 * Get popular templates (most used)
 */
export async function getPopularTemplates(limit: number = 10): Promise<RoomTemplate[]> {
  const rows = await sql`
    SELECT * FROM room_templates 
    WHERE is_premium = FALSE 
    ORDER BY use_count DESC, created_at DESC 
    LIMIT ${limit}
  `;

  return rows.map((row: any) => ({
    ...row,
    layout: JSON.parse(row.layout),
    furniture_preset: JSON.parse(row.furniture_preset),
    is_premium: Boolean(row.is_premium),
  }));
}

/**
 * Search templates by name
 */
export async function searchTemplates(query: string): Promise<RoomTemplate[]> {
  const rows = await sql`
    SELECT * FROM room_templates 
    WHERE LOWER(name) LIKE ${`%${query.toLowerCase()}%`} OR LOWER(description) LIKE ${`%${query.toLowerCase()}%`}
    ORDER BY use_count DESC
    LIMIT 20
  `;

  return rows.map((row: any) => ({
    ...row,
    layout: JSON.parse(row.layout),
    furniture_preset: JSON.parse(row.furniture_preset),
    is_premium: Boolean(row.is_premium),
  }));
}
