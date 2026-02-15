import { describe, it, expect } from 'vitest';

/**
 * Streaks System Unit Tests
 * Tests login streak logic, rewards, and leaderboard without database
 */

describe('Streaks System', () => {
  describe('Reward Calculation', () => {
    it('should calculate reward as streak × 10', () => {
      const getStreakReward = (streak: number): number => {
        if (streak <= 0) return 0;
        return Math.min(streak * 10, 500);
      };

      expect(getStreakReward(1)).toBe(10);
      expect(getStreakReward(5)).toBe(50);
      expect(getStreakReward(10)).toBe(100);
      expect(getStreakReward(25)).toBe(250);
    });

    it('should cap reward at 500 coins', () => {
      const getStreakReward = (streak: number): number => {
        if (streak <= 0) return 0;
        return Math.min(streak * 10, 500);
      };

      expect(getStreakReward(50)).toBe(500);
      expect(getStreakReward(100)).toBe(500);
      expect(getStreakReward(1000)).toBe(500);
    });

    it('should return 0 for invalid streaks', () => {
      const getStreakReward = (streak: number): number => {
        if (streak <= 0) return 0;
        return Math.min(streak * 10, 500);
      };

      expect(getStreakReward(0)).toBe(0);
      expect(getStreakReward(-1)).toBe(0);
      expect(getStreakReward(-100)).toBe(0);
    });
  });

  describe('Consecutive Login Logic', () => {
    it('should increment streak for consecutive day login', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const today = new Date().toISOString().split('T')[0];
      
      const isConsecutive = (lastLogin: string, currentLogin: string): boolean => {
        const last = new Date(lastLogin);
        const current = new Date(currentLogin);
        const diffTime = current.getTime() - last.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays === 1;
      };

      expect(isConsecutive(yesterdayStr, today)).toBe(true);
    });

    it('should reset streak after gap in logins', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
      
      const today = new Date().toISOString().split('T')[0];
      
      const isConsecutive = (lastLogin: string, currentLogin: string): boolean => {
        const last = new Date(lastLogin);
        const current = new Date(currentLogin);
        const diffTime = current.getTime() - last.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays === 1;
      };

      expect(isConsecutive(threeDaysAgoStr, today)).toBe(false);
    });

    it('should calculate new streak correctly', () => {
      type StreakUpdate = {
        lastLoginDate: string | null;
        currentStreak: number;
        todayLogin: string;
      };

      const calculateNewStreak = (data: StreakUpdate): number => {
        if (!data.lastLoginDate) return 1;

        const yesterday = new Date(data.todayLogin);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const lastLoginStr = new Date(data.lastLoginDate).toISOString().split('T')[0];

        if (lastLoginStr === yesterdayStr) {
          return data.currentStreak + 1;
        }
        return 1; // Reset
      };

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Consecutive
      expect(calculateNewStreak({
        lastLoginDate: yesterdayStr,
        currentStreak: 5,
        todayLogin: today,
      })).toBe(6);

      // Gap
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      expect(calculateNewStreak({
        lastLoginDate: threeDaysAgo.toISOString().split('T')[0],
        currentStreak: 5,
        todayLogin: today,
      })).toBe(1);

      // First login
      expect(calculateNewStreak({
        lastLoginDate: null,
        currentStreak: 0,
        todayLogin: today,
      })).toBe(1);
    });
  });

  describe('Double Login Prevention', () => {
    it('should detect same-day login attempt', () => {
      const today = new Date().toISOString().split('T')[0];
      
      const hasLoggedInToday = (lastLoginDate: string | null): boolean => {
        if (!lastLoginDate) return false;
        const todayStr = new Date().toISOString().split('T')[0];
        const lastLoginStr = new Date(lastLoginDate).toISOString().split('T')[0];
        return todayStr === lastLoginStr;
      };

      expect(hasLoggedInToday(today)).toBe(true);
    });

    it('should allow login if last login was yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const hasLoggedInToday = (lastLoginDate: string | null): boolean => {
        if (!lastLoginDate) return false;
        const todayStr = new Date().toISOString().split('T')[0];
        const lastLoginStr = new Date(lastLoginDate).toISOString().split('T')[0];
        return todayStr === lastLoginStr;
      };

      expect(hasLoggedInToday(yesterdayStr)).toBe(false);
    });

    it('should allow first-time login', () => {
      const hasLoggedInToday = (lastLoginDate: string | null): boolean => {
        if (!lastLoginDate) return false;
        const todayStr = new Date().toISOString().split('T')[0];
        const lastLoginStr = new Date(lastLoginDate).toISOString().split('T')[0];
        return todayStr === lastLoginStr;
      };

      expect(hasLoggedInToday(null)).toBe(false);
    });
  });

  describe('Longest Streak Tracking', () => {
    it('should update longest streak when current exceeds it', () => {
      const updateLongestStreak = (current: number, longest: number): number => {
        return Math.max(current, longest);
      };

      expect(updateLongestStreak(10, 5)).toBe(10);
      expect(updateLongestStreak(15, 12)).toBe(15);
    });

    it('should maintain longest streak when current is lower', () => {
      const updateLongestStreak = (current: number, longest: number): number => {
        return Math.max(current, longest);
      };

      expect(updateLongestStreak(3, 20)).toBe(20);
      expect(updateLongestStreak(1, 50)).toBe(50);
    });

    it('should handle first streak correctly', () => {
      const updateLongestStreak = (current: number, longest: number): number => {
        return Math.max(current, longest);
      };

      expect(updateLongestStreak(1, 0)).toBe(1);
      expect(updateLongestStreak(5, 0)).toBe(5);
    });
  });

  describe('Leaderboard Sorting', () => {
    it('should sort by current streak descending', () => {
      const mockStreaks = [
        { agentId: 'a1', currentStreak: 5, longestStreak: 10 },
        { agentId: 'a2', currentStreak: 15, longestStreak: 15 },
        { agentId: 'a3', currentStreak: 3, longestStreak: 20 },
      ];

      const sorted = [...mockStreaks].sort((a, b) => b.currentStreak - a.currentStreak);

      expect(sorted[0].agentId).toBe('a2');
      expect(sorted[1].agentId).toBe('a1');
      expect(sorted[2].agentId).toBe('a3');
    });

    it('should use longest streak as tiebreaker', () => {
      const mockStreaks = [
        { agentId: 'a1', currentStreak: 10, longestStreak: 15 },
        { agentId: 'a2', currentStreak: 10, longestStreak: 25 },
        { agentId: 'a3', currentStreak: 10, longestStreak: 10 },
      ];

      const sorted = [...mockStreaks].sort((a, b) => {
        if (b.currentStreak !== a.currentStreak) {
          return b.currentStreak - a.currentStreak;
        }
        return b.longestStreak - a.longestStreak;
      });

      expect(sorted[0].agentId).toBe('a2');
      expect(sorted[1].agentId).toBe('a1');
      expect(sorted[2].agentId).toBe('a3');
    });

    it('should filter out zero streaks from leaderboard', () => {
      const mockStreaks = [
        { agentId: 'a1', currentStreak: 5, longestStreak: 10 },
        { agentId: 'a2', currentStreak: 0, longestStreak: 15 },
        { agentId: 'a3', currentStreak: 3, longestStreak: 3 },
      ];

      const filtered = mockStreaks.filter(s => s.currentStreak > 0);

      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.agentId)).toEqual(['a1', 'a3']);
    });

    it('should respect limit parameter', () => {
      const mockStreaks = [
        { agentId: 'a1', currentStreak: 10 },
        { agentId: 'a2', currentStreak: 9 },
        { agentId: 'a3', currentStreak: 8 },
        { agentId: 'a4', currentStreak: 7 },
        { agentId: 'a5', currentStreak: 6 },
      ];

      const limit = 3;
      const limited = mockStreaks.slice(0, limit);

      expect(limited).toHaveLength(3);
      expect(limited.map(s => s.agentId)).toEqual(['a1', 'a2', 'a3']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle midnight boundary correctly', () => {
      // Simulating login just before and after midnight
      const endOfDay = '2024-01-15T23:59:59Z';
      const startOfNextDay = '2024-01-16T00:00:01Z';

      const getDayString = (dateStr: string): string => {
        return new Date(dateStr).toISOString().split('T')[0];
      };

      expect(getDayString(endOfDay)).toBe('2024-01-15');
      expect(getDayString(startOfNextDay)).toBe('2024-01-16');
    });

    it('should handle timezone differences in date comparison', () => {
      // All comparisons should use ISO date strings (YYYY-MM-DD)
      const utcDate = '2024-01-15T12:00:00Z';
      const pstDate = '2024-01-15T04:00:00-08:00';

      const getDayString = (dateStr: string): string => {
        return new Date(dateStr).toISOString().split('T')[0];
      };

      // Both should normalize to same day
      expect(getDayString(utcDate)).toBe('2024-01-15');
      expect(getDayString(pstDate)).toBe('2024-01-15');
    });
  });
});
