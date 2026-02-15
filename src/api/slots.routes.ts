import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as slotsService from '../services/slots.js';

const router = express.Router();

/**
 * POST /api/slots/:machineId/spin - Spin slot machine (authenticated)
 */
router.post('/api/slots/:machineId/spin', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const machineId = parseInt(req.params.machineId);
    const { bet } = req.body;

    if (!bet || bet <= 0) return res.status(400).json({ error: 'Invalid bet amount' });

    const result = await slotsService.spin(machineId, agentId, bet, sql);
    res.json({ success: true, symbols: result.symbols, payout: result.payout, jackpotWon: result.jackpotWon, message: result.message });
  } catch (error: any) {
    console.error('[Slots API] Error spinning:', error);
    res.status(500).json({ error: error.message || 'Failed to spin' });
  }
});

/**
 * GET /api/slots - List all slot machines (public)
 */
router.get('/api/slots', async (_req, res) => {
  try {
    const machines = await slotsService.getMachines(sql);
    res.json({ machines });
  } catch (error) {
    console.error('[Slots API] Error fetching machines:', error);
    res.status(500).json({ error: 'Failed to fetch machines' });
  }
});

/**
 * GET /api/slots/:machineId/stats - Get machine stats (public)
 */
router.get('/api/slots/:machineId/stats', async (req, res) => {
  try {
    const machineId = parseInt(req.params.machineId);
    const stats = await slotsService.getMachineStats(machineId, sql);
    if (!stats) return res.status(404).json({ error: 'Machine not found' });
    res.json(stats);
  } catch (error) {
    console.error('[Slots API] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/agents/:agentId/slots/history - Get agent's spin history (authenticated)
 */
router.get('/api/agents/:agentId/slots/history', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const history = await slotsService.getAgentHistory(agentId, sql, limit);
    res.json({ history });
  } catch (error) {
    console.error('[Slots API] Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
