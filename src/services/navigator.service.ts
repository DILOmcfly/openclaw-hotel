/**
 * Navigator Service
 * Handles room search, filtering, favorites, and visit tracking
 */
import { sql } from '../db/index.js';

export interface RoomListItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  occupants: number;
  maxOccupants: number;
  createdBy: string | null;
  isFavorite?: boolean;
  lastVisited?: Date | null;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  tag?: string;
  sortBy?: 'name' | 'occupants' | 'recent';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Search and filter rooms with advanced options
 */
export async function searchRooms(
  agentId: string | null,
  filters: SearchFilters
): Promise<RoomListItem[]> {
  const {
    query = '',
    category,
    tag,
    sortBy = 'occupants',
    sortOrder = 'desc',
    limit = 50,
    offset = 0
  } = filters;

  let queryStr = `
    SELECT 
      r.id,
      r.name,
      r.description,
      r.category,
      r.max_occupants AS "maxOccupants",
      r.created_by AS "createdBy",
      COUNT(DISTINCT p.agent_id) AS occupants,
      COALESCE(
        json_agg(DISTINCT rt.tag) FILTER (WHERE rt.tag IS NOT NULL),
        '[]'
      ) AS tags,
      ${agentId ? `EXISTS(SELECT 1 FROM room_favorites rf WHERE rf.room_id = r.id AND rf.agent_id = $${agentId ? '1' : 'NULL'}) AS "isFavorite",` : 'false AS "isFavorite",'}
      ${agentId ? `rv.last_visited_at AS "lastVisited"` : 'NULL AS "lastVisited"'}
    FROM rooms r
    LEFT JOIN presence p ON r.id = p.room_id
    LEFT JOIN room_tags rt ON r.id = rt.room_id
    ${agentId ? `LEFT JOIN room_visits rv ON r.id = rv.room_id AND rv.agent_id = $1` : ''}
    WHERE r.is_public = true
  `;

  const params: any[] = agentId ? [agentId] : [];
  let paramIndex = agentId ? 2 : 1;

  // Search by name
  if (query) {
    queryStr += ` AND LOWER(r.name) LIKE LOWER($${paramIndex})`;
    params.push(`%${query}%`);
    paramIndex++;
  }

  // Filter by category
  if (category) {
    queryStr += ` AND r.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  // Filter by tag
  if (tag) {
    queryStr += ` AND EXISTS(SELECT 1 FROM room_tags rt2 WHERE rt2.room_id = r.id AND rt2.tag = $${paramIndex})`;
    params.push(tag);
    paramIndex++;
  }

  queryStr += ` GROUP BY r.id, r.name, r.description, r.category, r.max_occupants, r.created_by${agentId ? ', rv.last_visited_at' : ''}`;

  // Sorting
  if (sortBy === 'name') {
    queryStr += ` ORDER BY r.name ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
  } else if (sortBy === 'occupants') {
    queryStr += ` ORDER BY occupants ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
  } else if (sortBy === 'recent' && agentId) {
    queryStr += ` ORDER BY rv.last_visited_at ${sortOrder === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`;
  }

  queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await sql.unsafe(queryStr, params);

  return result.map((row: any) => ({
    ...row,
    tags: Array.isArray(row.tags) && row.tags[0] !== null ? row.tags : [],
    occupants: parseInt(row.occupants, 10)
  }));
}

/**
 * Add room to favorites
 */
export async function addFavorite(agentId: string, roomId: string): Promise<void> {
  await sql`
    INSERT INTO room_favorites (agent_id, room_id)
    VALUES (${agentId}, ${roomId})
    ON CONFLICT (agent_id, room_id) DO NOTHING
  `;
}

/**
 * Remove room from favorites
 */
export async function removeFavorite(agentId: string, roomId: string): Promise<void> {
  await sql`
    DELETE FROM room_favorites 
    WHERE agent_id = ${agentId} AND room_id = ${roomId}
  `;
}

/**
 * Get agent's favorite rooms
 */
export async function getFavorites(agentId: string): Promise<RoomListItem[]> {
  return searchRooms(agentId, { sortBy: 'name', sortOrder: 'asc', limit: 100 });
}

/**
 * Track room visit (for "recent rooms" feature)
 */
export async function trackVisit(agentId: string, roomId: string): Promise<void> {
  await sql`
    INSERT INTO room_visits (agent_id, room_id, last_visited_at, visit_count)
    VALUES (${agentId}, ${roomId}, NOW(), 1)
    ON CONFLICT (agent_id, room_id)
    DO UPDATE SET 
      last_visited_at = NOW(),
      visit_count = room_visits.visit_count + 1
  `;
}

/**
 * Get agent's recent rooms (sorted by last visit)
 */
export async function getRecentRooms(agentId: string, limit = 10): Promise<RoomListItem[]> {
  return searchRooms(agentId, {
    sortBy: 'recent',
    sortOrder: 'desc',
    limit
  });
}

/**
 * Get all available categories
 */
export async function getCategories(): Promise<string[]> {
  const result = await sql`
    SELECT DISTINCT category FROM rooms WHERE category IS NOT NULL ORDER BY category
  `;
  return result.map((row: any) => row.category);
}

/**
 * Get all available tags
 */
export async function getTags(): Promise<string[]> {
  const result = await sql`
    SELECT DISTINCT tag FROM room_tags ORDER BY tag
  `;
  return result.map((row: any) => row.tag);
}

/**
 * Add tags to a room (owner only)
 */
export async function addRoomTags(roomId: string, tags: string[]): Promise<void> {
  const uniqueTags = [...new Set(tags.map(t => t.toLowerCase().trim()))];
  for (const tag of uniqueTags) {
    if (tag.length > 0 && tag.length <= 32) {
      await sql`
        INSERT INTO room_tags (room_id, tag) 
        VALUES (${roomId}, ${tag}) 
        ON CONFLICT DO NOTHING
      `;
    }
  }
}

/**
 * Update room category (owner only)
 */
export async function updateRoomCategory(roomId: string, category: string): Promise<void> {
  const validCategories = ['public', 'official', 'roleplay', 'games', 'trading', 'hangout', 'custom'];
  if (!validCategories.includes(category)) {
    throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  await sql`
    UPDATE rooms SET category = ${category} WHERE id = ${roomId}
  `;
}
