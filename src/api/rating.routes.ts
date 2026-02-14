import express, { Request, Response } from 'express';
import { db } from '../db/index.js';
import { 
  submitRating, 
  getRoomAverageRating, 
  getRoomReviews,
  getAgentRating,
  deleteRating
} from '../services/rating.js';
import { validateToken } from '../services/auth.js';
import { requireRole } from '../middleware/adminAuth.js';

const router = express.Router();

/**
 * POST /api/rooms/:roomId/rate
 * Submit or update a rating for a room
 */
router.post('/:roomId/rate', validateToken, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { rating, reviewText } = req.body;
    const agentId = (req as any).user?.id;
    
    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
    }
    
    const sql = await db.getClient();
    try {
      const result = await submitRating(roomId, agentId, rating, reviewText, sql);
      res.json(result);
    } finally {
      sql.release();
    }
  } catch (error: any) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ error: error.message || 'Failed to submit rating' });
  }
});

/**
 * GET /api/rooms/:roomId/rating/average
 * Get average rating for a room
 */
router.get('/:roomId/rating/average', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    
    const sql = await db.getClient();
    try {
      const result = await getRoomAverageRating(roomId, sql);
      res.json(result);
    } finally {
      sql.release();
    }
  } catch (error: any) {
    console.error('Error getting average rating:', error);
    res.status(500).json({ error: error.message || 'Failed to get average rating' });
  }
});

/**
 * GET /api/rooms/:roomId/reviews
 * Get all reviews for a room
 */
router.get('/:roomId/reviews', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const sql = await db.getClient();
    try {
      const result = await getRoomReviews(roomId, limit, sql);
      res.json(result);
    } finally {
      sql.release();
    }
  } catch (error: any) {
    console.error('Error getting reviews:', error);
    res.status(500).json({ error: error.message || 'Failed to get reviews' });
  }
});

/**
 * GET /api/rooms/:roomId/rating/me
 * Get current user's rating for a room
 */
router.get('/:roomId/rating/me', validateToken, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const agentId = (req as any).user?.id;
    
    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const sql = await db.getClient();
    try {
      const result = await getAgentRating(roomId, agentId, sql);
      res.json(result || { rating: null });
    } finally {
      sql.release();
    }
  } catch (error: any) {
    console.error('Error getting agent rating:', error);
    res.status(500).json({ error: error.message || 'Failed to get rating' });
  }
});

/**
 * DELETE /api/ratings/:ratingId
 * Delete a rating (admin only)
 */
router.delete('/ratings/:ratingId', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { ratingId } = req.params;
    
    const sql = await db.getClient();
    try {
      await deleteRating(ratingId, sql);
      res.json({ success: true });
    } finally {
      sql.release();
    }
  } catch (error: any) {
    console.error('Error deleting rating:', error);
    res.status(500).json({ error: error.message || 'Failed to delete rating' });
  }
});

export default router;
