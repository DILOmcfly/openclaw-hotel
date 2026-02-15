import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import {
  sendMail,
  getInbox,
  getSentMail,
  readMail,
  deleteMail,
  getUnreadCount,
} from '../services/mail.js';

const router = express.Router();

/**
 * POST /api/mail
 * Send mail to another agent
 */
router.post('/api/mail', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { recipientId, subject, body } = req.body;

    if (!recipientId || !subject || !body) {
      return res.status(400).json({ error: 'recipientId, subject, and body are required' });
    }

    const mail = await sendMail(agentId, recipientId, subject, body, sql);

    logger.info('Mail sent', {
      mailId: mail.id,
      senderId: agentId,
      recipientId,
    });

    res.json({ success: true, mail });
  } catch (error: any) {
    logger.error('Failed to send mail', { error });
    res.status(400).json({ error: error.message || 'Failed to send mail' });
  }
});

/**
 * GET /api/mail/inbox
 * Get inbox for authenticated agent
 */
router.get('/api/mail/inbox', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const mails = await getInbox(agentId, limit, offset, sql);

    res.json({ mails });
  } catch (error: any) {
    logger.error('Failed to fetch inbox', { error });
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

/**
 * GET /api/mail/sent
 * Get sent mail for authenticated agent
 */
router.get('/api/mail/sent', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const mails = await getSentMail(agentId, limit, offset, sql);

    res.json({ mails });
  } catch (error: any) {
    logger.error('Failed to fetch sent mail', { error });
    res.status(500).json({ error: 'Failed to fetch sent mail' });
  }
});

/**
 * PUT /api/mail/:id/read
 * Mark mail as read
 */
router.put('/api/mail/:id/read', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await readMail(id, agentId, sql);

    logger.info('Mail marked as read', {
      mailId: id,
      agentId,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to mark mail as read', { error });
    res.status(400).json({ error: error.message || 'Failed to mark mail as read' });
  }
});

/**
 * DELETE /api/mail/:id
 * Delete mail
 */
router.delete('/api/mail/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await deleteMail(id, agentId, sql);

    logger.info('Mail deleted', {
      mailId: id,
      agentId,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete mail', { error });
    res.status(400).json({ error: error.message || 'Failed to delete mail' });
  }
});

/**
 * GET /api/mail/unread
 * Get unread mail count
 */
router.get('/api/mail/unread', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const count = await getUnreadCount(agentId, sql);

    res.json({ count });
  } catch (error: any) {
    logger.error('Failed to fetch unread count', { error });
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

export default router;
