/**
 * Analytics API Routes
 * Endpoints for agent activity statistics and timelines
 */
import express from 'express';
import { sql } from '../db/index.js';
import * as analyticsService from '../services/analyticsService.js';

const router = express.Router();

/**
 * GET /api/analytics/agents?metric=messages_sent&limit=10
 * Get top agents for a specific metric
 */
router.get('/api/analytics/agents', async (req, res) => {
  try {
    const { metric, limit } = req.query;

    if (!metric || typeof metric !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required query parameter: metric' 
      });
    }

    if (!analyticsService.isValidMetric(metric)) {
      return res.status(400).json({ 
        error: 'Invalid metric. Must be one of: messages_sent, rooms_visited, trades_completed, games_won, friends_count' 
      });
    }

    const parsedLimit = Math.min(parseInt(limit as string) || 10, 100);

    const topAgents = await analyticsService.getTopAgents(
      metric as analyticsService.AnalyticsMetric,
      parsedLimit,
      sql
    );

    res.json({
      metric,
      limit: parsedLimit,
      agents: topAgents,
    });
  } catch (error) {
    console.error('[Analytics API] Error fetching top agents:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch analytics';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/analytics/agents/:id/timeline?metric=messages_sent&hours=24
 * Get agent activity timeline over time
 */
router.get('/api/analytics/agents/:id/timeline', async (req, res) => {
  try {
    const { id } = req.params;
    const { metric, hours } = req.query;

    if (!metric || typeof metric !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required query parameter: metric' 
      });
    }

    if (!analyticsService.isValidMetric(metric)) {
      return res.status(400).json({ 
        error: 'Invalid metric. Must be one of: messages_sent, rooms_visited, trades_completed, games_won, friends_count' 
      });
    }

    const parsedHours = Math.min(parseInt(hours as string) || 24, 168);

    const timeline = await analyticsService.getAgentTimeline(
      id,
      metric as analyticsService.AnalyticsMetric,
      parsedHours,
      sql
    );

    res.json(timeline);
  } catch (error) {
    console.error('[Analytics API] Error fetching timeline:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch timeline';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/analytics/summary
 * Get analytics summary (top 5 agents across all metrics)
 */
router.get('/api/analytics/summary', async (req, res) => {
  try {
    const summary = await analyticsService.getAnalyticsSummary(sql);
    res.json(summary);
  } catch (error) {
    console.error('[Analytics API] Error fetching summary:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch summary';
    res.status(500).json({ error: message });
  }
});

export default router;
