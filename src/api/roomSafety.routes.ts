import express from 'express';
import { sql } from '../db/index.js';
import { requireAgent } from '../middleware/agentOnly.js';
import { requireRole } from '../middleware/admin.js';
import { setRating, addWarning, removeWarning, getRating, verifyRating, reportRoom, getRoomsByRating, type SafetyRating } from '../services/roomSafety.js';

const router = express.Router();

async function isRoomOwner(roomId: string, agentId: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM rooms WHERE id = ${roomId}::uuid AND created_by = ${agentId}::uuid LIMIT 1`;
  return rows.length > 0;
}

router.get('/api/rooms/:roomId/safety', async (req, res) => {
  try {
    const safety = await getRating(req.params.roomId, sql);
    res.json(safety || { roomId: req.params.roomId, rating: 'everyone', contentWarnings: [], reportsCount: 0 });
  } catch (error) {
    console.error('[Room Safety] Get error:', error);
    res.status(500).json({ error: 'Failed to get room safety rating' });
  }
});

router.put('/api/rooms/:roomId/safety/rating', requireAgent, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { rating } = req.body;
    if (!rating) return res.status(400).json({ error: 'Rating is required' });
    if (!await isRoomOwner(roomId, (req as any).agentId)) {
      return res.status(403).json({ error: 'Only room owners can set safety rating' });
    }
    await setRating(roomId, rating as SafetyRating, sql);
    res.json({ success: true, message: 'Room safety rating updated', roomId, rating });
  } catch (error: any) {
    console.error('[Room Safety] Set rating error:', error);
    res.status(400).json({ error: error.message || 'Failed to set room safety rating' });
  }
});

router.post('/api/rooms/:roomId/safety/warning', requireAgent, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { warning } = req.body;
    if (!warning) return res.status(400).json({ error: 'Warning is required' });
    if (!await isRoomOwner(roomId, (req as any).agentId)) {
      return res.status(403).json({ error: 'Only room owners can add warnings' });
    }
    await addWarning(roomId, warning, sql);
    res.json({ success: true, message: 'Warning added', roomId, warning });
  } catch (error: any) {
    console.error('[Room Safety] Add warning error:', error);
    res.status(400).json({ error: error.message || 'Failed to add warning' });
  }
});

router.delete('/api/rooms/:roomId/safety/warning', requireAgent, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { warning } = req.body;
    if (!warning) return res.status(400).json({ error: 'Warning is required' });
    if (!await isRoomOwner(roomId, (req as any).agentId)) {
      return res.status(403).json({ error: 'Only room owners can remove warnings' });
    }
    const removed = await removeWarning(roomId, warning, sql);
    if (!removed) return res.status(404).json({ error: 'Warning not found' });
    res.json({ success: true, message: 'Warning removed', roomId });
  } catch (error) {
    console.error('[Room Safety] Remove warning error:', error);
    res.status(500).json({ error: 'Failed to remove warning' });
  }
});

router.put('/api/rooms/:roomId/safety/verify', requireRole('admin'), async (req, res) => {
  try {
    await verifyRating(req.params.roomId, (req as any).agentId, sql);
    res.json({ success: true, message: 'Room safety rating verified', roomId: req.params.roomId });
  } catch (error) {
    console.error('[Room Safety] Verify error:', error);
    res.status(500).json({ error: 'Failed to verify room safety rating' });
  }
});

router.post('/api/rooms/:roomId/safety/report', requireAgent, async (req, res) => {
  try {
    const reportsCount = await reportRoom(req.params.roomId, sql);
    res.json({ success: true, message: 'Room reported', roomId: req.params.roomId, reportsCount });
  } catch (error) {
    console.error('[Room Safety] Report error:', error);
    res.status(500).json({ error: 'Failed to report room' });
  }
});

router.get('/api/rooms/safety/:rating', async (req, res) => {
  try {
    const { rating } = req.params;
    if (!['everyone', 'teen', 'mature', 'restricted'].includes(rating)) {
      return res.status(400).json({ error: 'Invalid rating' });
    }
    const roomIds = await getRoomsByRating(rating as SafetyRating, sql);
    res.json({ rating, roomIds, count: roomIds.length });
  } catch (error) {
    console.error('[Room Safety] Get rooms by rating error:', error);
    res.status(500).json({ error: 'Failed to get rooms by rating' });
  }
});

export default router;
