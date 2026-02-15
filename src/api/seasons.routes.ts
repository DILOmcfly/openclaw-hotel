import express from 'express';
import { sql } from '../db/index.js';
import { requireRole } from '../middleware/admin.js';
import { logger } from '../utils/logger.js';
import {
  createSeason,
  getActiveSeason,
  getSeasonById,
  getAllSeasons,
  activateSeason,
  deactivateSeason,
  addSeasonalItem,
  getSeasonalItems,
} from '../services/seasons.js';

const router = express.Router();

/**
 * GET /api/seasons
 * List all seasons
 */
router.get('/api/seasons', async (req, res) => {
  try {
    const seasons = await getAllSeasons(sql);
    res.json({ seasons });
  } catch (error: any) {
    logger.error('Failed to fetch seasons', { error });
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
});

/**
 * GET /api/seasons/active
 * Get current active season
 */
router.get('/api/seasons/active', async (req, res) => {
  try {
    const season = await getActiveSeason(sql);
    
    if (!season) {
      return res.status(404).json({ error: 'No active season' });
    }

    res.json({ season });
  } catch (error: any) {
    logger.error('Failed to fetch active season', { error });
    res.status(500).json({ error: 'Failed to fetch active season' });
  }
});

/**
 * POST /api/seasons
 * Create a new season (admin only)
 */
router.post('/api/seasons', requireRole('admin'), async (req, res) => {
  try {
    const { name, theme, startDate, endDate, weatherOverride, colorScheme } = req.body;

    if (!name || !theme || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const season = await createSeason(
      name,
      theme,
      new Date(startDate),
      new Date(endDate),
      weatherOverride || null,
      colorScheme || {},
      sql
    );

    logger.info('Season created', { seasonId: season.id, name });
    res.json({ success: true, season });
  } catch (error: any) {
    logger.error('Failed to create season', { error });
    res.status(400).json({ error: error.message || 'Failed to create season' });
  }
});

/**
 * PUT /api/seasons/:id/activate
 * Activate a season (admin only)
 */
router.put('/api/seasons/:id/activate', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    await activateSeason(id, sql);

    logger.info('Season activated', { seasonId: id });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to activate season', { error });
    res.status(400).json({ error: error.message || 'Failed to activate season' });
  }
});

/**
 * PUT /api/seasons/:id/deactivate
 * Deactivate a season (admin only)
 */
router.put('/api/seasons/:id/deactivate', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    await deactivateSeason(id, sql);

    logger.info('Season deactivated', { seasonId: id });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to deactivate season', { error });
    res.status(400).json({ error: error.message || 'Failed to deactivate season' });
  }
});

/**
 * POST /api/seasons/:id/items
 * Add item to a season (admin only)
 */
router.post('/api/seasons/:id/items', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { itemType, name, description, rarity } = req.body;

    if (!itemType || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const item = await addSeasonalItem(
      id,
      itemType,
      name,
      description || '',
      rarity || 'rare',
      sql
    );

    logger.info('Seasonal item added', { itemId: item.id, seasonId: id });
    res.json({ success: true, item });
  } catch (error: any) {
    logger.error('Failed to add seasonal item', { error });
    res.status(400).json({ error: error.message || 'Failed to add seasonal item' });
  }
});

/**
 * GET /api/seasons/:id/items
 * Get items for a season
 */
router.get('/api/seasons/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    
    const items = await getSeasonalItems(id, sql);

    res.json({ items });
  } catch (error: any) {
    logger.error('Failed to fetch seasonal items', { error });
    res.status(500).json({ error: 'Failed to fetch seasonal items' });
  }
});

export default router;
