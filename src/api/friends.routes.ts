import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFriends,
  getPendingRequests,
} from '../services/friends.js';

const router = express.Router();

/**
 * POST /api/friends/request
 * Send a friend request
 */
router.post('/api/friends/request', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { targetAgentId } = req.body;

    if (!targetAgentId) {
      return res.status(400).json({ error: 'targetAgentId is required' });
    }

    const friendship = await sendFriendRequest(agentId, targetAgentId, sql);

    logger.info('Friend request sent', {
      requesterId: agentId,
      addresseeId: targetAgentId,
      friendshipId: friendship.id,
    });

    res.json({ success: true, friendship });
  } catch (error: any) {
    logger.error('Failed to send friend request', { error });
    res.status(400).json({ error: error.message || 'Failed to send friend request' });
  }
});

/**
 * PUT /api/friends/:id/accept
 * Accept a friend request
 */
router.put('/api/friends/:id/accept', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await acceptFriendRequest(id, agentId, sql);

    logger.info('Friend request accepted', {
      friendshipId: id,
      agentId,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to accept friend request', { error });
    res.status(400).json({ error: error.message || 'Failed to accept friend request' });
  }
});

/**
 * PUT /api/friends/:id/reject
 * Reject a friend request
 */
router.put('/api/friends/:id/reject', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await rejectFriendRequest(id, agentId, sql);

    logger.info('Friend request rejected', {
      friendshipId: id,
      agentId,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to reject friend request', { error });
    res.status(400).json({ error: error.message || 'Failed to reject friend request' });
  }
});

/**
 * DELETE /api/friends/:id
 * Remove a friend
 */
router.delete('/api/friends/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await removeFriend(id, agentId, sql);

    logger.info('Friend removed', {
      friendshipId: id,
      agentId,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to remove friend', { error });
    res.status(400).json({ error: error.message || 'Failed to remove friend' });
  }
});

/**
 * GET /api/friends
 * Get all accepted friends
 */
router.get('/api/friends', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const friends = await getFriends(agentId, sql);

    res.json({ friends });
  } catch (error: any) {
    logger.error('Failed to fetch friends', { error });
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

/**
 * GET /api/friends/pending
 * Get pending friend requests received
 */
router.get('/api/friends/pending', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const requests = await getPendingRequests(agentId, sql);

    res.json({ requests });
  } catch (error: any) {
    logger.error('Failed to fetch pending requests', { error });
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

export default router;
