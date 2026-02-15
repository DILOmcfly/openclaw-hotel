/**
 * Guest Book Service - Manages room visitor messages
 */

export type GuestbookEntry = {
  id: number;
  roomId: number;
  authorId: string;
  message: string;
  mood: string;
  pinned: boolean;
  likes: number;
  createdAt: Date;
};

export type GuestbookStats = {
  totalEntries: number;
  uniqueVisitors: number;
  mostActiveContributor: { authorId: string; count: number } | null;
  moodDistribution: { mood: string; count: number }[];
};

/**
 * Enable guest book for a room (owner only)
 */
export async function enableGuestbook(roomId: number, ownerId: string, sql: any): Promise<void> {
  // Verify ownership
  const room = await sql`SELECT owner_id FROM rooms WHERE id = ${roomId}`;
  if (room.length === 0 || room[0].owner_id !== ownerId) {
    throw new Error('Only room owner can enable guest book');
  }

  await sql`
    INSERT INTO room_guestbooks (room_id, enabled)
    VALUES (${roomId}, true)
    ON CONFLICT (room_id) DO UPDATE SET enabled = true
  `;
}

/**
 * Add entry to guest book (max 500 chars, one per agent per day)
 */
export async function addEntry(
  roomId: number,
  authorId: string,
  message: string,
  mood: string,
  sql: any
): Promise<GuestbookEntry> {
  // Validate message length
  if (!message || message.length === 0 || message.length > 500) {
    throw new Error('Message must be 1-500 characters');
  }

  // Check if guest book is enabled
  const gb = await sql`SELECT enabled FROM room_guestbooks WHERE room_id = ${roomId}`;
  if (gb.length === 0 || !gb[0].enabled) {
    throw new Error('Guest book not enabled for this room');
  }

  // Check if agent already posted today
  const today = new Date().toISOString().split('T')[0];
  const existing = await sql`
    SELECT id FROM guestbook_entries
    WHERE room_id = ${roomId} AND author_id = ${authorId}
    AND DATE(created_at) = ${today}
  `;
  if (existing.length > 0) {
    throw new Error('You can only post once per day');
  }

  const result = await sql`
    INSERT INTO guestbook_entries (room_id, author_id, message, mood)
    VALUES (${roomId}, ${authorId}, ${message}, ${mood})
    RETURNING id, room_id AS "roomId", author_id AS "authorId", message, mood, pinned, likes, created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Get entries (paginated, newest first)
 */
export async function getEntries(roomId: number, limit: number, offset: number, sql: any): Promise<GuestbookEntry[]> {
  const result = await sql`
    SELECT id, room_id AS "roomId", author_id AS "authorId", message, mood, pinned, likes, created_at AS "createdAt"
    FROM guestbook_entries
    WHERE room_id = ${roomId}
    ORDER BY pinned DESC, created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return result;
}

/**
 * Pin entry (owner only, max 3 pinned)
 */
export async function pinEntry(entryId: number, ownerId: string, sql: any): Promise<void> {
  const entry = await sql`SELECT room_id FROM guestbook_entries WHERE id = ${entryId}`;
  if (entry.length === 0) throw new Error('Entry not found');

  const room = await sql`SELECT owner_id FROM rooms WHERE id = ${entry[0].room_id}`;
  if (room.length === 0 || room[0].owner_id !== ownerId) {
    throw new Error('Only room owner can pin entries');
  }

  const pinned = await sql`SELECT COUNT(*) as count FROM guestbook_entries WHERE room_id = ${entry[0].room_id} AND pinned = true`;
  if (pinned[0].count >= 3) {
    throw new Error('Maximum 3 entries can be pinned');
  }

  await sql`UPDATE guestbook_entries SET pinned = true WHERE id = ${entryId}`;
}

/**
 * Unpin entry (owner only)
 */
export async function unpinEntry(entryId: number, ownerId: string, sql: any): Promise<void> {
  const entry = await sql`SELECT room_id FROM guestbook_entries WHERE id = ${entryId}`;
  if (entry.length === 0) throw new Error('Entry not found');

  const room = await sql`SELECT owner_id FROM rooms WHERE id = ${entry[0].room_id}`;
  if (room.length === 0 || room[0].owner_id !== ownerId) {
    throw new Error('Only room owner can unpin entries');
  }

  await sql`UPDATE guestbook_entries SET pinned = false WHERE id = ${entryId}`;
}

/**
 * Like entry (toggle)
 */
export async function likeEntry(entryId: number, sql: any): Promise<number> {
  const result = await sql`
    UPDATE guestbook_entries
    SET likes = likes + 1
    WHERE id = ${entryId}
    RETURNING likes
  `;
  if (result.length === 0) throw new Error('Entry not found');
  return result[0].likes;
}

/**
 * Delete entry (author or owner)
 */
export async function deleteEntry(entryId: number, userId: string, sql: any): Promise<void> {
  const entry = await sql`SELECT room_id, author_id FROM guestbook_entries WHERE id = ${entryId}`;
  if (entry.length === 0) throw new Error('Entry not found');

  const room = await sql`SELECT owner_id FROM rooms WHERE id = ${entry[0].room_id}`;
  if (entry[0].author_id !== userId && (room.length === 0 || room[0].owner_id !== userId)) {
    throw new Error('Only author or room owner can delete entry');
  }

  await sql`DELETE FROM guestbook_entries WHERE id = ${entryId}`;
}

/**
 * Get guest book stats
 */
export async function getGuestbookStats(roomId: number, sql: any): Promise<GuestbookStats> {
  const total = await sql`SELECT COUNT(*) as count FROM guestbook_entries WHERE room_id = ${roomId}`;
  const unique = await sql`SELECT COUNT(DISTINCT author_id) as count FROM guestbook_entries WHERE room_id = ${roomId}`;
  const topContributor = await sql`
    SELECT author_id, COUNT(*) as count
    FROM guestbook_entries
    WHERE room_id = ${roomId}
    GROUP BY author_id
    ORDER BY count DESC
    LIMIT 1
  `;
  const moods = await sql`
    SELECT mood, COUNT(*) as count
    FROM guestbook_entries
    WHERE room_id = ${roomId}
    GROUP BY mood
    ORDER BY count DESC
  `;

  return {
    totalEntries: parseInt(total[0].count),
    uniqueVisitors: parseInt(unique[0].count),
    mostActiveContributor: topContributor.length > 0 ? { authorId: topContributor[0].author_id, count: parseInt(topContributor[0].count) } : null,
    moodDistribution: moods.map((m: any) => ({ mood: m.mood, count: parseInt(m.count) })),
  };
}
