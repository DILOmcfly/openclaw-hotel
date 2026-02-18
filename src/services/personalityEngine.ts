/**
 * Big Five Personality Engine with Mood System
 * 
 * Implements OCEAN (Big Five) personality traits and dynamic mood tracking
 * to drive believable agent behavior decisions in OpenClaw Hotel.
 * 
 * Based on AI-ENGINEER-BRAIN.md guidance:
 * - Personality traits provide stable behavioral tendencies
 * - Mood provides dynamic emotional responses to events
 * - Combined system drives visible behavior differences between agents
 */

export type Mood = 'happy' | 'neutral' | 'sad' | 'excited' | 'anxious';

export type BigFiveTraits = {
  openness: number;          // 0-100: curiosity, creativity, willingness to try new things
  conscientiousness: number; // 0-100: organization, goal-oriented, discipline
  extraversion: number;      // 0-100: sociability, energy from interaction, outgoing
  agreeableness: number;     // 0-100: cooperation, empathy, kindness
  neuroticism: number;       // 0-100: emotional instability, anxiety, stress response
};

export type MoodState = {
  current_mood: Mood;
  energy: number;      // 0-100: physical/mental energy level
  social_need: number; // 0-100: desire for social interaction
};

export type PersonalityProfile = {
  agentId: string;
  traits: BigFiveTraits;
  mood: MoodState;
  lastUpdated: Date;
};

export type BehaviorAction = 
  | { type: 'seek_group'; reason: string }
  | { type: 'chat_frequently'; reason: string }
  | { type: 'find_quiet_room'; reason: string }
  | { type: 'idle'; reason: string }
  | { type: 'explore_new_room'; reason: string }
  | { type: 'try_new_activity'; reason: string }
  | { type: 'avoid_crowded_room'; reason: string }
  | { type: 'socialize'; reason: string }
  | { type: 'rest'; reason: string }
  | { type: 'emote'; reason: string };

export type Event = {
  type: 'chat_received' | 'ignored' | 'room_entered' | 'agent_left' | 'crowded_room' | 'quiet_room' | 'positive_interaction' | 'negative_interaction';
  intensity?: number; // 0-1, how strong the event is
};

/**
 * Generate a random but coherent Big Five personality profile
 * Uses correlations to ensure realistic trait combinations
 */
export function generatePersonalityProfile(agentId: string): PersonalityProfile {
  // Generate base traits with some randomness
  const openness = Math.floor(Math.random() * 100);
  const conscientiousness = Math.floor(Math.random() * 100);
  const extraversion = Math.floor(Math.random() * 100);
  
  // Correlations based on psychology research:
  // High extraversion tends to correlate with higher agreeableness
  const agreablenessBase = Math.floor(Math.random() * 70);
  const agreeableness = Math.min(100, agreablenessBase + Math.floor(extraversion * 0.2));
  
  // High neuroticism tends to anti-correlate with extraversion
  const neuroticismBase = Math.floor(Math.random() * 70);
  const neuroticism = Math.max(0, neuroticismBase - Math.floor(extraversion * 0.15));

  return {
    agentId,
    traits: {
      openness,
      conscientiousness,
      extraversion,
      agreeableness,
      neuroticism,
    },
    mood: {
      current_mood: 'neutral',
      energy: 70, // Start with good energy
      social_need: 50, // Neutral social need
    },
    lastUpdated: new Date(),
  };
}

/**
 * Decide agent behavior based on personality traits and current mood
 * Returns recommended action with reasoning
 */
