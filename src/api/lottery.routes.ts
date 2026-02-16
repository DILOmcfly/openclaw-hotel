import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { requireRole } from '../middleware/admin.js';
import * as lotteryService from '../services/lottery.js';

const router = express.Router();

router.post('/api/lottery', requireRole('admin'), async (req, res) => {
  try {
    const { name, ticketPrice, drawAt } = req.body;
    if (!name || !ticketPrice) return res.status(400).json({ error: 'Missing name or ticketPrice' });
    const lottery = await lotteryService.createLottery(name, ticketPrice, drawAt ? new Date(drawAt) : null, sql);
    res.json(lottery);
  } catch (error) {
    console.error('[Lottery API] Create error:', error);
    res.status(500).json({ error: 'Failed to create lottery' });
  }
});

router.post('/api/lottery/:id/buy', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const ticket = await lotteryService.buyTicket(parseInt(req.params.id, 10), agentId, sql);
    res.json(ticket);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to buy ticket';
    console.error('[Lottery API] Buy ticket error:', error);
    res.status(400).json({ error: message });
  }
});

router.get('/api/lottery/active', async (_req, res) => {
  try {
    const lottery = await lotteryService.getActiveLottery(sql);
    res.json(lottery || { lottery: null });
  } catch (error) {
    console.error('[Lottery API] Get active error:', error);
    res.status(500).json({ error: 'Failed to get active lottery' });
  }
});

router.get('/api/agents/:agentId/lottery/tickets', async (req, res) => {
  try {
    const { agentId } = req.params;
    const lotteryId = parseInt(req.query.lotteryId as string, 10);
    if (!lotteryId) return res.status(400).json({ error: 'Missing lotteryId query parameter' });
    const tickets = await lotteryService.getTickets(lotteryId, agentId, sql);
    res.json(tickets);
  } catch (error) {
    console.error('[Lottery API] Get tickets error:', error);
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});

router.post('/api/lottery/:id/draw', requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const result = await lotteryService.draw(parseInt(id, 10), sql);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to draw lottery';
    console.error('[Lottery API] Draw error:', error);
    res.status(400).json({ error: message });
  }
});

router.get('/api/lottery/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const history = await lotteryService.getLotteryHistory(limit, sql);
    res.json(history);
  } catch (error) {
    console.error('[Lottery API] Get history error:', error);
    res.status(500).json({ error: 'Failed to get lottery history' });
  }
});

export default router;
