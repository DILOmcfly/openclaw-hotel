import { describe, it, expect } from 'vitest';

/**
 * Achievement System Unit Tests
 * These tests validate logic and data structures without requiring a database
 */

describe('Achievement System - Validation', () => {
  it('should validate achievement condition types', () => {
    const validConditionTypes = [
      'login_count',
      'room_count',
      'trade_count',
      'friends_count',
      'message_count',
    ];

    const validateConditionType = (type: string): boolean => {
      return validConditionTypes.includes(type);
    };

    expect(validateConditionType('login_count')).toBe(true);
    expect(validateConditionType('room_count')).toBe(true);
    expect(validateConditionType('invalid_type')).toBe(false);
    expect(validateConditionType('')).toBe(false);
  });

  it('should validate achievement data structure', () => {
    type Achievement = {
      id: string;
      name: string;
      description: string;
      icon: string;
      conditionType: string;
      conditionValue: number;
    };

    const validateAchievement = (achievement: Achievement): { valid: boolean; error?: string } => {
      if (!achievement.name || achievement.name.length > 64) {
        return { valid: false, error: 'Name must be 1-64 characters' };
      }
      if (!achievement.description) {
        return { valid: false, error: 'Description is required' };
      }
      if (!achievement.icon || achievement.icon.length > 8) {
        return { valid: false, error: 'Icon must be 1-8 characters (emoji)' };
      }
      if (achievement.conditionValue < 0) {
        return { valid: false, error: 'Condition value cannot be negative' };
      }
      return { valid: true };
    };

    const validAchievement: Achievement = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'first_login',
      description: 'Welcome!',
      icon: '👋',
      conditionType: 'login_count',
      conditionValue: 1,
    };

    const invalidName: Achievement = {
      ...validAchievement,
      name: 'a'.repeat(65),
    };

    const invalidIcon: Achievement = {
      ...validAchievement,
      icon: 'too_long_emoji',
    };

    const invalidValue: Achievement = {
      ...validAchievement,
      conditionValue: -1,
    };

    expect(validateAchievement(validAchievement).valid).toBe(true);
    expect(validateAchievement(invalidName).valid).toBe(false);
    expect(validateAchievement(invalidName).error).toBe('Name must be 1-64 characters');
    expect(validateAchievement(invalidIcon).valid).toBe(false);
    expect(validateAchievement(invalidValue).valid).toBe(false);
  });

  it('should prevent duplicate award logic', () => {
    type AgentAchievement = {
      agentId: string;
      achievementId: string;
    };

    const agentAchievements: AgentAchievement[] = [];

    const awardAchievement = (
      agentId: string,
      achievementId: string
    ): { awarded: boolean; reason?: string } => {
      const exists = agentAchievements.some(
        (aa) => aa.agentId === agentId && aa.achievementId === achievementId
      );

      if (exists) {
        return { awarded: false, reason: 'Already has this achievement' };
      }

      agentAchievements.push({ agentId, achievementId });
      return { awarded: true };
    };

    const agentId = 'agent-123';
    const achievementId = 'badge-456';

    // First award should succeed
    const firstAward = awardAchievement(agentId, achievementId);
    expect(firstAward.awarded).toBe(true);
    expect(agentAchievements).toHaveLength(1);

    // Second award should fail (duplicate)
    const secondAward = awardAchievement(agentId, achievementId);
    expect(secondAward.awarded).toBe(false);
    expect(secondAward.reason).toBe('Already has this achievement');
    expect(agentAchievements).toHaveLength(1);

    // Different achievement for same agent should succeed
    const thirdAward = awardAchievement(agentId, 'badge-789');
    expect(thirdAward.awarded).toBe(true);
    expect(agentAchievements).toHaveLength(2);
  });

  it('should correctly map event types to condition types', () => {
    const conditionMap: Record<string, string> = {
      login: 'login_count',
      room_created: 'room_count',
      trade_completed: 'trade_count',
      friend_added: 'friends_count',
      message_sent: 'message_count',
    };

    expect(conditionMap['login']).toBe('login_count');
    expect(conditionMap['room_created']).toBe('room_count');
    expect(conditionMap['trade_completed']).toBe('trade_count');
    expect(conditionMap['friend_added']).toBe('friends_count');
    expect(conditionMap['message_sent']).toBe('message_count');
    expect(conditionMap['invalid_event']).toBeUndefined();
  });

  it('should determine achievement eligibility', () => {
    type Achievement = {
      id: string;
      conditionType: string;
      conditionValue: number;
    };

    const checkEligibility = (
      achievement: Achievement,
      currentValue: number,
      alreadyEarned: boolean
    ): boolean => {
      if (alreadyEarned) return false;
      return currentValue >= achievement.conditionValue;
    };

    const achievement: Achievement = {
      id: 'badge-1',
      conditionType: 'room_count',
      conditionValue: 5,
    };

    expect(checkEligibility(achievement, 10, false)).toBe(true); // Has enough, not earned
    expect(checkEligibility(achievement, 5, false)).toBe(true); // Exactly enough
    expect(checkEligibility(achievement, 3, false)).toBe(false); // Not enough
    expect(checkEligibility(achievement, 10, true)).toBe(false); // Already earned
  });

  it('should sort achievements by earned status and value', () => {
    type AchievementWithStatus = {
      name: string;
      conditionValue: number;
      earned: boolean;
    };

    const achievements: AchievementWithStatus[] = [
      { name: '100_messages', conditionValue: 100, earned: false },
      { name: 'first_room', conditionValue: 1, earned: true },
      { name: '10_friends', conditionValue: 10, earned: false },
      { name: 'first_login', conditionValue: 1, earned: true },
      { name: 'first_trade', conditionValue: 1, earned: false },
    ];

    const sorted = [...achievements].sort((a, b) => {
      // Earned first
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      // Then by condition value
      return a.conditionValue - b.conditionValue;
    });

    expect(sorted[0].earned).toBe(true);
    expect(sorted[1].earned).toBe(true);
    expect(sorted[2].earned).toBe(false);
    expect(sorted[2].conditionValue).toBe(1); // first_trade
    expect(sorted[3].conditionValue).toBe(10); // 10_friends
    expect(sorted[4].conditionValue).toBe(100); // 100_messages
  });
});