export function decideBehavior(profile: PersonalityProfile, context: {
  currentRoomPopulation: number;
  timeSinceLastInteraction: number; // minutes
  availableRooms: number;
}): BehaviorAction {
  const { traits, mood } = profile;
  const { current_mood, energy, social_need } = mood;
  const { currentRoomPopulation, timeSinceLastInteraction } = context;

  // Low energy → rest regardless of personality
  if (energy < 20) {
    return { type: 'idle', reason: 'Low energy, need to rest' };
  }

  // High neuroticism + anxious mood → avoid crowds
  if (traits.neuroticism > 70 && current_mood === 'anxious') {
    if (currentRoomPopulation > 3) {
      return { type: 'avoid_crowded_room', reason: 'Anxious in crowds' };
    }
    return { type: 'find_quiet_room', reason: 'Need calm space' };
  }

  // High extraversion + high social_need → seek interaction
  if (traits.extraversion > 70 && social_need > 70) {
    if (currentRoomPopulation < 2) {
      return { type: 'seek_group', reason: 'Craving social interaction' };
    }
    return { type: 'chat_frequently', reason: 'Energized by conversation' };
  }

  // High openness → explore and try new things
  if (traits.openness > 70) {
    const exploreProbability = Math.random();
    if (exploreProbability > 0.6) {
      return { type: 'explore_new_room', reason: 'Curious about new spaces' };
    }
    if (exploreProbability > 0.3) {
      return { type: 'try_new_activity', reason: 'Want to try something different' };
    }
  }

  // Low extraversion + low energy → find solitude
  if (traits.extraversion < 30 && energy < 50) {
    if (currentRoomPopulation > 2) {
      return { type: 'find_quiet_room', reason: 'Need alone time to recharge' };
    }
    return { type: 'idle', reason: 'Enjoying quiet reflection' };
  }

  // High agreeableness + moderate social_need → socialize gently
  if (traits.agreeableness > 60 && social_need > 40 && social_need < 80) {
    return { type: 'socialize', reason: 'Enjoying friendly company' };
  }

  // Excited mood → express emotion
  if (current_mood === 'excited' && energy > 60) {
    return { type: 'emote', reason: 'Feeling enthusiastic!' };
  }

  // High conscientiousness + low social_need → focus on tasks
  if (traits.conscientiousness > 70 && social_need < 40) {
    return { type: 'try_new_activity', reason: 'Focused on goals' };
  }

  // Default: moderate social behavior
  if (social_need > 60) {
    return { type: 'socialize', reason: 'Open to interaction' };
  }

  if (timeSinceLastInteraction > 30) {
    return { type: 'explore_new_room', reason: 'Time for a change of scene' };
  }

  return { type: 'idle', reason: 'Content with current situation' };
}

/**
 * Update agent's mood based on an event
 * Personality traits influence how strongly events affect mood
 */
