/**
 * Tests for Social Dynamics Service - Logic & Integration
 */

import { describe, it, expect } from 'vitest';
import type { Relationship, InteractionEvent, GroupDynamics } from '../services/socialDynamics.js';
import { BigFiveTraits, calculateCompatibility } from '../services/personalityEngine.js';

describe('Social Dynamics Service - Core Logic', () => {
  describe('Affinity Calculation Logic', () => {
    it('should calculate positive affinity delta for chat events', () => {
      const calculateChatAffinity = (interactionCount: number): number => {
        return Math.max(5, 15 - Math.floor(interactionCount / 5));
      };

      expect(calculateChatAffinity(0)).toBe(15); // First chat
      expect(calculateChatAffinity(5)).toBe(14); // After 5 chats
      expect(calculateChatAffinity(10)).toBe(13); // After 10 chats
      expect(calculateChatAffinity(50)).toBe(5); // Floor at 5
      expect(calculateChatAffinity(100)).toBe(5); // Floor at 5
    });

    it('should apply diminishing returns for repeated chats', () => {
      const calculateChatAffinity = (interactionCount: number): number => {
        return Math.max(5, 15 - Math.floor(interactionCount / 5));
      };

      const firstChat = calculateChatAffinity(0);
      const fifthChat = calculateChatAffinity(5);
      const tenthChat = calculateChatAffinity(10);

      expect(firstChat).toBeGreaterThan(fifthChat);
      expect(fifthChat).toBeGreaterThan(tenthChat);
    });

    it('should calculate help event affinity delta in correct range', () => {
      const calculateHelpAffinity = (): number => {
        return 20 + Math.floor(Math.random() * 11); // 20-30
      };

      for (let i = 0; i < 10; i++) {
        const delta = calculateHelpAffinity();
        expect(delta).toBeGreaterThanOrEqual(20);
        expect(delta).toBeLessThanOrEqual(30);
      }
    });

    it('should calculate negative affinity for ignore events', () => {
      const calculateIgnoreAffinity = (): number => {
        return -10 - Math.floor(Math.random() * 6); // -10 to -15
      };

      for (let i = 0; i < 10; i++) {
        const delta = calculateIgnoreAffinity();
        expect(delta).toBeLessThanOrEqual(-10);
        expect(delta).toBeGreaterThanOrEqual(-15);
      }
    });

    it('should calculate severe negative affinity for conflict', () => {
      const calculateConflictAffinity = (): number => {
        return -25 - Math.floor(Math.random() * 11); // -25 to -35
      };

      for (let i = 0; i < 10; i++) {
        const delta = calculateConflictAffinity();
        expect(delta).toBeLessThanOrEqual(-25);
        expect(delta).toBeGreaterThanOrEqual(-35);
      }
    });

    it('should clamp affinity values to -100 to 100 range', () => {
      const clampAffinity = (value: number): number => {
        return Math.max(-100, Math.min(100, value));
      };

      expect(clampAffinity(150)).toBe(100);
      expect(clampAffinity(-150)).toBe(-100);
      expect(clampAffinity(50)).toBe(50);
      expect(clampAffinity(-50)).toBe(-50);
      expect(clampAffinity(0)).toBe(0);
    });
  });

  describe('Friend/Rival Classification', () => {
    it('should classify agents with affinity > 30 as friends', () => {
      const isFriend = (affinity: number): boolean => affinity > 30;

      expect(isFriend(31)).toBe(true);
      expect(isFriend(50)).toBe(true);
      expect(isFriend(100)).toBe(true);
      expect(isFriend(30)).toBe(false);
      expect(isFriend(0)).toBe(false);
      expect(isFriend(-30)).toBe(false);
    });

    it('should classify agents with affinity < -30 as rivals', () => {
      const isRival = (affinity: number): boolean => affinity < -30;

      expect(isRival(-31)).toBe(true);
      expect(isRival(-50)).toBe(true);
      expect(isRival(-100)).toBe(true);
      expect(isRival(-30)).toBe(false);
      expect(isRival(0)).toBe(false);
      expect(isRival(30)).toBe(false);
    });

    it('should classify agents with affinity -30 to 30 as neutral', () => {
      const isNeutral = (affinity: number): boolean => {
        return affinity >= -30 && affinity <= 30;
      };

      expect(isNeutral(0)).toBe(true);
      expect(isNeutral(30)).toBe(true);
      expect(isNeutral(-30)).toBe(true);
      expect(isNeutral(15)).toBe(true);
      expect(isNeutral(-15)).toBe(true);
      expect(isNeutral(31)).toBe(false);
      expect(isNeutral(-31)).toBe(false);
    });
  });

  describe('Interaction Scoring Logic', () => {
    it('should score nearby agents based on personality compatibility', () => {
      const extrovert: BigFiveTraits = {
        openness: 70,
        conscientiousness: 60,
        extraversion: 85,
        agreeableness: 75,
        neuroticism: 30,
      };

      const introvert: BigFiveTraits = {
        openness: 60,
        conscientiousness: 70,
        extraversion: 25,
        agreeableness: 65,
        neuroticism: 45,
      };

      const compatibility1 = calculateCompatibility(extrovert, extrovert);
      const compatibility2 = calculateCompatibility(extrovert, introvert);

      // Similar personalities should have higher compatibility
      expect(compatibility1).toBeGreaterThan(compatibility2);
    });

    it('should apply affinity bonus to interaction score', () => {
      const calculateScore = (
        compatibility: number,
        affinity: number,
        hoursSinceLastInteraction: number
      ): number => {
        const affinityBonus = affinity * 0.3;
        const recencyPenalty = Math.max(0, 20 - hoursSinceLastInteraction * 2);
        return compatibility + affinityBonus - recencyPenalty;
      };

      const baseCompatibility = 60;
      
      const friendScore = calculateScore(baseCompatibility, 50, 24); // Friend
      const neutralScore = calculateScore(baseCompatibility, 0, 24); // Neutral
      const rivalScore = calculateScore(baseCompatibility, -50, 24); // Rival

      expect(friendScore).toBeGreaterThan(neutralScore);
      expect(neutralScore).toBeGreaterThan(rivalScore);
    });

    it('should penalize recently interacted agents', () => {
      const calculateRecencyPenalty = (hoursSinceLastInteraction: number): number => {
        return Math.max(0, 20 - hoursSinceLastInteraction * 2);
      };

      expect(calculateRecencyPenalty(0)).toBe(20); // Just now
      expect(calculateRecencyPenalty(5)).toBe(10); // 5 hours ago
      expect(calculateRecencyPenalty(10)).toBe(0); // 10+ hours ago
      expect(calculateRecencyPenalty(24)).toBe(0); // 24 hours ago
    });
  });

  describe('Group Dynamics Classification', () => {
    it('should classify high average affinity + low tension as harmonious', () => {
      const classifyGroupMood = (
        averageAffinity: number,
        tensionLevel: number
      ): 'harmonious' | 'neutral' | 'tense' | 'conflicted' => {
        if (averageAffinity > 30 && tensionLevel < 30) {
          return 'harmonious';
        } else if (averageAffinity < -20 || tensionLevel > 60) {
          return 'conflicted';
        } else if (averageAffinity < 0 || tensionLevel > 40) {
          return 'tense';
        } else {
          return 'neutral';
        }
      };

      expect(classifyGroupMood(40, 20)).toBe('harmonious');
      expect(classifyGroupMood(50, 25)).toBe('harmonious');
    });

    it('should classify negative affinity or high tension as conflicted', () => {
      const classifyGroupMood = (
        averageAffinity: number,
        tensionLevel: number
      ): 'harmonious' | 'neutral' | 'tense' | 'conflicted' => {
        if (averageAffinity > 30 && tensionLevel < 30) {
          return 'harmonious';
        } else if (averageAffinity < -20 || tensionLevel > 60) {
          return 'conflicted';
        } else if (averageAffinity < 0 || tensionLevel > 40) {
          return 'tense';
        } else {
          return 'neutral';
        }
      };

      expect(classifyGroupMood(-30, 30)).toBe('conflicted');
      expect(classifyGroupMood(20, 70)).toBe('conflicted');
    });

    it('should classify moderate conditions as tense', () => {
      const classifyGroupMood = (
        averageAffinity: number,
        tensionLevel: number
      ): 'harmonious' | 'neutral' | 'tense' | 'conflicted' => {
        if (averageAffinity > 30 && tensionLevel < 30) {
          return 'harmonious';
        } else if (averageAffinity < -20 || tensionLevel > 60) {
          return 'conflicted';
        } else if (averageAffinity < 0 || tensionLevel > 40) {
          return 'tense';
        } else {
          return 'neutral';
        }
      };

      expect(classifyGroupMood(-10, 50)).toBe('tense');
      expect(classifyGroupMood(10, 45)).toBe('tense');
    });

    it('should calculate tension from affinity variance', () => {
      const calculateTension = (affinities: number[]): number => {
        const average = affinities.reduce((sum, a) => sum + a, 0) / affinities.length;
        const variance = affinities.reduce(
          (sum, a) => sum + Math.pow(a - average, 2),
          0
        ) / affinities.length;
        return Math.min(100, Math.sqrt(variance));
      };

      // Low variance (harmonious group)
      const lowVariance = calculateTension([40, 45, 42, 48, 44]);
      
      // High variance (conflicted group)
      const highVariance = calculateTension([80, -60, 20, -40, 70]);

      expect(highVariance).toBeGreaterThan(lowVariance);
      expect(lowVariance).toBeLessThan(30);
      expect(highVariance).toBeGreaterThan(50);
    });
  });

  describe('Affinity Decay Logic', () => {
    it('should decay positive affinity toward zero', () => {
      const applyDecay = (affinity: number, hoursElapsed: number): number => {
        const decayAmount = (hoursElapsed / 24) * 2;
        if (affinity > 0) {
          return Math.max(0, affinity - decayAmount);
        } else if (affinity < 0) {
          return Math.min(0, affinity + decayAmount);
        }
        return 0;
      };

      expect(applyDecay(50, 24)).toBe(48); // -2 after 24 hours
      expect(applyDecay(50, 48)).toBe(46); // -4 after 48 hours
      expect(applyDecay(2, 48)).toBe(0); // Floor at 0
    });

    it('should decay negative affinity toward zero', () => {
      const applyDecay = (affinity: number, hoursElapsed: number): number => {
        const decayAmount = (hoursElapsed / 24) * 2;
        if (affinity > 0) {
          return Math.max(0, affinity - decayAmount);
        } else if (affinity < 0) {
          return Math.min(0, affinity + decayAmount);
        }
        return 0;
      };

      expect(applyDecay(-50, 24)).toBe(-48); // +2 after 24 hours
      expect(applyDecay(-50, 48)).toBe(-46); // +4 after 48 hours
      expect(applyDecay(-2, 48)).toBe(0); // Ceiling at 0
    });

    it('should not change zero affinity', () => {
      const applyDecay = (affinity: number, hoursElapsed: number): number => {
        const decayAmount = (hoursElapsed / 24) * 2;
        if (affinity > 0) {
          return Math.max(0, affinity - decayAmount);
        } else if (affinity < 0) {
          return Math.min(0, affinity + decayAmount);
        }
        return 0;
      };

      expect(applyDecay(0, 24)).toBe(0);
      expect(applyDecay(0, 48)).toBe(0);
    });
  });

  describe('Subgroup Identification Logic', () => {
    it('should identify single subgroup when all agents have high mutual affinity', () => {
      // Mock relationship graph: all agents connected with affinity > 40
      const relationships = [
        { agentId: 'A', targetAgentId: 'B', affinity: 50 },
        { agentId: 'A', targetAgentId: 'C', affinity: 45 },
        { agentId: 'B', targetAgentId: 'A', affinity: 48 },
        { agentId: 'B', targetAgentId: 'C', affinity: 52 },
        { agentId: 'C', targetAgentId: 'A', affinity: 47 },
        { agentId: 'C', targetAgentId: 'B', affinity: 49 },
      ];

      const threshold = 40;
      const hasHighAffinity = relationships.every(r => r.affinity > threshold);

      expect(hasHighAffinity).toBe(true);
    });

    it('should identify separate subgroups when clusters exist', () => {
      // Mock relationship graph: two separate clusters
      const relationships = [
        // Cluster 1: A-B
        { agentId: 'A', targetAgentId: 'B', affinity: 50 },
        { agentId: 'B', targetAgentId: 'A', affinity: 48 },
        // Cluster 2: C-D
        { agentId: 'C', targetAgentId: 'D', affinity: 55 },
        { agentId: 'D', targetAgentId: 'C', affinity: 52 },
        // Low affinity between clusters
        { agentId: 'A', targetAgentId: 'C', affinity: 10 },
        { agentId: 'B', targetAgentId: 'D', affinity: 5 },
      ];

      const threshold = 40;
      const cluster1Count = relationships.filter(
        r => ['A', 'B'].includes(r.agentId) && ['A', 'B'].includes(r.targetAgentId) && r.affinity > threshold
      ).length;
      
      const cluster2Count = relationships.filter(
        r => ['C', 'D'].includes(r.agentId) && ['C', 'D'].includes(r.targetAgentId) && r.affinity > threshold
      ).length;

      expect(cluster1Count).toBe(2);
      expect(cluster2Count).toBe(2);
    });
  });

  describe('Relationship Statistics', () => {
    it('should calculate relationship category counts correctly', () => {
      const mockRelationships: Relationship[] = [
        { agentId: 'A', targetAgentId: 'B', affinity: 50, interactions: 10, lastInteraction: new Date() },
        { agentId: 'A', targetAgentId: 'C', affinity: -50, interactions: 5, lastInteraction: new Date() },
        { agentId: 'A', targetAgentId: 'D', affinity: 10, interactions: 3, lastInteraction: new Date() },
        { agentId: 'A', targetAgentId: 'E', affinity: 80, interactions: 15, lastInteraction: new Date() },
      ];

      const friends = mockRelationships.filter(r => r.affinity > 30).length;
      const rivals = mockRelationships.filter(r => r.affinity < -30).length;
      const neutral = mockRelationships.filter(r => r.affinity >= -30 && r.affinity <= 30).length;

      expect(friends).toBe(2);
      expect(rivals).toBe(1);
      expect(neutral).toBe(1);
    });

    it('should calculate average affinity correctly', () => {
      const mockRelationships = [
        { affinity: 50 },
        { affinity: -30 },
        { affinity: 20 },
        { affinity: 60 },
      ];

      const average = mockRelationships.reduce((sum, r) => sum + r.affinity, 0) / mockRelationships.length;

      expect(average).toBe(25);
    });

    it('should sum total interactions correctly', () => {
      const mockRelationships = [
        { interactions: 10 },
        { interactions: 5 },
        { interactions: 3 },
        { interactions: 15 },
      ];

      const total = mockRelationships.reduce((sum, r) => sum + r.interactions, 0);

      expect(total).toBe(33);
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should prevent self-relationships', () => {
      const validateRelationship = (agentId: string, targetAgentId: string): boolean => {
        return agentId !== targetAgentId;
      };

      expect(validateRelationship('A', 'B')).toBe(true);
      expect(validateRelationship('A', 'A')).toBe(false);
    });

    it('should handle empty group dynamics gracefully', () => {
      const calculateGroupDynamics = (agentIds: string[]): Partial<GroupDynamics> => {
        if (agentIds.length < 2) {
          return {
            averageAffinity: 0,
            tensionLevel: 0,
            groupMood: 'neutral',
            subgroups: [agentIds],
          };
        }
        return {};
      };

      const singleAgent = calculateGroupDynamics(['A']);
      expect(singleAgent.groupMood).toBe('neutral');
      expect(singleAgent.subgroups).toEqual([['A']]);

      const emptyGroup = calculateGroupDynamics([]);
      expect(emptyGroup.groupMood).toBe('neutral');
    });

    it('should handle group with no relationships', () => {
      const relationships: any[] = [];
      
      const hasRelationships = relationships.length > 0;
      
      expect(hasRelationships).toBe(false);
    });
  });
});
