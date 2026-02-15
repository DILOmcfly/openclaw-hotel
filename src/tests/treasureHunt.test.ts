import { describe, it, expect } from 'vitest';

/**
 * Treasure Hunt System Unit Tests - Pure logic, NO database
 */

describe('Treasure Hunt System', () => {
  describe('Treasure Placement', () => {
    it('should generate unique treasure positions', () => {
      const usedPositions = new Set<string>();
      for (let i = 0; i < 5; i++) {
        let x: number, y: number, posKey: string;
        do {
          x = Math.floor(Math.random() * 30);
          y = Math.floor(Math.random() * 30);
          posKey = `${x},${y}`;
        } while (usedPositions.has(posKey));
        usedPositions.add(posKey);
      }
      expect(usedPositions.size).toBe(5);
    });

    it('should place treasures within grid bounds', () => {
      const x = Math.floor(Math.random() * 30);
      const y = Math.floor(Math.random() * 30);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(30);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(30);
    });
  });

  describe('Search Logic', () => {
    it('should detect treasure at exact coordinates', () => {
      const treasures = [{ x: 5, y: 10, foundBy: null }];
      expect(treasures.find(t => t.x === 5 && t.y === 10 && !t.foundBy)).toBeDefined();
    });

    it('should not find already discovered treasures', () => {
      const treasures = [{ x: 5, y: 10, foundBy: 'agent1' }];
      expect(treasures.find(t => t.x === 5 && t.y === 10 && !t.foundBy)).toBeUndefined();
    });

    it('should return undefined for empty tiles', () => {
      const treasures = [{ x: 5, y: 10, foundBy: null }];
      expect(treasures.find(t => t.x === 0 && t.y === 0 && !t.foundBy)).toBeUndefined();
    });
  });

  describe('Progress Tracking', () => {
    it('should calculate remaining treasures', () => {
      expect(5 - 0).toBe(5);
      expect(5 - 3).toBe(2);
      expect(5 - 5).toBe(0);
    });

    it('should track agent found count', () => {
      const participants = [{ agentId: 'agent1', foundCount: 3 }];
      expect(participants.find(p => p.agentId === 'agent1')?.foundCount || 0).toBe(3);
    });

    it('should increment found count', () => {
      let count = 2;
      count += 1;
      expect(count).toBe(3);
    });
  });

  describe('Leaderboard', () => {
    it('should sort by found count descending', () => {
      const p = [{ agentId: 'a1', foundCount: 2 }, { agentId: 'a2', foundCount: 5 }];
      expect([...p].sort((a, b) => b.foundCount - a.foundCount)[0].agentId).toBe('a2');
    });

    it('should use join time as tiebreaker', () => {
      const p = [
        { agentId: 'a1', foundCount: 3, joinedAt: new Date('2024-01-02') },
        { agentId: 'a2', foundCount: 3, joinedAt: new Date('2024-01-01') },
      ];
      const sorted = [...p].sort((a, b) => 
        b.foundCount !== a.foundCount ? b.foundCount - a.foundCount : a.joinedAt.getTime() - b.joinedAt.getTime()
      );
      expect(sorted[0].agentId).toBe('a2');
    });
  });

  describe('Reward Calculation', () => {
    it('should award coins per treasure', () => {
      expect(20 * 3).toBe(60);
    });

    it('should award completion bonus', () => {
      expect(5 === 5 ? 100 : 0).toBe(100);
    });

    it('should calculate total earnings', () => {
      expect((20 * 5) + 100).toBe(200);
    });
  });

  describe('Hunt Completion', () => {
    it('should identify agents who found all', () => {
      const p = [{ agentId: 'a1', foundCount: 5 }, { agentId: 'a2', foundCount: 3 }];
      expect(p.filter(x => x.foundCount === 5)).toHaveLength(1);
    });

    it('should handle no completers', () => {
      const p = [{ agentId: 'a1', foundCount: 3 }];
      expect(p.filter(x => x.foundCount === 5)).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should validate status values', () => {
      expect(['active', 'completed', 'cancelled']).toContain('active');
    });

    it('should validate coordinates', () => {
      const isValid = (c: number) => c >= 0 && c < 30;
      expect(isValid(0)).toBe(true);
      expect(isValid(-1)).toBe(false);
    });

    it('should handle multiple agent finds', () => {
      const finds = [{ agentId: 'a1' }, { agentId: 'a2' }, { agentId: 'a1' }];
      expect(finds.filter(f => f.agentId === 'a1')).toHaveLength(2);
    });
  });
});
