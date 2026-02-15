import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as emoteReactionsService from '../services/emoteReactions.js';

const router = express.Router();

/**
 * POST /api/reactions
 * Add a reaction
 */
router.post('/api/reactions', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { targetType, targetId, emote } = req.body;

    if (!targetType || !targetId || !emote) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const reaction = await emoteReactionsService.addReaction(targetType, targetId, agentId, emote, sql);

    if (!reaction) {
      return res.status(400).json({ error: 'Max unique emotes limit reached for this target' });
    }

    res.json({ success: true, reaction });
  } catch (error) {
    console.error('[Emote Reactions API] Error adding reaction:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

/**
 * DELETE /api/reactions
 * Remove a reaction
 */
router.delete('/api/reactions', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { targetType, targetId, emote } = req.body;

    if (!targetType || !targetId || !emote) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const removed = await emoteReactionsService.removeReaction(targetType, targetId, agentId, emote, sql);

    res.json({ success: removed });
  } catch (error) {
    console.error('[Emote Reactions API] Error removing reaction:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

/**
 * GET /api/reactions/:targetType/:targetId
 * Get all reactions for a target
 */
router.get('/api/reactions/:targetType/:targetId', async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const reactions = await emoteReactionsService.getReactions(targetType, targetId, sql);

    res.json({ reactions });
  } catch (error) {
    console.error('[Emote Reactions API] Error fetching reactions:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

/**
 * GET /api/agents/:agentId/reactions
 * Get reactions by an agent
 */
router.get('/api/agents/:agentId/reactions', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const reactions = await emoteReactionsService.getAgentReactions(agentId, limit, sql);

    res.json({ reactions });
  } catch (error) {
    console.error('[Emote Reactions API] Error fetching agent reactions:', error);
    res.status(500).json({ error: 'Failed to fetch agent reactions' });
  }
});

/**
 * GET /api/reactions/popular
 * Get most popular emotes
 */
router.get('/api/reactions/popular', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const popular = await emoteReactionsService.getPopularEmotes(limit, sql);

    res.json({ popular });
  } catch (error) {
    console.error('[Emote Reactions API] Error fetching popular emotes:', error);
    res.status(500).json({ error: 'Failed to fetch popular emotes' });
  }
});

export default router;
