import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import {
  addFavorite,
  removeFavorite,
  getFavorites,
  isFavorite,
  getPopularTargets,
  type TargetType,
} from '../services/favorites.js';

const router = express.Router();

/**
 * POST /api/favorites
 * Add a favorite
 */
router.post('/api/favorites', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { targetType, targetId } = req.body;

    if (!targetType || !targetId) {
      return res.status(400).json({ error: 'targetType and targetId are required' });
    }

    const validTypes: TargetType[] = ['room', 'agent', 'item', 'guild'];
    if (!validTypes.includes(targetType)) {
      return res.status(400).json({ error: 'Invalid target type' });
    }

    const favorite = await addFavorite(agentId, targetType, targetId, sql);

    logger.info('Favorite added', {
      agentId,
      targetType,
      targetId,
      favoriteId: favorite.id,
    });

    res.json({ success: true, favorite });
  } catch (error: any) {
    logger.error('Failed to add favorite', { error });
    res.status(400).json({ error: error.message || 'Failed to add favorite' });
  }
});

/**
 * DELETE /api/favorites/:targetType/:targetId
 * Remove a favorite
 */
router.delete('/api/favorites/:targetType/:targetId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { targetType, targetId } = req.params;

    const validTypes: TargetType[] = ['room', 'agent', 'item', 'guild'];
    if (!validTypes.includes(targetType as TargetType)) {
      return res.status(400).json({ error: 'Invalid target type' });
    }

    await removeFavorite(agentId, targetType as TargetType, targetId, sql);

    logger.info('Favorite removed', {
      agentId,
      targetType,
      targetId,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to remove favorite', { error });
    res.status(400).json({ error: error.message || 'Failed to remove favorite' });
  }
});

/**
 * GET /api/favorites
 * Get all favorites for the authenticated agent
 * Query param: ?type=room|agent|item|guild
 */
router.get('/api/favorites', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const targetType = req.query.type as TargetType | undefined;

    if (targetType) {
      const validTypes: TargetType[] = ['room', 'agent', 'item', 'guild'];
      if (!validTypes.includes(targetType)) {
        return res.status(400).json({ error: 'Invalid target type' });
      }
    }

    const favorites = await getFavorites(agentId, targetType, sql);

    res.json({ favorites });
  } catch (error: any) {
    logger.error('Failed to fetch favorites', { error });
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

/**
 * GET /api/favorites/check/:targetType/:targetId
 * Check if a target is favorited by the authenticated agent
 */
router.get('/api/favorites/check/:targetType/:targetId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { targetType, targetId } = req.params;

    const validTypes: TargetType[] = ['room', 'agent', 'item', 'guild'];
    if (!validTypes.includes(targetType as TargetType)) {
      return res.status(400).json({ error: 'Invalid target type' });
    }

    const favorited = await isFavorite(agentId, targetType as TargetType, targetId, sql);

    res.json({ isFavorite: favorited });
  } catch (error: any) {
    logger.error('Failed to check favorite', { error });
    res.status(500).json({ error: 'Failed to check favorite' });
  }
});

/**
 * GET /api/favorites/popular/:targetType
 * Get most favorited targets of a specific type
 * Query param: ?limit=10 (default 10)
 */
router.get('/api/favorites/popular/:targetType', async (req, res) => {
  try {
    const { targetType } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const validTypes: TargetType[] = ['room', 'agent', 'item', 'guild'];
    if (!validTypes.includes(targetType as TargetType)) {
      return res.status(400).json({ error: 'Invalid target type' });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Limit must be between 1 and 100' });
    }

    const popular = await getPopularTargets(targetType as TargetType, limit, sql);

    res.json({ popular });
  } catch (error: any) {
    logger.error('Failed to fetch popular targets', { error });
    res.status(500).json({ error: 'Failed to fetch popular targets' });
  }
});

export default router;
