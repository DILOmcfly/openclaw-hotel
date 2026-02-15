import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as luckyWheelService from '../services/luckyWheel.js';

const router = express.Router();

/**
 * GET /api/wheel
 * Get wheel segments with probabilities
 */
router.get('/api/wheel', async (req, res) => {
  try {
    const segments = luckyWheelService.getWheelSegments();
    res.json({ segments });
  } catch (error) {
    console.error('[Lucky Wheel API] Error fetching wheel segments:', error);
    res.status(500).json({ error: 'Failed to fetch wheel segments' });
  }
});

/**
 * GET /api/wheel/status
 * Check if authenticated agent can spin
 */
router.get('/api/wheel/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const canSpin = await luckyWheelService.canSpin(agentId, sql);

    res.json({ canSpin });
  } catch (error) {
    console.error('[Lucky Wheel API] Error checking spin status:', error);
    res.status(500).json({ error: 'Failed to check spin status' });
  }
});

/**
 * POST /api/wheel/spin
 * Spin the wheel (authenticated, daily limit)
 */
router.post('/api/wheel/spin', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const result = await luckyWheelService.spin(agentId, sql);

    res.json({
      success: true,
      prize: {
        type: result.prizeType,
        label: result.prizeLabel,
        value: result.prizeValue,
      },
      message: `You won: ${result.prizeLabel}!`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to spin wheel';
    console.error('[Lucky Wheel API] Error spinning wheel:', error);
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/wheel/recent
 * Get recent wins for display
 */
router.get('/api/wheel/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const recentWins = await luckyWheelService.getRecentWins(limit, sql);

    res.json({ wins: recentWins });
  } catch (error) {
    console.error('[Lucky Wheel API] Error fetching recent wins:', error);
    res.status(500).json({ error: 'Failed to fetch recent wins' });
  }
});

export default router;
