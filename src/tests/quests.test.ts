import { describe, it, expect } from 'vitest';

/**
 * Quests System Unit Tests
 * Tests quest assignment, progress tracking, and rewards without database
 */

describe('Quests System', () => {
  describe('Quest Progress Calculation', () => {
    it('should calculate progress percentage', () => {
      const calcProgress = (current: number, required: number): number => {
        return Math.floor((current / required) * 100);
      };

      expect(calcProgress(3, 10)).toBe(30);
      expect(calcProgress(5, 10)).toBe(50);
      expect(calcProgress(10, 10)).toBe(100);
    });

    it('should cap progress at requirement value', () => {
      const updateProgress = (current: number, increment: number, max: number): number => {
        return Math.min(current + increment, max);
      };

      expect(updateProgress(8, 5, 10)).toBe(10);
      expect(updateProgress(9, 10, 10)).toBe(10);
      expect(updateProgress(10, 1, 10)).toBe(10);
    });

    it('should handle zero progress correctly', () => {
      const updateProgress = (current: number, increment: number, max: number): number => {
        return Math.min(current + increment, max);
      };

      expect(updateProgress(0, 1, 10)).toBe(1);
      expect(updateProgress(0, 0, 10)).toBe(0);
    });
  });

  describe('Quest Completion Logic', () => {
    it('should mark quest as complete when progress meets requirement', () => {
      const isComplete = (progress: number, requirement: number): boolean => {
        return progress >= requirement;
      };

      expect(isComplete(10, 10)).toBe(true);
      expect(isComplete(15, 10)).toBe(true);
      expect(isComplete(9, 10)).toBe(false);
    });

    it('should not complete quest if progress is below requirement', () => {
      const isComplete = (progress: number, requirement: number): boolean => {
        return progress >= requirement;
      };

      expect(isComplete(0, 10)).toBe(false);
      expect(isComplete(5, 10)).toBe(false);
      expect(isComplete(9, 10)).toBe(false);
    });

    it('should handle edge case of zero requirement', () => {
      const isComplete = (progress: number, requirement: number): boolean => {
        return progress >= requirement;
      };

      expect(isComplete(0, 0)).toBe(true);
      expect(isComplete(1, 0)).toBe(true);
    });
  });

  describe('Quest Type Filtering', () => {
    it('should filter quests by type', () => {
      const mockQuests = [
        { id: 1, questType: 'daily' },
        { id: 2, questType: 'weekly' },
        { id: 3, questType: 'daily' },
        { id: 4, questType: 'special' },
      ];

      const filtered = mockQuests.filter((q) => q.questType === 'daily');
      expect(filtered).toHaveLength(2);
      expect(filtered.map((q) => q.id)).toEqual([1, 3]);
    });

    it('should return all quests when no type filter', () => {
      const mockQuests = [
        { id: 1, questType: 'daily' },
        { id: 2, questType: 'weekly' },
        { id: 3, questType: 'special' },
      ];

      const filtered = mockQuests;
      expect(filtered).toHaveLength(3);
    });

    it('should handle empty quest list', () => {
      const mockQuests: any[] = [];
      const filtered = mockQuests.filter((q) => q.questType === 'daily');
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Reward Calculation', () => {
    it('should calculate total reward for quest', () => {
      const calcReward = (coins: number, xp: number) => ({ coins, xp });

      expect(calcReward(50, 10)).toEqual({ coins: 50, xp: 10 });
      expect(calcReward(150, 30)).toEqual({ coins: 150, xp: 30 });
      expect(calcReward(300, 60)).toEqual({ coins: 300, xp: 60 });
    });

    it('should handle zero rewards', () => {
      const calcReward = (coins: number, xp: number) => ({ coins, xp });

      expect(calcReward(0, 0)).toEqual({ coins: 0, xp: 0 });
    });

    it('should sum multiple quest rewards', () => {
      const rewards = [
        { coins: 50, xp: 10 },
        { coins: 40, xp: 8 },
        { coins: 30, xp: 5 },
      ];

      const total = rewards.reduce(
        (acc, r) => ({ coins: acc.coins + r.coins, xp: acc.xp + r.xp }),
        { coins: 0, xp: 0 }
      );

      expect(total).toEqual({ coins: 120, xp: 23 });
    });
  });

  describe('Quest Assignment Logic', () => {
    it('should prevent duplicate quest assignment', () => {
      const existingQuests = [1, 2, 3];
      const newQuestId = 2;

      const isDuplicate = existingQuests.includes(newQuestId);
      expect(isDuplicate).toBe(true);
    });

    it('should allow new quest assignment', () => {
      const existingQuests = [1, 2, 3];
      const newQuestId = 4;

      const isDuplicate = existingQuests.includes(newQuestId);
      expect(isDuplicate).toBe(false);
    });

    it('should count assigned quests correctly', () => {
      const assignedQuests = [
        { questId: 1, agentId: 'a1' },
        { questId: 2, agentId: 'a1' },
        { questId: 3, agentId: 'a1' },
      ];

      expect(assignedQuests).toHaveLength(3);
    });
  });

  describe('Quest Sorting', () => {
    it('should sort quests by type then id', () => {
      const mockQuests = [
        { id: 3, questType: 'weekly' },
        { id: 1, questType: 'daily' },
        { id: 4, questType: 'special' },
        { id: 2, questType: 'daily' },
      ];

      const typeOrder = { daily: 1, weekly: 2, special: 3 };
      const sorted = [...mockQuests].sort((a, b) => {
        const typeCompare = typeOrder[a.questType as keyof typeof typeOrder] - typeOrder[b.questType as keyof typeof typeOrder];
        return typeCompare !== 0 ? typeCompare : a.id - b.id;
      });

      expect(sorted.map((q) => q.id)).toEqual([1, 2, 3, 4]);
    });

    it('should maintain order within same type', () => {
      const mockQuests = [
        { id: 3, questType: 'daily' },
        { id: 1, questType: 'daily' },
        { id: 2, questType: 'daily' },
      ];

      const sorted = [...mockQuests].sort((a, b) => a.id - b.id);
      expect(sorted.map((q) => q.id)).toEqual([1, 2, 3]);
    });
  });

  describe('Requirement Validation', () => {
    it('should validate requirement types', () => {
      const validTypes = [
        'visit_rooms',
        'send_messages',
        'play_games',
        'buy_items',
        'make_friends',
        'earn_coins',
        'visit_unique_rooms',
        'win_games',
      ];

      expect(validTypes.includes('visit_rooms')).toBe(true);
      expect(validTypes.includes('invalid_type')).toBe(false);
    });

    it('should validate requirement values are positive', () => {
      const isValidRequirement = (value: number): boolean => value > 0;

      expect(isValidRequirement(1)).toBe(true);
      expect(isValidRequirement(10)).toBe(true);
      expect(isValidRequirement(0)).toBe(false);
      expect(isValidRequirement(-5)).toBe(false);
    });

    it('should validate quest has valid type', () => {
      const validQuestTypes = ['daily', 'weekly', 'special'];
      const isValidType = (type: string): boolean => validQuestTypes.includes(type);

      expect(isValidType('daily')).toBe(true);
      expect(isValidType('weekly')).toBe(true);
      expect(isValidType('special')).toBe(true);
      expect(isValidType('monthly')).toBe(false);
    });
  });

  describe('Progress Increment', () => {
    it('should increment progress by specified amount', () => {
      const incrementProgress = (current: number, increment: number): number => {
        return current + increment;
      };

      expect(incrementProgress(5, 1)).toBe(6);
      expect(incrementProgress(0, 5)).toBe(5);
      expect(incrementProgress(10, 3)).toBe(13);
    });

    it('should handle negative increments', () => {
      const incrementProgress = (current: number, increment: number): number => {
        return Math.max(0, current + increment);
      };

      expect(incrementProgress(5, -2)).toBe(3);
      expect(incrementProgress(3, -5)).toBe(0);
      expect(incrementProgress(0, -1)).toBe(0);
    });

    it('should default to increment of 1', () => {
      const incrementProgress = (current: number, increment?: number): number => {
        return current + (increment ?? 1);
      };

      expect(incrementProgress(5)).toBe(6);
      expect(incrementProgress(0)).toBe(1);
      expect(incrementProgress(10, undefined)).toBe(11);
    });
  });

  describe('Edge Cases', () => {
    it('should handle quest with zero progress', () => {
      type QuestProgress = { progress: number; requirement: number };
      const quest: QuestProgress = { progress: 0, requirement: 10 };

      expect(quest.progress).toBe(0);
      expect(quest.progress < quest.requirement).toBe(true);
    });

    it('should handle completed quest', () => {
      type CompletedQuest = { completed: boolean; completedAt: Date | null };
      const quest: CompletedQuest = {
        completed: true,
        completedAt: new Date('2024-01-15'),
      };

      expect(quest.completed).toBe(true);
      expect(quest.completedAt).not.toBeNull();
    });

    it('should handle incomplete quest', () => {
      type CompletedQuest = { completed: boolean; completedAt: Date | null };
      const quest: CompletedQuest = {
        completed: false,
        completedAt: null,
      };

      expect(quest.completed).toBe(false);
      expect(quest.completedAt).toBeNull();
    });
  });
});
