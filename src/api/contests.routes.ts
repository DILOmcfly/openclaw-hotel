import { Router } from 'express';
import { requireAgent } from '../middleware/agentOnly.js';
import { requireRole } from '../middleware/admin.js';
import { sql } from '../db/index.js';
import {
  createContest,
  enterContest,
  vote,
  getResults,
  advanceStatus,
  getActiveContests,
} from '../services/contests.js';

const router = Router();

/**
 * POST /api/contests
 * Create a new contest (admin only)
 */
router.post('/api/contests', requireRole('admin'), async (req, res) => {
  try {
    const { title, theme, entriesCloseAt, votingCloseAt } = req.body;
    const createdBy = (req as any).agentId;

    if (!title || !theme || !entriesCloseAt || !votingCloseAt) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const contest = await createContest(
      title,
      theme,
      new Date(entriesCloseAt),
      new Date(votingCloseAt),
      createdBy,
      sql
    );

    res.status(201).json(contest);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create contest';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/contests
 * Get active contests
 */
router.get('/api/contests', async (req, res) => {
  try {
    const contests = await getActiveContests(sql);
    res.status(200).json(contests);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch contests';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/contests/:id/enter
 * Enter a contest with a room (requires auth)
 */
router.post('/api/contests/:id/enter', requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { roomId } = req.body;
    const agentId = (req as any).agentId;

    if (!roomId) {
      res.status(400).json({ error: 'roomId is required' });
      return;
    }

    const result = await enterContest(id, roomId, agentId, sql);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(201).json({ success: true, message: 'Successfully entered contest' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enter contest';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/contests/:id/vote
 * Vote for a room in a contest (requires auth)
 */
router.post('/api/contests/:id/vote', requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { roomId, score } = req.body;
    const voterId = (req as any).agentId;

    if (!roomId || score === undefined) {
      res.status(400).json({ error: 'roomId and score are required' });
      return;
    }

    const result = await vote(id, voterId, roomId, score, sql);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({ success: true, message: 'Vote recorded' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record vote';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/contests/:id/results
 * Get contest results
 */
router.get('/api/contests/:id/results', async (req, res) => {
  try {
    const { id } = req.params;
    const results = await getResults(id, sql);
    res.status(200).json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch results';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/contests/:id/advance
 * Advance contest status (admin only)
 */
router.put('/api/contests/:id/advance', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await advanceStatus(id, sql);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({ 
      success: true, 
      newStatus: result.newStatus,
      message: `Contest advanced to ${result.newStatus}` 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to advance contest';
    res.status(500).json({ error: message });
  }
});

export default router;
