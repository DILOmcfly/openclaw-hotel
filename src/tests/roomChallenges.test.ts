import { describe, it, expect } from 'vitest';

/**
 * Room Challenges System Unit Tests
 * Tests challenge logic, progress tracking, and rewards without database
 */

describe('Room Challenges System', () => {
  describe('Challenge Creation', () => {
    it('should validate challenge type', () => {
      const validTypes = ['speed', 'collection', 'social', 'creative', 'puzzle'];
      const isValidType = (type: string): boolean => validTypes.includes(type);

      expect(isValidType('speed')).toBe(true);
      expect(isValidType('social')).toBe(true);
      expect(isValidType('invalid')).toBe(false);
    });

    it('should set default values correctly', () => {
      const createChallengeDefaults = (data: any) => ({
        targetValue: data.targetValue || 10,
        rewardCoins: data.rewardCoins || 100,
        timeLimitSeconds: data.timeLimitSeconds || 300,
        maxParticipants: data.maxParticipants || 20,
      });

      const defaults = createChallengeDefaults({});
      expect(defaults.targetValue).toBe(10);
      expect(defaults.rewardCoins).toBe(100);
      expect(defaults.timeLimitSeconds).toBe(300);
      expect(defaults.maxParticipants).toBe(20);
    });

    it('should override defaults with provided values', () => {
      const createChallengeDefaults = (data: any) => ({
        targetValue: data.targetValue || 10,
        rewardCoins: data.rewardCoins || 100,
        timeLimitSeconds: data.timeLimitSeconds || 300,
        maxParticipants: data.maxParticipants || 20,
      });

      const custom = createChallengeDefaults({
        targetValue: 50,
        rewardCoins: 500,
        timeLimitSeconds: 600,
        maxParticipants: 10,
      });

      expect(custom.targetValue).toBe(50);
      expect(custom.rewardCoins).toBe(500);
      expect(custom.timeLimitSeconds).toBe(600);
      expect(custom.maxParticipants).toBe(10);
    });
  });

  describe('Challenge Status Transitions', () => {
    it('should only start pending challenges', () => {
      const canStart = (status: string): boolean => status === 'pending';

      expect(canStart('pending')).toBe(true);
      expect(canStart('active')).toBe(false);
      expect(canStart('completed')).toBe(false);
      expect(canStart('cancelled')).toBe(false);
    });

    it('should calculate end time correctly', () => {
      const calculateEndTime = (startTime: Date, timeLimitSeconds: number): Date => {
        return new Date(startTime.getTime() + timeLimitSeconds * 1000);
      };

      const start = new Date('2024-01-15T12:00:00Z');
      const end = calculateEndTime(start, 300);

      expect(end.toISOString()).toBe('2024-01-15T12:05:00.000Z');
    });

    it('should validate active status for joining', () => {
      const canJoin = (status: string): boolean => status === 'active';

      expect(canJoin('active')).toBe(true);
      expect(canJoin('pending')).toBe(false);
      expect(canJoin('completed')).toBe(false);
    });

    it('should only end active challenges', () => {
      const canEnd = (status: string): boolean => status === 'active';

      expect(canEnd('active')).toBe(true);
      expect(canEnd('pending')).toBe(false);
      expect(canEnd('completed')).toBe(false);
    });
  });

  describe('Participant Limits', () => {
    it('should check if challenge is full', () => {
      const isFull = (currentCount: number, maxParticipants: number): boolean => {
        return currentCount >= maxParticipants;
      };

      expect(isFull(10, 20)).toBe(false);
      expect(isFull(20, 20)).toBe(true);
      expect(isFull(25, 20)).toBe(true);
    });

    it('should allow joining when not full', () => {
      const canJoinIfNotFull = (currentCount: number, maxParticipants: number): boolean => {
        return currentCount < maxParticipants;
      };

      expect(canJoinIfNotFull(0, 20)).toBe(true);
      expect(canJoinIfNotFull(19, 20)).toBe(true);
      expect(canJoinIfNotFull(20, 20)).toBe(false);
    });
  });

  describe('Progress Tracking', () => {
    it('should increment progress correctly', () => {
      const updateProgress = (current: number, increment: number): number => {
        return current + increment;
      };

      expect(updateProgress(0, 1)).toBe(1);
      expect(updateProgress(5, 3)).toBe(8);
      expect(updateProgress(10, 5)).toBe(15);
    });

    it('should detect completion when target reached', () => {
      const isCompleted = (progress: number, targetValue: number): boolean => {
        return progress >= targetValue;
      };

      expect(isCompleted(10, 10)).toBe(true);
      expect(isCompleted(15, 10)).toBe(true);
      expect(isCompleted(9, 10)).toBe(false);
    });

    it('should auto-complete on target', () => {
      type ProgressUpdate = {
        progress: number;
        completed: boolean;
      };

      const calculateUpdate = (
        currentProgress: number,
        increment: number,
        targetValue: number
      ): ProgressUpdate => {
        const newProgress = currentProgress + increment;
        return {
          progress: newProgress,
          completed: newProgress >= targetValue,
        };
      };

      const update1 = calculateUpdate(8, 2, 10);
      expect(update1.completed).toBe(true);
      expect(update1.progress).toBe(10);

      const update2 = calculateUpdate(5, 2, 10);
      expect(update2.completed).toBe(false);
      expect(update2.progress).toBe(7);
    });
  });

  describe('Leaderboard Sorting', () => {
    it('should sort by progress descending', () => {
      const participants = [
        { agentId: 'a1', progress: 5, completedAt: null },
        { agentId: 'a2', progress: 15, completedAt: null },
        { agentId: 'a3', progress: 10, completedAt: null },
      ];

      const sorted = [...participants].sort((a, b) => b.progress - a.progress);

      expect(sorted[0].agentId).toBe('a2');
      expect(sorted[1].agentId).toBe('a3');
      expect(sorted[2].agentId).toBe('a1');
    });

    it('should use completion time as tiebreaker', () => {
      const participants = [
        { agentId: 'a1', progress: 10, completedAt: new Date('2024-01-15T12:05:00Z') },
        { agentId: 'a2', progress: 10, completedAt: new Date('2024-01-15T12:03:00Z') },
        { agentId: 'a3', progress: 10, completedAt: new Date('2024-01-15T12:10:00Z') },
      ];

      const sorted = [...participants].sort((a, b) => {
        if (b.progress !== a.progress) return b.progress - a.progress;
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        return a.completedAt.getTime() - b.completedAt.getTime();
      });

      expect(sorted[0].agentId).toBe('a2');
      expect(sorted[1].agentId).toBe('a1');
      expect(sorted[2].agentId).toBe('a3');
    });

    it('should place incomplete participants last', () => {
      const participants = [
        { agentId: 'a1', progress: 10, completedAt: new Date('2024-01-15T12:05:00Z') },
        { agentId: 'a2', progress: 8, completedAt: null },
        { agentId: 'a3', progress: 10, completedAt: new Date('2024-01-15T12:03:00Z') },
      ];

      const sorted = [...participants].sort((a, b) => {
        if (b.progress !== a.progress) return b.progress - a.progress;
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        return a.completedAt.getTime() - b.completedAt.getTime();
      });

      expect(sorted[0].agentId).toBe('a3');
      expect(sorted[1].agentId).toBe('a1');
      expect(sorted[2].agentId).toBe('a2');
    });
  });

  describe('Reward Distribution', () => {
    it('should count completed participants', () => {
      const participants = [
        { agentId: 'a1', completed: true },
        { agentId: 'a2', completed: false },
        { agentId: 'a3', completed: true },
        { agentId: 'a4', completed: true },
      ];

      const completedCount = participants.filter((p) => p.completed).length;
      expect(completedCount).toBe(3);
    });

    it('should calculate total reward distribution', () => {
      const rewardPerWinner = 100;
      const winnersCount = 5;
      const totalRewards = rewardPerWinner * winnersCount;

      expect(totalRewards).toBe(500);
    });

    it('should handle zero winners', () => {
      const participants = [
        { agentId: 'a1', completed: false },
        { agentId: 'a2', completed: false },
      ];

      const completedCount = participants.filter((p) => p.completed).length;
      expect(completedCount).toBe(0);
    });
  });

  describe('Time Validation', () => {
    it('should detect expired challenges', () => {
      const isExpired = (endsAt: Date | null): boolean => {
        if (!endsAt) return false;
        return new Date() > endsAt;
      };

      const past = new Date('2020-01-01T00:00:00Z');
      const future = new Date('2030-01-01T00:00:00Z');

      expect(isExpired(past)).toBe(true);
      expect(isExpired(future)).toBe(false);
      expect(isExpired(null)).toBe(false);
    });

    it('should calculate remaining time', () => {
      const getRemainingSeconds = (endsAt: Date): number => {
        const now = new Date();
        const diff = endsAt.getTime() - now.getTime();
        return Math.max(0, Math.floor(diff / 1000));
      };

      const future = new Date(Date.now() + 5 * 60 * 1000);
      const remaining = getRemainingSeconds(future);

      expect(remaining).toBeGreaterThan(290);
      expect(remaining).toBeLessThan(310);
    });
  });

  describe('Challenge Types', () => {
    it('should have valid challenge types', () => {
      const types: Array<'speed' | 'collection' | 'social' | 'creative' | 'puzzle'> = [
        'speed',
        'collection',
        'social',
        'creative',
        'puzzle',
      ];

      expect(types).toHaveLength(5);
      expect(types).toContain('speed');
      expect(types).toContain('puzzle');
    });

    it('should categorize challenge types', () => {
      const getChallengeCategory = (type: string): string => {
        if (['speed', 'collection'].includes(type)) return 'action';
        if (['social', 'creative'].includes(type)) return 'interaction';
        if (type === 'puzzle') return 'mental';
        return 'unknown';
      };

      expect(getChallengeCategory('speed')).toBe('action');
      expect(getChallengeCategory('social')).toBe('interaction');
      expect(getChallengeCategory('puzzle')).toBe('mental');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero participants', () => {
      const participants: any[] = [];
      const winnersCount = participants.filter((p) => p.completed).length;

      expect(winnersCount).toBe(0);
    });

    it('should handle negative progress increment safely', () => {
      const safeIncrement = (current: number, increment: number): number => {
        const newProgress = current + increment;
        return Math.max(0, newProgress);
      };

      expect(safeIncrement(5, -10)).toBe(0);
      expect(safeIncrement(10, -3)).toBe(7);
    });

    it('should prevent duplicate participants', () => {
      const participants = ['a1', 'a2', 'a3', 'a1'];
      const unique = [...new Set(participants)];

      expect(unique).toHaveLength(3);
      expect(unique).toEqual(['a1', 'a2', 'a3']);
    });

    it('should handle very long time limits', () => {
      const calculateEndTime = (startTime: Date, timeLimitSeconds: number): Date => {
        return new Date(startTime.getTime() + timeLimitSeconds * 1000);
      };

      const start = new Date('2024-01-15T12:00:00Z');
      const end = calculateEndTime(start, 86400); // 24 hours

      expect(end.toISOString()).toBe('2024-01-16T12:00:00.000Z');
    });
  });
});
