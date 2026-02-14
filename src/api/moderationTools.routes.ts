import express from 'express';
import { requireRole } from '../middleware/admin.js';
import * as modTools from '../services/moderationTools.js';

const router = express.Router();

// Helper to safely extract string from param
function getParam(value: any): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return '';
}

/**
 * POST /api/moderation/mute
 * Mute an agent (moderator+)
 */
router.post('/mute', requireRole('moderator'), async (req, res) => {
  try {
    const { agentId, durationMinutes, reason } = req.body;

    if (!agentId || typeof durationMinutes !== 'number' || durationMinutes <= 0) {
      return res.status(400).json({ error: 'Invalid agentId or durationMinutes' });
    }

    const moderatorId = (req as any).agentId!;
    const action = await modTools.muteAgent(agentId, moderatorId, durationMinutes, reason || 'No reason provided');

    res.json({ action });
  } catch (error) {
    console.error('Mute agent error:', error);
    res.status(500).json({ error: 'Failed to mute agent' });
  }
});

/**
 * POST /api/moderation/unmute
 * Unmute an agent (moderator+)
 */
router.post('/unmute', requireRole('moderator'), async (req, res) => {
  try {
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'Missing agentId' });
    }

    await modTools.unmuteAgent(agentId);
    res.json({ success: true });
  } catch (error) {
    console.error('Unmute agent error:', error);
    res.status(500).json({ error: 'Failed to unmute agent' });
  }
});

/**
 * GET /api/moderation/mute-status/:agentId
 * Check if an agent is muted
 */
router.get('/mute-status/:agentId', requireRole('moderator'), async (req, res) => {
  try {
    const agentId = getParam(req.params.agentId);
    const muted = await modTools.isAgentMuted(agentId);
    const muteDetails = muted ? await modTools.getActiveMute(agentId) : null;

    res.json({ muted, muteDetails });
  } catch (error) {
    console.error('Mute status error:', error);
    res.status(500).json({ error: 'Failed to get mute status' });
  }
});

/**
 * POST /api/moderation/ip-ban
 * Ban an IP address (admin only)
 */
router.post('/ip-ban', requireRole('admin'), async (req, res) => {
  try {
    const { ipAddress, durationMinutes, reason } = req.body;

    if (!ipAddress) {
      return res.status(400).json({ error: 'Missing ipAddress' });
    }

    const moderatorId = (req as any).agentId!;
    const action = await modTools.banIP(
      ipAddress,
      moderatorId,
      reason || 'No reason provided',
      durationMinutes || null
    );

    res.json({ action });
  } catch (error) {
    console.error('IP ban error:', error);
    res.status(500).json({ error: 'Failed to ban IP' });
  }
});

/**
 * GET /api/moderation/ip-ban-status/:ip
 * Check if an IP is banned (admin only)
 */
router.get('/ip-ban-status/:ip', requireRole('admin'), async (req, res) => {
  try {
    const ip = getParam(req.params.ip);
    const banned = await modTools.isIPBanned(ip);

    res.json({ banned });
  } catch (error) {
    console.error('IP ban status error:', error);
    res.status(500).json({ error: 'Failed to check IP ban status' });
  }
});

/**
 * POST /api/moderation/filter
 * Add a word filter (admin only)
 */
router.post('/filter', requireRole('admin'), async (req, res) => {
  try {
    const { pattern, severity, action, autoMuteDurationMinutes } = req.body;

    if (!pattern || !severity || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['low', 'medium', 'high'].includes(severity)) {
      return res.status(400).json({ error: 'Invalid severity' });
    }

    if (!['flag', 'block', 'auto_mute'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const createdBy = (req as any).agentId!;
    const filter = await modTools.addWordFilter(
      pattern,
      severity,
      action,
      autoMuteDurationMinutes || null,
      createdBy
    );

    res.json({ filter });
  } catch (error) {
    console.error('Add filter error:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to add filter' });
  }
});

/**
 * GET /api/moderation/filters
 * Get all word filters (moderator+)
 */
router.get('/filters', requireRole('moderator'), async (_req, res) => {
  try {
    const filters = await modTools.getWordFilters();
    res.json({ filters });
  } catch (error) {
    console.error('Get filters error:', error);
    res.status(500).json({ error: 'Failed to get filters' });
  }
});

/**
 * DELETE /api/moderation/filter/:filterId
 * Delete a word filter (admin only)
 */
router.delete('/filter/:filterId', requireRole('admin'), async (req, res) => {
  try {
    const filterId = getParam(req.params.filterId);
    await modTools.deleteWordFilter(filterId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete filter error:', error);
    res.status(500).json({ error: 'Failed to delete filter' });
  }
});

/**
 * GET /api/moderation/history/:agentId
 * Get moderation history for an agent (moderator+)
 */
router.get('/history/:agentId', requireRole('moderator'), async (req, res) => {
  try {
    const agentId = getParam(req.params.agentId);
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await modTools.getModerationHistory(agentId, limit);
    res.json({ history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get moderation history' });
  }
});

export default router;
