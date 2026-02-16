// @ts-nocheck - TODO: fix type errors
import express, { Request, Response } from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { getHourlyStats, getDailyStats, getPeakHour, getTotalVisitors } from '../services/roomAnalytics.js';

const router = express.Router();

router.get('/api/rooms/:roomId/analytics/hourly', validateToken, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const stats = await getHourlyStats(roomId, date, sql);
    res.json({ roomId, date, hourly: stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/rooms/:roomId/analytics/daily', validateToken, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    const stats = await getDailyStats(roomId, days, sql);
    res.json({ roomId, days, daily: stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/rooms/:roomId/analytics/peak', validateToken, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const peak = await getPeakHour(roomId, sql);
    res.json({ roomId, peak });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/rooms/:roomId/analytics/total', validateToken, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const total = await getTotalVisitors(roomId, sql);
    res.json({ roomId, ...total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