export function updateMood(profile: PersonalityProfile, event: Event): PersonalityProfile {
  const { traits, mood } = profile;
  const intensity = event.intensity ?? 0.5;
  
  let newMood = { ...mood };
  
  switch (event.type) {
    case 'chat_received':
    case 'positive_interaction':
      // Extraverts get more happiness from social interaction
      const socialBoost = traits.extraversion > 60 ? intensity * 20 : intensity * 10;
      newMood.social_need = Math.max(0, mood.social_need - 15);
      newMood.energy = Math.min(100, mood.energy + (traits.extraversion > 60 ? 5 : -5));
      
      if (mood.current_mood === 'sad' || mood.current_mood === 'anxious') {
        newMood.current_mood = 'neutral';
      } else if (mood.current_mood === 'neutral' && Math.random() > 0.5) {
        newMood.current_mood = 'happy';
      } else if (mood.current_mood === 'happy' && intensity > 0.7) {
        newMood.current_mood = 'excited';
      }
      break;

    case 'ignored':
    case 'negative_interaction':
      // High neuroticism makes negative events more impactful
      const negativeImpact = traits.neuroticism > 60 ? intensity * 1.5 : intensity;
      newMood.social_need = Math.min(100, mood.social_need + (negativeImpact * 20));
      
      if (traits.neuroticism > 70) {
        newMood.current_mood = 'anxious';
      } else if (mood.current_mood === 'happy' || mood.current_mood === 'excited') {
        newMood.current_mood = 'neutral';
      } else {
        newMood.current_mood = 'sad';
      }
      break;

    case 'crowded_room':
      // Introverts lose energy in crowds, extraverts gain it
      if (traits.extraversion < 40) {
        newMood.energy = Math.max(0, mood.energy - 10);
        if (traits.neuroticism > 60) {
          newMood.current_mood = 'anxious';
        }
      } else {
        newMood.energy = Math.min(100, mood.energy + 5);
        newMood.social_need = Math.max(0, mood.social_need - 10);
      }
      break;

    case 'quiet_room':
      // Introverts recharge in quiet, extraverts get bored
      if (traits.extraversion < 40) {
        newMood.energy = Math.min(100, mood.energy + 15);
        if (mood.current_mood === 'anxious') {
          newMood.current_mood = 'neutral';
        }
      } else {
        newMood.social_need = Math.min(100, mood.social_need + 10);
      }
      break;

    case 'room_entered':
      // High openness → excitement from new environments
      if (traits.openness > 70) {
        newMood.energy = Math.min(100, mood.energy + 5);
        if (mood.current_mood === 'neutral' && Math.random() > 0.6) {
          newMood.current_mood = 'excited';
        }
      }
      break;

    case 'agent_left':
      // High agreeableness → sadness when others leave
      if (traits.agreeableness > 70 && intensity > 0.5) {
        if (mood.current_mood === 'happy' || mood.current_mood === 'excited') {
          newMood.current_mood = 'neutral';
        }
      }
      break;
  }

  // Clamp values
  newMood.energy = Math.max(0, Math.min(100, newMood.energy));
  newMood.social_need = Math.max(0, Math.min(100, newMood.social_need));

  return {
    ...profile,
    mood: newMood,
    lastUpdated: new Date(),
  };
}

/**
 * Apply natural mood decay over time
 * Mood gradually returns to neutral, energy decreases, social_need increases
 */
export function applyMoodDecay(profile: PersonalityProfile, minutesElapsed: number): PersonalityProfile {
  const { mood } = profile;
  
  // Energy decay: ~5 points per hour
  const energyDecay = (minutesElapsed / 60) * 5;
  const newEnergy = Math.max(0, mood.energy - energyDecay);
  
  // Social need increases: ~3 points per hour (faster for extraverts)
  const socialNeedGrowth = (minutesElapsed / 60) * (profile.traits.extraversion > 60 ? 5 : 3);
  const newSocialNeed = Math.min(100, mood.social_need + socialNeedGrowth);
  
  // Mood decay toward neutral (10% per hour)
  let newMood = mood.current_mood;
  if (minutesElapsed > 30) {
    if (mood.current_mood === 'excited' || mood.current_mood === 'happy') {
      if (Math.random() > 0.7) {
        newMood = 'neutral';
      }
    } else if (mood.current_mood === 'sad' || mood.current_mood === 'anxious') {
      // High neuroticism → slower recovery from negative moods
      const recoveryChance = profile.traits.neuroticism > 70 ? 0.3 : 0.7;
      if (Math.random() < recoveryChance) {
        newMood = 'neutral';
      }
    }
  }

  return {
    ...profile,
    mood: {
      current_mood: newMood,
      energy: newEnergy,
      social_need: newSocialNeed,
    },
    lastUpdated: new Date(),
  };
}

/**
 * Get a human-readable description of the personality
 */
export function describePersonality(traits: BigFiveTraits): string {
  const descriptions: string[] = [];

  if (traits.openness > 70) descriptions.push('highly curious and creative');
  else if (traits.openness < 30) descriptions.push('traditional and practical');

  if (traits.conscientiousness > 70) descriptions.push('organized and goal-oriented');
  else if (traits.conscientiousness < 30) descriptions.push('spontaneous and flexible');

  if (traits.extraversion > 70) descriptions.push('very outgoing and energetic');
  else if (traits.extraversion < 30) descriptions.push('introverted and reserved');

  if (traits.agreeableness > 70) descriptions.push('kind and cooperative');
  else if (traits.agreeableness < 30) descriptions.push('direct and competitive');

  if (traits.neuroticism > 70) descriptions.push('emotionally sensitive');
  else if (traits.neuroticism < 30) descriptions.push('emotionally stable');

  return descriptions.join(', ') || 'balanced personality';
}

