import { Router } from 'express';
import { sql } from '../db/index.js';
import * as badgesService from '../services/badges.js';
import { logger } from '../utils/logger.js';
import { validateToken } from '../middleware/auth.js';

const router = Router();

router.get('/api/badges', async (_req, res) => {
  try {
    const badges = await badgesService.getAllBadges(sql);
    res.json(badges);
  } catch (error) {
    logger.error('Error fetching badges', { error });
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

router.post('/api/agents/:agentId/badges/:badgeId/award', validateToken, async (req, res) => {
  try {
    const agentId = req.params.agentId as string;
    const badgeId = req.params.badgeId as string;
    
    // Verify the authenticated agent matches the target agent
    if (req.agent?.id !== agentId) {
      return res.status(403).json({ error: 'Cannot award badges to other agents' });
    }
    
    const result = await badgesService.awardBadge(agentId, parseInt(badgeId), sql);
    if (!result) {
      return res.status(400).json({ error: 'Badge unavailable (already owned, supply limit reached, or does not exist)' });
    }
    res.json(result);
  } catch (error) {
    logger.error('Error awarding badge', { error });
    res.status(500).json({ error: 'Failed to award badge' });
  }
});

router.get('/api/agents/:agentId/badges', async (req, res) => {
  try {
    const agentId = req.params.agentId as string;
    const badges = await badgesService.getAgentBadges(agentId, sql);
    res.json(badges);
  } catch (error) {
    logger.error('Error fetching agent badges', { error });
    res.status(500).json({ error: 'Failed to fetch agent badges' });
  }
});

router.put('/api/agents/:agentId/badges/:badgeId/equip', validateToken, async (req, res) => {
  try {
    const agentId = req.params.agentId as string;
    const badgeId = req.params.badgeId as string;
    
    // Verify the authenticated agent matches the target agent
    if (req.agent?.id !== agentId) {
      return res.status(403).json({ error: 'Cannot equip badges for other agents' });
    }
    
    const success = await badgesService.equipBadge(agentId, parseInt(badgeId), sql);
    if (!success) {
      return res.status(400).json({ error: 'Cannot equip badge (not owned or max 3 equipped)' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Error equipping badge', { error });
    res.status(500).json({ error: 'Failed to equip badge' });
  }
});

router.put('/api/agents/:agentId/badges/:badgeId/unequip', validateToken, async (req, res) => {
  try {
    const agentId = req.params.agentId as string;
    const badgeId = req.params.badgeId as string;
    
    // Verify the authenticated agent matches the target agent
    if (req.agent?.id !== agentId) {
      return res.status(403).json({ error: 'Cannot unequip badges for other agents' });
    }
    
    const success = await badgesService.unequipBadge(agentId, parseInt(badgeId), sql);
    if (!success) {
      return res.status(404).json({ error: 'Badge not found or not owned' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Error unequipping badge', { error });
    res.status(500).json({ error: 'Failed to unequip badge' });
  }
});

router.get('/api/badges/:badgeId/holders', async (req, res) => {
  try {
    const { badgeId } = req.params;
    const holders = await badgesService.getBadgeHolders(parseInt(badgeId), sql);
    res.json(holders);
  } catch (error) {
    logger.error('Error fetching badge holders', { error });
    res.status(500).json({ error: 'Failed to fetch badge holders' });
  }
});

export default router;
