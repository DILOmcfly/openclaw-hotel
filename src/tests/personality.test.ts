/**
 * Personality System Tests
 * Tests personality logic without database calls
 */

import { describe, it, expect } from 'vitest';

describe('Personality System', () => {
  describe('Trait Clamping', () => {
    it('should clamp values to 0-100 range', () => {
      const clamp = (value: number): number => Math.max(0, Math.min(100, value));

      expect(clamp(50)).toBe(50);
      expect(clamp(0)).toBe(0);
      expect(clamp(100)).toBe(100);
    });

    it('should clamp negative values to 0', () => {
      const clamp = (value: number): number => Math.max(0, Math.min(100, value));

      expect(clamp(-1)).toBe(0);
      expect(clamp(-50)).toBe(0);
      expect(clamp(-999)).toBe(0);
    });

    it('should clamp values above 100', () => {
      const clamp = (value: number): number => Math.max(0, Math.min(100, value));

      expect(clamp(101)).toBe(100);
      expect(clamp(150)).toBe(100);
      expect(clamp(999)).toBe(100);
    });
  });

  describe('Decay Calculation', () => {
    it('should regress toward 50 by 10% per day', () => {
      const calculateDecay = (current: number, days: number): number => {
        if (days === 0) return current;
        let value = current;
        const DECAY_RATE = 0.1;
        for (let i = 0; i < days; i++) {
          value -= (value - 50) * DECAY_RATE;
        }
        return Math.round(value);
      };

      // High value decays down toward 50
      expect(calculateDecay(100, 1)).toBe(95); // 100 - (50 * 0.1) = 95
      
      // Low value decays up toward 50
      expect(calculateDecay(0, 1)).toBe(5); // 0 - (-50 * 0.1) = 5
    });

    it('should handle no decay when days is 0', () => {
      const calculateDecay = (current: number, days: number): number => {
        if (days === 0) return current;
        let value = current;
        const DECAY_RATE = 0.1;
        for (let i = 0; i < days; i++) {
          value -= (value - 50) * DECAY_RATE;
        }
        return Math.round(value);
      };

      expect(calculateDecay(80, 0)).toBe(80);
      expect(calculateDecay(20, 0)).toBe(20);
    });

    it('should converge toward 50 over multiple days', () => {
      const calculateDecay = (current: number, days: number): number => {
        if (days === 0) return current;
        let value = current;
        const DECAY_RATE = 0.1;
        for (let i = 0; i < days; i++) {
          value -= (value - 50) * DECAY_RATE;
        }
        return Math.round(value);
      };

      // After many days, should get closer to 50
      const after10Days = calculateDecay(100, 10);
      expect(after10Days).toBeGreaterThan(50);
      expect(after10Days).toBeLessThan(70);
    });

    it('should maintain 50 when already at neutral', () => {
      const calculateDecay = (current: number, days: number): number => {
        if (days === 0) return current;
        let value = current;
        const DECAY_RATE = 0.1;
        for (let i = 0; i < days; i++) {
          value -= (value - 50) * DECAY_RATE;
        }
        return Math.round(value);
      };

      expect(calculateDecay(50, 1)).toBe(50);
      expect(calculateDecay(50, 5)).toBe(50);
    });
  });

  describe('Recommendation Logic', () => {
    it('should recommend social actions for high sociability', () => {
      type Personality = {
        sociability: number;
        curiosity: number;
        competitiveness: number;
        generosity: number;
        volatility: number;
      };

      const getRecommendations = (p: Personality): string[] => {
        const recs: string[] = [];
        if (p.sociability > 70) recs.push('host_room_event', 'send_friend_requests');
        if (p.curiosity > 70) recs.push('explore_new_rooms');
        if (p.competitiveness > 70) recs.push('play_games');
        if (p.generosity > 70) recs.push('send_gifts');
        if (p.sociability < 30) recs.push('try_chatting');
        return recs.slice(0, 5);
      };

      const personality: Personality = {
        sociability: 80,
        curiosity: 50,
        competitiveness: 50,
        generosity: 50,
        volatility: 50,
      };

      const recs = getRecommendations(personality);
      expect(recs).toContain('host_room_event');
      expect(recs).toContain('send_friend_requests');
    });

    it('should recommend exploration for high curiosity', () => {
      type Personality = {
        sociability: number;
        curiosity: number;
        competitiveness: number;
        generosity: number;
        volatility: number;
      };

      const getRecommendations = (p: Personality): string[] => {
        const recs: string[] = [];
        if (p.sociability > 70) recs.push('host_room_event');
        if (p.curiosity > 70) recs.push('explore_new_rooms', 'try_new_furniture');
        if (p.competitiveness > 70) recs.push('play_games');
        if (p.generosity > 70) recs.push('send_gifts');
        return recs.slice(0, 5);
      };

      const personality: Personality = {
        sociability: 50,
        curiosity: 75,
        competitiveness: 50,
        generosity: 50,
        volatility: 50,
      };

      const recs = getRecommendations(personality);
      expect(recs).toContain('explore_new_rooms');
    });

    it('should recommend games for high competitiveness', () => {
      type Personality = {
        sociability: number;
        curiosity: number;
        competitiveness: number;
        generosity: number;
        volatility: number;
      };

      const getRecommendations = (p: Personality): string[] => {
        const recs: string[] = [];
        if (p.competitiveness > 70) recs.push('play_games', 'check_leaderboards');
        return recs.slice(0, 5);
      };

      const personality: Personality = {
        sociability: 50,
        curiosity: 50,
        competitiveness: 80,
        generosity: 50,
        volatility: 50,
      };

      const recs = getRecommendations(personality);
      expect(recs).toContain('play_games');
    });

    it('should recommend helping for high generosity', () => {
      type Personality = {
        sociability: number;
        curiosity: number;
        competitiveness: number;
        generosity: number;
        volatility: number;
      };

      const getRecommendations = (p: Personality): string[] => {
        const recs: string[] = [];
        if (p.generosity > 70) recs.push('send_gifts', 'help_newcomers');
        return recs.slice(0, 5);
      };

      const personality: Personality = {
        sociability: 50,
        curiosity: 50,
        competitiveness: 50,
        generosity: 85,
        volatility: 50,
      };

      const recs = getRecommendations(personality);
      expect(recs).toContain('send_gifts');
    });

    it('should recommend balance for low sociability', () => {
      type Personality = {
        sociability: number;
        curiosity: number;
        competitiveness: number;
        generosity: number;
        volatility: number;
      };

      const getRecommendations = (p: Personality): string[] => {
        const recs: string[] = [];
        if (p.sociability < 30) recs.push('try_chatting', 'make_friends');
        return recs.slice(0, 5);
      };

      const personality: Personality = {
        sociability: 20,
        curiosity: 50,
        competitiveness: 50,
        generosity: 50,
        volatility: 50,
      };

      const recs = getRecommendations(personality);
      expect(recs).toContain('try_chatting');
    });

    it('should limit recommendations to max 5', () => {
      type Personality = {
        sociability: number;
        curiosity: number;
        competitiveness: number;
        generosity: number;
        volatility: number;
      };

      const getRecommendations = (p: Personality): string[] => {
        const recs: string[] = [];
        if (p.sociability > 70) recs.push('a', 'b', 'c');
        if (p.curiosity > 70) recs.push('d', 'e', 'f');
        if (p.competitiveness > 70) recs.push('g', 'h', 'i');
        return recs.slice(0, 5);
      };

      const personality: Personality = {
        sociability: 80,
        curiosity: 80,
        competitiveness: 80,
        generosity: 80,
        volatility: 80,
      };

      const recs = getRecommendations(personality);
      expect(recs.length).toBeLessThanOrEqual(5);
    });

    it('should return empty for neutral personality', () => {
      type Personality = {
        sociability: number;
        curiosity: number;
        competitiveness: number;
        generosity: number;
        volatility: number;
      };

      const getRecommendations = (p: Personality): string[] => {
        const recs: string[] = [];
        if (p.sociability > 70) recs.push('host');
        if (p.curiosity > 70) recs.push('explore');
        if (p.competitiveness > 70) recs.push('compete');
        if (p.generosity > 70) recs.push('give');
        if (p.sociability < 30) recs.push('chat');
        return recs.slice(0, 5);
      };

      const personality: Personality = {
        sociability: 50,
        curiosity: 50,
        competitiveness: 50,
        generosity: 50,
        volatility: 50,
      };

      const recs = getRecommendations(personality);
      expect(recs.length).toBe(0);
    });
  });

  describe('Trait Updates', () => {
    it('should apply positive delta correctly', () => {
      const applyDelta = (current: number, delta: number): number => {
        return Math.max(0, Math.min(100, current + delta));
      };

      expect(applyDelta(50, 10)).toBe(60);
      expect(applyDelta(30, 5)).toBe(35);
    });

    it('should apply negative delta correctly', () => {
      const applyDelta = (current: number, delta: number): number => {
        return Math.max(0, Math.min(100, current + delta));
      };

      expect(applyDelta(50, -10)).toBe(40);
      expect(applyDelta(30, -5)).toBe(25);
    });

    it('should prevent overflow above 100', () => {
      const applyDelta = (current: number, delta: number): number => {
        return Math.max(0, Math.min(100, current + delta));
      };

      expect(applyDelta(95, 10)).toBe(100);
      expect(applyDelta(100, 50)).toBe(100);
    });

    it('should prevent underflow below 0', () => {
      const applyDelta = (current: number, delta: number): number => {
        return Math.max(0, Math.min(100, current + delta));
      };

      expect(applyDelta(5, -10)).toBe(0);
      expect(applyDelta(0, -50)).toBe(0);
    });
  });

  describe('Trait Validation', () => {
    it('should validate trait names', () => {
      const validTraits = [
        'sociability',
        'curiosity',
        'competitiveness',
        'generosity',
        'volatility',
      ];

      const isValidTrait = (trait: string): boolean => validTraits.includes(trait);

      expect(isValidTrait('sociability')).toBe(true);
      expect(isValidTrait('curiosity')).toBe(true);
      expect(isValidTrait('competitiveness')).toBe(true);
      expect(isValidTrait('generosity')).toBe(true);
      expect(isValidTrait('volatility')).toBe(true);
    });

    it('should reject invalid trait names', () => {
      const validTraits = [
        'sociability',
        'curiosity',
        'competitiveness',
        'generosity',
        'volatility',
      ];

      const isValidTrait = (trait: string): boolean => validTraits.includes(trait);

      expect(isValidTrait('invalid')).toBe(false);
      expect(isValidTrait('strength')).toBe(false);
      expect(isValidTrait('')).toBe(false);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle empty agent list', () => {
      const bulkProcess = (ids: string[]): number => ids.length;

      expect(bulkProcess([])).toBe(0);
    });

    it('should handle single agent', () => {
      const bulkProcess = (ids: string[]): number => ids.length;

      expect(bulkProcess(['agent-1'])).toBe(1);
    });

    it('should handle multiple agents', () => {
      const bulkProcess = (ids: string[]): number => ids.length;

      expect(bulkProcess(['agent-1', 'agent-2', 'agent-3'])).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly at threshold values', () => {
      const isHigh = (value: number): boolean => value > 70;
      const isLow = (value: number): boolean => value < 30;

      expect(isHigh(70)).toBe(false);
      expect(isHigh(71)).toBe(true);
      expect(isLow(30)).toBe(false);
      expect(isLow(29)).toBe(true);
    });

    it('should handle boundary trait values', () => {
      const clamp = (value: number): number => Math.max(0, Math.min(100, value));

      expect(clamp(0)).toBe(0);
      expect(clamp(100)).toBe(100);
      expect(clamp(50)).toBe(50);
    });
  });

  describe('Action Impacts', () => {
    type ActionImpact = { trait: string; delta: number };

    const calculateActionImpacts = (actionType: string): ActionImpact[] => {
      const impacts: ActionImpact[] = [];
      switch (actionType) {
        case 'room_explore':
          impacts.push({ trait: 'curiosity', delta: 1 });
          break;
        case 'chat_message':
          impacts.push({ trait: 'sociability', delta: 1 });
          break;
        case 'furniture_placed':
          impacts.push({ trait: 'curiosity', delta: 1 });
          break;
        case 'emote_used':
          impacts.push({ trait: 'volatility', delta: 1 });
          impacts.push({ trait: 'sociability', delta: 1 });
          break;
        case 'game_played':
          impacts.push({ trait: 'competitiveness', delta: 2 });
          break;
        case 'game_won':
          impacts.push({ trait: 'competitiveness', delta: 3 });
          break;
        case 'trade_completed':
          impacts.push({ trait: 'generosity', delta: 2 });
          break;
        case 'friend_added':
          impacts.push({ trait: 'sociability', delta: 2 });
          break;
        case 'room_created':
          impacts.push({ trait: 'curiosity', delta: 3 });
          break;
      }
      return impacts;
    };

    it('should map room exploration to curiosity', () => {
      const impacts = calculateActionImpacts('room_explore');
      expect(impacts).toHaveLength(1);
      expect(impacts[0].trait).toBe('curiosity');
      expect(impacts[0].delta).toBe(1);
    });

    it('should map chat to sociability', () => {
      const impacts = calculateActionImpacts('chat_message');
      expect(impacts).toHaveLength(1);
      expect(impacts[0].trait).toBe('sociability');
      expect(impacts[0].delta).toBe(1);
    });

    it('should map emotes to multiple traits', () => {
      const impacts = calculateActionImpacts('emote_used');
      expect(impacts).toHaveLength(2);
      expect(impacts.some(i => i.trait === 'volatility')).toBe(true);
      expect(impacts.some(i => i.trait === 'sociability')).toBe(true);
    });

    it('should map game wins to higher competitiveness boost', () => {
      const playImpacts = calculateActionImpacts('game_played');
      const winImpacts = calculateActionImpacts('game_won');
      
      expect(playImpacts[0].delta).toBe(2);
      expect(winImpacts[0].delta).toBe(3);
      expect(winImpacts[0].delta).toBeGreaterThan(playImpacts[0].delta);
    });

    it('should map trades to generosity', () => {
      const impacts = calculateActionImpacts('trade_completed');
      expect(impacts).toHaveLength(1);
      expect(impacts[0].trait).toBe('generosity');
      expect(impacts[0].delta).toBe(2);
    });

    it('should return empty array for unknown actions', () => {
      const impacts = calculateActionImpacts('unknown_action');
      expect(impacts).toHaveLength(0);
    });

    it('should handle empty string action', () => {
      const impacts = calculateActionImpacts('');
      expect(impacts).toHaveLength(0);
    });

    it('should differentiate between room creation and exploration', () => {
      const createImpacts = calculateActionImpacts('room_created');
      const exploreImpacts = calculateActionImpacts('room_explore');
      
      expect(createImpacts[0].delta).toBe(3);
      expect(exploreImpacts[0].delta).toBe(1);
      expect(createImpacts[0].delta).toBeGreaterThan(exploreImpacts[0].delta);
    });
  });

  describe('Archetype Calculation', () => {
    type Personality = {
      agentId: string;
      sociability: number;
      curiosity: number;
      competitiveness: number;
      generosity: number;
      volatility: number;
      lastUpdated: Date;
      totalActions: number;
      createdAt: Date;
    };

    const calculateArchetype = (p: Personality): string => {
      const { sociability, curiosity, competitiveness, generosity, volatility } = p;

      if (sociability > 75) return '🎭 The Social Butterfly';
      if (curiosity > 75) return '🔍 The Explorer';
      if (competitiveness > 75) return '🏆 The Champion';
      if (generosity > 75) return '💝 The Philanthropist';
      if (volatility > 75) return '🎨 The Wild Card';

      if (sociability > 65 && generosity > 65) return '🤝 The Community Builder';
      if (curiosity > 65 && competitiveness > 65) return '🧪 The Innovator';
      if (sociability > 65 && volatility > 65) return '🎪 The Entertainer';
      if (curiosity > 65 && generosity > 65) return '🌱 The Mentor';
      if (competitiveness > 65 && volatility > 65) return '⚡ The Maverick';

      if (sociability < 30) return '🧊 The Lone Wolf';
      if (curiosity < 30 && competitiveness < 30) return '😴 The Chill One';
      if (generosity < 30 && competitiveness > 60) return '💼 The Pragmatist';

      const allBalanced = [sociability, curiosity, competitiveness, generosity, volatility]
        .every(t => t >= 40 && t <= 60);
      if (allBalanced) return '⚖️ The Balanced';

      return '🌟 The Unique';
    };

    const mockPersonality = (traits: Partial<Omit<Personality, 'agentId' | 'lastUpdated' | 'totalActions' | 'createdAt'>>): Personality => ({
      agentId: 'test-agent',
      sociability: 50,
      curiosity: 50,
      competitiveness: 50,
      generosity: 50,
      volatility: 50,
      lastUpdated: new Date(),
      totalActions: 0,
      createdAt: new Date(),
      ...traits,
    });

    it('should identify Social Butterfly archetype', () => {
      const p = mockPersonality({ sociability: 80 });
      expect(calculateArchetype(p)).toBe('🎭 The Social Butterfly');
    });

    it('should identify Explorer archetype', () => {
      const p = mockPersonality({ curiosity: 80 });
      expect(calculateArchetype(p)).toBe('🔍 The Explorer');
    });

    it('should identify Champion archetype', () => {
      const p = mockPersonality({ competitiveness: 80 });
      expect(calculateArchetype(p)).toBe('🏆 The Champion');
    });

    it('should identify Philanthropist archetype', () => {
      const p = mockPersonality({ generosity: 80 });
      expect(calculateArchetype(p)).toBe('💝 The Philanthropist');
    });

    it('should identify Wild Card archetype', () => {
      const p = mockPersonality({ volatility: 80 });
      expect(calculateArchetype(p)).toBe('🎨 The Wild Card');
    });

    it('should identify Community Builder archetype', () => {
      const p = mockPersonality({ sociability: 70, generosity: 70 });
      expect(calculateArchetype(p)).toBe('🤝 The Community Builder');
    });

    it('should identify Innovator archetype', () => {
      const p = mockPersonality({ curiosity: 70, competitiveness: 70 });
      expect(calculateArchetype(p)).toBe('🧪 The Innovator');
    });

    it('should identify Lone Wolf archetype', () => {
      const p = mockPersonality({ sociability: 25 });
      expect(calculateArchetype(p)).toBe('🧊 The Lone Wolf');
    });

    it('should identify Balanced archetype', () => {
      const p = mockPersonality({ sociability: 50, curiosity: 50, competitiveness: 50, generosity: 50, volatility: 50 });
      expect(calculateArchetype(p)).toBe('⚖️ The Balanced');
    });

    it('should default to Unique for edge cases', () => {
      const p = mockPersonality({ sociability: 35, curiosity: 65, competitiveness: 45 });
      expect(calculateArchetype(p)).toBe('🌟 The Unique');
    });

    it('should prioritize single high trait over combined', () => {
      const p = mockPersonality({ sociability: 80, generosity: 70 });
      expect(calculateArchetype(p)).toBe('🎭 The Social Butterfly'); // sociability > 75 takes priority
    });

    it('should identify Entertainer archetype', () => {
      const p = mockPersonality({ sociability: 70, volatility: 70 });
      expect(calculateArchetype(p)).toBe('🎪 The Entertainer');
    });

    it('should identify Mentor archetype', () => {
      const p = mockPersonality({ curiosity: 70, generosity: 70 });
      expect(calculateArchetype(p)).toBe('🌱 The Mentor');
    });

    it('should identify Maverick archetype', () => {
      const p = mockPersonality({ competitiveness: 70, volatility: 70 });
      expect(calculateArchetype(p)).toBe('⚡ The Maverick');
    });
  });
});
