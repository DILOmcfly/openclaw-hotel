import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as tc from '../services/tradingCards.js';

const router = express.Router();

router.get('/api/cards', async (_req, res) => {
  try { res.json({ cards: await tc.getAllCards(sql) }); }
  catch (e) { console.error('[Trading Cards] Error:', e); res.status(500).json({ error: 'Failed to fetch cards' }); }
});

router.post('/api/agents/:agentId/cards/:cardId/mint', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: authId } = validateToken(token);
    const { agentId, cardId } = req.params;
    if (authId !== agentId) return res.status(403).json({ error: 'Forbidden' });
    res.json({ success: true, card: await tc.mintCard(agentId, parseInt(cardId), sql) });
  } catch (e: any) {
    console.error('[Trading Cards] Mint error:', e);
    if (e.message === 'Card not found') return res.status(404).json({ error: e.message });
    if (e.message === 'Card supply exhausted') return res.status(400).json({ error: e.message });
    res.status(500).json({ error: 'Failed to mint card' });
  }
});

router.get('/api/agents/:agentId/cards', async (req, res) => {
  try { res.json({ cards: await tc.getAgentCards(req.params.agentId, sql, req.query.rarity as string) }); }
  catch (e) { console.error('[Trading Cards] Error:', e); res.status(500).json({ error: 'Failed to fetch cards' }); }
});

router.post('/api/cards/trade', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const { receiverAgentId, senderCardIds, receiverCardIds } = req.body;
    if (!receiverAgentId || !senderCardIds || !receiverCardIds) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    res.json(await tc.tradeCards(agentId, receiverAgentId, senderCardIds, receiverCardIds, sql));
  } catch (e: any) {
    console.error('[Trading Cards] Trade error:', e);
    res.status(400).json({ error: e.message || 'Failed to trade' });
  }
});

router.get('/api/cards/stats', async (req, res) => {
  try {
    const cardId = parseInt(req.query.cardId as string);
    if (isNaN(cardId)) return res.status(400).json({ error: 'Invalid card ID' });
    res.json(await tc.getCardStats(cardId, sql));
  } catch (e: any) {
    console.error('[Trading Cards] Stats error:', e);
    if (e.message === 'Card not found') return res.status(404).json({ error: e.message });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/api/cards/rarest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    res.json({ cards: await tc.getRarestCards(limit, sql) });
  } catch (e) { console.error('[Trading Cards] Error:', e); res.status(500).json({ error: 'Failed to fetch rarest' }); }
});

router.get('/api/agents/:agentId/cards/progress', async (req, res) => {
  try { res.json(await tc.getCollectionProgress(req.params.agentId, sql)); }
  catch (e) { console.error('[Trading Cards] Error:', e); res.status(500).json({ error: 'Failed to fetch progress' }); }
});

router.get('/api/cards/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    res.json({ leaderboard: await tc.getLeaderboard(limit, sql) });
  } catch (e) { console.error('[Trading Cards] Error:', e); res.status(500).json({ error: 'Failed to fetch leaderboard' }); }
});

export default router;
