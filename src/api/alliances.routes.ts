import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as s from '../services/alliances.js';

const router = express.Router();

router.post('/api/alliances', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const alliance = await s.createAlliance(req.body.name, req.body.motto, req.body.leaderGuildId, agentId, sql);
    res.status(201).json({ alliance });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.post('/api/alliances/:id/invite/:guildId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    await s.inviteGuild(parseInt(req.params.id), parseInt(req.params.guildId), validateToken(token).agentId, sql);
    res.json({ success: true });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.post('/api/alliances/:id/join', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    await s.joinAlliance(parseInt(req.params.id), req.body.guildId, validateToken(token).agentId, sql);
    res.json({ success: true });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.delete('/api/alliances/:id/leave/:guildId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    await s.leaveAlliance(parseInt(req.params.id), parseInt(req.params.guildId), validateToken(token).agentId, sql);
    res.json({ success: true });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.post('/api/alliances/:id/rival/:targetId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    await s.declareRivalry(parseInt(req.params.id), parseInt(req.params.targetId), req.body.reason, validateToken(token).agentId, sql);
    res.json({ success: true });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.delete('/api/alliances/:id/rival/:targetId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    await s.endRivalry(parseInt(req.params.id), parseInt(req.params.targetId), validateToken(token).agentId, sql);
    res.json({ success: true });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

router.get('/api/alliances/:id', async (req, res) => {
  try {
    res.json({ alliance: await s.getAlliance(parseInt(req.params.id), sql) });
  } catch (error: any) { res.status(404).json({ error: error.message }); }
});

router.get('/api/alliances', async (_req, res) => {
  try {
    res.json({ alliances: await s.getAlliances(sql) });
  } catch (error: any) { res.status(500).json({ error: 'Failed to fetch alliances' }); }
});

router.get('/api/alliances/:id/stats', async (req, res) => {
  try {
    res.json({ stats: await s.getAllianceStats(parseInt(req.params.id), sql) });
  } catch (error: any) { res.status(500).json({ error: 'Failed to fetch stats' }); }
});

export default router;
