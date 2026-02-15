import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as itemRarityService from '../services/itemRarity.js';

const router = express.Router();

/**
 * GET /api/items/rarity/:rarity
 * Get all items of a specific rarity
 */
router.get('/api/items/rarity/:rarity', async (req, res) => {
  try {
    const { rarity } = req.params;
    
    const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    if (!validRarities.includes(rarity)) {
      return res.status(400).json({ error: 'Invalid rarity level' });
    }

    const items = await itemRarityService.getItemsByRarity(rarity as itemRarityService.Rarity, sql);
    res.json({ rarity, items });
  } catch (error) {
    console.error('[Item Rarity API] Error fetching items by rarity:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

/**
 * GET /api/items/collection/:agentId
 * Get collection progress for a specific agent
 */
router.get('/api/items/collection/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const progress = await itemRarityService.getCollectionProgress(agentId, sql);
    
    res.json({
      agentId,
      progress,
    });
  } catch (error) {
    console.error('[Item Rarity API] Error fetching collection progress:', error);
    res.status(500).json({ error: 'Failed to fetch collection progress' });
  }
});

/**
 * GET /api/items/distribution
 * Get authenticated user's rarity distribution
 */
router.get('/api/items/distribution', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const distribution = await itemRarityService.getRarityDistribution(agentId, sql);

    res.json({
      agentId,
      distribution,
    });
  } catch (error) {
    console.error('[Item Rarity API] Error fetching rarity distribution:', error);
    res.status(500).json({ error: 'Failed to fetch rarity distribution' });
  }
});

export default router;
