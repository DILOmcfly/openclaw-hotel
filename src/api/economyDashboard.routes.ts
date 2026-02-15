import express from 'express';
import { sql } from '../db/index.js';
import { requireRole } from '../middleware/admin.js';
import * as economyDashboard from '../services/economyDashboard.js';

const router = express.Router();

/** POST /api/economy/snapshot - Take economy snapshot (admin only) */
router.post('/api/economy/snapshot', requireRole('admin'), async (req, res) => {
  try {
    const snapshot = await economyDashboard.takeSnapshot(sql);
    res.json({ success: true, snapshot, message: 'Economy snapshot created' });
  } catch (error) {
    console.error('[Economy Dashboard] Error taking snapshot:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

/** GET /api/economy/latest - Get latest economy snapshot (public) */
router.get('/api/economy/latest', async (req, res) => {
  try {
    const snapshot = await economyDashboard.getLatestSnapshot(sql);
    if (!snapshot) return res.status(404).json({ error: 'No snapshots available' });
    res.json(snapshot);
  } catch (error) {
    console.error('[Economy Dashboard] Error fetching latest snapshot:', error);
    res.status(500).json({ error: 'Failed to fetch latest snapshot' });
  }
});

/** GET /api/economy/history - Get historical snapshots (query: startDate, endDate) */
router.get('/api/economy/history', async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate query params required' });
    const snapshots = await economyDashboard.getHistory(sql, startDate, endDate);
    res.json({ startDate, endDate, count: snapshots.length, snapshots });
  } catch (error) {
    console.error('[Economy Dashboard] Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/** GET /api/economy/distribution - Get wealth distribution by brackets (public) */
router.get('/api/economy/distribution', async (req, res) => {
  try {
    const distribution = await economyDashboard.getWealthDistribution(sql);
    res.json({ distribution });
  } catch (error) {
    console.error('[Economy Dashboard] Error fetching distribution:', error);
    res.status(500).json({ error: 'Failed to fetch wealth distribution' });
  }
});

/** GET /api/economy/top-earners - Get top earners (query: limit, default 10, max 100) */
router.get('/api/economy/top-earners', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const earners = await economyDashboard.getTopEarners(sql, limit);
    res.json({ topEarners: earners });
  } catch (error) {
    console.error('[Economy Dashboard] Error fetching top earners:', error);
    res.status(500).json({ error: 'Failed to fetch top earners' });
  }
});

/** GET /api/economy/health - Get economy health status and inflation check (public) */
router.get('/api/economy/health', async (req, res) => {
  try {
    const health = await economyDashboard.getEconomyHealth(sql);
    res.json(health);
  } catch (error) {
    console.error('[Economy Dashboard] Error checking economy health:', error);
    res.status(500).json({ error: 'Failed to check economy health' });
  }
});

export default router;
