import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as reviewsService from '../services/roomReviews.js';

const router = express.Router();

router.post('/api/rooms/:roomId/reviews', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const roomId = parseInt(req.params.roomId);
    const { rating, reviewText } = req.body;
    const review = await reviewsService.addReview(roomId, agentId, rating, reviewText || null, sql);
    res.status(201).json(review);
  } catch (error: any) {
    const status = error.message?.includes('Rating must') || error.message?.includes('exceed') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to add review' });
  }
});

router.put('/api/rooms/:roomId/reviews/:reviewId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const reviewId = parseInt(req.params.reviewId);
    const { rating, reviewText } = req.body;
    const review = await reviewsService.updateReview(reviewId, agentId, rating, reviewText || null, sql);
    res.json(review);
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : error.message?.includes('Rating must') ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to update review' });
  }
});

router.delete('/api/rooms/:roomId/reviews/:reviewId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const reviewId = parseInt(req.params.reviewId);
    const deleted = await reviewsService.deleteReview(reviewId, agentId, sql);
    if (!deleted) return res.status(404).json({ error: 'Review not found or unauthorized' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

router.get('/api/rooms/:roomId/reviews', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const viewerAgentId = token ? validateToken(token).agentId : undefined;
    const roomId = parseInt(req.params.roomId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as 'date' | 'rating' | 'helpful') || 'date';
    const result = await reviewsService.getRoomReviews(roomId, { page, limit, sortBy, viewerAgentId }, sql);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.post('/api/reviews/:reviewId/helpful', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const reviewId = parseInt(req.params.reviewId);
    const isHelpful = await reviewsService.markHelpful(reviewId, agentId, sql);
    res.json({ success: true, isHelpful });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark helpful' });
  }
});

router.get('/api/rooms/:roomId/reviews/stats', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const stats = await reviewsService.getRoomStats(roomId, sql);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/api/agents/:agentId/reviews', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const reviews = await reviewsService.getAgentReviews(agentId, sql);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agent reviews' });
  }
});

export default router;
