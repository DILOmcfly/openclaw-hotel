/**
 * Room Reviews Service - Manages room ratings and reviews
 */
export type Review = {
  id: number;
  roomId: number;
  agentId: string;
  rating: number;
  reviewText: string | null;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
  isHelpful?: boolean;
};

export type RoomStats = {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { [key: number]: number };
};

const MAX_REVIEW_LENGTH = 500;

function validateReview(rating: number, reviewText?: string | null): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be an integer between 1 and 5');
  }
  if (reviewText && reviewText.length > MAX_REVIEW_LENGTH) {
    throw new Error(`Review text cannot exceed ${MAX_REVIEW_LENGTH} characters`);
  }
}

export async function addReview(
  roomId: number,
  agentId: string,
  rating: number,
  reviewText: string | null,
  sql: any
): Promise<Review> {
  validateReview(rating, reviewText);
  const result = await sql`
    INSERT INTO room_reviews (room_id, agent_id, rating, review_text, created_at, updated_at)
    VALUES (${roomId}, ${agentId}, ${rating}, ${reviewText}, NOW(), NOW())
    RETURNING 
      id, room_id AS "roomId", agent_id AS "agentId", rating,
      review_text AS "reviewText", helpful_count AS "helpfulCount",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return result[0];
}

export async function updateReview(
  reviewId: number,
  agentId: string,
  rating: number,
  reviewText: string | null,
  sql: any
): Promise<Review> {
  validateReview(rating, reviewText);
  const result = await sql`
    UPDATE room_reviews
    SET rating = ${rating}, review_text = ${reviewText}, updated_at = NOW()
    WHERE id = ${reviewId} AND agent_id = ${agentId}
    RETURNING 
      id, room_id AS "roomId", agent_id AS "agentId", rating,
      review_text AS "reviewText", helpful_count AS "helpfulCount",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  if (result.length === 0) throw new Error('Review not found or unauthorized');
  return result[0];
}

export async function deleteReview(reviewId: number, agentId: string, sql: any): Promise<boolean> {
  const result = await sql`
    DELETE FROM room_reviews WHERE id = ${reviewId} AND agent_id = ${agentId} RETURNING id
  `;
  return result.length > 0;
}

export async function getRoomReviews(
  roomId: number,
  options: { page?: number; limit?: number; sortBy?: 'date' | 'rating' | 'helpful'; viewerAgentId?: string },
  sql: any
): Promise<{ reviews: Review[]; total: number }> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 10, 100);
  const offset = (page - 1) * limit;
  const sortBy = options.sortBy || 'date';
  let orderClause = 'r.created_at DESC';
  if (sortBy === 'rating') orderClause = 'r.rating DESC, r.created_at DESC';
  if (sortBy === 'helpful') orderClause = 'r.helpful_count DESC, r.created_at DESC';
  const reviews = await sql.unsafe(`
    SELECT 
      r.id, r.room_id AS "roomId", r.agent_id AS "agentId", r.rating,
      r.review_text AS "reviewText", r.helpful_count AS "helpfulCount",
      r.created_at AS "createdAt", r.updated_at AS "updatedAt"
      ${options.viewerAgentId ? `,
      CASE WHEN rh.agent_id IS NOT NULL THEN true ELSE false END AS "isHelpful"` : ''}
    FROM room_reviews r
    ${options.viewerAgentId ? `
    LEFT JOIN review_helpful rh ON r.id = rh.review_id AND rh.agent_id = '${options.viewerAgentId}'` : ''}
    WHERE r.room_id = ${roomId}
    ORDER BY ${orderClause}
    LIMIT ${limit} OFFSET ${offset}
  `);
  const countResult = await sql`
    SELECT COUNT(*) AS count FROM room_reviews WHERE room_id = ${roomId}
  `;
  return { reviews, total: parseInt(countResult[0].count) };
}

export async function markHelpful(reviewId: number, agentId: string, sql: any): Promise<boolean> {
  const existing = await sql`
    SELECT 1 FROM review_helpful WHERE review_id = ${reviewId} AND agent_id = ${agentId}
  `;
  if (existing.length > 0) {
    await sql`DELETE FROM review_helpful WHERE review_id = ${reviewId} AND agent_id = ${agentId}`;
    await sql`UPDATE room_reviews SET helpful_count = helpful_count - 1 WHERE id = ${reviewId}`;
    return false;
  } else {
    await sql`INSERT INTO review_helpful (review_id, agent_id) VALUES (${reviewId}, ${agentId})`;
    await sql`UPDATE room_reviews SET helpful_count = helpful_count + 1 WHERE id = ${reviewId}`;
    return true;
  }
}

export async function getRoomStats(roomId: number, sql: any): Promise<RoomStats> {
  const result = await sql`
    SELECT 
      COALESCE(AVG(rating), 0) AS "averageRating", COUNT(*) AS "totalReviews",
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS "rating1",
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS "rating2",
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS "rating3",
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS "rating4",
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS "rating5"
    FROM room_reviews WHERE room_id = ${roomId}
  `;
  const row = result[0];
  return {
    averageRating: parseFloat(row.averageRating) || 0,
    totalReviews: parseInt(row.totalReviews) || 0,
    ratingDistribution: {
      1: parseInt(row.rating1) || 0,
      2: parseInt(row.rating2) || 0,
      3: parseInt(row.rating3) || 0,
      4: parseInt(row.rating4) || 0,
      5: parseInt(row.rating5) || 0,
    },
  };
}

export async function getAgentReviews(agentId: string, sql: any): Promise<Review[]> {
  const result = await sql`
    SELECT 
      id, room_id AS "roomId", agent_id AS "agentId", rating,
      review_text AS "reviewText", helpful_count AS "helpfulCount",
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM room_reviews WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
  `;
  return result;
}
