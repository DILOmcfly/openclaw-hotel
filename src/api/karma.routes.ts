import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as karmaService from '../services/karma.js';

const router = express.Router();

router.post('/api/agents/:agentId/karma', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: authAgentId } = validateToken(token);
    const { agentId } = req.params;
    const { action, reason } = req.body;
    if (!action || !karmaService.KARMA_POINTS[action as karmaService.KarmaAction]) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    const event = await karmaService.addKarmaEvent(agentId, action as karmaService.KarmaAction, sql, authAgentId, reason);
    const karma = await karmaService.getKarma(agentId, sql);
    res.json({ success: true, event, karma: karma.karma, level: karmaService.getKarmaLevel(karma.karma) });
  } catch (error) {
    console.error('[Karma API] Error adding karma event:', error);
    res.status(500).json({ error: 'Failed to add karma event' });
  }
});

router.get('/api/agents/:agentId/karma', async (req, res) => {
  try {
    const { agentId } = req.params;
    const karma = await karmaService.getKarma(agentId, sql);
    res.json({ ...karma, level: karmaService.getKarmaLevel(karma.karma) });
  } catch (error) {
    console.error('[Karma API] Error fetching karma:', error);
    res.status(500).json({ error: 'Failed to fetch karma' });
  }
});

router.get('/api/agents/:agentId/karma/history', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const history = await karmaService.getKarmaHistory(agentId, sql, limit, offset);
    res.json({ history });
  } catch (error) {
    console.error('[Karma API] Error fetching karma history:', error);
    res.status(500).json({ error: 'Failed to fetch karma history' });
  }
});

router.get('/api/karma/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const leaderboard = await karmaService.getKarmaLeaderboard(limit, sql);
    res.json({
      leaderboard: leaderboard.map(k => ({
        agentId: k.agentId, karma: k.karma, level: karmaService.getKarmaLevel(k.karma),
        positiveActions: k.positiveActions, negativeActions: k.negativeActions,
      })),
    });
  } catch (error) {
    console.error('[Karma API] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.get('/api/agents/:agentId/karma/level', async (req, res) => {
  try {
    const { agentId } = req.params;
    const karma = await karmaService.getKarma(agentId, sql);
    res.json({ agentId, karma: karma.karma, level: karmaService.getKarmaLevel(karma.karma) });
  } catch (error) {
    console.error('[Karma API] Error fetching karma level:', error);
    res.status(500).json({ error: 'Failed to fetch karma level' });
  }
});

export default router;
