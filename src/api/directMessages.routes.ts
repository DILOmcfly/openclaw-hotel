/**
 * directMessages.routes.ts
 * REST API endpoints for whisper/DM system
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { DirectMessageService } from '../services/directMessages.js';
import { validateToken } from '../services/auth.js';
import { sql } from '../db/index.js';

const router = Router();
const dmService = new DirectMessageService(sql);

// Helper to safely extract string from query param
function getQueryParam(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return String(value);
}

/**
 * POST /api/messages/send
 * Send a direct message (whisper)
 * Body: { recipientId: string, content: string }
 */
router.post('/api/messages/send', async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { agentId: senderId } = validateToken(token);
      const { recipientId, content } = req.body;

      if (!recipientId || !content) {
        res.status(400).json({ error: 'Missing recipientId or content' });
        return;
      }

      const message = await dmService.sendMessage(senderId, recipientId, content);

      res.json(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DirectMessages] Send failed:', message);
      
      if (message.includes('not friends')) {
        res.status(403).json({ error: message });
      } else if (message.includes('characters')) {
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to send message' });
      }
    }
  });

/**
 * GET /api/messages/conversation/:otherAgentId
 * Get conversation history with another agent
 */
router.get('/api/messages/conversation/:otherAgentId', async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { agentId } = validateToken(token);
      const otherAgentId = req.params.otherAgentId as string;
      const limit = parseInt(getQueryParam(req.query.limit)) || 50;

      const messages = await dmService.getConversation(agentId, otherAgentId, limit);

      res.json(messages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DirectMessages] Get conversation failed:', message);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

/**
 * GET /api/messages/inbox
 * Get conversation previews (list of recent conversations)
 */
router.get('/api/messages/inbox', async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { agentId } = validateToken(token);

      const previews = await dmService.getConversationPreviews(agentId);

      res.json(previews);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DirectMessages] Get inbox failed:', message);
      res.status(500).json({ error: 'Failed to fetch inbox' });
    }
  });

/**
 * PUT /api/messages/mark-read/:senderId
 * Mark messages from a sender as read
 */
router.put('/api/messages/mark-read/:senderId', async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { agentId: recipientId } = validateToken(token);
      const senderId = req.params.senderId as string;

      const count = await dmService.markAsRead(recipientId, senderId);

      res.json({ markedAsRead: count });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DirectMessages] Mark as read failed:', message);
      res.status(500).json({ error: 'Failed to mark messages as read' });
    }
  });

/**
 * GET /api/messages/unread-count
 * Get unread message count
 */
router.get('/api/messages/unread-count', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { agentId } = validateToken(token);

    const count = await dmService.getUnreadCount(agentId);

    res.json({ unreadCount: count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DirectMessages] Get unread count failed:', message);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

export default router;
