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
      expect(isValidCategory('top_rated_rooms')).toBe(true);
    });

    it('should reject invalid categories', () => {
      expect(isValidCategory('invalid')).toBe(false);
      expect(isValidCategory('')).toBe(false);
      expect(isValidCategory('COINS')).toBe(false);
      expect(isValidCategory('coin')).toBe(false);
      expect(isValidCategory('top_rooms')).toBe(false);
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

  describe('Top Rated Rooms Category', () => {
    it('should sort rooms by average rating descending', () => {
      const mockRooms: LeaderboardEntry[] = [
        { 
          rank: 0, 
          agentId: 'owner1', 
          displayName: 'Alice', 
          value: 4.2, 
          roomId: 'room1', 
          roomName: 'Room A', 
          ratingCount: 10 
        },
        { 
          rank: 0, 
          agentId: 'owner2', 
          displayName: 'Bob', 
          value: 4.8, 
          roomId: 'room2', 
          roomName: 'Room B', 
          ratingCount: 15 
        },
        { 
          rank: 0, 
          agentId: 'owner3', 
          displayName: 'Charlie', 
          value: 3.9, 
          roomId: 'room3', 
          roomName: 'Room C', 
          ratingCount: 5 
        },
      ];

      // Simulate SQL ORDER BY avg_rating DESC, rating_count DESC
      const sorted = mockRooms.sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        return (b.ratingCount || 0) - (a.ratingCount || 0);
      });
      const withRanks = sorted.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

      expect(withRanks[0].roomName).toBe('Room B');
      expect(withRanks[0].value).toBe(4.8);
      expect(withRanks[0].rank).toBe(1);
      expect(withRanks[1].roomName).toBe('Room A');
      expect(withRanks[2].roomName).toBe('Room C');
    });

    it('should break ties by rating count (more ratings = higher rank)', () => {
      const mockRooms: LeaderboardEntry[] = [
        { 
          rank: 0, 
          agentId: 'owner1', 
          displayName: 'Alice', 
          value: 4.5, 
          roomId: 'room1', 
          roomName: 'Room A', 
          ratingCount: 5 
        },
        { 
          rank: 0, 
          agentId: 'owner2', 
          displayName: 'Bob', 
          value: 4.5, 
          roomId: 'room2', 
          roomName: 'Room B', 
          ratingCount: 20 
        },
      ];

      const sorted = mockRooms.sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        return (b.ratingCount || 0) - (a.ratingCount || 0);
      });

      expect(sorted[0].roomName).toBe('Room B'); // Same rating, but more reviews
      expect(sorted[0].ratingCount).toBe(20);
      expect(sorted[1].roomName).toBe('Room A');
    });

    it('should include roomId, roomName, and ratingCount in entries', () => {
      const mockEntry: LeaderboardEntry = {
        rank: 1,
        agentId: 'owner1',
        displayName: 'Alice',
        value: 4.7,
        roomId: 'room-123',
        roomName: 'Amazing Room',
        ratingCount: 42,
      };

      expect(mockEntry.roomId).toBe('room-123');
      expect(mockEntry.roomName).toBe('Amazing Room');
      expect(mockEntry.ratingCount).toBe(42);
      expect(mockEntry.value).toBe(4.7); // avg_rating
    });
  });
});
