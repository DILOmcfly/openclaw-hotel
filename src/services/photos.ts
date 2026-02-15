/**
 * Photo Service - Manage room photos and gallery
 */

import { randomUUID } from 'crypto';

export type Photo = {
  id: string;
  roomId: string;
  takenBy: string;
  caption: string;
  likes: number;
  createdAt: string;
};

const MAX_CAPTION_LENGTH = 200;

/**
 * Take a photo in a room
 */
export async function takePhoto(
  roomId: string,
  takenBy: string,
  caption: string,
  sql: any
): Promise<Photo> {
  // Validate caption length
  if (caption.length > MAX_CAPTION_LENGTH) {
    throw new Error(`Caption must be ${MAX_CAPTION_LENGTH} characters or less`);
  }

  const photoId = randomUUID();
  const result = await sql`
    INSERT INTO room_photos (id, room_id, taken_by, caption, likes, created_at)
    VALUES (${photoId}, ${roomId}, ${takenBy}, ${caption}, 0, NOW())
    RETURNING id, room_id AS "roomId", taken_by AS "takenBy", caption, likes, created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Toggle like on a photo (like if not liked, unlike if already liked)
 */
export async function likePhoto(
  photoId: string,
  agentId: string,
  sql: any
): Promise<{ liked: boolean; likes: number }> {
  // Check if already liked
  const existingLike = await sql`
    SELECT 1 FROM photo_likes
    WHERE photo_id = ${photoId} AND agent_id = ${agentId}
  `;

  if (existingLike.length > 0) {
    // Unlike
    await sql`
      DELETE FROM photo_likes
      WHERE photo_id = ${photoId} AND agent_id = ${agentId}
    `;

    await sql`
      UPDATE room_photos
      SET likes = likes - 1
      WHERE id = ${photoId}
    `;

    const updated = await sql`
      SELECT likes FROM room_photos WHERE id = ${photoId}
    `;

    return { liked: false, likes: updated[0]?.likes || 0 };
  } else {
    // Like
    await sql`
      INSERT INTO photo_likes (photo_id, agent_id, created_at)
      VALUES (${photoId}, ${agentId}, NOW())
    `;

    await sql`
      UPDATE room_photos
      SET likes = likes + 1
      WHERE id = ${photoId}
    `;

    const updated = await sql`
      SELECT likes FROM room_photos WHERE id = ${photoId}
    `;

    return { liked: true, likes: updated[0]?.likes || 0 };
  }
}

/**
 * Get photos by room
 */
export async function getPhotosByRoom(
  roomId: string,
  limit: number,
  sql: any
): Promise<Photo[]> {
  const photos = await sql`
    SELECT id, room_id AS "roomId", taken_by AS "takenBy", caption, likes, created_at AS "createdAt"
    FROM room_photos
    WHERE room_id = ${roomId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return photos;
}

/**
 * Get photos by agent
 */
export async function getPhotosByAgent(
  agentId: string,
  limit: number,
  sql: any
): Promise<Photo[]> {
  const photos = await sql`
    SELECT id, room_id AS "roomId", taken_by AS "takenBy", caption, likes, created_at AS "createdAt"
    FROM room_photos
    WHERE taken_by = ${agentId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return photos;
}

/**
 * Get popular photos sorted by likes
 */
export async function getPopularPhotos(
  limit: number,
  sql: any
): Promise<Photo[]> {
  const photos = await sql`
    SELECT id, room_id AS "roomId", taken_by AS "takenBy", caption, likes, created_at AS "createdAt"
    FROM room_photos
    ORDER BY likes DESC, created_at DESC
    LIMIT ${limit}
  `;

  return photos;
}

/**
 * Delete a photo (only photographer can delete)
 */
export async function deletePhoto(
  photoId: string,
  agentId: string,
  sql: any
): Promise<void> {
  // Check ownership
  const photo = await sql`
    SELECT taken_by AS "takenBy"
    FROM room_photos
    WHERE id = ${photoId}
  `;

  if (photo.length === 0) {
    throw new Error('Photo not found');
  }

  if (photo[0].takenBy !== agentId) {
    throw new Error('You can only delete your own photos');
  }

  // Delete likes first (foreign key constraint)
  await sql`
    DELETE FROM photo_likes
    WHERE photo_id = ${photoId}
  `;

  // Delete photo
  await sql`
    DELETE FROM room_photos
    WHERE id = ${photoId}
  `;
}
