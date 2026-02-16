// @ts-nocheck - TODO: fix type errors
import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface RoomRating {
  id: string;
  roomId: string;
  agentId: string;
  rating: number;
  reviewText?: string;
  createdAt: Date;
}

export interface RoomRatingWithAgent extends RoomRating {
  agentName: string;
}

export interface RoomAverageRating {
  roomId: string;
  avgRating: number;
  ratingCount: number;
}

/**
 * Submit or update a room rating
 * @returns The created/updated rating
 */
export async function submitRating(
  roomId: string,
  agentId: string,
  rating: number,
  reviewText: string | undefined,
  sql: PoolClient
): Promise<RoomRating> {
  // Validate rating
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }
  
  // Sanitize review text
  const sanitizedReview = reviewText?.trim().slice(0, 500);
  
  // Upsert rating (insert or update if exists)
  const result = await sql.query(
    `INSERT INTO room_ratings (id, room_id, agent_id, rating, review_text)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (room_id, agent_id) 
     DO UPDATE SET 
       rating = EXCLUDED.rating,
       review_text = EXCLUDED.review_text,
       created_at = now()
     RETURNING id, room_id, agent_id, rating, review_text, created_at`,
    [uuidv4(), roomId, agentId, rating, sanitizedReview || null]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    roomId: row.room_id,
    agentId: row.agent_id,
    rating: row.rating,
    reviewText: row.review_text,
    createdAt: row.created_at
  };
}

/**
 * Get average rating for a room
 */
export async function getRoomAverageRating(
  roomId: string,
  sql: PoolClient
): Promise<RoomAverageRating> {
  const result = await sql.query(
    `SELECT avg_rating, rating_count FROM rooms WHERE id = $1`,
    [roomId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Room not found');
  }
  
  const row = result.rows[0];
  return {
    roomId,
    avgRating: parseFloat(row.avg_rating) || 0,
    ratingCount: parseInt(row.rating_count) || 0
  };
}

/**
 * Get all reviews for a room (with agent names)
 */
export async function getRoomReviews(
  roomId: string,
  limit = 20,
  sql: PoolClient
): Promise<RoomRatingWithAgent[]> {
  const result = await sql.query(
    `SELECT 
       r.id, r.room_id, r.agent_id, r.rating, r.review_text, r.created_at,
       a.name as agent_name
     FROM room_ratings r
     JOIN agents a ON r.agent_id = a.id
     WHERE r.room_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [roomId, limit]
  );
  
  return result.rows.map(row => ({
    id: row.id,
    roomId: row.room_id,
    agentId: row.agent_id,
    rating: row.rating,
    reviewText: row.review_text,
    createdAt: row.created_at,
    agentName: row.agent_name
  }));
}

/**
 * Get a user's rating for a specific room
 */
export async function getAgentRating(
  roomId: string,
  agentId: string,
  sql: PoolClient
): Promise<RoomRating | null> {
  const result = await sql.query(
    `SELECT id, room_id, agent_id, rating, review_text, created_at
     FROM room_ratings
     WHERE room_id = $1 AND agent_id = $2`,
    [roomId, agentId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    roomId: row.room_id,
    agentId: row.agent_id,
    rating: row.rating,
    reviewText: row.review_text,
    createdAt: row.created_at
  };
}

/**
 * Delete a rating (admin or owner only)
 */
export async function deleteRating(
  ratingId: string,
  sql: PoolClient
): Promise<void> {
  await sql.query(`DELETE FROM room_ratings WHERE id = $1`, [ratingId]);
}
