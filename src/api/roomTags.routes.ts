import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as roomTagsService from '../services/roomTags.js';

const router = express.Router();

router.post('/api/rooms/:roomId/tags', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ error: 'Tag required' });
    await roomTagsService.addTag(parseInt(req.params.roomId), tag, agentId, sql);
    res.json({ success: true });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.delete('/api/rooms/:roomId/tags/:tag', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    await roomTagsService.removeTag(parseInt(req.params.roomId), req.params.tag, agentId, sql);
    res.json({ success: true });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.get('/api/rooms/:roomId/tags', async (req, res) => {
  try {
    const tags = await roomTagsService.getRoomTags(parseInt(req.params.roomId), sql);
    res.json({ tags });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.get('/api/tags/:tag/rooms', async (req, res) => {
  try {
    const roomIds = await roomTagsService.searchByTag(req.params.tag, sql);
    res.json({ roomIds });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.get('/api/tags/trending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const tags = await roomTagsService.getTrendingTags(limit, sql);
    res.json({ tags });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.post('/api/agents/:agentId/tags/:tag/follow', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    await roomTagsService.followTag(agentId, req.params.tag, sql);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.delete('/api/agents/:agentId/tags/:tag/follow', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    await roomTagsService.unfollowTag(agentId, req.params.tag, sql);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.get('/api/agents/:agentId/tags', async (req, res) => {
  try {
    const tags = await roomTagsService.getFollowedTags(req.params.agentId, sql);
    res.json({ tags });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

router.get('/api/agents/:agentId/recommended-rooms', async (req, res) => {
  try {
    const roomIds = await roomTagsService.getRecommendedRooms(req.params.agentId, sql);
    res.json({ roomIds });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export default router;
