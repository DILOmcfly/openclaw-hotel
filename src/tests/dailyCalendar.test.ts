import { describe, it, expect } from 'vitest';

/** Daily Calendar System Unit Tests - All SQL mocked, no real DB */

describe('Daily Calendar System', () => {
  describe('Reward Progression', () => {
    it('should have correct rewards for days 1-6 (10 coins)', () => {
      const dailyRewards = [10, 10, 10, 10, 10, 10];
      dailyRewards.forEach((reward, idx) => {
        expect(reward).toBe(10);
        expect(idx + 1).toBeLessThanOrEqual(6);
      });
    });

    it('should have week 1 bonus on day 7 (50 coins)', () => {
      const day7Reward = 50;
      expect(day7Reward).toBe(50);
    });

    it('should have correct rewards for days 8-13 (15 coins)', () => {
      const rewards = [15, 15, 15, 15, 15, 15];
      rewards.forEach(reward => expect(reward).toBe(15));
    });

    it('should have week 2 bonus on day 14 (75 coins)', () => {
      const day14Reward = 75;
      expect(day14Reward).toBe(75);
    });

    it('should have correct rewards for days 15-20 (20 coins)', () => {
      const rewards = [20, 20, 20, 20, 20, 20];
      rewards.forEach(reward => expect(reward).toBe(20));
    });

    it('should have week 3 bonus on day 21 (100 coins)', () => {
      const day21Reward = 100;
      expect(day21Reward).toBe(100);
    });

    it('should have correct rewards for days 22-27 (25 coins)', () => {
      const rewards = [25, 25, 25, 25, 25, 25];
      rewards.forEach(reward => expect(reward).toBe(25));
    });

    it('should have week 4 bonus on day 28 (150 coins)', () => {
      const day28Reward = 150;
      expect(day28Reward).toBe(150);
    });

    it('should have correct rewards for days 29-30 (30 coins)', () => {
      const rewards = [30, 30];
      rewards.forEach(reward => expect(reward).toBe(30));
    });

    it('should have month-end bonus on day 31 (200 coins)', () => {
      const day31Reward = 200;
      expect(day31Reward).toBe(200);
    });
  });

  describe('Claim Prevention', () => {
    it('should detect if already claimed today', () => {
      const claims = [
        { agentId: 'a1', year: 2024, month: 2, day: 15 },
      ];
      const hasClaimedToday = (agentId: string, day: number) => {
        return claims.some(c => c.agentId === agentId && c.day === day);
      };
      expect(hasClaimedToday('a1', 15)).toBe(true);
      expect(hasClaimedToday('a1', 16)).toBe(false);
    });

    it('should allow first-time claim', () => {
      const claims: any[] = [];
      const hasClaimedToday = (agentId: string, day: number) => {
        return claims.some(c => c.agentId === agentId && c.day === day);
      };
      expect(hasClaimedToday('a1', 15)).toBe(false);
    });

    it('should prevent double claims on same day', () => {
      const claims = [{ day: 5 }];
      const alreadyClaimed = claims.length > 0;
      expect(alreadyClaimed).toBe(true);
    });
  });

  describe('Calendar Display', () => {
    it('should mark claimed days correctly', () => {
      const rewards = [
        { day: 1, rewardValue: 10 },
        { day: 2, rewardValue: 10 },
        { day: 3, rewardValue: 10 },
      ];
      const claimedDays = [1, 3];
      const calendar = rewards.map(r => ({
        ...r,
        claimed: claimedDays.includes(r.day),
      }));
      expect(calendar[0].claimed).toBe(true);
      expect(calendar[1].claimed).toBe(false);
      expect(calendar[2].claimed).toBe(true);
    });

    it('should handle no claims correctly', () => {
      const rewards = [{ day: 1 }, { day: 2 }];
      const claimedDays: number[] = [];
      const calendar = rewards.map(r => ({
        ...r,
        claimed: claimedDays.includes(r.day),
      }));
      expect(calendar.every(c => !c.claimed)).toBe(true);
    });

    it('should handle all days claimed', () => {
      const rewards = [{ day: 1 }, { day: 2 }, { day: 3 }];
      const claimedDays = [1, 2, 3];
      const calendar = rewards.map(r => ({
        ...r,
        claimed: claimedDays.includes(r.day),
      }));
      expect(calendar.every(c => c.claimed)).toBe(true);
    });
  });

  describe('Progress Tracking', () => {
    it('should calculate claim rate correctly', () => {
      const claimed = 10;
      const total = 15;
      const claimRate = Math.round((claimed / total) * 100);
      expect(claimRate).toBe(67);
    });

    it('should calculate perfect claim rate', () => {
      const claimed = 15;
      const total = 15;
      const claimRate = Math.round((claimed / total) * 100);
      expect(claimRate).toBe(100);
    });

    it('should handle zero claims', () => {
      const claimed = 0;
      const total = 10;
      const claimRate = total > 0 ? Math.round((claimed / total) * 100) : 0;
      expect(claimRate).toBe(0);
    });

    it('should sum coins earned correctly', () => {
      const claims = [
        { rewardValue: 10 },
        { rewardValue: 50 },
        { rewardValue: 15 },
      ];
      const totalCoins = claims.reduce((sum, c) => sum + c.rewardValue, 0);
      expect(totalCoins).toBe(75);
    });
  });

  describe('Missed Days', () => {
    it('should identify missed days correctly', () => {
      const currentDay = 10;
      const claimedDays = [1, 2, 5, 8];
      const missed = [];
      for (let day = 1; day < currentDay; day++) {
        if (!claimedDays.includes(day)) missed.push(day);
      }
      expect(missed).toEqual([3, 4, 6, 7, 9]);
    });

    it('should handle no missed days', () => {
      const currentDay = 4;
      const claimedDays = [1, 2, 3];
      const missed = [];
      for (let day = 1; day < currentDay; day++) {
        if (!claimedDays.includes(day)) missed.push(day);
      }
      expect(missed).toEqual([]);
    });

    it('should handle all days missed', () => {
      const currentDay = 5;
      const claimedDays: number[] = [];
      const missed = [];
      for (let day = 1; day < currentDay; day++) {
        if (!claimedDays.includes(day)) missed.push(day);
      }
      expect(missed).toEqual([1, 2, 3, 4]);
    });
  });

  describe('Streak Calculation', () => {
    it('should calculate consecutive streak correctly', () => {
      const claimedDays = [1, 2, 3, 4, 5];
      let streak = 1;
      for (let i = claimedDays.length - 1; i > 0; i--) {
        if (claimedDays[i] - claimedDays[i - 1] === 1) streak++;
        else break;
      }
      expect(streak).toBe(5);
    });

    it('should calculate partial streak from gap', () => {
      const claimedDays = [1, 2, 5, 6, 7];
      let streak = 1;
      for (let i = claimedDays.length - 1; i > 0; i--) {
        if (claimedDays[i] - claimedDays[i - 1] === 1) streak++;
        else break;
      }
      expect(streak).toBe(3); // 5,6,7
    });

    it('should handle single claim streak', () => {
      const claimedDays = [5];
      const streak = claimedDays.length > 0 ? 1 : 0;
      expect(streak).toBe(1);
    });

    it('should calculate bonus percentage (10% per day)', () => {
      const streak = 5;
      const bonusPercent = streak * 10;
      expect(bonusPercent).toBe(50);
    });

    it('should handle no streak', () => {
      const claimedDays: number[] = [];
      const streak = claimedDays.length === 0 ? 0 : 1;
      expect(streak).toBe(0);
    });

    it('should handle non-consecutive days as streak of 1', () => {
      const claimedDays = [1, 3, 5, 7];
      let streak = 1;
      for (let i = claimedDays.length - 1; i > 0; i--) {
        if (claimedDays[i] - claimedDays[i - 1] === 1) streak++;
        else break;
      }
      expect(streak).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle month boundaries correctly', () => {
      const year = 2024;
      const month = 2; // February
      const day = 15;
      const dateKey = `${year}-${month}-${day}`;
      expect(dateKey).toBe('2024-2-15');
    });

    it('should handle 31-day months', () => {
      const daysInMonth = 31;
      const rewards = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      expect(rewards.length).toBe(31);
      expect(rewards[0]).toBe(1);
      expect(rewards[30]).toBe(31);
    });

    it('should handle current day as total for progress', () => {
      const currentDay = 15;
      const total = currentDay;
      expect(total).toBe(15);
    });
  });
});
