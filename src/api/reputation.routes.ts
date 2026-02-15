import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import {
  reviewAgent,
  getReputation,
  getReviews,
  getTopReputation,
  updateReview,
} from '../services/reputation.js';

const router = express.Router();

/**
 * POST /api/reputation/review
 * Submit a review for an agent
 */
router.post('/api/reputation/review', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId: reviewerId } = validateToken(token);
    const { targetId, score, comment = '' } = req.body;

    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required' });
    }

    if (score !== -1 && score !== 1) {
      return res.status(400).json({ error: 'score must be -1 or 1' });
    }

    const review = await reviewAgent(reviewerId, targetId, score, comment, sql);

    logger.info('Review submitted', {
      reviewerId,
      targetId,
      score,
      reviewId: review.id,
    });

    res.json({ success: true, review });
  } catch (error: any) {
    logger.error('Failed to submit review', { error });
    res.status(400).json({ error: error.message || 'Failed to submit review' });
  }
});

/**
 * GET /api/reputation/:agentId
 * Get reputation for an agent
 */
router.get('/api/reputation/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    const reputation = await getReputation(agentId, sql);

    res.json({ reputation });
  } catch (error: any) {
    logger.error('Failed to get reputation', { error });
    res.status(500).json({ error: 'Failed to get reputation' });
  }
});

/**
 * GET /api/reputation/:agentId/reviews
 * Get reviews for an agent
 */
router.get('/api/reputation/:agentId/reviews', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!agentId) {
      return res.status(400).json({ error: 'agentId is required' });
    }

    const reviews = await getReviews(agentId, limit, sql);

    res.json({ reviews });
  } catch (error: any) {
    logger.error('Failed to get reviews', { error });
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

/**
 * GET /api/reputation/top
 * Get agents with highest reputation
 */
router.get('/api/reputation/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const topAgents = await getTopReputation(limit, sql);

    res.json({ topAgents });
  } catch (error: any) {
    logger.error('Failed to get top reputation', { error });
    res.status(500).json({ error: 'Failed to get top reputation' });
  }
});

export default router;