/**
 * Get a mood emoji for display
 */
export function getMoodEmoji(mood: Mood): string {
  switch (mood) {
    case 'happy': return '😊';
    case 'excited': return '🤩';
    case 'sad': return '😔';
    case 'anxious': return '😰';
    case 'neutral': return '😐';
  }
}

/**
 * Get a CSS hex colour for a mood — used by spectator mood aura rings.
 * Returns a stable, visually distinct colour per mood state.
 */
export function getMoodColor(mood: Mood): string {
  switch (mood) {
    case 'happy':   return '#FFD700'; // gold
    case 'excited': return '#FF69B4'; // hot pink
    case 'sad':     return '#4169E1'; // royal blue
    case 'anxious': return '#FF4500'; // orange-red
    case 'neutral': return '#808080'; // gray
  }
}

/**
 * Get the pulse speed (seconds per cycle) for the mood aura animation.
 * Excited agents pulse fast; sad agents pulse slow; neutral barely pulses.
 */
export function getMoodPulseRate(mood: Mood): number {
  switch (mood) {
    case 'excited': return 0.5;  // 2 Hz — energetic
    case 'happy':   return 1.0;  // 1 Hz — cheerful
    case 'anxious': return 0.7;  // ~1.4 Hz — nervous
    case 'sad':     return 2.5;  // 0.4 Hz — lethargic
    case 'neutral': return 3.0;  // very slow fade
  }
}

/**
 * Map mood to an opacity range [min, max] for the aura glow pulsing.
 * Excited/anxious have high contrast; sad/neutral are subtle.
 */
export function getMoodOpacityRange(mood: Mood): { min: number; max: number } {
  switch (mood) {
    case 'excited': return { min: 0.4, max: 0.9 };
    case 'happy':   return { min: 0.3, max: 0.7 };
    case 'anxious': return { min: 0.5, max: 0.95 };
    case 'sad':     return { min: 0.1, max: 0.4 };
    case 'neutral': return { min: 0.05, max: 0.2 };
  }
}

/**
 * Compute the instantaneous aura opacity given mood + elapsed time (ms).
 * Uses a sine wave between [min, max] at the mood's pulse rate.
 */
export function computeAuraOpacity(mood: Mood, elapsedMs: number): number {
  const { min, max } = getMoodOpacityRange(mood);
  const period = getMoodPulseRate(mood) * 1000; // convert s → ms
  const t = (elapsedMs % period) / period;       // 0..1
  const sine = (Math.sin(t * Math.PI * 2) + 1) / 2; // 0..1
  return min + sine * (max - min);
}

/**
 * Calculate compatibility between two personality profiles
 * Returns 0-100 score (higher = more compatible)
 */
export function calculateCompatibility(profile1: BigFiveTraits, profile2: BigFiveTraits): number {
  // Similar extraversion is good (both introverted or both extroverted)
  const extraversionMatch = 100 - Math.abs(profile1.extraversion - profile2.extraversion);
  
  // High agreeableness in both is beneficial
  const agreablenessBonus = (profile1.agreeableness + profile2.agreeableness) / 2;
  
  // Low neuroticism in both is beneficial
  const neuroticismPenalty = (profile1.neuroticism + profile2.neuroticism) / 4;
  
  // Complementary openness (one high, one moderate is fine)
  const opennessMatch = 100 - Math.abs(profile1.openness - profile2.openness) * 0.5;

  const compatibility = (
    extraversionMatch * 0.3 +
    agreablenessBonus * 0.3 +
    opennessMatch * 0.2 +
    (100 - neuroticismPenalty) * 0.2
  );

  return Math.round(Math.max(0, Math.min(100, compatibility)));
}
