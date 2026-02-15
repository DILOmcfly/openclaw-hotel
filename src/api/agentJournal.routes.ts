import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as journalService from '../services/agentJournal.js';

const router = express.Router();

const authCheck = (req: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  return validateToken(token);
};

router.post('/api/agents/:agentId/journal', async (req, res) => {
  try {
    const { agentId: authAgentId } = authCheck(req);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });
    const entry = await journalService.createEntry({ agentId: req.params.agentId, ...req.body }, sql);
    res.status(201).json({ success: true, entry });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 400).json({ error: error.message });
  }
});

router.get('/api/agents/:agentId/journal', async (req, res) => {
  try {
    const { agentId: authAgentId } = authCheck(req);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });
    const { type, mood, minImportance, limit, offset } = req.query;
    const filters = { type: type as any, mood: mood as string,
      minImportance: minImportance ? parseInt(minImportance as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined };
    res.json({ entries: await journalService.getEntries(req.params.agentId, filters, sql) });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.get('/api/agents/:agentId/journal/:entryId', async (req, res) => {
  try {
    const { agentId: authAgentId } = authCheck(req);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });
    const entry = await journalService.getEntry(parseInt(req.params.entryId), sql);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json({ entry });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.put('/api/agents/:agentId/journal/:entryId', async (req, res) => {
  try {
    const { agentId: authAgentId } = authCheck(req);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });
    const entry = await journalService.updateEntry(parseInt(req.params.entryId), req.params.agentId, req.body, sql);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, entry });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 400).json({ error: error.message });
  }
});

router.delete('/api/agents/:agentId/journal/:entryId', async (req, res) => {
  try {
    const { agentId: authAgentId } = authCheck(req);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });
    const deleted = await journalService.deleteEntry(parseInt(req.params.entryId), req.params.agentId, sql);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.get('/api/agents/:agentId/journal/search', async (req, res) => {
  try {
    const { agentId: authAgentId } = authCheck(req);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: 'Query required' });
    res.json({ entries: await journalService.searchEntries(req.params.agentId, query, sql), query });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

router.get('/api/agents/:agentId/journal/stats', async (req, res) => {
  try {
    const { agentId: authAgentId } = authCheck(req);
    if (authAgentId !== req.params.agentId) return res.status(403).json({ error: 'Forbidden' });
    res.json({ stats: await journalService.getJournalStats(req.params.agentId, sql) });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ error: error.message });
  }
});

export default router;
