import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import {
  createPoll,
  vote,
  getPollResults,
  getActivePolls,
  closePoll,
} from '../services/polls.js';

const router = express.Router();

/**
 * POST /api/rooms/:roomId/polls
 * Create a new poll in a room
 */
router.post('/api/rooms/:roomId/polls', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { question, options, durationSecs } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    if (!options || !Array.isArray(options)) {
      return res.status(400).json({ error: 'Options array is required' });
    }

    const poll = await createPoll(
      roomId,
      agentId,
      question,
      options,
      durationSecs || null,
      sql
    );

    logger.info('Poll created', {
      pollId: poll.id,
      roomId,
      creatorId: agentId,
    });

    res.status(201).json({ poll });
  } catch (error: any) {
    logger.error('Failed to create poll', { error });
    res.status(400).json({ error: error.message || 'Failed to create poll' });
  }
});

/**
 * GET /api/rooms/:roomId/polls
 * Get active polls for a room
 */
router.get('/api/rooms/:roomId/polls', async (req, res) => {
  try {
    const { roomId } = req.params;
    const polls = await getActivePolls(roomId, sql);

    res.json({ polls });
  } catch (error: any) {
    logger.error('Failed to fetch polls', { error });
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

/**
 * POST /api/polls/:id/vote
 * Cast a vote on a poll
 */
router.post('/api/polls/:id/vote', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;
    const { optionIndex } = req.body;

    if (typeof optionIndex !== 'number') {
      return res.status(400).json({ error: 'optionIndex is required' });
    }

    await vote(id, agentId, optionIndex, sql);

    logger.info('Vote cast', {
      pollId: id,
      agentId,
      optionIndex,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to vote', { error });
    res.status(400).json({ error: error.message || 'Failed to vote' });
  }
});

/**
 * GET /api/polls/:id/results
 * Get poll results
 */
router.get('/api/polls/:id/results', async (req, res) => {
  try {
    const { id } = req.params;
    const results = await getPollResults(id, sql);

    res.json({ results });
  } catch (error: any) {
    logger.error('Failed to fetch poll results', { error });
    res.status(404).json({ error: error.message || 'Failed to fetch poll results' });
  }
});

/**
 * PUT /api/polls/:id/close
 * Close a poll (creator only)
 */
router.put('/api/polls/:id/close', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await closePoll(id, agentId, sql);

    logger.info('Poll closed', {
      pollId: id,
      agentId,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to close poll', { error });
    res.status(400).json({ error: error.message || 'Failed to close poll' });
  }
});

export default router;
