/**
 * chatHistory.routes.ts
 * REST API endpoints for room chat history
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  getRoomHistory,
  searchMessages,
  getMessageCount,
} from '../services/chatHistory.js';
import { sql } from '../db/index.js';

const router = Router();

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
 * GET /api/rooms/:roomId/chat/history
 * Get paginated chat history
 * Query params: limit (default 50), before (cursor)
 */
router.get('/api/rooms/:roomId/chat/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const roomId = req.params.roomId as string;
    const limit = parseInt(getQueryParam(req.query.limit)) || 50;
    const before = getQueryParam(req.query.before) || undefined;

    const messages = await getRoomHistory(roomId, limit, before, sql);

    res.json(messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ChatHistory] Get history failed:', message);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

/**
 * GET /api/rooms/:roomId/chat/search
 * Search messages in a room
 * Query params: q (search query)
 */
router.get('/api/rooms/:roomId/chat/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const roomId = req.params.roomId as string;
    const query = getQueryParam(req.query.q);

    if (!query) {
      res.status(400).json({ error: 'Missing search query parameter (q)' });
      return;
    }

    const messages = await searchMessages(roomId, query, sql);

    res.json(messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ChatHistory] Search failed:', message);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

/**
 * GET /api/rooms/:roomId/chat/count
 * Get total message count for a room
 */
router.get('/api/rooms/:roomId/chat/count', async (req: Request, res: Response): Promise<void> => {
  try {
    const roomId = req.params.roomId as string;

    const count = await getMessageCount(roomId, sql);

    res.json({ count });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ChatHistory] Get count failed:', message);
    res.status(500).json({ error: 'Failed to get message count' });
  }
});

export default router;
