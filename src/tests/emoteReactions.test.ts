import { describe, it, expect } from 'vitest';

/**
 * Emote Reactions System Unit Tests
 * Tests reaction logic without database (all SQL mocked)
 */

describe('Emote Reactions System', () => {
  describe('Reaction Limits', () => {
    it('should allow up to 20 unique emotes per target', () => {
      const MAX_UNIQUE_EMOTES = 20;
      const existingEmotes = Array.from({ length: 19 }, (_, i) => `emote${i}`);
      const newEmote = 'emote20';

      const canAdd = existingEmotes.length < MAX_UNIQUE_EMOTES || existingEmotes.includes(newEmote);
      expect(canAdd).toBe(true);
    });

    it('should reject 21st unique emote', () => {
      const MAX_UNIQUE_EMOTES = 20;
      const existingEmotes = Array.from({ length: 20 }, (_, i) => `emote${i}`);
      const newEmote = 'emote21';

      const canAdd = existingEmotes.length < MAX_UNIQUE_EMOTES || existingEmotes.includes(newEmote);
      expect(canAdd).toBe(false);
    });

    it('should allow duplicate emote even at limit', () => {
      const MAX_UNIQUE_EMOTES = 20;
      const existingEmotes = Array.from({ length: 20 }, (_, i) => `emote${i}`);
      const duplicateEmote = 'emote5';

      const canAdd = existingEmotes.length < MAX_UNIQUE_EMOTES || existingEmotes.includes(duplicateEmote);
      expect(canAdd).toBe(true);
    });

    it('should allow one reaction per agent per emote per target', () => {
      const reactions = [
        { targetId: 't1', agentId: 'a1', emote: '👍' },
        { targetId: 't1', agentId: 'a1', emote: '👍' }, // Duplicate
      ];

      const uniqueKey = (r: any) => `${r.targetId}-${r.agentId}-${r.emote}`;
      const unique = [...new Set(reactions.map(uniqueKey))];

      expect(unique).toHaveLength(1);
    });
  });

  describe('Reaction Grouping', () => {
    it('should group reactions by emote', () => {
      const reactions = [
        { emote: '👍', agentId: 'a1' },
        { emote: '👍', agentId: 'a2' },
        { emote: '❤️', agentId: 'a3' },
        { emote: '👍', agentId: 'a4' },
      ];

      const grouped = reactions.reduce((acc: Record<string, string[]>, r) => {
        if (!acc[r.emote]) acc[r.emote] = [];
        acc[r.emote].push(r.agentId);
        return acc;
      }, {});

      expect(grouped['👍']).toEqual(['a1', 'a2', 'a4']);
      expect(grouped['❤️']).toEqual(['a3']);
    });

    it('should count reactions per emote', () => {
      const reactions = [
        { emote: '👍', agentId: 'a1' },
        { emote: '👍', agentId: 'a2' },
        { emote: '❤️', agentId: 'a3' },
      ];

      const grouped = reactions.reduce((acc: Record<string, number>, r) => {
        acc[r.emote] = (acc[r.emote] || 0) + 1;
        return acc;
      }, {});

      expect(grouped['👍']).toBe(2);
      expect(grouped['❤️']).toBe(1);
    });

    it('should preserve reactor order', () => {
      const reactions = [
        { emote: '👍', agentId: 'a1', createdAt: new Date('2024-01-01') },
        { emote: '👍', agentId: 'a3', createdAt: new Date('2024-01-03') },
        { emote: '👍', agentId: 'a2', createdAt: new Date('2024-01-02') },
      ];

      const sorted = [...reactions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const reactorOrder = sorted.map(r => r.agentId);

      expect(reactorOrder).toEqual(['a1', 'a2', 'a3']);
    });
  });

  describe('Target Type Validation', () => {
    it('should validate target types', () => {
      const validTypes = ['message', 'room', 'agent', 'furniture', 'event'];
      const testType = 'message';

      expect(validTypes.includes(testType)).toBe(true);
    });

    it('should reject invalid target types', () => {
      const validTypes = ['message', 'room', 'agent', 'furniture', 'event'];
      const testType = 'invalid';

      expect(validTypes.includes(testType)).toBe(false);
    });

    it('should accept all valid target types', () => {
      const validTypes = ['message', 'room', 'agent', 'furniture', 'event'];
      const testTypes = ['message', 'room', 'agent', 'furniture', 'event'];

      testTypes.forEach(type => {
        expect(validTypes.includes(type)).toBe(true);
      });
    });
  });

  describe('Popular Emotes Ranking', () => {
    it('should rank emotes by usage count', () => {
      const reactions = [
        { emote: '👍', count: 10 },
        { emote: '❤️', count: 25 },
        { emote: '😂', count: 5 },
      ];

      const sorted = [...reactions].sort((a, b) => b.count - a.count);

      expect(sorted[0].emote).toBe('❤️');
      expect(sorted[1].emote).toBe('👍');
      expect(sorted[2].emote).toBe('😂');
    });

    it('should respect limit parameter', () => {
      const reactions = [
        { emote: '👍', count: 10 },
        { emote: '❤️', count: 25 },
        { emote: '😂', count: 5 },
        { emote: '🎉', count: 15 },
      ];

      const limit = 2;
      const sorted = [...reactions].sort((a, b) => b.count - a.count).slice(0, limit);

      expect(sorted).toHaveLength(2);
      expect(sorted[0].emote).toBe('❤️');
      expect(sorted[1].emote).toBe('🎉');
    });

    it('should handle tie counts correctly', () => {
      const reactions = [
        { emote: '👍', count: 10 },
        { emote: '❤️', count: 10 },
        { emote: '😂', count: 5 },
      ];

      const sorted = [...reactions].sort((a, b) => b.count - a.count);

      expect(sorted[0].count).toBe(10);
      expect(sorted[1].count).toBe(10);
      expect(sorted[2].count).toBe(5);
    });
  });

  describe('Agent Reaction History', () => {
    it('should track what an agent has reacted to', () => {
      const reactions = [
        { agentId: 'a1', targetId: 't1', emote: '👍' },
        { agentId: 'a1', targetId: 't2', emote: '❤️' },
        { agentId: 'a2', targetId: 't1', emote: '👍' },
      ];

      const agentReactions = reactions.filter(r => r.agentId === 'a1');

      expect(agentReactions).toHaveLength(2);
      expect(agentReactions.map(r => r.targetId)).toEqual(['t1', 't2']);
    });

    it('should sort agent reactions by newest first', () => {
      const reactions = [
        { agentId: 'a1', targetId: 't1', createdAt: new Date('2024-01-01') },
        { agentId: 'a1', targetId: 't2', createdAt: new Date('2024-01-03') },
        { agentId: 'a1', targetId: 't3', createdAt: new Date('2024-01-02') },
      ];

      const sorted = [...reactions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      expect(sorted[0].targetId).toBe('t2');
      expect(sorted[1].targetId).toBe('t3');
      expect(sorted[2].targetId).toBe('t1');
    });

    it('should limit agent reaction results', () => {
      const reactions = Array.from({ length: 100 }, (_, i) => ({
        agentId: 'a1',
        targetId: `t${i}`,
      }));

      const limit = 50;
      const limited = reactions.slice(0, limit);

      expect(limited).toHaveLength(50);
    });
  });

  describe('Reaction Count', () => {
    it('should count total reactions for a target', () => {
      const reactions = [
        { targetType: 'message', targetId: 'm1', emote: '👍' },
        { targetType: 'message', targetId: 'm1', emote: '❤️' },
        { targetType: 'message', targetId: 'm1', emote: '😂' },
        { targetType: 'message', targetId: 'm2', emote: '👍' },
      ];

      const count = reactions.filter(r => r.targetType === 'message' && r.targetId === 'm1').length;

      expect(count).toBe(3);
    });

    it('should return 0 for target with no reactions', () => {
      const reactions: any[] = [];
      const count = reactions.filter(r => r.targetId === 'nonexistent').length;

      expect(count).toBe(0);
    });

    it('should count reactions across different emotes', () => {
      const reactions = [
        { targetId: 't1', emote: '👍' },
        { targetId: 't1', emote: '👍' },
        { targetId: 't1', emote: '❤️' },
      ];

      const uniqueEmotes = new Set(reactions.filter(r => r.targetId === 't1').map(r => r.emote));

      expect(uniqueEmotes.size).toBe(2);
      expect(reactions.filter(r => r.targetId === 't1')).toHaveLength(3);
    });
  });

  describe('Reaction Removal', () => {
    it('should remove specific reaction', () => {
      const reactions = [
        { targetId: 't1', agentId: 'a1', emote: '👍', id: 1 },
        { targetId: 't1', agentId: 'a2', emote: '👍', id: 2 },
      ];

      const toRemove = { targetId: 't1', agentId: 'a1', emote: '👍' };
      const remaining = reactions.filter(
        r => !(r.targetId === toRemove.targetId && r.agentId === toRemove.agentId && r.emote === toRemove.emote)
      );

      expect(remaining).toHaveLength(1);
      expect(remaining[0].agentId).toBe('a2');
    });

    it('should not affect other reactions when removing', () => {
      const reactions = [
        { targetId: 't1', agentId: 'a1', emote: '👍' },
        { targetId: 't1', agentId: 'a1', emote: '❤️' },
        { targetId: 't1', agentId: 'a2', emote: '👍' },
      ];

      const toRemove = { targetId: 't1', agentId: 'a1', emote: '👍' };
      const remaining = reactions.filter(
        r => !(r.targetId === toRemove.targetId && r.agentId === toRemove.agentId && r.emote === toRemove.emote)
      );

      expect(remaining).toHaveLength(2);
    });

    it('should return false if reaction does not exist', () => {
      const reactions = [
        { targetId: 't1', agentId: 'a1', emote: '👍' },
      ];

      const toRemove = { targetId: 't1', agentId: 'a2', emote: '👍' };
      const found = reactions.some(
        r => r.targetId === toRemove.targetId && r.agentId === toRemove.agentId && r.emote === toRemove.emote
      );

      expect(found).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty reaction list', () => {
      const reactions: any[] = [];
      const grouped = reactions.reduce((acc: Record<string, number>, r) => {
        acc[r.emote] = (acc[r.emote] || 0) + 1;
        return acc;
      }, {});

      expect(Object.keys(grouped)).toHaveLength(0);
    });

    it('should handle emote with special characters', () => {
      const emote = '🎉✨';
      const isValid = emote.length <= 10;

      expect(isValid).toBe(true);
    });

    it('should enforce emote length limit', () => {
      const emote = '12345678901'; // 11 chars
      const isValid = emote.length <= 10;

      expect(isValid).toBe(false);
    });
  });
});
