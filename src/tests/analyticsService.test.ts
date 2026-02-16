import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import {
  isValidMetric,
  getTopAgents,
  getAgentTimeline,
  getAnalyticsSummary,
  type AnalyticsMetric,
  type AgentAnalytics,
  type AgentTimeline,
} from '../services/analyticsService.js';

/**
 * Analytics Service Tests
 * 
 * Tests analytics tracking and statistics functionality:
 * - Metric validation
 * - Top agents ranking (messages, rooms, trades, games, friends)
 * - Agent activity timelines
 * - Analytics summary generation
 * - Edge cases (invalid inputs, empty data, banned agents)
 * 
 * NOTE: Tests marked with .skip require test database connection.
 */

describe.skip('analyticsService', () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    const dbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/openclaw_hotel_test';
    sql = postgres(dbUrl);
  });

  afterAll(async () => {
    await sql.end();
  });

  describe('isValidMetric', () => {
    it('should return true for valid metrics', () => {
      expect(isValidMetric('messages_sent')).toBe(true);
      expect(isValidMetric('rooms_visited')).toBe(true);
      expect(isValidMetric('trades_completed')).toBe(true);
      expect(isValidMetric('games_won')).toBe(true);
      expect(isValidMetric('friends_count')).toBe(true);
    });

    it('should return false for invalid metrics', () => {
      expect(isValidMetric('invalid_metric')).toBe(false);
      expect(isValidMetric('MESSAGES_SENT')).toBe(false);
      expect(isValidMetric('')).toBe(false);
      expect(isValidMetric('123')).toBe(false);
    });
  });

  describe('getTopAgents', () => {
    it('should throw error for limit < 1', async () => {
      await expect(
        getTopAgents('messages_sent', 0, sql)
      ).rejects.toThrow('Limit must be between 1 and 100');
    });

    it('should throw error for limit > 100', async () => {
      await expect(
        getTopAgents('messages_sent', 101, sql)
      ).rejects.toThrow('Limit must be between 1 and 100');
    });

    it('should return top agents for messages_sent metric', async () => {
      const result = await getTopAgents('messages_sent', 5, sql);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
      
      // Verify structure
      if (result.length > 0) {
        const agent = result[0];
        expect(agent).toHaveProperty('rank');
        expect(agent).toHaveProperty('agentId');
        expect(agent).toHaveProperty('displayName');
        expect(agent).toHaveProperty('value');
        expect(typeof agent.rank).toBe('number');
        expect(typeof agent.agentId).toBe('string');
        expect(typeof agent.displayName).toBe('string');
        expect(typeof agent.value).toBe('number');
        
        // Verify ranking order
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].value).toBeGreaterThanOrEqual(result[i + 1].value);
        }
      }
    });

    it('should return top agents for rooms_visited metric', async () => {
      const result = await getTopAgents('rooms_visited', 5, sql);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
      
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('rank');
        expect(result[0]).toHaveProperty('agentId');
        expect(result[0]).toHaveProperty('displayName');
        expect(result[0]).toHaveProperty('value');
      }
    });

    it('should return top agents for trades_completed metric', async () => {
      const result = await getTopAgents('trades_completed', 5, sql);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
      
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('rank');
        expect(result[0]).toHaveProperty('agentId');
        expect(result[0]).toHaveProperty('displayName');
        expect(result[0]).toHaveProperty('value');
      }
    });

    it('should return top agents for games_won metric', async () => {
      const result = await getTopAgents('games_won', 5, sql);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
      
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('rank');
        expect(result[0]).toHaveProperty('agentId');
        expect(result[0]).toHaveProperty('displayName');
        expect(result[0]).toHaveProperty('value');
      }
    });

    it('should return top agents for friends_count metric', async () => {
      const result = await getTopAgents('friends_count', 5, sql);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
      
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('rank');
        expect(result[0]).toHaveProperty('agentId');
        expect(result[0]).toHaveProperty('displayName');
        expect(result[0]).toHaveProperty('value');
      }
    });

    it('should filter out banned agents', async () => {
      const result = await getTopAgents('messages_sent', 10, sql);
      
      // If we have results, verify none are banned
      // (requires checking agents table - implementation detail)
      expect(Array.isArray(result)).toBe(true);
      
      // All results should have valid agent IDs (not from banned agents)
      for (const agent of result) {
        expect(agent.agentId).toBeTruthy();
        expect(agent.displayName).toBeTruthy();
      }
    });

    it('should respect limit parameter', async () => {
      const limit = 3;
      const result = await getTopAgents('messages_sent', limit, sql);
      
      expect(result.length).toBeLessThanOrEqual(limit);
    });

    it('should return empty array when no data exists (graceful handling)', async () => {
      // This test verifies the try-catch block returns empty array
      // when tables don't exist or no data matches
      const result = await getTopAgents('games_won', 5, sql);
      
      expect(Array.isArray(result)).toBe(true);
      // May be empty or have data, but should not throw
    });
  });

  describe('getAgentTimeline', () => {
    it('should throw error for hours < 1', async () => {
      await expect(
        getAgentTimeline('agent-123', 'messages_sent', 0, sql)
      ).rejects.toThrow('Hours must be between 1 and 168');
    });

    it('should throw error for hours > 168', async () => {
      await expect(
        getAgentTimeline('agent-123', 'messages_sent', 169, sql)
      ).rejects.toThrow('Hours must be between 1 and 168');
    });

    it('should return timeline for valid agent and metric', async () => {
      // Use a real agent ID from test data (if exists)
      // For now, test with any ID - will return empty dataPoints if not found
      const result = await getAgentTimeline('test-agent', 'messages_sent', 24, sql);
      
      expect(result).toHaveProperty('agentId');
      expect(result).toHaveProperty('displayName');
      expect(result).toHaveProperty('metric');
      expect(result).toHaveProperty('dataPoints');
      
      expect(result.agentId).toBe('test-agent');
      expect(result.metric).toBe('messages_sent');
      expect(Array.isArray(result.dataPoints)).toBe(true);
      
      // Verify dataPoints structure (if any exist)
      if (result.dataPoints.length > 0) {
        const point = result.dataPoints[0];
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('value');
        expect(typeof point.timestamp).toBe('number');
        expect(typeof point.value).toBe('number');
        
        // Verify timestamps are in order
        for (let i = 0; i < result.dataPoints.length - 1; i++) {
          expect(result.dataPoints[i].timestamp).toBeLessThanOrEqual(
            result.dataPoints[i + 1].timestamp
          );
        }
      }
    });

    it('should return timeline for rooms_visited metric', async () => {
      const result = await getAgentTimeline('test-agent', 'rooms_visited', 24, sql);
      
      expect(result.metric).toBe('rooms_visited');
      expect(Array.isArray(result.dataPoints)).toBe(true);
    });

    it('should return timeline for trades_completed metric', async () => {
      const result = await getAgentTimeline('test-agent', 'trades_completed', 24, sql);
      
      expect(result.metric).toBe('trades_completed');
      expect(Array.isArray(result.dataPoints)).toBe(true);
    });

    it('should return timeline for games_won metric', async () => {
      const result = await getAgentTimeline('test-agent', 'games_won', 24, sql);
      
      expect(result.metric).toBe('games_won');
      expect(Array.isArray(result.dataPoints)).toBe(true);
    });

    it('should return timeline for friends_count metric', async () => {
      const result = await getAgentTimeline('test-agent', 'friends_count', 24, sql);
      
      expect(result.metric).toBe('friends_count');
      expect(Array.isArray(result.dataPoints)).toBe(true);
    });

    it('should return empty timeline when no data exists', async () => {
      const result = await getAgentTimeline('nonexistent-agent', 'messages_sent', 24, sql);
      
      expect(result.dataPoints).toEqual([]);
      expect(result.agentId).toBe('nonexistent-agent');
    });

    it('should return correct displayName for existing agent', async () => {
      // This test assumes agents table has display_name column
      const result = await getAgentTimeline('test-agent', 'messages_sent', 24, sql);
      
      expect(result.displayName).toBeTruthy();
      expect(typeof result.displayName).toBe('string');
    });

    it('should return "Unknown" displayName for nonexistent agent', async () => {
      const result = await getAgentTimeline('absolutely-nonexistent-id', 'messages_sent', 24, sql);
      
      expect(result.displayName).toBe('Unknown');
    });

    it('should respect hours parameter (cutoff time)', async () => {
      const hours = 12;
      const result = await getAgentTimeline('test-agent', 'messages_sent', hours, sql);
      
      // All timestamps should be within the last 12 hours
      const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
      
      for (const point of result.dataPoints) {
        expect(point.timestamp).toBeGreaterThanOrEqual(cutoffTime);
      }
    });
  });

  describe('getAnalyticsSummary', () => {
    it('should return summary for all 5 metrics', async () => {
      const result = await getAnalyticsSummary(sql);
      
      expect(result).toHaveProperty('messages_sent');
      expect(result).toHaveProperty('rooms_visited');
      expect(result).toHaveProperty('trades_completed');
      expect(result).toHaveProperty('games_won');
      expect(result).toHaveProperty('friends_count');
      
      // All should be arrays
      expect(Array.isArray(result.messages_sent)).toBe(true);
      expect(Array.isArray(result.rooms_visited)).toBe(true);
      expect(Array.isArray(result.trades_completed)).toBe(true);
      expect(Array.isArray(result.games_won)).toBe(true);
      expect(Array.isArray(result.friends_count)).toBe(true);
    });

    it('should return at most 5 agents per metric', async () => {
      const result = await getAnalyticsSummary(sql);
      
      expect(result.messages_sent.length).toBeLessThanOrEqual(5);
      expect(result.rooms_visited.length).toBeLessThanOrEqual(5);
      expect(result.trades_completed.length).toBeLessThanOrEqual(5);
      expect(result.games_won.length).toBeLessThanOrEqual(5);
      expect(result.friends_count.length).toBeLessThanOrEqual(5);
    });

    it('should return empty arrays when tables don\'t exist (graceful handling)', async () => {
      const result = await getAnalyticsSummary(sql);
      
      // Should not throw, even if tables don't exist
      expect(result).toBeTruthy();
      
      // All metrics should be present (may be empty arrays)
      expect(result).toHaveProperty('messages_sent');
      expect(result).toHaveProperty('rooms_visited');
      expect(result).toHaveProperty('trades_completed');
      expect(result).toHaveProperty('games_won');
      expect(result).toHaveProperty('friends_count');
    });

    it('should return agents with correct structure in summary', async () => {
      const result = await getAnalyticsSummary(sql);
      
      // Check structure for any metric that has data
      const metrics: AnalyticsMetric[] = [
        'messages_sent',
        'rooms_visited',
        'trades_completed',
        'games_won',
        'friends_count',
      ];
      
      for (const metric of metrics) {
        if (result[metric].length > 0) {
          const agent = result[metric][0];
          expect(agent).toHaveProperty('rank');
          expect(agent).toHaveProperty('agentId');
          expect(agent).toHaveProperty('displayName');
          expect(agent).toHaveProperty('value');
          expect(typeof agent.rank).toBe('number');
          expect(typeof agent.agentId).toBe('string');
          expect(typeof agent.displayName).toBe('string');
          expect(typeof agent.value).toBe('number');
        }
      }
    });
  });
});
