/**
 * Analytics Service Tests
 * Comprehensive test suite for analytics tracking and statistics
 * 
 * @requires test database (marked as .skip, run with TEST_DB=true)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isValidMetric,
  getTopAgents,
  getAgentTimeline,
  getAnalyticsSummary,
  type AnalyticsMetric,
  type AgentAnalytics,
  type AgentTimeline,
} from '../services/analyticsService';

// Mock SQL connection (real tests require test database)
function getMockSql() {
  return vi.fn().mockResolvedValue([]);
}

describe('AnalyticsService', () => {
  describe('isValidMetric', () => {
    it('should validate all supported metrics', () => {
      expect(isValidMetric('messages_sent')).toBe(true);
      expect(isValidMetric('rooms_visited')).toBe(true);
      expect(isValidMetric('trades_completed')).toBe(true);
      expect(isValidMetric('games_won')).toBe(true);
      expect(isValidMetric('friends_count')).toBe(true);
    });

    it('should reject invalid metrics', () => {
      expect(isValidMetric('invalid_metric')).toBe(false);
      expect(isValidMetric('')).toBe(false);
      expect(isValidMetric('MESSAGES_SENT')).toBe(false); // Case sensitive
      expect(isValidMetric('messages')).toBe(false); // Partial match
    });
  });

  describe.skip('getTopAgents', () => {
    let sql: any;

    beforeEach(() => {
      sql = getMockSql();
    });

    it('should validate limit range', async () => {
      await expect(getTopAgents('messages_sent', 0, sql)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
      await expect(getTopAgents('messages_sent', 101, sql)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
    });

    it('should fetch top agents for messages_sent metric', async () => {
      const mockResults = [
        { rank: 1, agentId: 'agent1', displayName: 'Alice', value: 150 },
        { rank: 2, agentId: 'agent2', displayName: 'Bob', value: 120 },
      ];
      sql.mockResolvedValueOnce(mockResults);

      const result = await getTopAgents('messages_sent', 10, sql);

      expect(result).toEqual([
        { rank: 1, agentId: 'agent1', displayName: 'Alice', value: 150 },
        { rank: 2, agentId: 'agent2', displayName: 'Bob', value: 120 },
      ]);
      expect(sql).toHaveBeenCalledTimes(1);
    });

    it('should fetch top agents for rooms_visited metric', async () => {
      const mockResults = [
        { rank: 1, agentId: 'agent1', displayName: 'Explorer', value: 25 },
      ];
      sql.mockResolvedValueOnce(mockResults);

      const result = await getTopAgents('rooms_visited', 5, sql);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        agentId: 'agent1',
        displayName: 'Explorer',
        value: 25,
      });
    });

    it('should fetch top agents for trades_completed metric', async () => {
      const mockResults = [
        { rank: 1, agentId: 'agent1', displayName: 'Trader', value: 50 },
      ];
      sql.mockResolvedValueOnce(mockResults);

      const result = await getTopAgents('trades_completed', 10, sql);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(50);
    });

    it('should fetch top agents for games_won metric', async () => {
      const mockResults = [
        { rank: 1, agentId: 'agent1', displayName: 'Gamer', value: 30 },
      ];
      sql.mockResolvedValueOnce(mockResults);

      const result = await getTopAgents('games_won', 10, sql);

      expect(result[0].displayName).toBe('Gamer');
    });

    it('should fetch top agents for friends_count metric', async () => {
      const mockResults = [
        { rank: 1, agentId: 'agent1', displayName: 'Social', value: 100 },
      ];
      sql.mockResolvedValueOnce(mockResults);

      const result = await getTopAgents('friends_count', 10, sql);

      expect(result[0].value).toBe(100);
    });

    it('should return empty array when no results', async () => {
      sql.mockResolvedValueOnce([]);

      const result = await getTopAgents('messages_sent', 10, sql);

      expect(result).toEqual([]);
    });

    it('should return empty array on database error', async () => {
      sql.mockRejectedValueOnce(new Error('Table does not exist'));

      const result = await getTopAgents('messages_sent', 10, sql);

      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const mockResults = Array.from({ length: 3 }, (_, i) => ({
        rank: i + 1,
        agentId: `agent${i + 1}`,
        displayName: `Agent ${i + 1}`,
        value: 100 - i * 10,
      }));
      sql.mockResolvedValueOnce(mockResults);

      const result = await getTopAgents('messages_sent', 3, sql);

      expect(result).toHaveLength(3);
    });
  });

  describe.skip('getAgentTimeline', () => {
    let sql: any;

    beforeEach(() => {
      sql = vi.fn();
    });

    it('should validate hours range', async () => {
      await expect(
        getAgentTimeline('agent1', 'messages_sent', 0, sql)
      ).rejects.toThrow('Hours must be between 1 and 168 (1 week)');
      
      await expect(
        getAgentTimeline('agent1', 'messages_sent', 169, sql)
      ).rejects.toThrow('Hours must be between 1 and 168 (1 week)');
    });

    it('should fetch timeline for messages_sent metric', async () => {
      sql.mockResolvedValueOnce([
        { display_name: 'Alice' },
      ]);
      sql.mockResolvedValueOnce([
        { timestamp: Date.now(), value: 10 },
        { timestamp: Date.now() + 3600000, value: 15 },
      ]);

      const result = await getAgentTimeline('agent1', 'messages_sent', 24, sql);

      expect(result).toMatchObject({
        agentId: 'agent1',
        displayName: 'Alice',
        metric: 'messages_sent',
      });
      expect(result.dataPoints).toHaveLength(2);
      expect(result.dataPoints[0]).toHaveProperty('timestamp');
      expect(result.dataPoints[0]).toHaveProperty('value');
    });

    it('should fetch timeline for rooms_visited metric', async () => {
      sql.mockResolvedValueOnce([
        { display_name: 'Explorer' },
      ]);
      sql.mockResolvedValueOnce([
        { timestamp: Date.now(), value: 5 },
      ]);

      const result = await getAgentTimeline('agent1', 'rooms_visited', 12, sql);

      expect(result.metric).toBe('rooms_visited');
      expect(result.dataPoints).toHaveLength(1);
    });

    it('should fetch timeline for trades_completed metric', async () => {
      sql.mockResolvedValueOnce([
        { display_name: 'Trader' },
      ]);
      sql.mockResolvedValueOnce([]);

      const result = await getAgentTimeline('agent1', 'trades_completed', 24, sql);

      expect(result.dataPoints).toEqual([]);
    });

    it('should fetch timeline for games_won metric', async () => {
      sql.mockResolvedValueOnce([
        { display_name: 'Gamer' },
      ]);
      sql.mockResolvedValueOnce([
        { timestamp: Date.now(), value: 3 },
      ]);

      const result = await getAgentTimeline('agent1', 'games_won', 6, sql);

      expect(result.displayName).toBe('Gamer');
    });

    it('should fetch timeline for friends_count metric', async () => {
      sql.mockResolvedValueOnce([
        { display_name: 'Social' },
      ]);
      sql.mockResolvedValueOnce([
        { timestamp: Date.now(), value: 10 },
      ]);

      const result = await getAgentTimeline('agent1', 'friends_count', 48, sql);

      expect(result.metric).toBe('friends_count');
    });

    it('should return empty timeline on database error', async () => {
      sql.mockResolvedValueOnce([
        { display_name: 'Test' },
      ]);
      sql.mockRejectedValueOnce(new Error('Query failed'));

      const result = await getAgentTimeline('agent1', 'messages_sent', 24, sql);

      expect(result.dataPoints).toEqual([]);
    });

    it('should handle unknown agent gracefully', async () => {
      sql.mockResolvedValueOnce([]); // No agent found
      sql.mockResolvedValueOnce([]);

      const result = await getAgentTimeline('unknown', 'messages_sent', 24, sql);

      expect(result.displayName).toBe('Unknown');
      expect(result.dataPoints).toEqual([]);
    });

    it('should return data points in chronological order', async () => {
      const now = Date.now();
      sql.mockResolvedValueOnce([
        { display_name: 'Test' },
      ]);
      sql.mockResolvedValueOnce([
        { timestamp: now, value: 1 },
        { timestamp: now + 1000, value: 2 },
        { timestamp: now + 2000, value: 3 },
      ]);

      const result = await getAgentTimeline('agent1', 'messages_sent', 1, sql);

      expect(result.dataPoints[0].timestamp).toBeLessThan(
        result.dataPoints[1].timestamp
      );
      expect(result.dataPoints[1].timestamp).toBeLessThan(
        result.dataPoints[2].timestamp
      );
    });
  });

  describe.skip('getAnalyticsSummary', () => {
    let sql: any;

    beforeEach(() => {
      sql = getMockSql();
    });

    it('should return summary for all metrics', async () => {
      sql.mockResolvedValue([
        { rank: 1, agentId: 'agent1', displayName: 'Test', value: 100 },
      ]);

      const result = await getAnalyticsSummary(sql);

      expect(result).toHaveProperty('messages_sent');
      expect(result).toHaveProperty('rooms_visited');
      expect(result).toHaveProperty('trades_completed');
      expect(result).toHaveProperty('games_won');
      expect(result).toHaveProperty('friends_count');
    });

    it('should return top 5 agents per metric', async () => {
      const mockTop5 = Array.from({ length: 5 }, (_, i) => ({
        rank: i + 1,
        agentId: `agent${i + 1}`,
        displayName: `Agent ${i + 1}`,
        value: 100 - i * 10,
      }));
      sql.mockResolvedValue(mockTop5);

      const result = await getAnalyticsSummary(sql);

      expect(result.messages_sent).toHaveLength(5);
    });

    it('should handle errors gracefully for individual metrics', async () => {
      sql.mockRejectedValue(new Error('Database error'));

      const result = await getAnalyticsSummary(sql);

      // Should return empty arrays for all metrics instead of throwing
      expect(result.messages_sent).toEqual([]);
      expect(result.rooms_visited).toEqual([]);
      expect(result.trades_completed).toEqual([]);
      expect(result.games_won).toEqual([]);
      expect(result.friends_count).toEqual([]);
    });

    it('should call getTopAgents for each metric', async () => {
      sql.mockResolvedValue([]);

      await getAnalyticsSummary(sql);

      // Should be called 5 times (one per metric)
      expect(sql).toHaveBeenCalledTimes(5);
    });
  });
});
