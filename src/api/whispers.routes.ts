import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as whispersService from '../services/whispers.js';

const router = express.Router();

router.post('/api/whispers', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const { receiverId, message } = req.body;
    if (!receiverId || !message) {
      return res.status(400).json({ error: 'receiverId and message are required' });
    }
    const whisper = await whispersService.sendWhisper(agentId, receiverId, message, sql);
    res.json({ success: true, whisper });
  } catch (error: any) {
    console.error('[Whispers API] Error sending whisper:', error);
    res.status(400).json({ error: error.message || 'Failed to send whisper' });
  }
});

router.get('/api/agents/:agentId/whispers/:otherId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId, otherId } = req.params;
    if (tokenAgentId !== agentId) return res.status(403).json({ error: 'Forbidden' });
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const conversation = await whispersService.getConversation(agentId, otherId, limit, offset, sql);
    res.json({ conversation });
  } catch (error) {
    console.error('[Whispers API] Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

router.get('/api/agents/:agentId/whispers/inbox', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId } = req.params;
    if (tokenAgentId !== agentId) return res.status(403).json({ error: 'Forbidden' });
    const inbox = await whispersService.getInbox(agentId, sql);
    res.json({ inbox });
  } catch (error) {
    console.error('[Whispers API] Error fetching inbox:', error);
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

router.put('/api/whispers/:id/read', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const whisperId = parseInt(req.params.id);
    await whispersService.markRead(whisperId, agentId, sql);
    res.json({ success: true });
  } catch (error) {
    console.error('[Whispers API] Error marking read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.delete('/api/whispers/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const whisperId = parseInt(req.params.id);
    await whispersService.deleteMessage(whisperId, agentId, sql);
    res.json({ success: true });
  } catch (error) {
    console.error('[Whispers API] Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

router.post('/api/agents/:agentId/block/:targetId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId, targetId } = req.params;
    if (tokenAgentId !== agentId) return res.status(403).json({ error: 'Forbidden' });
    const { reason } = req.body;
    await whispersService.blockAgent(agentId, targetId, reason || '', sql);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Whispers API] Error blocking agent:', error);
    res.status(400).json({ error: error.message || 'Failed to block agent' });
  }
});

router.delete('/api/agents/:agentId/block/:targetId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId, targetId } = req.params;
    if (tokenAgentId !== agentId) return res.status(403).json({ error: 'Forbidden' });
    await whispersService.unblockAgent(agentId, targetId, sql);
    res.json({ success: true });
  } catch (error) {
    console.error('[Whispers API] Error unblocking agent:', error);
    res.status(500).json({ error: 'Failed to unblock agent' });
  }
});

router.get('/api/agents/:agentId/blocked', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId } = req.params;
    if (tokenAgentId !== agentId) return res.status(403).json({ error: 'Forbidden' });
    const blockedAgents = await whispersService.getBlockList(agentId, sql);
    res.json({ blockedAgents });
  } catch (error) {
    console.error('[Whispers API] Error fetching block list:', error);
    res.status(500).json({ error: 'Failed to fetch block list' });
  }
});

router.get('/api/agents/:agentId/whispers/unread', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId } = req.params;
    if (tokenAgentId !== agentId) return res.status(403).json({ error: 'Forbidden' });
    const unreadCount = await whispersService.getUnreadCount(agentId, sql);
    res.json({ unreadCount });
  } catch (error) {
    console.error('[Whispers API] Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

export default router;
