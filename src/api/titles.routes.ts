import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import {
  getAllTitles,
  getEarnedTitles,
  setActiveTitle,
  checkEligibility,
} from '../services/titles.js';

const router = express.Router();

/**
 * GET /api/titles
 * Get all available titles
 */
router.get('/api/titles', async (_req, res) => {
  try {
    const titles = await getAllTitles(sql);
    res.json({ titles });
  } catch (error: any) {
    console.error('[Titles API] Get all titles error:', error);
    res.status(500).json({ error: 'Failed to get titles' });
  }
});

/**
 * GET /api/titles/mine
 * Get earned titles for authenticated agent
 */
router.get('/api/titles/mine', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let agentId: string;
  try {
    ({ agentId } = validateToken(token));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Check eligibility and auto-award
    await checkEligibility(agentId, sql);
    
    const titles = await getEarnedTitles(agentId, sql);
    res.json({ titles });
  } catch (error: any) {
    console.error('[Titles API] Get my titles error:', error);
    res.status(500).json({ error: 'Failed to get earned titles' });
  }
});

/**
 * PUT /api/titles/:id/activate
 * Set a title as active
 */
router.put('/api/titles/:id/activate', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let agentId: string;
  try {
    ({ agentId } = validateToken(token));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { id } = req.params;

  try {
    await setActiveTitle(agentId, id, sql);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Titles API] Activate title error:', error);
    res.status(400).json({ error: error.message || 'Failed to activate title' });
  }
});

/**
 * GET /api/titles/agent/:agentId
 * Get titles for a specific agent
 */
router.get('/api/titles/agent/:agentId', async (req, res) => {
  const { agentId } = req.params;

  try {
    const titles = await getEarnedTitles(agentId, sql);
    res.json({ titles });
  } catch (error: any) {
    console.error('[Titles API] Get agent titles error:', error);
    res.status(500).json({ error: 'Failed to get agent titles' });
  }
});

export default router;
