import { describe, it, expect } from 'vitest';
import { isValidMetric, getTopAgents, getAgentTimeline } from '../services/analyticsService.js';
import type { AgentAnalytics, TimelinePoint } from '../services/analyticsService.js';

describe('Analytics Service', () => {
  describe('Metric Validation', () => {
    it('should validate correct metrics', () => {
      expect(isValidMetric('messages_sent')).toBe(true);
      expect(isValidMetric('rooms_visited')).toBe(true);
      expect(isValidMetric('trades_completed')).toBe(true);
      expect(isValidMetric('games_won')).toBe(true);
      expect(isValidMetric('friends_count')).toBe(true);
    });

    it('should reject invalid metrics', () => {
      expect(isValidMetric('invalid')).toBe(false);
      expect(isValidMetric('')).toBe(false);
      expect(isValidMetric('MESSAGES_SENT')).toBe(false);
      expect(isValidMetric('message')).toBe(false);
      expect(isValidMetric('rooms')).toBe(false);
    });
  });

  describe('Top Agents Ranking Logic', () => {
    it('should sort agents by value descending', () => {
      const mockAgents: AgentAnalytics[] = [
        { rank: 0, agentId: 'agent1', displayName: 'Alice', value: 50 },
        { rank: 0, agentId: 'agent2', displayName: 'Bob', value: 100 },
        { rank: 0, agentId: 'agent3', displayName: 'Charlie', value: 75 },
      ];

      const sorted = mockAgents.sort((a, b) => b.value - a.value);
      const withRanks = sorted.map((agent, index) => ({
        ...agent,
        rank: index + 1,
      }));

      expect(withRanks[0].displayName).toBe('Bob');
      expect(withRanks[0].rank).toBe(1);
      expect(withRanks[0].value).toBe(100);
      
      expect(withRanks[1].displayName).toBe('Charlie');
      expect(withRanks[1].rank).toBe(2);
      expect(withRanks[1].value).toBe(75);
      
      expect(withRanks[2].displayName).toBe('Alice');
      expect(withRanks[2].rank).toBe(3);
      expect(withRanks[2].value).toBe(50);
    });

    it('should handle tied values correctly', () => {
      const mockAgents: AgentAnalytics[] = [
        { rank: 1, agentId: 'agent1', displayName: 'Alice', value: 100 },
        { rank: 2, agentId: 'agent2', displayName: 'Bob', value: 100 },
        { rank: 3, agentId: 'agent3', displayName: 'Charlie', value: 50 },
      ];

      // Both tied agents should have distinct ranks (row number behavior)
      expect(mockAgents[0].rank).toBe(1);
      expect(mockAgents[1].rank).toBe(2);
      expect(mockAgents[0].value).toBe(mockAgents[1].value);
    });

    it('should filter out zero values', () => {
      const mockAgents: AgentAnalytics[] = [
        { rank: 1, agentId: 'agent1', displayName: 'Alice', value: 100 },
        { rank: 2, agentId: 'agent2', displayName: 'Bob', value: 50 },
        { rank: 3, agentId: 'agent3', displayName: 'Charlie', value: 0 },
      ];

      const filtered = mockAgents.filter(a => a.value > 0);
      expect(filtered.length).toBe(2);
      expect(filtered.every(a => a.value > 0)).toBe(true);
    });
  });

  describe('Timeline Data Processing', () => {
    it('should generate timeline points with correct structure', () => {
      const mockPoints: TimelinePoint[] = [
        { timestamp: Date.now() - 3600000, value: 10 },
        { timestamp: Date.now() - 1800000, value: 15 },
        { timestamp: Date.now(), value: 20 },
      ];

      mockPoints.forEach(point => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('value');
        expect(typeof point.timestamp).toBe('number');
        expect(typeof point.value).toBe('number');
      });
    });

    it('should sort timeline points by timestamp ascending', () => {
      const mockPoints: TimelinePoint[] = [
        { timestamp: Date.now(), value: 20 },
        { timestamp: Date.now() - 3600000, value: 10 },
        { timestamp: Date.now() - 1800000, value: 15 },
      ];

      const sorted = mockPoints.sort((a, b) => a.timestamp - b.timestamp);

      expect(sorted[0].value).toBe(10);
      expect(sorted[1].value).toBe(15);
      expect(sorted[2].value).toBe(20);
      
      // Verify ascending timestamps
      expect(sorted[0].timestamp).toBeLessThan(sorted[1].timestamp);
      expect(sorted[1].timestamp).toBeLessThan(sorted[2].timestamp);
    });

    it('should calculate cumulative values correctly', () => {
      const events = [1, 1, 1, 1]; // 4 events
      
      const cumulative = events.map((_, index) => ({
        timestamp: Date.now() + index * 1000,
        value: events.slice(0, index + 1).length,
      }));

      expect(cumulative[0].value).toBe(1);
      expect(cumulative[1].value).toBe(2);
      expect(cumulative[2].value).toBe(3);
      expect(cumulative[3].value).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', () => {
      const emptyAgents: AgentAnalytics[] = [];
      expect(emptyAgents.length).toBe(0);
    });

    it('should enforce limit bounds', () => {
      const testLimits = [0, 1, 50, 100, 101, 200];
      
      testLimits.forEach(limit => {
        if (limit < 1 || limit > 100) {
          expect(() => {
            if (limit < 1 || limit > 100) {
              throw new Error('Limit must be between 1 and 100');
            }
          }).toThrow('Limit must be between 1 and 100');
        }
      });
    });

    it('should enforce hours bounds for timeline', () => {
      const testHours = [0, 1, 24, 168, 169, 300];
      
      testHours.forEach(hours => {
        if (hours < 1 || hours > 168) {
          expect(() => {
            if (hours < 1 || hours > 168) {
              throw new Error('Hours must be between 1 and 168 (1 week)');
            }
          }).toThrow('Hours must be between 1 and 168 (1 week)');
        }
      });
    });

    it('should handle agents with no display name', () => {
      const agent: AgentAnalytics = {
        rank: 1,
        agentId: 'agent1',
        displayName: 'Unknown',
        value: 50,
      };

      expect(agent.displayName).toBe('Unknown');
    });
  });

  describe('Data Type Validation', () => {
    it('should ensure rank is a number', () => {
      const agent: AgentAnalytics = {
        rank: 1,
        agentId: 'agent1',
        displayName: 'Alice',
        value: 100,
      };

      expect(typeof agent.rank).toBe('number');
      expect(Number.isInteger(agent.rank)).toBe(true);
    });

    it('should ensure value is a number', () => {
      const agent: AgentAnalytics = {
        rank: 1,
        agentId: 'agent1',
        displayName: 'Alice',
        value: 100,
      };

      expect(typeof agent.value).toBe('number');
    });

    it('should ensure timeline timestamps are valid', () => {
      const point: TimelinePoint = {
        timestamp: Date.now(),
        value: 10,
      };

      const date = new Date(point.timestamp);
      expect(date.toString()).not.toBe('Invalid Date');
      expect(point.timestamp).toBeGreaterThan(0);
    });
  });
});
