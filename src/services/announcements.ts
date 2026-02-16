import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type Announcement = {
  id: string;
  roomId: string;
  authorId: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Create a new announcement (max 10 per room)
 */
export async function createAnnouncement(
  roomId: string,
  authorId: string,
  title: string,
  body: string,
  sql: Sql
): Promise<Announcement> {
  // Check current count
  const [countResult] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count
    FROM room_announcements
    WHERE room_id = ${roomId}
  `;

  if (countResult && countResult.count >= 10) {
    throw new Error('Maximum 10 announcements per room');
  }

  const id = randomUUID();

  const [announcement] = await sql<Announcement[]>`
    INSERT INTO room_announcements (id, room_id, author_id, title, body)
    VALUES (${id}, ${roomId}, ${authorId}, ${title}, ${body})
    RETURNING 
      id,
      room_id AS "roomId",
      author_id AS "authorId",
      title,
      body,
      pinned,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  return announcement;
}

/**
 * Update an announcement (author only)
 */
export async function updateAnnouncement(
  announcementId: string,
  authorId: string,
  title: string,
  body: string,
  sql: Sql
): Promise<void> {
  // Check if announcement exists and user is author
  const [existing] = await sql<Announcement[]>`
    SELECT id, author_id AS "authorId"
    FROM room_announcements
    WHERE id = ${announcementId}
  `;

  if (!existing) {
    throw new Error('Announcement not found');
  }

  if (existing.authorId !== authorId) {
    throw new Error('Only the author can update this announcement');
  }

  await sql`
    UPDATE room_announcements
    SET title = ${title}, body = ${body}, updated_at = NOW()
    WHERE id = ${announcementId}
  `;
}

/**
 * Delete an announcement (author or admin)
 */
export async function deleteAnnouncement(
  announcementId: string,
  authorId: string,
  sql: Sql
): Promise<void> {
  // Check if announcement exists
  const [existing] = await sql<Announcement[]>`
    SELECT id, author_id AS "authorId"
    FROM room_announcements
    WHERE id = ${announcementId}
  `;

  if (!existing) {
    throw new Error('Announcement not found');
  }

  // Check if user is admin
  const [agent] = await sql<{ role: string }[]>`
    SELECT role FROM agents WHERE id = ${authorId}::uuid
  `;

  const isAdmin = agent && (agent.role === 'admin' || agent.role === 'moderator');
  const isAuthor = existing.authorId === authorId;

  if (!isAuthor && !isAdmin) {
    throw new Error('Only the author or an admin can delete this announcement');
  }

  await sql`
    DELETE FROM room_announcements
    WHERE id = ${announcementId}
  `;
}

/**
 * Get announcements for a room (pinned first, then by date)
 */
export async function getAnnouncements(
  roomId: string, 
  sql: Sql,
  limit: number = 50,
  offset: number = 0
): Promise<{ announcements: Announcement[]; total: number }> {
  // Get total count
  const [{ count }] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int as count 
    FROM room_announcements 
    WHERE room_id = ${roomId}
  `;

  // Get paginated announcements
  const announcements = await sql<Announcement[]>`
    SELECT 
      id,
      room_id AS "roomId",
      author_id AS "authorId",
      title,
      body,
      pinned,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM room_announcements
    WHERE room_id = ${roomId}
    ORDER BY pinned DESC, created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return { announcements, total: count };
}

/**
 * Toggle pin status (author only)
 */
export async function pinAnnouncement(
  announcementId: string,
  authorId: string,
  sql: Sql
): Promise<void> {
  // Check if announcement exists and user is author
  const [existing] = await sql<Announcement[]>`
    SELECT id, author_id AS "authorId", pinned
    FROM room_announcements
    WHERE id = ${announcementId}
  `;

  if (!existing) {
    throw new Error('Announcement not found');
  }

  if (existing.authorId !== authorId) {
    throw new Error('Only the author can pin this announcement');
  }

  await sql`
    UPDATE room_announcements
    SET pinned = NOT pinned
    WHERE id = ${announcementId}
  `;
}

/**
 * Get the most recent announcement for a room
 */
export async function getLatestAnnouncement(
  roomId: string,
  sql: Sql
): Promise<Announcement | null> {
  const [announcement] = await sql<Announcement[]>`
    SELECT 
      id,
      room_id AS "roomId",
      author_id AS "authorId",
      title,
      body,
      pinned,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM room_announcements
    WHERE room_id = ${roomId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return announcement || null;
}
