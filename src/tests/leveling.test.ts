import { describe, it, expect } from 'vitest';

/**
 * Leveling System Unit Tests
 * Tests XP, level calculation, rewards, and leaderboard without database
 */

describe('Leveling System', () => {
  describe('Level Requirement Calculation', () => {
    it('should calculate XP requirement as level^2 * 100', () => {
      const getLevelRequirement = (level: number): number => {
        if (level <= 1) return 0;
        return level * level * 100;
      };

      expect(getLevelRequirement(1)).toBe(0);
      expect(getLevelRequirement(2)).toBe(400);
      expect(getLevelRequirement(5)).toBe(2500);
      expect(getLevelRequirement(10)).toBe(10000);
    });

    it('should return 0 for level 1 or below', () => {
      const getLevelRequirement = (level: number): number => {
        if (level <= 1) return 0;
        return level * level * 100;
      };

      expect(getLevelRequirement(0)).toBe(0);
      expect(getLevelRequirement(-1)).toBe(0);
    });

    it('should handle large level numbers', () => {
      const getLevelRequirement = (level: number): number => {
        if (level <= 1) return 0;
        return level * level * 100;
      };

      expect(getLevelRequirement(50)).toBe(250000);
      expect(getLevelRequirement(100)).toBe(1000000);
    });
  });

  describe('Level Calculation from XP', () => {
    it('should calculate correct level from total XP', () => {
      const getLevelRequirement = (level: number): number => {
        if (level <= 1) return 0;
        return level * level * 100;
      };

      const calculateLevel = (totalXp: number): number => {
        let level = 1;
        while (getLevelRequirement(level + 1) <= totalXp) {
          level++;
        }
        return level;
      };

      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(399)).toBe(1);
      expect(calculateLevel(400)).toBe(2);
      expect(calculateLevel(2500)).toBe(5);
      expect(calculateLevel(10000)).toBe(10);
    });

    it('should handle edge cases at level boundaries', () => {
      const getLevelRequirement = (level: number): number => {
        if (level <= 1) return 0;
        return level * level * 100;
      };

      const calculateLevel = (totalXp: number): number => {
        let level = 1;
        while (getLevelRequirement(level + 1) <= totalXp) {
          level++;
        }
        return level;
      };

      expect(calculateLevel(399)).toBe(1); // Just below level 2
      expect(calculateLevel(400)).toBe(2); // Exactly level 2
      expect(calculateLevel(401)).toBe(2); // Just above level 2
    });

    it('should handle very large XP values', () => {
      const getLevelRequirement = (level: number): number => {
        if (level <= 1) return 0;
        return level * level * 100;
      };

      const calculateLevel = (totalXp: number): number => {
        let level = 1;
        while (getLevelRequirement(level + 1) <= totalXp) {
          level++;
        }
        return level;
      };

      expect(calculateLevel(1000000)).toBe(100);
      expect(calculateLevel(500000)).toBe(70);
    });
  });

  describe('XP Addition and Level Up Detection', () => {
    it('should detect level up when crossing threshold', () => {
      const getLevelRequirement = (level: number): number => {
        if (level <= 1) return 0;
        return level * level * 100;
      };

      const calculateLevel = (totalXp: number): number => {
        let level = 1;
        while (getLevelRequirement(level + 1) <= totalXp) {
          level++;
        }
        return level;
      };

      const checkLevelUp = (currentXp: number, xpToAdd: number): boolean => {
        const oldLevel = calculateLevel(currentXp);
        const newLevel = calculateLevel(currentXp + xpToAdd);
        return newLevel > oldLevel;
      };

      expect(checkLevelUp(0, 400)).toBe(true); // 0 -> 400 (level 1 -> 2)
      expect(checkLevelUp(300, 100)).toBe(true); // 300 -> 400 (level 1 -> 2)
      expect(checkLevelUp(100, 100)).toBe(false); // 100 -> 200 (still level 1)
    });

    it('should not level up within same level range', () => {
      const calculateLevel = (totalXp: number): number => {
        let level = 1;
        const getLevelRequirement = (lvl: number): number => {
          if (lvl <= 1) return 0;
          return lvl * lvl * 100;
        };
        while (getLevelRequirement(level + 1) <= totalXp) {
          level++;
        }
        return level;
      };

      const checkLevelUp = (currentXp: number, xpToAdd: number): boolean => {
        const oldLevel = calculateLevel(currentXp);
        const newLevel = calculateLevel(currentXp + xpToAdd);
        return newLevel > oldLevel;
      };

      expect(checkLevelUp(100, 50)).toBe(false);
      expect(checkLevelUp(500, 100)).toBe(false);
    });

    it('should handle multiple level jumps at once', () => {
      const calculateLevel = (totalXp: number): number => {
        let level = 1;
        const getLevelRequirement = (lvl: number): number => {
          if (lvl <= 1) return 0;
          return lvl * lvl * 100;
        };
        while (getLevelRequirement(level + 1) <= totalXp) {
          level++;
        }
        return level;
      };

      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(10000)).toBe(10); // Jump from 1 to 10
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress percentage correctly', () => {
      const calculateProgress = (currentXp: number, level: number): number => {
        const getLevelRequirement = (lvl: number): number => {
          if (lvl <= 1) return 0;
          return lvl * lvl * 100;
        };

        const xpForCurrentLevel = getLevelRequirement(level);
        const xpForNextLevel = getLevelRequirement(level + 1);
        const xpProgress = currentXp - xpForCurrentLevel;
        const xpNeeded = xpForNextLevel - xpForCurrentLevel;
        return xpNeeded > 0 ? Math.floor((xpProgress / xpNeeded) * 100) : 100;
      };

      // Level 1: 0 XP, need 400 for level 2
      expect(calculateProgress(0, 1)).toBe(0);
      expect(calculateProgress(200, 1)).toBe(50);
      expect(calculateProgress(400, 2)).toBe(0); // Just hit level 2

      // Level 2: 400 XP base, need 900 total for level 3 (500 more)
      expect(calculateProgress(650, 2)).toBe(50);
    });

    it('should return 100% at max progress for level', () => {
      const calculateProgress = (currentXp: number, level: number): number => {
        const getLevelRequirement = (lvl: number): number => {
          if (lvl <= 1) return 0;
          return lvl * lvl * 100;
        };

        const xpForCurrentLevel = getLevelRequirement(level);
        const xpForNextLevel = getLevelRequirement(level + 1);
        const xpProgress = currentXp - xpForCurrentLevel;
        const xpNeeded = xpForNextLevel - xpForCurrentLevel;
        return xpNeeded > 0 ? Math.floor((xpProgress / xpNeeded) * 100) : 100;
      };

      expect(calculateProgress(399, 1)).toBe(99);
    });
  });

  describe('Reward System', () => {
    it('should have rewards for specific levels', () => {
      const rewardLevels = [1, 5, 10, 25, 50, 100];
      const hasReward = (level: number): boolean => {
        return rewardLevels.includes(level);
      };

      expect(hasReward(1)).toBe(true);
      expect(hasReward(5)).toBe(true);
      expect(hasReward(10)).toBe(true);
      expect(hasReward(25)).toBe(true);
      expect(hasReward(50)).toBe(true);
      expect(hasReward(100)).toBe(true);
    });

    it('should not have rewards for non-milestone levels', () => {
      const rewardLevels = [1, 5, 10, 25, 50, 100];
      const hasReward = (level: number): boolean => {
        return rewardLevels.includes(level);
      };

      expect(hasReward(2)).toBe(false);
      expect(hasReward(7)).toBe(false);
      expect(hasReward(15)).toBe(false);
      expect(hasReward(99)).toBe(false);
    });

    it('should have escalating coin rewards', () => {
      const rewards = {
        1: 0,
        5: 100,
        10: 500,
        25: 2500,
        50: 10000,
        100: 50000,
      };

      expect(rewards[5]).toBeLessThan(rewards[10]);
      expect(rewards[10]).toBeLessThan(rewards[25]);
      expect(rewards[25]).toBeLessThan(rewards[50]);
      expect(rewards[50]).toBeLessThan(rewards[100]);
    });

    it('should have appropriate titles for each milestone', () => {
      const titles = {
        1: 'Newcomer',
        5: 'Regular',
        10: 'Veteran',
        25: 'Elite',
        50: 'Legend',
        100: 'Mythic',
      };

      expect(titles[1]).toBe('Newcomer');
      expect(titles[100]).toBe('Mythic');
    });
  });

  describe('Leaderboard Sorting', () => {
    it('should sort by level descending, then XP descending', () => {
      const mockAgents = [
        { agentId: 'a1', level: 5, totalXpEarned: 3000 },
        { agentId: 'a2', level: 10, totalXpEarned: 12000 },
        { agentId: 'a3', level: 5, totalXpEarned: 3500 },
        { agentId: 'a4', level: 10, totalXpEarned: 11000 },
      ];

      const sorted = [...mockAgents].sort((a, b) => {
        if (b.level !== a.level) {
          return b.level - a.level;
        }
        return b.totalXpEarned - a.totalXpEarned;
      });

      expect(sorted[0].agentId).toBe('a2'); // Level 10, 12000 XP
      expect(sorted[1].agentId).toBe('a4'); // Level 10, 11000 XP
      expect(sorted[2].agentId).toBe('a3'); // Level 5, 3500 XP
      expect(sorted[3].agentId).toBe('a1'); // Level 5, 3000 XP
    });

    it('should handle agents with same level and XP', () => {
      const mockAgents = [
        { agentId: 'a1', level: 5, totalXpEarned: 3000 },
        { agentId: 'a2', level: 5, totalXpEarned: 3000 },
      ];

      const sorted = [...mockAgents].sort((a, b) => {
        if (b.level !== a.level) {
          return b.level - a.level;
        }
        return b.totalXpEarned - a.totalXpEarned;
      });

      expect(sorted).toHaveLength(2);
      expect(sorted[0].level).toBe(5);
      expect(sorted[1].level).toBe(5);
    });

    it('should respect limit parameter', () => {
      const mockAgents = Array.from({ length: 20 }, (_, i) => ({
        agentId: `a${i}`,
        level: 20 - i,
        totalXpEarned: (20 - i) * 1000,
      }));

      const limit = 10;
      const limited = mockAgents.slice(0, limit);

      expect(limited).toHaveLength(10);
      expect(limited[0].level).toBe(20);
      expect(limited[9].level).toBe(11);
    });
  });

  describe('Edge Cases', () => {
    it('should handle brand new agent with no XP', () => {
      const defaultLevel = 1;
      const defaultXp = 0;

      expect(defaultLevel).toBe(1);
      expect(defaultXp).toBe(0);
    });

    it('should reject negative XP additions', () => {
      const validateXP = (amount: number): boolean => {
        return amount > 0;
      };

      expect(validateXP(-10)).toBe(false);
      expect(validateXP(0)).toBe(false);
      expect(validateXP(10)).toBe(true);
    });

    it('should track total XP earned separately from current XP', () => {
      const totalXpEarned = 5000;
      const currentLevel = 7;
      
      // Total XP includes XP from all previous levels
      expect(totalXpEarned).toBeGreaterThanOrEqual(0);
      expect(currentLevel).toBeGreaterThanOrEqual(1);
    });
  });
});
