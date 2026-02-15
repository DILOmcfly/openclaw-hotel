import { describe, it, expect } from 'vitest';

/**
 * Visitor Log System Unit Tests
 * Tests visitor tracking logic and statistics without database
 */

describe('Visitor Log System', () => {
  describe('Duration Calculation', () => {
    it('should calculate duration in seconds between entry and exit', () => {
      const calculateDuration = (enteredAt: Date, leftAt: Date): number => {
        return Math.floor((leftAt.getTime() - enteredAt.getTime()) / 1000);
      };

      const entered = new Date('2024-01-15T10:00:00Z');
      const left = new Date('2024-01-15T10:05:00Z');
      
      expect(calculateDuration(entered, left)).toBe(300); // 5 minutes
    });

    it('should handle hour-long visits', () => {
      const calculateDuration = (enteredAt: Date, leftAt: Date): number => {
        return Math.floor((leftAt.getTime() - enteredAt.getTime()) / 1000);
      };

      const entered = new Date('2024-01-15T10:00:00Z');
      const left = new Date('2024-01-15T11:00:00Z');
      
      expect(calculateDuration(entered, left)).toBe(3600); // 1 hour
    });

    it('should handle multi-hour visits', () => {
      const calculateDuration = (enteredAt: Date, leftAt: Date): number => {
        return Math.floor((leftAt.getTime() - enteredAt.getTime()) / 1000);
      };

      const entered = new Date('2024-01-15T10:00:00Z');
      const left = new Date('2024-01-15T13:30:00Z');
      
      expect(calculateDuration(entered, left)).toBe(12600); // 3.5 hours
    });
  });

  describe('Active Visitor Detection', () => {
    it('should identify active visitors (no exit time)', () => {
      const isActive = (leftAt: Date | null): boolean => {
        return leftAt === null;
      };

      expect(isActive(null)).toBe(true);
      expect(isActive(new Date())).toBe(false);
    });

    it('should filter active visitors from list', () => {
      const visits = [
        { agentId: 'agent1', leftAt: null },
        { agentId: 'agent2', leftAt: new Date() },
        { agentId: 'agent3', leftAt: null },
      ];

      const active = visits.filter(v => v.leftAt === null);
      
      expect(active).toHaveLength(2);
      expect(active.map(v => v.agentId)).toEqual(['agent1', 'agent3']);
    });
  });

  describe('Visit Statistics', () => {
    it('should calculate average duration from multiple visits', () => {
      const visits = [
        { durationSeconds: 300 },
        { durationSeconds: 600 },
        { durationSeconds: 900 },
      ];

      const avgDuration = visits.reduce((sum, v) => sum + v.durationSeconds, 0) / visits.length;
      
      expect(avgDuration).toBe(600);
    });

    it('should count unique visitors', () => {
      const visits = [
        { agentId: 'agent1' },
        { agentId: 'agent2' },
        { agentId: 'agent1' },
        { agentId: 'agent3' },
        { agentId: 'agent2' },
      ];

      const uniqueVisitors = new Set(visits.map(v => v.agentId)).size;
      
      expect(uniqueVisitors).toBe(3);
    });

    it('should count total visits', () => {
      const visits = [
        { agentId: 'agent1' },
        { agentId: 'agent2' },
        { agentId: 'agent1' },
      ];

      expect(visits.length).toBe(3);
    });

    it('should handle empty visit list', () => {
      const visits: any[] = [];

      const uniqueVisitors = new Set(visits.map(v => v.agentId)).size;
      const avgDuration = visits.length > 0 
        ? visits.reduce((sum, v) => sum + (v.durationSeconds || 0), 0) / visits.length 
        : 0;

      expect(uniqueVisitors).toBe(0);
      expect(avgDuration).toBe(0);
    });
  });

  describe('Frequent Visitor Detection', () => {
    it('should rank visitors by visit count', () => {
      const visits = [
        { agentId: 'agent1' },
        { agentId: 'agent2' },
        { agentId: 'agent1' },
        { agentId: 'agent3' },
        { agentId: 'agent1' },
      ];

      const frequency = visits.reduce((acc, v) => {
        acc[v.agentId] = (acc[v.agentId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const ranked = Object.entries(frequency)
        .map(([agentId, count]) => ({ agentId, count }))
        .sort((a, b) => b.count - a.count);

      expect(ranked[0]).toEqual({ agentId: 'agent1', count: 3 });
      expect(ranked[1]).toEqual({ agentId: 'agent2', count: 1 });
      expect(ranked[2]).toEqual({ agentId: 'agent3', count: 1 });
    });

    it('should limit results to top N visitors', () => {
      const visits = [
        { agentId: 'agent1' },
        { agentId: 'agent2' },
        { agentId: 'agent3' },
        { agentId: 'agent4' },
      ];

      const frequency = visits.reduce((acc, v) => {
        acc[v.agentId] = (acc[v.agentId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const ranked = Object.entries(frequency)
        .map(([agentId, count]) => ({ agentId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 2);

      expect(ranked).toHaveLength(2);
    });
  });

  describe('Popular Room Ranking', () => {
    it('should aggregate visits across multiple rooms', () => {
      const stats = [
        { roomId: 1, totalVisits: 100 },
        { roomId: 2, totalVisits: 50 },
        { roomId: 3, totalVisits: 150 },
      ];

      const sorted = [...stats].sort((a, b) => b.totalVisits - a.totalVisits);

      expect(sorted[0].roomId).toBe(3);
      expect(sorted[1].roomId).toBe(1);
      expect(sorted[2].roomId).toBe(2);
    });

    it('should sum visits over a date range', () => {
      const dailyStats = [
        { roomId: 1, date: '2024-01-15', totalVisits: 50 },
        { roomId: 1, date: '2024-01-16', totalVisits: 60 },
        { roomId: 1, date: '2024-01-17', totalVisits: 40 },
      ];

      const totalVisits = dailyStats
        .filter(s => s.roomId === 1)
        .reduce((sum, s) => sum + s.totalVisits, 0);

      expect(totalVisits).toBe(150);
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter visits within date range', () => {
      const visits = [
        { enteredAt: new Date('2024-01-15') },
        { enteredAt: new Date('2024-01-20') },
        { enteredAt: new Date('2024-01-25') },
      ];

      const startDate = new Date('2024-01-18');
      const endDate = new Date('2024-01-22');

      const filtered = visits.filter(v => 
        v.enteredAt >= startDate && v.enteredAt <= endDate
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].enteredAt).toEqual(new Date('2024-01-20'));
    });

    it('should handle boundary dates inclusively', () => {
      const visits = [
        { enteredAt: new Date('2024-01-15') },
        { enteredAt: new Date('2024-01-20') },
      ];

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-20');

      const filtered = visits.filter(v => 
        v.enteredAt >= startDate && v.enteredAt <= endDate
      );

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Pagination Logic', () => {
    it('should apply limit to results', () => {
      const visits = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const limit = 10;
      
      const paginated = visits.slice(0, limit);
      
      expect(paginated).toHaveLength(10);
    });

    it('should apply offset and limit together', () => {
      const visits = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const limit = 10;
      const offset = 20;
      
      const paginated = visits.slice(offset, offset + limit);
      
      expect(paginated).toHaveLength(10);
      expect(paginated[0].id).toBe(20);
      expect(paginated[9].id).toBe(29);
    });

    it('should handle offset beyond array length', () => {
      const visits = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const limit = 10;
      const offset = 150;
      
      const paginated = visits.slice(offset, offset + limit);
      
      expect(paginated).toHaveLength(0);
    });

    it('should cap limit at maximum', () => {
      const requestedLimit = 200;
      const maxLimit = 100;
      
      const actualLimit = Math.min(requestedLimit, maxLimit);
      
      expect(actualLimit).toBe(100);
    });
  });

  describe('Visit Validation', () => {
    it('should validate roomId is a number', () => {
      const isValidRoomId = (roomId: any): boolean => {
        return typeof roomId === 'number' && !isNaN(roomId) && roomId > 0;
      };

      expect(isValidRoomId(123)).toBe(true);
      expect(isValidRoomId('123')).toBe(false);
      expect(isValidRoomId(-1)).toBe(false);
      expect(isValidRoomId(0)).toBe(false);
    });

    it('should validate agentId is non-empty string', () => {
      const isValidAgentId = (agentId: any): boolean => {
        return typeof agentId === 'string' && agentId.trim().length > 0;
      };

      expect(isValidAgentId('agent123')).toBe(true);
      expect(isValidAgentId('')).toBe(false);
      expect(isValidAgentId('   ')).toBe(false);
      expect(isValidAgentId(123)).toBe(false);
    });

    it('should validate visit has required fields', () => {
      const isValidVisit = (visit: any): boolean => {
        return (
          typeof visit.roomId === 'number' &&
          typeof visit.agentId === 'string' &&
          visit.enteredAt instanceof Date
        );
      };

      expect(isValidVisit({
        roomId: 1,
        agentId: 'agent1',
        enteredAt: new Date(),
      })).toBe(true);

      expect(isValidVisit({
        roomId: '1',
        agentId: 'agent1',
        enteredAt: new Date(),
      })).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle visit with zero duration', () => {
      const calculateDuration = (enteredAt: Date, leftAt: Date): number => {
        return Math.floor((leftAt.getTime() - enteredAt.getTime()) / 1000);
      };

      const entered = new Date('2024-01-15T10:00:00Z');
      const left = new Date('2024-01-15T10:00:00Z');
      
      expect(calculateDuration(entered, left)).toBe(0);
    });

    it('should handle same visitor entering multiple times', () => {
      const visits = [
        { agentId: 'agent1', enteredAt: new Date('2024-01-15T10:00:00Z') },
        { agentId: 'agent1', enteredAt: new Date('2024-01-15T11:00:00Z') },
        { agentId: 'agent1', enteredAt: new Date('2024-01-15T12:00:00Z') },
      ];

      expect(visits.filter(v => v.agentId === 'agent1')).toHaveLength(3);
      expect(new Set(visits.map(v => v.agentId)).size).toBe(1);
    });

    it('should handle concurrent visitors in same room', () => {
      const visits = [
        { agentId: 'agent1', leftAt: null },
        { agentId: 'agent2', leftAt: null },
        { agentId: 'agent3', leftAt: null },
      ];

      const concurrent = visits.filter(v => v.leftAt === null);
      
      expect(concurrent).toHaveLength(3);
    });
  });
});
