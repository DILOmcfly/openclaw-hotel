import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { requireRole } from '../middleware/admin.js';
import { logger } from '../utils/logger.js';
import {
  createReport,
  getReportsByStatus,
  getPendingCount,
  resolveReport,
  type ReportReason,
  type ReportStatus,
} from '../services/reports.js';

const router = express.Router();

/**
 * POST /api/reports
 * Create a new report (authenticated agents)
 */
router.post('/api/reports', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { reportedId, reason, description, roomId } = req.body;

    if (!reportedId || !reason) {
      return res.status(400).json({ error: 'reportedId and reason are required' });
    }

    const validReasons: ReportReason[] = ['spam', 'harassment', 'inappropriate', 'cheating', 'impersonation', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid reason' });
    }

    const report = await createReport(
      agentId,
      reportedId,
      reason,
      description || '',
      roomId || null,
      sql
    );

    logger.info('Report created', {
      reportId: report.id,
      reporterId: agentId,
      reportedId,
      reason,
    });

    res.json({ success: true, report });
  } catch (error: any) {
    logger.error('Failed to create report', { error });
    res.status(400).json({ error: error.message || 'Failed to create report' });
  }
});

/**
 * GET /api/reports
 * List reports with optional status filter (admin/moderator only)
 */
router.get('/api/reports', requireRole('moderator'), async (req, res) => {
  try {
    const status = req.query.status as ReportStatus | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (status) {
      const validStatuses: ReportStatus[] = ['pending', 'reviewed', 'resolved', 'dismissed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
    }

    const reports = await getReportsByStatus(status || null, limit, offset, sql);

    res.json({ reports });
  } catch (error: any) {
    logger.error('Failed to fetch reports', { error });
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/**
 * GET /api/reports/pending/count
 * Get count of pending reports (admin/moderator only)
 */
router.get('/api/reports/pending/count', requireRole('moderator'), async (req, res) => {
  try {
    const count = await getPendingCount(sql);

    res.json({ count });
  } catch (error: any) {
    logger.error('Failed to fetch pending count', { error });
    res.status(500).json({ error: 'Failed to fetch pending count' });
  }
});

/**
 * PUT /api/reports/:id/resolve
 * Resolve a report (admin/moderator only)
 */
router.put('/api/reports/:id/resolve', requireRole('moderator'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { status, note } = req.body;
    const agentId = (req as any).agentId as string; // Set by requireRole middleware

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const validStatuses = ['reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be reviewed, resolved, or dismissed' });
    }

    await resolveReport(id, agentId, status, note || '', sql);

    logger.info('Report resolved', {
      reportId: id,
      resolvedBy: agentId,
      status,
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to resolve report', { error });
    res.status(400).json({ error: error.message || 'Failed to resolve report' });
  }
});

export default router;
