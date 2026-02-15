import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as reputationService from '../services/reputation.js';

const router = express.Router();

router.post('/api/agents/:agentId/reputation', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: givenBy } = validateToken(token);
    const { agentId } = req.params;
    const { eventType, reason } = req.body;
    if (!eventType) return res.status(400).json({ error: 'Event type is required' });
    const event = await reputationService.addEvent(agentId, eventType, givenBy, reason || null, sql);
    res.json({ success: true, event: { id: event.id, eventType: event.eventType, points: event.points, createdAt: event.createdAt } });
  } catch (error) {
    console.error('[Reputation API] Error adding event:', error);
    res.status(500).json({ error: 'Failed to add reputation event' });
  }
});

router.get('/api/agents/:agentId/reputation', async (req, res) => {
  try {
    const { agentId } = req.params;
    const reputation = await reputationService.getReputation(agentId, sql);
    res.json({ agentId: reputation.agentId, reputation: reputation.reputation, positiveCount: reputation.positiveCount, negativeCount: reputation.negativeCount, updatedAt: reputation.updatedAt });
  } catch (error) {
    console.error('[Reputation API] Error fetching reputation:', error);
    res.status(500).json({ error: 'Failed to fetch reputation' });
  }
});

router.get('/api/agents/:agentId/reputation/history', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const history = await reputationService.getReputationHistory(agentId, limit, offset, sql);
    res.json({ events: history });
  } catch (error) {
    console.error('[Reputation API] Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch reputation history' });
  }
});

router.get('/api/reputation/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const leaderboard = await reputationService.getLeaderboard(limit, sql);
    res.json({ leaderboard });
  } catch (error) {
    console.error('[Reputation API] Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.get('/api/agents/:agentId/reputation/trust-level', async (req, res) => {
  try {
    const { agentId } = req.params;
    const reputation = await reputationService.getReputation(agentId, sql);
    const trustLevel = reputationService.calculateTrustLevel(reputation.reputation);
    res.json({ agentId, reputation: reputation.reputation, trustLevel: trustLevel.level, score: trustLevel.score, minRequired: trustLevel.minRequired, maxRequired: trustLevel.maxRequired });
  } catch (error) {
    console.error('[Reputation API] Error calculating trust level:', error);
    res.status(500).json({ error: 'Failed to calculate trust level' });
  }
});

export default router;
