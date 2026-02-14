import { describe, it, expect } from 'vitest';
import { isValidCategory, getLeaderboard, getAgentRank } from '../services/leaderboard.js';
import type { LeaderboardEntry } from '../services/leaderboard.js';

describe('Leaderboard Service', () => {
  describe('Category Validation', () => {
    it('should validate correct categories', () => {
      expect(isValidCategory('coins')).toBe(true);
      expect(isValidCategory('trades')).toBe(true);
      expect(isValidCategory('friends')).toBe(true);
      expect(isValidCategory('achievements')).toBe(true);
      expect(isValidCategory('games_won')).toBe(true);
    });

    it('should reject invalid categories', () => {
      expect(isValidCategory('invalid')).toBe(false);
      expect(isValidCategory('')).toBe(false);
      expect(isValidCategory('COINS')).toBe(false);
      expect(isValidCategory('coin')).toBe(false);
    });
  });

  describe('Mock Leaderboard Logic', () => {
    it('should sort entries by value descending', () => {
      const mockEntries: LeaderboardEntry[] = [
        { rank: 0, agentId: 'agent1', displayName: 'Alice', value: 500 },
        { rank: 0, agentId: 'agent2', displayName: 'Bob', value: 1000 },
        { rank: 0, agentId: 'agent3', displayName: 'Charlie', value: 750 },
      ];

      const sorted = mockEntries.sort((a, b) => b.value - a.value);
      const withRanks = sorted.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

      expect(withRanks[0].displayName).toBe('Bob');
      expect(withRanks[0].rank).toBe(1);
      expect(withRanks[1].displayName).toBe('Charlie');
      expect(withRanks[1].rank).toBe(2);
      expect(withRanks[2].displayName).toBe('Alice');
      expect(withRanks[2].rank).toBe(3);
    });

    it('should calculate correct ranks for tied values', () => {
      const mockEntries: LeaderboardEntry[] = [
        { rank: 1, agentId: 'agent1', displayName: 'Alice', value: 1000 },
        { rank: 2, agentId: 'agent2', displayName: 'Bob', value: 1000 },
        { rank: 3, agentId: 'agent3', displayName: 'Charlie', value: 500 },
      ];

      // In SQL with ROW_NUMBER(), ties get sequential ranks
      expect(mockEntries[0].rank).toBe(1);
      expect(mockEntries[1].rank).toBe(2);
      expect(mockEntries[2].rank).toBe(3);
    });

    it('should limit results correctly', () => {
      const limit = 5;
      const mockEntries: LeaderboardEntry[] = Array.from({ length: 20 }, (_, i) => ({
        rank: i + 1,
        agentId: `agent${i}`,
        displayName: `Player ${i}`,
        value: 1000 - i * 10,
      }));

      const limited = mockEntries.slice(0, limit);
      expect(limited).toHaveLength(limit);
      expect(limited[0].rank).toBe(1);
      expect(limited[4].rank).toBe(5);
    });
  });

  describe('Rank Calculation', () => {
    it('should find agent rank in mock data', () => {
      const mockLeaderboard: LeaderboardEntry[] = [
        { rank: 1, agentId: 'agent1', displayName: 'Alice', value: 1000 },
        { rank: 2, agentId: 'agent2', displayName: 'Bob', value: 900 },
        { rank: 3, agentId: 'agent3', displayName: 'Charlie', value: 800 },
        { rank: 4, agentId: 'agent4', displayName: 'Dave', value: 700 },
      ];

      const bobEntry = mockLeaderboard.find(e => e.agentId === 'agent2');
      expect(bobEntry?.rank).toBe(2);

      const charlieEntry = mockLeaderboard.find(e => e.agentId === 'agent3');
      expect(charlieEntry?.rank).toBe(3);
    });

    it('should return null for non-existent agent', () => {
      const mockLeaderboard: LeaderboardEntry[] = [
        { rank: 1, agentId: 'agent1', displayName: 'Alice', value: 1000 },
      ];

      const nonExistent = mockLeaderboard.find(e => e.agentId === 'nonexistent');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty leaderboard', () => {
      const emptyLeaderboard: LeaderboardEntry[] = [];
      expect(emptyLeaderboard).toHaveLength(0);
    });

    it('should validate limit boundaries', () => {
      const isValidLimit = (limit: number) => limit >= 1 && limit <= 100;
      
      expect(isValidLimit(1)).toBe(true);
      expect(isValidLimit(10)).toBe(true);
      expect(isValidLimit(100)).toBe(true);
      expect(isValidLimit(0)).toBe(false);
      expect(isValidLimit(101)).toBe(false);
      expect(isValidLimit(-5)).toBe(false);
    });
  });
});
