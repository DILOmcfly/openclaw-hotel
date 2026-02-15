/**
 * Room Tags Service - Tag-based room discovery
 */

const MAX_TAGS_PER_ROOM = 5;
const TRENDING_DAYS = 7;

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export async function addTag(roomId: number, tag: string, agentId: string, sql: any): Promise<void> {
  const normalized = normalizeTag(tag);
  if (!normalized || normalized.length > 30) throw new Error('Invalid tag');

  const room = await sql`SELECT owner_id AS "ownerId" FROM rooms WHERE id = ${roomId}`;
  if (room.length === 0) throw new Error('Room not found');
  if (room[0].ownerId !== agentId) throw new Error('Only room owner can add tags');

  const existing = await sql`SELECT COUNT(*) AS count FROM room_tags WHERE room_id = ${roomId}`;
  if (existing[0].count >= MAX_TAGS_PER_ROOM) {
    throw new Error(`Maximum ${MAX_TAGS_PER_ROOM} tags per room`);
  }

  await sql`
    INSERT INTO room_tags (room_id, tag, added_by)
    VALUES (${roomId}, ${normalized}, ${agentId})
    ON CONFLICT (room_id, tag) DO NOTHING
  `;
}

export async function removeTag(roomId: number, tag: string, agentId: string, sql: any): Promise<void> {
  const normalized = normalizeTag(tag);
  const room = await sql`SELECT owner_id AS "ownerId" FROM rooms WHERE id = ${roomId}`;
  if (room.length === 0) throw new Error('Room not found');
  if (room[0].ownerId !== agentId) throw new Error('Only room owner can remove tags');

  await sql`DELETE FROM room_tags WHERE room_id = ${roomId} AND tag = ${normalized}`;
}

export async function getRoomTags(roomId: number, sql: any): Promise<string[]> {
  const result = await sql`
    SELECT tag FROM room_tags WHERE room_id = ${roomId} ORDER BY created_at ASC
  `;
  return result.map((r: any) => r.tag);
}

export async function searchByTag(tag: string, sql: any): Promise<number[]> {
  const normalized = normalizeTag(tag);
  const result = await sql`SELECT room_id AS "roomId" FROM room_tags WHERE tag = ${normalized}`;
  return result.map((r: any) => r.roomId);
}

export async function getTrendingTags(limit: number, sql: any): Promise<Array<{ tag: string; count: number }>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - TRENDING_DAYS);

  const result = await sql`
    SELECT tag, COUNT(*) AS count FROM room_tags
    WHERE created_at >= ${cutoffDate.toISOString()}
    GROUP BY tag ORDER BY count DESC LIMIT ${limit}
  `;
  return result.map((r: any) => ({ tag: r.tag, count: parseInt(r.count) }));
}

export async function followTag(agentId: string, tag: string, sql: any): Promise<void> {
  const normalized = normalizeTag(tag);
  await sql`
    INSERT INTO tag_follows (agent_id, tag)
    VALUES (${agentId}, ${normalized})
    ON CONFLICT (agent_id, tag) DO NOTHING
  `;
}

export async function unfollowTag(agentId: string, tag: string, sql: any): Promise<void> {
  const normalized = normalizeTag(tag);
  await sql`DELETE FROM tag_follows WHERE agent_id = ${agentId} AND tag = ${normalized}`;
}

export async function getFollowedTags(agentId: string, sql: any): Promise<string[]> {
  const result = await sql`
    SELECT tag FROM tag_follows WHERE agent_id = ${agentId} ORDER BY created_at DESC
  `;
  return result.map((r: any) => r.tag);
}

export async function getRecommendedRooms(agentId: string, sql: any): Promise<number[]> {
  const result = await sql`
    SELECT DISTINCT rt.room_id AS "roomId" FROM room_tags rt
    INNER JOIN tag_follows tf ON rt.tag = tf.tag
    WHERE tf.agent_id = ${agentId}
    ORDER BY rt.created_at DESC
  `;
  return result.map((r: any) => r.roomId);
}
