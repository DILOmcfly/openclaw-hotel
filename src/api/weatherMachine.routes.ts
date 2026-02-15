import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as weatherService from '../services/weatherMachine.js';

const router = express.Router();

/**
 * PUT /api/rooms/:roomId/weather
 * Set weather for a room (owner only)
 */
router.put('/api/rooms/:roomId/weather', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const roomId = parseInt(req.params.roomId);
    const { weather } = req.body;

    const result = await weatherService.setWeather(roomId, weather, agentId, sql);
    res.json({ success: true, weather: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/rooms/:roomId/weather
 * Get current weather for a room
 */
router.get('/api/rooms/:roomId/weather', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const weather = await weatherService.getWeather(roomId, sql);
    
    if (!weather) {
      return res.json({ weather: null, message: 'No weather machine installed' });
    }
    
    res.json({ weather });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/rooms/:roomId/weather/auto-cycle
 * Enable/disable auto-cycle
 */
router.put('/api/rooms/:roomId/weather/auto-cycle', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    validateToken(token);
    const roomId = parseInt(req.params.roomId);
    const { enabled, intervalMinutes } = req.body;

    if (enabled) {
      await weatherService.enableAutoCycle(roomId, intervalMinutes || 30, sql);
    } else {
      await weatherService.disableAutoCycle(roomId, sql);
    }

    res.json({ success: true, autoCycle: enabled });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/rooms/:roomId/weather/intensity
 * Set weather intensity
 */
router.put('/api/rooms/:roomId/weather/intensity', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    validateToken(token);
    const roomId = parseInt(req.params.roomId);
    const { intensity } = req.body;

    await weatherService.setIntensity(roomId, intensity, sql);
    res.json({ success: true, intensity });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/rooms/:roomId/weather/history
 * Get weather history for a room
 */
router.get('/api/rooms/:roomId/weather/history', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await weatherService.getWeatherHistory(roomId, limit, offset, sql);
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/weather/popular
 * Get most popular weather types globally
 */
router.get('/api/weather/popular', async (_req, res) => {
  try {
    const popular = await weatherService.getPopularWeather(sql);
    res.json({ popular });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/rooms/:roomId/weather/stats
 * Get weather stats for a room
 */
router.get('/api/rooms/:roomId/weather/stats', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const stats = await weatherService.getWeatherStats(roomId, sql);
    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
