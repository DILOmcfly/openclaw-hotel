import express from 'express';
import { sql } from '../db/index.js';
import * as fortunesService from '../services/fortunes.js';

const router = express.Router();

router.get('/api/agents/:agentId/fortune/today', async (req, res) => {
  try {
    const { agentId } = req.params;
    const f = await fortunesService.getDailyFortune(agentId, sql);
    res.json({ success: true, fortune: { id: f.id, fortuneText: f.fortuneText, luckyNumber: f.luckyNumber, luckyColor: f.luckyColor, moodPrediction: f.moodPrediction, category: f.category, date: f.fortuneDate } });
  } catch (error) {
    console.error('[Fortunes API] Error getting daily fortune:', error);
    res.status(500).json({ error: 'Failed to get fortune' });
  }
});

router.get('/api/agents/:agentId/fortune/history', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const history = await fortunesService.getFortuneHistory(agentId, limit, sql);
    res.json({ success: true, history: history.map(f => ({ id: f.id, fortuneText: f.fortuneText, luckyNumber: f.luckyNumber, luckyColor: f.luckyColor, category: f.category, date: f.fortuneDate, isShared: f.isShared })) });
  } catch (error) {
    console.error('[Fortunes API] Error getting fortune history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

router.post('/api/agents/:agentId/fortune/share', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { fortuneId } = req.body;
    if (!fortuneId) return res.status(400).json({ error: 'fortuneId required' });
    const success = await fortunesService.shareFortune(fortuneId, agentId, sql);
    if (!success) return res.status(404).json({ error: 'Fortune not found or unauthorized' });
    res.json({ success: true, message: 'Fortune shared!' });
  } catch (error) {
    console.error('[Fortunes API] Error sharing fortune:', error);
    res.status(500).json({ error: 'Failed to share fortune' });
  }
});

router.get('/api/fortunes/shared', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const shared = await fortunesService.getSharedFortunes(limit, sql);
    res.json({ success: true, fortunes: shared.map(f => ({ id: f.id, agentId: f.agentId, fortuneText: f.fortuneText, category: f.category, date: f.fortuneDate })) });
  } catch (error) {
    console.error('[Fortunes API] Error getting shared fortunes:', error);
    res.status(500).json({ error: 'Failed to get shared fortunes' });
  }
});

router.get('/api/fortunes/lucky', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const lucky = await fortunesService.getLuckyAgents(limit, sql);
    res.json({ success: true, luckyAgents: lucky.map(f => ({ agentId: f.agentId, fortuneText: f.fortuneText, category: f.category })) });
  } catch (error) {
    console.error('[Fortunes API] Error getting lucky agents:', error);
    res.status(500).json({ error: 'Failed to get lucky agents' });
  }
});

router.get('/api/fortunes/stats', async (req, res) => {
  try {
    const stats = await fortunesService.getFortuneStats(sql);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[Fortunes API] Error getting fortune stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
