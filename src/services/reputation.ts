import type { Sql } from 'postgres';
import { randomUUID } from 'crypto';

export type AgentReputation = {
  agentId: string;
  karma: number;
  positiveReviews: number;
  negativeReviews: number;
  lastReviewAt: Date | null;
};

export type ReputationReview = {
  id: string;
  reviewerId: string;
  targetId: string;
  score: number;
  comment: string;
  createdAt: Date;
};

/**
 * Submit or create a review for an agent
 */
export async function reviewAgent(
  reviewerId: string,
  targetId: string,
  score: number,
  comment: string,
  sql: Sql
): Promise<ReputationReview> {
  // Validate score
  if (score !== -1 && score !== 1) {
    throw new Error('Score must be -1 or 1');
  }

  // Prevent self-review
  if (reviewerId === targetId) {
    throw new Error('Cannot review yourself');
  }

  // Validate comment length
  if (comment.length > 200) {
    throw new Error('Comment must be 200 characters or less');
  }

  // Check for existing review
  const [existingReview] = await sql<ReputationReview[]>`
    SELECT id, reviewer_id AS "reviewerId", target_id AS "targetId", score, comment, created_at AS "createdAt"
    FROM reputation_reviews
    WHERE reviewer_id = ${reviewerId} AND target_id = ${targetId}
  `;

  if (existingReview) {
    throw new Error('You have already reviewed this agent');
  }

  // Create review
  const reviewId = randomUUID();
  const [review] = await sql<ReputationReview[]>`
    INSERT INTO reputation_reviews (id, reviewer_id, target_id, score, comment)
    VALUES (${reviewId}, ${reviewerId}, ${targetId}, ${score}, ${comment})
    RETURNING id, reviewer_id AS "reviewerId", target_id AS "targetId", score, comment, created_at AS "createdAt"
  `;

  // Update or create reputation record
  await sql`
    INSERT INTO agent_reputation (agent_id, karma, positive_reviews, negative_reviews, last_review_at)
    VALUES (
      ${targetId},
      ${score},
      ${score === 1 ? 1 : 0},
      ${score === -1 ? 1 : 0},
      NOW()
    )
    ON CONFLICT (agent_id) DO UPDATE SET
      karma = agent_reputation.karma + ${score},
      positive_reviews = agent_reputation.positive_reviews + ${score === 1 ? 1 : 0},
      negative_reviews = agent_reputation.negative_reviews + ${score === -1 ? 1 : 0},
      last_review_at = NOW()
  `;

  return review;
}

/**
 * Get reputation for an agent
 */
export async function getReputation(agentId: string, sql: Sql): Promise<AgentReputation> {
  const [reputation] = await sql<AgentReputation[]>`
    SELECT 
      agent_id AS "agentId",
      karma,
      positive_reviews AS "positiveReviews",
      negative_reviews AS "negativeReviews",
      last_review_at AS "lastReviewAt"
    FROM agent_reputation
    WHERE agent_id = ${agentId}
  `;

  if (!reputation) {
    return {
      agentId,
      karma: 0,
      positiveReviews: 0,
      negativeReviews: 0,
      lastReviewAt: null,
    };
  }

  return reputation;
}

/**
 * Get reviews received by an agent
 */
export async function getReviews(agentId: string, limit: number, sql: Sql): Promise<ReputationReview[]> {
  const reviews = await sql<ReputationReview[]>`
    SELECT 
      id,
      reviewer_id AS "reviewerId",
      target_id AS "targetId",
      score,
      comment,
      created_at AS "createdAt"
    FROM reputation_reviews
    WHERE target_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return reviews;
}

/**
 * Get agents with highest reputation
 */
export async function getTopReputation(limit: number, sql: Sql): Promise<AgentReputation[]> {
  const topAgents = await sql<AgentReputation[]>`
    SELECT 
      agent_id AS "agentId",
      karma,
      positive_reviews AS "positiveReviews",
      negative_reviews AS "negativeReviews",
      last_review_at AS "lastReviewAt"
    FROM agent_reputation
    ORDER BY karma DESC, positive_reviews DESC
    LIMIT ${limit}
  `;

  return topAgents;
}

/**
 * Update an existing review
 */
export async function updateReview(
  reviewerId: string,
  targetId: string,
  newScore: number,
  sql: Sql
): Promise<ReputationReview> {
  // Validate new score
  if (newScore !== -1 && newScore !== 1) {
    throw new Error('Score must be -1 or 1');
  }

  // Get existing review
  const [existingReview] = await sql<ReputationReview[]>`
    SELECT id, reviewer_id AS "reviewerId", target_id AS "targetId", score, comment, created_at AS "createdAt"
    FROM reputation_reviews
    WHERE reviewer_id = ${reviewerId} AND target_id = ${targetId}
  `;

  if (!existingReview) {
    throw new Error('Review not found');
  }

  // If score hasn't changed, return existing
  if (existingReview.score === newScore) {
    return existingReview;
  }

  // Update review
  const [updatedReview] = await sql<ReputationReview[]>`
    UPDATE reputation_reviews
    SET score = ${newScore}
    WHERE reviewer_id = ${reviewerId} AND target_id = ${targetId}
    RETURNING id, reviewer_id AS "reviewerId", target_id AS "targetId", score, comment, created_at AS "createdAt"
  `;

  // Calculate the delta change
  const delta = newScore - existingReview.score;

  // Update reputation record
  await sql`
    UPDATE agent_reputation
    SET 
      karma = karma + ${delta},
      positive_reviews = positive_reviews + ${newScore === 1 ? 1 : -1},
      negative_reviews = negative_reviews + ${newScore === -1 ? 1 : -1},
      last_review_at = NOW()
    WHERE agent_id = ${targetId}
  `;

  return updatedReview;
}
