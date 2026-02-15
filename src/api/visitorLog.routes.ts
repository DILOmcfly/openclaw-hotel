import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as visitorLogService from '../services/visitorLog.js';

const router = express.Router();

router.post('/api/rooms/:roomId/visits/enter', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const visit = await visitorLogService.logEntry(parseInt(req.params.roomId), agentId, sql);
    res.json({ success: true, visit });
  } catch (error) { res.status(500).json({ error: 'Failed to log entry' }); }
});

router.post('/api/rooms/:roomId/visits/exit', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { visitId } = req.body;
    if (!visitId) return res.status(400).json({ error: 'visitId required' });
    const visit = await visitorLogService.logExit(visitId, sql);
    res.json({ success: true, visit });
  } catch (error) { res.status(500).json({ error: 'Failed to log exit' }); }
});

router.get('/api/rooms/:roomId/visitors', async (req, res) => {
  try {
    const visitors = await visitorLogService.getVisitors(parseInt(req.params.roomId), sql);
    res.json({ visitors });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch visitors' }); }
});

router.get('/api/rooms/:roomId/visits/history', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const history = await visitorLogService.getVisitHistory(roomId, limit, offset, sql);
    res.json({ history, limit, offset });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch history' }); }
});

router.get('/api/agents/:agentId/visits', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const visits = await visitorLogService.getAgentVisitHistory(req.params.agentId, limit, sql);
    res.json({ visits });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch agent visits' }); }
});

router.get('/api/rooms/:roomId/visits/stats', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const stats = await visitorLogService.getDailyStats(roomId, date, sql);
    res.json({ stats });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch stats' }); }
});

router.get('/api/rooms/popular', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const now = Date.now();
    const startDate = req.query.startDate as string || new Date(now - 7 * 86400000).toISOString().split('T')[0];
    const endDate = req.query.endDate as string || new Date().toISOString().split('T')[0];
    const popular = await visitorLogService.getPopularRooms(startDate, endDate, limit, sql);
    res.json({ popular, startDate, endDate });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch popular rooms' }); }
});

router.get('/api/rooms/:roomId/visits/frequent', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const frequent = await visitorLogService.getFrequentVisitors(roomId, limit, sql);
    res.json({ frequent });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch frequent visitors' }); }
});

export default router;
