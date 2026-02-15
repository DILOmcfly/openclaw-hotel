/**
 * Bookmarks Service - Manages agent bookmarks for rooms, items, agents, guilds, events, auctions
 */

export type BookmarkType = 'room' | 'agent' | 'item' | 'guild' | 'event' | 'auction';

export type Bookmark = {
  id: number;
  agentId: string;
  bookmarkType: BookmarkType;
  targetId: string;
  note: string | null;
  folder: string;
  createdAt: Date;
};

const MAX_BOOKMARKS_PER_AGENT = 200;
const BOOKMARK_COLUMNS = `id, agent_id AS "agentId", bookmark_type AS "bookmarkType", target_id AS "targetId", note, folder, created_at AS "createdAt"`;

export function isValidBookmarkType(type: string): type is BookmarkType {
  return ['room', 'agent', 'item', 'guild', 'event', 'auction'].includes(type);
}

export async function addBookmark(agentId: string, bookmarkType: BookmarkType, targetId: string, note: string | null, folder: string, sql: any): Promise<Bookmark> {
  const count = await getBookmarkCount(agentId, sql);
  if (count >= MAX_BOOKMARKS_PER_AGENT) throw new Error(`Bookmark limit reached (max ${MAX_BOOKMARKS_PER_AGENT})`);

  const result = await sql`
    INSERT INTO agent_bookmarks (agent_id, bookmark_type, target_id, note, folder)
    VALUES (${agentId}, ${bookmarkType}, ${targetId}, ${note}, ${folder})
    ON CONFLICT (agent_id, bookmark_type, target_id) DO UPDATE SET note = ${note}, folder = ${folder}
    RETURNING ${sql(BOOKMARK_COLUMNS)}
  `;
  return result[0];
}

export async function removeBookmark(agentId: string, bookmarkId: number, sql: any): Promise<boolean> {
  const result = await sql`DELETE FROM agent_bookmarks WHERE id = ${bookmarkId} AND agent_id = ${agentId} RETURNING id`;
  return result.length > 0;
}

export async function getBookmarks(agentId: string, bookmarkType: BookmarkType | null, folder: string | null, sql: any): Promise<Bookmark[]> {
  if (bookmarkType && folder) {
    return await sql`SELECT ${sql(BOOKMARK_COLUMNS)} FROM agent_bookmarks WHERE agent_id = ${agentId} AND bookmark_type = ${bookmarkType} AND folder = ${folder} ORDER BY created_at DESC`;
  } else if (bookmarkType) {
    return await sql`SELECT ${sql(BOOKMARK_COLUMNS)} FROM agent_bookmarks WHERE agent_id = ${agentId} AND bookmark_type = ${bookmarkType} ORDER BY created_at DESC`;
  } else if (folder) {
    return await sql`SELECT ${sql(BOOKMARK_COLUMNS)} FROM agent_bookmarks WHERE agent_id = ${agentId} AND folder = ${folder} ORDER BY created_at DESC`;
  }
  return await sql`SELECT ${sql(BOOKMARK_COLUMNS)} FROM agent_bookmarks WHERE agent_id = ${agentId} ORDER BY created_at DESC`;
}

export async function getFolders(agentId: string, sql: any): Promise<{ folder: string; count: number }[]> {
  return await sql`SELECT folder, COUNT(*)::int AS count FROM agent_bookmarks WHERE agent_id = ${agentId} GROUP BY folder ORDER BY folder`;
}

export async function moveToFolder(agentId: string, bookmarkId: number, newFolder: string, sql: any): Promise<boolean> {
  const result = await sql`UPDATE agent_bookmarks SET folder = ${newFolder} WHERE id = ${bookmarkId} AND agent_id = ${agentId} RETURNING id`;
  return result.length > 0;
}

export async function getBookmarkCount(agentId: string, sql: any): Promise<number> {
  const result = await sql`SELECT COUNT(*)::int AS count FROM agent_bookmarks WHERE agent_id = ${agentId}`;
  return result[0].count;
}

export async function searchBookmarks(agentId: string, query: string, sql: any): Promise<Bookmark[]> {
  return await sql`SELECT ${sql(BOOKMARK_COLUMNS)} FROM agent_bookmarks WHERE agent_id = ${agentId} AND note ILIKE ${'%' + query + '%'} ORDER BY created_at DESC`;
}

export async function isBookmarked(agentId: string, bookmarkType: BookmarkType, targetId: string, sql: any): Promise<boolean> {
  const result = await sql`SELECT id FROM agent_bookmarks WHERE agent_id = ${agentId} AND bookmark_type = ${bookmarkType} AND target_id = ${targetId}`;
  return result.length > 0;
}
