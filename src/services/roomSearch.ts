/**
 * Room Search Service - Enhanced tagging and search for rooms
 */

export type RoomTag = {
  roomId: string;
  tag: string;
  createdBy: string;
  createdAt: string;
};

export type RoomDescription = {
  roomId: string;
  shortDesc: string;
  longDesc: string;
  rules: string;
  updatedAt: string;
};

export type SearchResult = {
  roomId: string;
  roomName: string;
  ownerName: string;
  matchType: 'name' | 'description' | 'tag';
};

export async function addTag(roomId: string, tag: string, createdBy: string, sql: any): Promise<{ success: boolean; error?: string }> {
  try {
    if (tag.length > 20 || tag.length === 0) return { success: false, error: 'Tag must be 1-20 characters' };
    
    const countResult = await sql`SELECT COUNT(*) AS count FROM room_tags_v2 WHERE room_id = ${roomId}`;
    if (parseInt(countResult[0]?.count || '0', 10) >= 10) return { success: false, error: 'Maximum 10 tags per room' };
    
    await sql`INSERT INTO room_tags_v2 (room_id, tag, created_by) VALUES (${roomId}, ${tag.toLowerCase()}, ${createdBy}) ON CONFLICT (room_id, tag) DO NOTHING`;
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add tag' };
  }
}

export async function removeTag(roomId: string, tag: string, sql: any): Promise<{ success: boolean }> {
  try {
    await sql`DELETE FROM room_tags_v2 WHERE room_id = ${roomId} AND tag = ${tag.toLowerCase()}`;
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getTagsByRoom(roomId: string, sql: any): Promise<RoomTag[]> {
  return await sql`
    SELECT room_id AS "roomId", tag, created_by AS "createdBy", created_at AS "createdAt"
    FROM room_tags_v2
    WHERE room_id = ${roomId}
    ORDER BY created_at ASC
  `;
}

export async function searchByTag(tag: string, sql: any): Promise<string[]> {
  const rows = await sql`SELECT DISTINCT room_id AS "roomId" FROM room_tags_v2 WHERE tag = ${tag.toLowerCase()}`;
  return rows.map((r: any) => r.roomId);
}

export async function getPopularTags(limit: number, sql: any): Promise<Array<{ tag: string; count: number }>> {
  const rows = await sql`SELECT tag, COUNT(*) AS count FROM room_tags_v2 GROUP BY tag ORDER BY count DESC, tag ASC LIMIT ${limit}`;
  return rows.map((r: any) => ({ tag: r.tag, count: parseInt(r.count, 10) }));
}

export async function setDescription(roomId: string, shortDesc: string, longDesc: string, rules: string, sql: any): Promise<{ success: boolean; error?: string }> {
  try {
    if (shortDesc.length > 200) return { success: false, error: 'Short description must be <= 200 characters' };
    if (longDesc.length > 2000) return { success: false, error: 'Long description must be <= 2000 characters' };
    if (rules.length > 500) return { success: false, error: 'Rules must be <= 500 characters' };
    
    await sql`
      INSERT INTO room_descriptions (room_id, short_desc, long_desc, rules, updated_at)
      VALUES (${roomId}, ${shortDesc}, ${longDesc}, ${rules}, NOW())
      ON CONFLICT (room_id) DO UPDATE SET short_desc = EXCLUDED.short_desc, long_desc = EXCLUDED.long_desc, rules = EXCLUDED.rules, updated_at = NOW()
    `;
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to set description' };
  }
}

export async function getDescription(roomId: string, sql: any): Promise<RoomDescription | null> {
  const rows = await sql`
    SELECT room_id AS "roomId", short_desc AS "shortDesc", long_desc AS "longDesc", rules, updated_at AS "updatedAt"
    FROM room_descriptions
    WHERE room_id = ${roomId}
  `;
  return rows.length > 0 ? rows[0] : null;
}

export async function searchRooms(query: string, sql: any): Promise<SearchResult[]> {
  const searchTerm = `%${query.toLowerCase()}%`;
  const results: SearchResult[] = [];
  
  const nameMatches = await sql`SELECT id AS "roomId", name AS "roomName", owner_name AS "ownerName" FROM rooms WHERE LOWER(name) LIKE ${searchTerm} LIMIT 20`;
  results.push(...nameMatches.map((r: any) => ({ roomId: r.roomId, roomName: r.roomName, ownerName: r.ownerName, matchType: 'name' as const })));
  
  const descMatches = await sql`
    SELECT rd.room_id AS "roomId", r.name AS "roomName", r.owner_name AS "ownerName"
    FROM room_descriptions rd
    JOIN rooms r ON rd.room_id = r.id
    WHERE LOWER(rd.short_desc) LIKE ${searchTerm} OR LOWER(rd.long_desc) LIKE ${searchTerm}
    LIMIT 20
  `;
  for (const match of descMatches) {
    if (!results.find((r) => r.roomId === match.roomId)) {
      results.push({ roomId: match.roomId, roomName: match.roomName, ownerName: match.ownerName, matchType: 'description' });
    }
  }
  
  const tagMatches = await sql`
    SELECT DISTINCT rt.room_id AS "roomId", r.name AS "roomName", r.owner_name AS "ownerName"
    FROM room_tags_v2 rt
    JOIN rooms r ON rt.room_id = r.id
    WHERE rt.tag LIKE ${searchTerm}
    LIMIT 20
  `;
  for (const match of tagMatches) {
    if (!results.find((r) => r.roomId === match.roomId)) {
      results.push({ roomId: match.roomId, roomName: match.roomName, ownerName: match.ownerName, matchType: 'tag' });
    }
  }
  
  return results.slice(0, 20);
}
