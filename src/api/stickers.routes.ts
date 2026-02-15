import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as stickersService from '../services/stickers.js';

const router = express.Router();

router.get('/api/stickers/packs', async (req, res) => {
  try {
    res.json({ packs: await stickersService.getPacks(sql) });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch packs' }); }
});

router.post('/api/agents/:agentId/stickers/buy/:packId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: authAgentId } = validateToken(token);
    const { agentId, packId } = req.params;
    if (authAgentId !== agentId) return res.status(403).json({ error: 'Forbidden' });
    const result = await stickersService.buyPack(agentId, parseInt(packId), sql);
    res.json({ success: true, ...result });
  } catch (error: any) {
    const msg = error.message || 'Failed to buy pack';
    const status = msg.includes('not found') ? 404 : msg.includes('Insufficient') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

router.get('/api/agents/:agentId/stickers', async (req, res) => {
  try {
    res.json({ stickers: await stickersService.getAgentStickers(req.params.agentId, sql) });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch stickers' }); }
});

router.post('/api/stickers/use', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const { stickerId } = req.body;
    if (!stickerId) return res.status(400).json({ error: 'stickerId required' });
    res.json(await stickersService.useSticker(agentId, parseInt(stickerId), sql));
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to use sticker' });
  }
});

router.post('/api/stickers/trade', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: fromAgentId } = validateToken(token);
    const { toAgentId, stickerId } = req.body;
    if (!toAgentId || !stickerId) return res.status(400).json({ error: 'toAgentId and stickerId required' });
    res.json({ success: await stickersService.tradeSticker(fromAgentId, toAgentId, parseInt(stickerId), sql) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to trade sticker' });
  }
});

router.get('/api/agents/:agentId/stickers/progress', async (req, res) => {
  try {
    res.json(await stickersService.getCollectionProgress(req.params.agentId, sql));
  } catch (error) { res.status(500).json({ error: 'Failed to fetch progress' }); }
});

router.get('/api/stickers/rarest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    res.json({ rarest: await stickersService.getRarestStickers(limit, sql) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rarest stickers' });
  }
});

export default router;
