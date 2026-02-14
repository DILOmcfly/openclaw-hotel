/**
 * Navigator API Routes
 * Endpoints for room search, filtering, favorites, and visit tracking
 */
import express from 'express';
import { validateToken } from '../services/auth.js';
import * as navigatorService from '../services/navigator.service.js';

const router = express.Router();

/**
 * GET /api/navigator/search
 * Search and filter rooms
 * Query params: query, category, tag, sortBy, sortOrder, limit, offset
 */
router.get('/search', async (req, res) => {
  try {
    const agentId = req.headers['x-agent-id'] as string | undefined;
    
    const filters: any = {
      query: req.query.query as string,
      category: req.query.category as string,
      tag: req.query.tag as string,
      sortBy: req.query.sortBy as any || 'occupants',
      sortOrder: req.query.sortOrder as any || 'desc',
      limit: parseInt(req.query.limit as string || '50', 10),
      offset: parseInt(req.query.offset as string || '0', 10)
    };

    const rooms = await navigatorService.searchRooms(agentId || null, filters);
    res.json({ rooms });
  } catch (error: any) {
    console.error('Search rooms error:', error);
    res.status(500).json({ error: 'Failed to search rooms' });
  }
});

/**
 * GET /api/navigator/categories
 * Get all available room categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await navigatorService.getCategories();
    res.json({ categories });
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

/**
 * GET /api/navigator/tags
 * Get all available room tags
 */
router.get('/tags', async (req, res) => {
  try {
    const tags = await navigatorService.getTags();
    res.json({ tags });
  } catch (error: any) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

/**
 * GET /api/navigator/favorites
 * Get agent's favorite rooms
 */
router.get('/favorites', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const favorites = await navigatorService.getFavorites(agentId);
    res.json({ favorites });
  } catch (error: any) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

/**
 * POST /api/navigator/favorites/:roomId
 * Add room to favorites
 */
router.post('/favorites/:roomId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;

    await navigatorService.addFavorite(agentId, roomId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

/**
 * DELETE /api/navigator/favorites/:roomId
 * Remove room from favorites
 */
router.delete('/favorites/:roomId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;

    await navigatorService.removeFavorite(agentId, roomId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

/**
 * GET /api/navigator/recent
 * Get agent's recently visited rooms
 */
router.get('/recent', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const limit = parseInt(req.query.limit as string || '10', 10);

    const recent = await navigatorService.getRecentRooms(agentId, limit);
    res.json({ recent });
  } catch (error: any) {
    console.error('Get recent rooms error:', error);
    res.status(500).json({ error: 'Failed to get recent rooms' });
  }
});

/**
 * POST /api/navigator/visit/:roomId
 * Track room visit (called when joining a room)
 */
router.post('/visit/:roomId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;

    await navigatorService.trackVisit(agentId, roomId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Track visit error:', error);
    res.status(500).json({ error: 'Failed to track visit' });
  }
});

/**
 * PUT /api/navigator/room/:roomId/category
 * Update room category (owner only)
 */
router.put('/room/:roomId/category', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { category } = req.body;

    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'Category is required' });
    }

    // TODO: Add ownership check (rooms service)
    await navigatorService.updateRoomCategory(roomId, category);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update category error:', error);
    res.status(400).json({ error: error.message || 'Failed to update category' });
  }
});

/**
 * POST /api/navigator/room/:roomId/tags
 * Add tags to room (owner only)
 */
router.post('/room/:roomId/tags', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }

    // TODO: Add ownership check (rooms service)
    await navigatorService.addRoomTags(roomId, tags);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Add tags error:', error);
    res.status(500).json({ error: 'Failed to add tags' });
  }
});

export default router;
