import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as guestbookService from '../services/guestbook.js';

const router = express.Router();

/** POST /api/rooms/:roomId/guestbook - Enable guest book */
router.post('/api/rooms/:roomId/guestbook', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const roomId = parseInt(req.params.roomId);

    await guestbookService.enableGuestbook(roomId, agentId, sql);
    res.json({ success: true, message: 'Guest book enabled' });
  } catch (error: any) {
    console.error('[Guestbook] Enable error:', error);
    res.status(error.message.includes('owner') ? 403 : 500).json({ error: error.message });
  }
});

/** POST /api/rooms/:roomId/guestbook/entries - Add entry */
router.post('/api/rooms/:roomId/guestbook/entries', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const roomId = parseInt(req.params.roomId);
    const { message, mood = 'happy' } = req.body;

    const entry = await guestbookService.addEntry(roomId, agentId, message, mood, sql);
    res.json({ success: true, entry });
  } catch (error: any) {
    console.error('[Guestbook] Add entry error:', error);
    res.status(400).json({ error: error.message });
  }
});

/** GET /api/rooms/:roomId/guestbook/entries - Get entries */
router.get('/api/rooms/:roomId/guestbook/entries', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const entries = await guestbookService.getEntries(roomId, limit, offset, sql);
    res.json({ entries });
  } catch (error: any) {
    console.error('[Guestbook] Get entries error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

/** PUT /api/guestbook/entries/:id/pin - Pin entry */
router.put('/api/guestbook/entries/:id/pin', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const entryId = parseInt(req.params.id);

    await guestbookService.pinEntry(entryId, agentId, sql);
    res.json({ success: true, message: 'Entry pinned' });
  } catch (error: any) {
    console.error('[Guestbook] Pin error:', error);
    res.status(error.message.includes('owner') || error.message.includes('Maximum') ? 403 : 500).json({ error: error.message });
  }
});

/** PUT /api/guestbook/entries/:id/unpin - Unpin entry */
router.put('/api/guestbook/entries/:id/unpin', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const entryId = parseInt(req.params.id);

    await guestbookService.unpinEntry(entryId, agentId, sql);
    res.json({ success: true, message: 'Entry unpinned' });
  } catch (error: any) {
    console.error('[Guestbook] Unpin error:', error);
    res.status(error.message.includes('owner') ? 403 : 500).json({ error: error.message });
  }
});

/** POST /api/guestbook/entries/:id/like - Like entry */
router.post('/api/guestbook/entries/:id/like', async (req, res) => {
  try {
    const entryId = parseInt(req.params.id);
    const likes = await guestbookService.likeEntry(entryId, sql);
    res.json({ success: true, likes });
  } catch (error: any) {
    console.error('[Guestbook] Like error:', error);
    res.status(404).json({ error: error.message });
  }
});

/** DELETE /api/guestbook/entries/:id - Delete entry */
router.delete('/api/guestbook/entries/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const entryId = parseInt(req.params.id);

    await guestbookService.deleteEntry(entryId, agentId, sql);
    res.json({ success: true, message: 'Entry deleted' });
  } catch (error: any) {
    console.error('[Guestbook] Delete error:', error);
    res.status(error.message.includes('Only') ? 403 : 500).json({ error: error.message });
  }
});

/** GET /api/rooms/:roomId/guestbook/stats - Get stats */
router.get('/api/rooms/:roomId/guestbook/stats', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const stats = await guestbookService.getGuestbookStats(roomId, sql);
    res.json({ stats });
  } catch (error: any) {
    console.error('[Guestbook] Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
