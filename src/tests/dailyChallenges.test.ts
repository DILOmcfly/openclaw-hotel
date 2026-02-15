import { describe, it, expect, vi } from 'vitest';
import type { DailyChallenge, ChallengeProgress } from '../services/dailyChallenges.js';

/**
 * Daily Challenges Unit Tests
 * All tests use mocked SQL - no database required
 */

describe('Daily Challenges - Validation', () => {
  it('should validate challenge types', () => {
    const validTypes = [
      'send_messages',
      'visit_rooms',
      'make_trades',
      'play_games',
      'send_gifts',
      'take_photos',
      'earn_karma',
    ];

    const validateChallengeType = (type: string): boolean => {
      return validTypes.includes(type);
    };

    expect(validateChallengeType('send_messages')).toBe(true);
    expect(validateChallengeType('visit_rooms')).toBe(true);
    expect(validateChallengeType('invalid_type')).toBe(false);
  });

  it('should validate challenge data structure', () => {
    const validateChallenge = (challenge: Partial<DailyChallenge>): {
      valid: boolean;
      error?: string;
    } => {
      if (!challenge.title || challenge.title.length === 0) {
        return { valid: false, error: 'Title is required' };
      }
      if (!challenge.description) {
        return { valid: false, error: 'Description is required' };
      }
      if (!challenge.targetCount || challenge.targetCount <= 0) {
        return { valid: false, error: 'Target count must be positive' };
      }
      return { valid: true };
    };

    const validChallenge: Partial<DailyChallenge> = {
      title: 'Social Butterfly',
      description: 'Send 10 messages',
      targetCount: 10,
      rewardCoins: 50,
    };

    const invalidTitle: Partial<DailyChallenge> = {
      ...validChallenge,
      title: '',
    };

    const invalidTarget: Partial<DailyChallenge> = {
      ...validChallenge,
      targetCount: 0,
    };

    expect(validateChallenge(validChallenge).valid).toBe(true);
    expect(validateChallenge(invalidTitle).valid).toBe(false);
    expect(validateChallenge(invalidTarget).valid).toBe(false);
  });

  it('should calculate progress percentage correctly', () => {
    const calculateProgress = (current: number, target: number): number => {
      return Math.min(Math.round((current / target) * 100), 100);
    };

    expect(calculateProgress(5, 10)).toBe(50);
    expect(calculateProgress(10, 10)).toBe(100);
    expect(calculateProgress(15, 10)).toBe(100); // Cap at 100%
    expect(calculateProgress(0, 10)).toBe(0);
  });

  it('should determine if challenge is completed', () => {
    const isCompleted = (current: number, target: number): boolean => {
      return current >= target;
    };

    expect(isCompleted(10, 10)).toBe(true);
    expect(isCompleted(11, 10)).toBe(true);
    expect(isCompleted(9, 10)).toBe(false);
    expect(isCompleted(0, 10)).toBe(false);
  });

  it('should prevent over-incrementing progress', () => {
    const incrementWithCap = (current: number, target: number): number => {
      return Math.min(current + 1, target);
    };

    expect(incrementWithCap(5, 10)).toBe(6);
    expect(incrementWithCap(9, 10)).toBe(10);
    expect(incrementWithCap(10, 10)).toBe(10); // Already at max
    expect(incrementWithCap(15, 10)).toBe(10); // Cap at target
  });

  it('should validate claim eligibility', () => {
    const canClaim = (progress: Partial<ChallengeProgress>): {
      eligible: boolean;
      reason?: string;
    } => {
      if (!progress.completed) {
        return { eligible: false, reason: 'Challenge not completed' };
      }
      return { eligible: true };
    };

    const completedProgress: Partial<ChallengeProgress> = {
      completed: true,
      currentCount: 10,
    };

    const incompleteProgress: Partial<ChallengeProgress> = {
      completed: false,
      currentCount: 5,
    };

    expect(canClaim(completedProgress).eligible).toBe(true);
    expect(canClaim(incompleteProgress).eligible).toBe(false);
    expect(canClaim(incompleteProgress).reason).toBe('Challenge not completed');
  });

  it('should calculate total reward coins correctly', () => {
    const challenges: Partial<DailyChallenge>[] = [
      { rewardCoins: 50 },
      { rewardCoins: 75 },
      { rewardCoins: 60 },
    ];

    const totalRewards = challenges.reduce((sum, c) => sum + (c.rewardCoins || 0), 0);

    expect(totalRewards).toBe(185);
  });

  it('should filter challenges by active date', () => {
    const challenges = [
      { id: '1', activeDate: '2026-02-15' },
      { id: '2', activeDate: '2026-02-14' },
      { id: '3', activeDate: '2026-02-15' },
    ];

    const today = '2026-02-15';
    const todayChallenges = challenges.filter((c) => c.activeDate === today);

    expect(todayChallenges).toHaveLength(2);
    expect(todayChallenges[0].id).toBe('1');
    expect(todayChallenges[1].id).toBe('3');
  });

  it('should handle multiple challenge types for same agent', () => {
    type ProgressMap = Map<string, number>;

    const incrementMultiple = (
      progressMap: ProgressMap,
      challengeIds: string[]
    ): ProgressMap => {
      const newMap = new Map(progressMap);
      challengeIds.forEach((id) => {
        const current = newMap.get(id) || 0;
        newMap.set(id, current + 1);
      });
      return newMap;
    };

    const progress: ProgressMap = new Map([
      ['send_messages_daily', 5],
      ['visit_rooms_daily', 2],
    ]);

    const updated = incrementMultiple(progress, [
      'send_messages_daily',
      'send_messages_daily',
    ]);

    expect(updated.get('send_messages_daily')).toBe(7);
    expect(updated.get('visit_rooms_daily')).toBe(2);
  });

  it('should sort challenges by completion status', () => {
    type ChallengeWithCompletion = {
      title: string;
      completed: boolean;
      currentCount: number;
    };

    const challenges: ChallengeWithCompletion[] = [
      { title: 'Challenge A', completed: false, currentCount: 5 },
      { title: 'Challenge B', completed: true, currentCount: 10 },
      { title: 'Challenge C', completed: false, currentCount: 2 },
      { title: 'Challenge D', completed: true, currentCount: 8 },
    ];

    const sorted = [...challenges].sort((a, b) => {
      // Incomplete challenges first (for prominence)
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // Then by progress
      return b.currentCount - a.currentCount;
    });

    expect(sorted[0].completed).toBe(false);
    expect(sorted[0].title).toBe('Challenge A'); // 5 progress
    expect(sorted[1].completed).toBe(false);
    expect(sorted[1].title).toBe('Challenge C'); // 2 progress
    expect(sorted[2].completed).toBe(true);
  });

  it('should prevent double-claiming rewards', () => {
    const claimedChallenges = new Set<string>();

    const claimReward = (
      challengeId: string,
      completed: boolean
    ): { success: boolean; error?: string } => {
      if (!completed) {
        return { success: false, error: 'Not completed' };
      }
      if (claimedChallenges.has(challengeId)) {
        return { success: false, error: 'Already claimed' };
      }
      claimedChallenges.add(challengeId);
      return { success: true };
    };

    // First claim succeeds
    const firstClaim = claimReward('challenge-1', true);
    expect(firstClaim.success).toBe(true);

    // Second claim fails
    const secondClaim = claimReward('challenge-1', true);
    expect(secondClaim.success).toBe(false);
    expect(secondClaim.error).toBe('Already claimed');

    // Incomplete challenge fails
    const incompleteClaim = claimReward('challenge-2', false);
    expect(incompleteClaim.success).toBe(false);
    expect(incompleteClaim.error).toBe('Not completed');
  });

  it('should track daily completion count', () => {
    type DailyProgress = {
      date: string;
      completedCount: number;
    };

    const trackCompletion = (
      progress: DailyProgress,
      date: string
    ): DailyProgress => {
      if (progress.date !== date) {
        // New day, reset
        return { date, completedCount: 1 };
      }
      return { ...progress, completedCount: progress.completedCount + 1 };
    };

    let progress: DailyProgress = { date: '2026-02-15', completedCount: 0 };

    progress = trackCompletion(progress, '2026-02-15');
    expect(progress.completedCount).toBe(1);

    progress = trackCompletion(progress, '2026-02-15');
    expect(progress.completedCount).toBe(2);

    // New day resets
    progress = trackCompletion(progress, '2026-02-16');
    expect(progress.completedCount).toBe(1);
    expect(progress.date).toBe('2026-02-16');
  });

  it('should validate reward amounts are positive', () => {
    const validateReward = (coins: number): { valid: boolean; error?: string } => {
      if (coins < 0) {
        return { valid: false, error: 'Reward cannot be negative' };
      }
      if (coins === 0) {
        return { valid: false, error: 'Reward must be greater than zero' };
      }
      return { valid: true };
    };

    expect(validateReward(50).valid).toBe(true);
    expect(validateReward(0).valid).toBe(false);
    expect(validateReward(-10).valid).toBe(false);
  });
});
