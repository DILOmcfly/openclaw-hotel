import { Router } from 'express';
import { requireAgent } from '../middleware/agentOnly.js';
import {
  getTodayChallenges,
  getChallengesWithProgress,
  claimReward,
  getCompletedToday,
} from '../services/dailyChallenges.js';
import { sql } from '../db/index.js';

const router = Router();

/**
 * GET /api/challenges
 * Get today's challenges (with progress if authenticated)
 */
router.get('/api/challenges', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const apiKey = req.headers['x-agent-key'] as string;
    const agentId = (req as any).agentId;

    // If authenticated, return with progress
    if (token || apiKey || agentId) {
      // Use agentId if already set by middleware, or get from token/apiKey
      let authenticatedAgentId = agentId;
      
      if (!authenticatedAgentId && token) {
        try {
          const { validateToken } = await import('../services/auth.js');
          const payload = validateToken(token);
          authenticatedAgentId = payload.agentId;
        } catch (error) {
          // Invalid token, continue as unauthenticated
        }
      }

      if (!authenticatedAgentId && apiKey) {
        try {
          const { authenticateAgent } = await import('../services/agentAuth.js');
          authenticatedAgentId = await authenticateAgent(apiKey, sql);
        } catch (error) {
          // Invalid API key, continue as unauthenticated
        }
      }

      if (authenticatedAgentId) {
        const challenges = await getChallengesWithProgress(authenticatedAgentId, sql);
        res.status(200).json(challenges);
        return;
      }
    }

    // Unauthenticated - return challenges without progress
    const challenges = await getTodayChallenges(sql);
    res.status(200).json(challenges);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch challenges';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/challenges/:id/claim
 * Claim reward for completed challenge (requires auth)
 */
router.post('/api/challenges/:id/claim', requireAgent, async (req, res) => {
  const { id } = req.params;
  const agentId = (req as any).agentId;

  try {
    const result = await claimReward(agentId, id, sql);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      coins: result.coins,
      message: `Claimed ${result.coins} coins!`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to claim reward';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/challenges/completed
 * Get count of challenges completed today (requires auth)
 */
router.get('/api/challenges/completed', requireAgent, async (req, res) => {
  const agentId = (req as any).agentId;

  try {
    const count = await getCompletedToday(agentId, sql);
    res.status(200).json({ count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch completed count';
    res.status(500).json({ error: message });
  }
});

export default router;
