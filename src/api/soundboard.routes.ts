import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as soundboardService from '../services/soundboard.js';

const router = express.Router();

router.post('/api/rooms/:roomId/soundboard', async (req, res) => {
  try {
    if (!req.headers.authorization?.replace('Bearer ', '')) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ success: true, config: await soundboardService.enableSoundboard(parseInt(req.params.roomId), sql) });
  } catch (error) { res.status(500).json({ error: 'Failed to enable soundboard' }); }
});

router.post('/api/rooms/:roomId/soundboard/sounds', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const { name, soundKey, category, volume } = req.body;
    res.json({ success: true, sound: await soundboardService.addSound(parseInt(req.params.roomId), name, soundKey, category, volume || 80, agentId, sql) });
  } catch (error: any) { res.status(400).json({ error: error.message || 'Failed to add sound' }); }
});

router.delete('/api/rooms/:roomId/soundboard/sounds/:id', async (req, res) => {
  try {
    if (!req.headers.authorization?.replace('Bearer ', '')) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ success: await soundboardService.removeSound(parseInt(req.params.id), sql) });
  } catch (error) { res.status(500).json({ error: 'Failed to remove sound' }); }
});

router.post('/api/rooms/:roomId/soundboard/play/:soundId', async (req, res) => {
  try {
    const result = await soundboardService.playSound(parseInt(req.params.roomId), parseInt(req.params.soundId), sql);
    res.json({ success: true, sound: result.sound, cooldownRemaining: result.cooldownRemaining });
  } catch (error: any) { res.status(400).json({ error: error.message || 'Failed to play sound' }); }
});

router.get('/api/rooms/:roomId/soundboard/sounds', async (req, res) => {
  try {
    res.json({ sounds: await soundboardService.getSounds(parseInt(req.params.roomId), sql) });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch sounds' }); }
});

router.get('/api/soundboard/popular', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    res.json({ sounds: await soundboardService.getPopularSounds(limit, sql) });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch popular sounds' }); }
});

router.put('/api/rooms/:roomId/soundboard/cooldown', async (req, res) => {
  try {
    if (!req.headers.authorization?.replace('Bearer ', '')) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ success: true, config: await soundboardService.setCooldown(parseInt(req.params.roomId), req.body.cooldownSeconds, sql) });
  } catch (error: any) { res.status(400).json({ error: error.message || 'Failed to set cooldown' }); }
});

router.get('/api/rooms/:roomId/soundboard/stats', async (req, res) => {
  try {
    res.json(await soundboardService.getSoundboardStats(parseInt(req.params.roomId), sql));
  } catch (error) { res.status(500).json({ error: 'Failed to fetch stats' }); }
});

export default router;
