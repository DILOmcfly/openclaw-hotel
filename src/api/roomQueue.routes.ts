import { Router } from 'express';
import { validateToken } from '../services/auth.js';
import {
  joinQueue,
  leaveQueue,
  getQueue,
  getPosition,
  isInQueue,
  getQueueLength,
} from '../services/roomQueue.js';

const router = Router();

router.post('/api/rooms/:roomId/queue', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { agentId } = validateToken(token);
  const { roomId } = req.params;
  try {
    joinQueue(roomId, agentId);
    const position = getPosition(roomId, agentId);
    res.status(200).json({ success: true, position, queueLength: getQueueLength(roomId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to join queue';
    res.status(400).json({ error: message });
  }
});

router.delete('/api/rooms/:roomId/queue', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { agentId } = validateToken(token);
  const { roomId } = req.params;
  try {
    leaveQueue(roomId, agentId);
    res.status(200).json({ success: true, queueLength: getQueueLength(roomId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to leave queue';
    res.status(400).json({ error: message });
  }
});

router.get('/api/rooms/:roomId/queue', async (req, res) => {
  const { roomId } = req.params;
  try {
    const queue = getQueue(roomId);
    res.status(200).json({
      roomId,
      queueLength: queue.length,
      queue: queue.map((entry, index) => ({
        position: index + 1,
        agentId: entry.agentId,
        joinedAt: entry.joinedAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch queue';
    res.status(500).json({ error: message });
  }
});

router.get('/api/rooms/:roomId/queue/position', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { agentId } = validateToken(token);
  const { roomId } = req.params;
  try {
    const position = getPosition(roomId, agentId);
    const inQueue = isInQueue(roomId, agentId);
    res.status(200).json({
      inQueue,
      position: inQueue ? position : null,
      queueLength: getQueueLength(roomId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get position';
    res.status(500).json({ error: message });
  }
});

export default router;
