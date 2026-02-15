import { describe, it, expect } from 'vitest';
import { sanitizeText, getVoiceForArchetype } from '../services/tts.js';

describe('TTS Service', () => {
  describe('sanitizeText', () => {
    it('should remove emojis', () => {
      const input = 'Hello 😀 World 🌍!';
      const result = sanitizeText(input);
      expect(result).toBe('Hello  World !');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeText(input);
      expect(result).toBe('Hello World');
    });

    it('should limit length to 200 characters', () => {
      const input = 'a'.repeat(250);
      const result = sanitizeText(input);
      expect(result.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(result).toContain('...');
    });

    it('should handle empty string', () => {
      const result = sanitizeText('');
      expect(result).toBe('');
    });

    it('should handle emoji-only string', () => {
      const result = sanitizeText('😀😃😄😁');
      expect(result).toBe('');
    });

    it('should preserve punctuation', () => {
      const input = 'Hello, World! How are you?';
      const result = sanitizeText(input);
      expect(result).toBe(input);
    });
  });

  describe('getVoiceForArchetype', () => {
    it('should return Alex for Charismatic Leader', () => {
      const voice = getVoiceForArchetype('Charismatic Leader');
      expect(voice).toBe('Alex');
    });

    it('should return Alex for Strategic Commander', () => {
      const voice = getVoiceForArchetype('Strategic Commander');
      expect(voice).toBe('Alex');
    });

    it('should return Samantha for Benevolent Guide', () => {
      const voice = getVoiceForArchetype('Benevolent Guide');
      expect(voice).toBe('Samantha');
    });

    it('should return Fred for Wild Card', () => {
      const voice = getVoiceForArchetype('Wild Card');
      expect(voice).toBe('Fred');
    });

    it('should return Daniel for Thoughtful Analyst', () => {
      const voice = getVoiceForArchetype('Thoughtful Analyst');
      expect(voice).toBe('Daniel');
    });

    it('should return Karen for null archetype', () => {
      const voice = getVoiceForArchetype(null);
      expect(voice).toBe('Karen');
    });

    it('should return Karen for unknown archetype', () => {
      const voice = getVoiceForArchetype('Unknown Archetype');
      expect(voice).toBe('Karen');
    });

    it('should handle all 16 archetypes', () => {
      const archetypes = [
        'Charismatic Leader',
        'Strategic Commander',
        'Benevolent Guide',
        'Social Catalyst',
        'Wild Card',
        'Creative Rebel',
        'Daring Explorer',
        'Impulsive Innovator',
        'Thoughtful Analyst',
        'Quiet Observer',
        'Methodical Builder',
        'Contemplative Sage',
        'Lone Wolf',
        'Generous Helper',
        'Balanced Diplomat',
        'Cautious Participant',
      ];

      for (const archetype of archetypes) {
        const voice = getVoiceForArchetype(archetype);
        expect(voice).toBeTypeOf('string');
        expect(voice.length).toBeGreaterThan(0);
      }
    });
  });
});
