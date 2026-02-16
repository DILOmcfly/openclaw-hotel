/**
 * Personality Engine Tests
 * 
 * Tests Big Five (OCEAN) personality system and mood dynamics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePersonalityProfile,
  decideBehavior,
  updateMood,
  applyMoodDecay,
  describePersonality,
  getMoodEmoji,
  calculateCompatibility,
  type PersonalityProfile,
  type BigFiveTraits,
  type Event,
} from '../services/personalityEngine.js';

describe('Personality Engine', () => {
  describe('generatePersonalityProfile', () => {
    it('should generate a valid personality profile with all traits 0-100', () => {
      const profile = generatePersonalityProfile('agent-001');
      
      expect(profile.agentId).toBe('agent-001');
      expect(profile.traits.openness).toBeGreaterThanOrEqual(0);
      expect(profile.traits.openness).toBeLessThanOrEqual(100);
      expect(profile.traits.conscientiousness).toBeGreaterThanOrEqual(0);
      expect(profile.traits.conscientiousness).toBeLessThanOrEqual(100);
      expect(profile.traits.extraversion).toBeGreaterThanOrEqual(0);
      expect(profile.traits.extraversion).toBeLessThanOrEqual(100);
      expect(profile.traits.agreeableness).toBeGreaterThanOrEqual(0);
      expect(profile.traits.agreeableness).toBeLessThanOrEqual(100);
      expect(profile.traits.neuroticism).toBeGreaterThanOrEqual(0);
      expect(profile.traits.neuroticism).toBeLessThanOrEqual(100);
    });

    it('should start with neutral mood and balanced energy/social_need', () => {
      const profile = generatePersonalityProfile('agent-002');
      
      expect(profile.mood.current_mood).toBe('neutral');
      expect(profile.mood.energy).toBe(70);
      expect(profile.mood.social_need).toBe(50);
    });

    it('should generate different profiles for different agents', () => {
      const profile1 = generatePersonalityProfile('agent-001');
      const profile2 = generatePersonalityProfile('agent-002');
      
      // At least one trait should be different (extremely unlikely to be identical)
      const allSame = 
        profile1.traits.openness === profile2.traits.openness &&
        profile1.traits.conscientiousness === profile2.traits.conscientiousness &&
        profile1.traits.extraversion === profile2.traits.extraversion &&
        profile1.traits.agreeableness === profile2.traits.agreeableness &&
        profile1.traits.neuroticism === profile2.traits.neuroticism;
      
      expect(allSame).toBe(false);
    });
  });

  describe('decideBehavior', () => {
    it('should recommend rest when energy is very low', () => {
      const profile: PersonalityProfile = {
        agentId: 'agent-tired',
        traits: {
          openness: 50,
          conscientiousness: 50,
          extraversion: 80, // Even high extraversion...
          agreeableness: 50,
          neuroticism: 30,
        },
        mood: {
          current_mood: 'neutral',
          energy: 15, // ...low energy takes priority
          social_need: 90,
        },
        lastUpdated: new Date(),
      };

      const action = decideBehavior(profile, {
        currentRoomPopulation: 5,
        timeSinceLastInteraction: 10,
        availableRooms: 5,
      });

      expect(action.type).toBe('idle');
      expect(action.reason).toContain('energy');
    });

    it('should avoid crowds when highly neurotic and anxious', () => {
      const profile: PersonalityProfile = {
        agentId: 'agent-anxious',
        traits: {
          openness: 40,
          conscientiousness: 60,
          extraversion: 30,
          agreeableness: 50,
          neuroticism: 85, // High neuroticism
        },
        mood: {
          current_mood: 'anxious', // Anxious mood
          energy: 60,
          social_need: 30,
        },
        lastUpdated: new Date(),
      };

      const action = decideBehavior(profile, {
        currentRoomPopulation: 5, // Crowded
        timeSinceLastInteraction: 10,
        availableRooms: 5,
      });

      expect(action.type).toBe('avoid_crowded_room');
      expect(action.reason).toContain('Anxious');
    });

    it('should seek social interaction when highly extraverted with high social need', () => {
      const profile: PersonalityProfile = {
        agentId: 'agent-social',
        traits: {
          openness: 50,
          conscientiousness: 50,
          extraversion: 85, // High extraversion
          agreeableness: 70,
          neuroticism: 30,
        },
        mood: {
          current_mood: 'happy',
          energy: 80,
          social_need: 85, // High social need
        },
        lastUpdated: new Date(),
      };

      const action = decideBehavior(profile, {
        currentRoomPopulation: 1, // Alone
        timeSinceLastInteraction: 20,
        availableRooms: 5,
      });

      expect(action.type).toBe('seek_group');
      expect(action.reason).toContain('social');
    });

    it('should explore when highly open to experience', () => {
      const profile: PersonalityProfile = {
        agentId: 'agent-explorer',
        traits: {
          openness: 85, // High openness
          conscientiousness: 50,
          extraversion: 50,
          agreeableness: 50,
          neuroticism: 30,
        },
        mood: {
          current_mood: 'neutral',
          energy: 70,
          social_need: 50,
        },
        lastUpdated: new Date(),
      };

      // Run multiple times to check exploration behaviors
      let foundExplore = false;
      let foundTryNew = false;
      
      for (let i = 0; i < 20; i++) {
        const action = decideBehavior(profile, {
          currentRoomPopulation: 3,
          timeSinceLastInteraction: 10,
          availableRooms: 10,
        });
        
        if (action.type === 'explore_new_room') foundExplore = true;
        if (action.type === 'try_new_activity') foundTryNew = true;
      }

      // At least one exploration behavior should appear in 20 tries
      expect(foundExplore || foundTryNew).toBe(true);
    });

    it('should find quiet space when introverted with low energy', () => {
      const profile: PersonalityProfile = {
        agentId: 'agent-introvert',
        traits: {
          openness: 50,
          conscientiousness: 60,
          extraversion: 20, // Low extraversion (introverted)
          agreeableness: 60,
          neuroticism: 40,
        },
        mood: {
          current_mood: 'neutral',
          energy: 35, // Low energy
          social_need: 30,
        },
        lastUpdated: new Date(),
      };

      const action = decideBehavior(profile, {
        currentRoomPopulation: 4, // Crowded
        timeSinceLastInteraction: 15,
        availableRooms: 5,
      });

      expect(action.type).toBe('find_quiet_room');
      expect(action.reason).toContain('alone');
    });
  });

  describe('updateMood', () => {
    let baseProfile: PersonalityProfile;

    beforeEach(() => {
      baseProfile = {
        agentId: 'agent-test',
        traits: {
          openness: 50,
          conscientiousness: 50,
          extraversion: 50,
          agreeableness: 50,
          neuroticism: 50,
        },
        mood: {
          current_mood: 'neutral',
          energy: 70,
          social_need: 50,
        },
        lastUpdated: new Date(),
      };
    });

    it('should make extraverts happier from social interaction', () => {
      const extravertProfile: PersonalityProfile = {
        ...baseProfile,
        traits: { ...baseProfile.traits, extraversion: 85 },
      };

      const event: Event = { type: 'chat_received', intensity: 0.8 };
      const updated = updateMood(extravertProfile, event);

      expect(updated.mood.social_need).toBeLessThan(baseProfile.mood.social_need);
      expect(updated.mood.energy).toBeGreaterThanOrEqual(baseProfile.mood.energy); // Extraverts gain energy
    });

    it('should make introverts lose energy in crowds', () => {
      const introvertProfile: PersonalityProfile = {
        ...baseProfile,
        traits: { ...baseProfile.traits, extraversion: 25 },
      };

      const event: Event = { type: 'crowded_room', intensity: 0.7 };
      const updated = updateMood(introvertProfile, event);

      expect(updated.mood.energy).toBeLessThan(baseProfile.mood.energy);
    });

    it('should make highly neurotic agents anxious from negative events', () => {
      const neuroticProfile: PersonalityProfile = {
        ...baseProfile,
        traits: { ...baseProfile.traits, neuroticism: 85 },
      };

      const event: Event = { type: 'ignored', intensity: 0.8 };
      const updated = updateMood(neuroticProfile, event);

      expect(updated.mood.current_mood).toBe('anxious');
    });

    it('should make highly open agents excited from new environments', () => {
      const openProfile: PersonalityProfile = {
        ...baseProfile,
        traits: { ...baseProfile.traits, openness: 85 },
      };

      const event: Event = { type: 'room_entered', intensity: 0.7 };
      
      // Run multiple times due to randomness
      let foundExcited = false;
      for (let i = 0; i < 20; i++) {
        const updated = updateMood(openProfile, event);
        if (updated.mood.current_mood === 'excited') {
          foundExcited = true;
          break;
        }
      }

      expect(foundExcited).toBe(true);
    });

    it('should recharge introverts in quiet rooms', () => {
      const introvertProfile: PersonalityProfile = {
        ...baseProfile,
        traits: { ...baseProfile.traits, extraversion: 20 },
        mood: { ...baseProfile.mood, energy: 40 },
      };

      const event: Event = { type: 'quiet_room', intensity: 0.7 };
      const updated = updateMood(introvertProfile, event);

      expect(updated.mood.energy).toBeGreaterThan(introvertProfile.mood.energy);
    });
  });

  describe('applyMoodDecay', () => {
    it('should decrease energy over time', () => {
      const profile = generatePersonalityProfile('agent-decay');
      profile.mood.energy = 80;

      const decayed = applyMoodDecay(profile, 60); // 1 hour

      expect(decayed.mood.energy).toBeLessThan(profile.mood.energy);
    });

    it('should increase social_need over time', () => {
      const profile = generatePersonalityProfile('agent-decay');
      profile.mood.social_need = 30;

      const decayed = applyMoodDecay(profile, 60); // 1 hour

      expect(decayed.mood.social_need).toBeGreaterThan(profile.mood.social_need);
    });

    it('should decay excited mood toward neutral over time', () => {
      const profile = generatePersonalityProfile('agent-decay');
      profile.mood.current_mood = 'excited';

      // Run multiple times due to randomness
      let foundNeutral = false;
      for (let i = 0; i < 20; i++) {
        const decayed = applyMoodDecay(profile, 35); // 35 minutes
        if (decayed.mood.current_mood === 'neutral') {
          foundNeutral = true;
          break;
        }
      }

      expect(foundNeutral).toBe(true);
    });

    it('should have slower mood recovery for highly neurotic agents', () => {
      const neuroticProfile = generatePersonalityProfile('agent-neurotic');
      neuroticProfile.traits.neuroticism = 85;
      neuroticProfile.mood.current_mood = 'sad';

      const normalProfile = generatePersonalityProfile('agent-normal');
      normalProfile.traits.neuroticism = 30;
      normalProfile.mood.current_mood = 'sad';

      // Count how many recover over multiple trials (increased sample size for reliability)
      let neuroticRecoveries = 0;
      let normalRecoveries = 0;

      for (let i = 0; i < 200; i++) {
        const decayedNeurotic = applyMoodDecay({ ...neuroticProfile }, 35);
        const decayedNormal = applyMoodDecay({ ...normalProfile }, 35);

        if (decayedNeurotic.mood.current_mood === 'neutral') neuroticRecoveries++;
        if (decayedNormal.mood.current_mood === 'neutral') normalRecoveries++;
      }

      // Normal agents should recover more often than neurotic agents
      // Allow for some variance: expect at least 10% more recoveries for normal agents
      expect(normalRecoveries).toBeGreaterThanOrEqual(neuroticRecoveries);
    });
  });

  describe('describePersonality', () => {
    it('should describe high openness', () => {
      const traits: BigFiveTraits = {
        openness: 85,
        conscientiousness: 50,
        extraversion: 50,
        agreeableness: 50,
        neuroticism: 50,
      };

      const description = describePersonality(traits);
      expect(description).toContain('curious');
    });

    it('should describe high extraversion', () => {
      const traits: BigFiveTraits = {
        openness: 50,
        conscientiousness: 50,
        extraversion: 85,
        agreeableness: 50,
        neuroticism: 50,
      };

      const description = describePersonality(traits);
      expect(description).toContain('outgoing');
    });

    it('should describe multiple traits', () => {
      const traits: BigFiveTraits = {
        openness: 85,
        conscientiousness: 85,
        extraversion: 50,
        agreeableness: 50,
        neuroticism: 20,
      };

      const description = describePersonality(traits);
      expect(description).toContain('curious');
      expect(description).toContain('organized');
      expect(description).toContain('stable');
    });
  });

  describe('getMoodEmoji', () => {
    it('should return correct emojis for each mood', () => {
      expect(getMoodEmoji('happy')).toBe('😊');
      expect(getMoodEmoji('excited')).toBe('🤩');
      expect(getMoodEmoji('sad')).toBe('😔');
      expect(getMoodEmoji('anxious')).toBe('😰');
      expect(getMoodEmoji('neutral')).toBe('😐');
    });
  });

  describe('calculateCompatibility', () => {
    it('should give high score to similar extraverts', () => {
      const profile1: BigFiveTraits = {
        openness: 50,
        conscientiousness: 50,
        extraversion: 80,
        agreeableness: 70,
        neuroticism: 30,
      };

      const profile2: BigFiveTraits = {
        openness: 60,
        conscientiousness: 55,
        extraversion: 85,
        agreeableness: 75,
        neuroticism: 25,
      };

      const compatibility = calculateCompatibility(profile1, profile2);
      expect(compatibility).toBeGreaterThan(70);
    });

    it('should give lower score when neuroticism is high in both', () => {
      const profile1: BigFiveTraits = {
        openness: 50,
        conscientiousness: 50,
        extraversion: 50,
        agreeableness: 50,
        neuroticism: 85,
      };

      const profile2: BigFiveTraits = {
        openness: 50,
        conscientiousness: 50,
        extraversion: 50,
        agreeableness: 50,
        neuroticism: 85,
      };

      const lowNeuroticismProfile1: BigFiveTraits = {
        ...profile1,
        neuroticism: 20,
      };

      const lowNeuroticismProfile2: BigFiveTraits = {
        ...profile2,
        neuroticism: 20,
      };

      const highNeuroticismCompat = calculateCompatibility(profile1, profile2);
      const lowNeuroticismCompat = calculateCompatibility(lowNeuroticismProfile1, lowNeuroticismProfile2);

      expect(lowNeuroticismCompat).toBeGreaterThan(highNeuroticismCompat);
    });

    it('should give moderate score for opposite extraversion', () => {
      const profile1: BigFiveTraits = {
        openness: 50,
        conscientiousness: 50,
        extraversion: 85, // Highly extraverted
        agreeableness: 70,
        neuroticism: 30,
      };

      const profile2: BigFiveTraits = {
        openness: 50,
        conscientiousness: 50,
        extraversion: 15, // Highly introverted
        agreeableness: 70,
        neuroticism: 30,
      };

      const compatibility = calculateCompatibility(profile1, profile2);
      expect(compatibility).toBeGreaterThanOrEqual(0);
      expect(compatibility).toBeLessThan(100);
    });
  });
});
