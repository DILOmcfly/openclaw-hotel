import { describe, it, expect } from 'vitest';
import {
  getMoodColor,
  getMoodPulseRate,
  getMoodOpacityRange,
  computeAuraOpacity,
  getMoodEmoji,
  type Mood,
} from '../services/personalityEngine.js';

/**
 * T-359 — Agent Mood Aura System
 *
 * Pure unit tests for mood-derived visual properties:
 *   - getMoodColor() — distinct colour per mood
 *   - getMoodPulseRate() — pulse period in seconds
 *   - getMoodOpacityRange() — [min, max] aura opacity bounds
 *   - computeAuraOpacity() — sinusoidal opacity for a given elapsed time
 */

const ALL_MOODS: Mood[] = ['happy', 'excited', 'sad', 'anxious', 'neutral'];

// ─── getMoodColor ─────────────────────────────────────────────────────────────

describe('T-359 — getMoodColor: returns distinct CSS hex strings', () => {
  it('returns a string for every mood', () => {
    for (const mood of ALL_MOODS) {
      expect(typeof getMoodColor(mood)).toBe('string');
    }
  });

  it('returns a CSS hex string (# prefix + 6 hex digits)', () => {
    for (const mood of ALL_MOODS) {
      expect(getMoodColor(mood)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('each mood gets a distinct colour', () => {
    const colors = ALL_MOODS.map(getMoodColor);
    const unique = new Set(colors);
    expect(unique.size).toBe(ALL_MOODS.length);
  });

  it('happy → gold (#FFD700)', () => {
    expect(getMoodColor('happy')).toBe('#FFD700');
  });

  it('excited → hot pink (#FF69B4)', () => {
    expect(getMoodColor('excited')).toBe('#FF69B4');
  });

  it('sad → royal blue (#4169E1)', () => {
    expect(getMoodColor('sad')).toBe('#4169E1');
  });

  it('anxious → orange-red (#FF4500)', () => {
    expect(getMoodColor('anxious')).toBe('#FF4500');
  });

  it('neutral → gray (#808080)', () => {
    expect(getMoodColor('neutral')).toBe('#808080');
  });
});

// ─── getMoodPulseRate ─────────────────────────────────────────────────────────

describe('T-359 — getMoodPulseRate: returns positive period (seconds)', () => {
  it('returns a positive number for every mood', () => {
    for (const mood of ALL_MOODS) {
      expect(getMoodPulseRate(mood)).toBeGreaterThan(0);
    }
  });

  it('excited pulses fastest (shortest period)', () => {
    const rates = ALL_MOODS.map(getMoodPulseRate);
    expect(getMoodPulseRate('excited')).toBe(Math.min(...rates));
  });

  it('neutral pulses slowest (longest period)', () => {
    const rates = ALL_MOODS.map(getMoodPulseRate);
    expect(getMoodPulseRate('neutral')).toBe(Math.max(...rates));
  });

  it('sad is slower than happy', () => {
    expect(getMoodPulseRate('sad')).toBeGreaterThan(getMoodPulseRate('happy'));
  });

  it('excited (0.5s) < anxious (0.7s) < happy (1.0s)', () => {
    expect(getMoodPulseRate('excited')).toBeLessThan(getMoodPulseRate('anxious'));
    expect(getMoodPulseRate('anxious')).toBeLessThan(getMoodPulseRate('happy'));
  });
});

// ─── getMoodOpacityRange ──────────────────────────────────────────────────────

describe('T-359 — getMoodOpacityRange: valid [min, max] bounds', () => {
  it('returns { min, max } for every mood', () => {
    for (const mood of ALL_MOODS) {
      const range = getMoodOpacityRange(mood);
      expect(range).toHaveProperty('min');
      expect(range).toHaveProperty('max');
    }
  });

  it('min is always ≥ 0 and max is always ≤ 1', () => {
    for (const mood of ALL_MOODS) {
      const { min, max } = getMoodOpacityRange(mood);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(1);
    }
  });

  it('min < max for every mood', () => {
    for (const mood of ALL_MOODS) {
      const { min, max } = getMoodOpacityRange(mood);
      expect(min).toBeLessThan(max);
    }
  });

  it('excited and anxious have the two highest max opacities (high-energy moods)', () => {
    const sorted = ALL_MOODS
      .map(m => ({ mood: m, max: getMoodOpacityRange(m).max }))
      .sort((a, b) => b.max - a.max);
    const topTwo = sorted.slice(0, 2).map(e => e.mood);
    expect(topTwo).toContain('excited');
    expect(topTwo).toContain('anxious');
  });

  it('neutral has the lowest max opacity (most subtle)', () => {
    const maxes = ALL_MOODS.map(m => getMoodOpacityRange(m).max);
    const neutralMax = getMoodOpacityRange('neutral').max;
    expect(neutralMax).toBe(Math.min(...maxes));
  });

  it('anxious has higher min than neutral (more prominent when not at peak)', () => {
    expect(getMoodOpacityRange('anxious').min).toBeGreaterThan(getMoodOpacityRange('neutral').min);
  });
});

// ─── computeAuraOpacity ───────────────────────────────────────────────────────

describe('T-359 — computeAuraOpacity: sinusoidal value within [min, max]', () => {
  it('returns a value within [min, max] at t=0', () => {
    for (const mood of ALL_MOODS) {
      const { min, max } = getMoodOpacityRange(mood);
      const opacity = computeAuraOpacity(mood, 0);
      expect(opacity).toBeGreaterThanOrEqual(min - 1e-9);
      expect(opacity).toBeLessThanOrEqual(max + 1e-9);
    }
  });

  it('stays within [min, max] across a full period', () => {
    for (const mood of ALL_MOODS) {
      const { min, max } = getMoodOpacityRange(mood);
      const period = getMoodPulseRate(mood) * 1000;
      for (let step = 0; step <= 100; step++) {
        const opacity = computeAuraOpacity(mood, (step / 100) * period);
        expect(opacity).toBeGreaterThanOrEqual(min - 1e-9);
        expect(opacity).toBeLessThanOrEqual(max + 1e-9);
      }
    }
  });

  it('opacity is periodic — same at t=0 and t=period (one full cycle)', () => {
    for (const mood of ALL_MOODS) {
      const period = getMoodPulseRate(mood) * 1000;
      const a = computeAuraOpacity(mood, 0);
      const b = computeAuraOpacity(mood, period);
      expect(a).toBeCloseTo(b, 5);
    }
  });

  it('opacity is not constant across a full period (it actually pulses)', () => {
    for (const mood of ALL_MOODS) {
      const period = getMoodPulseRate(mood) * 1000;
      const vals = new Set<string>();
      for (let i = 0; i < 8; i++) {
        vals.add(computeAuraOpacity(mood, (i / 8) * period).toFixed(4));
      }
      expect(vals.size).toBeGreaterThan(1);
    }
  });

  it('reaches approximately max at t=quarter-period (sine peak)', () => {
    for (const mood of ALL_MOODS) {
      const { max } = getMoodOpacityRange(mood);
      const period = getMoodPulseRate(mood) * 1000;
      const opacity = computeAuraOpacity(mood, period / 4); // t=0.25 → sine=1
      expect(opacity).toBeCloseTo(max, 4);
    }
  });

  it('reaches approximately min at t=three-quarter-period (sine trough)', () => {
    for (const mood of ALL_MOODS) {
      const { min } = getMoodOpacityRange(mood);
      const period = getMoodPulseRate(mood) * 1000;
      const opacity = computeAuraOpacity(mood, (3 * period) / 4); // t=0.75 → sine=-1
      expect(opacity).toBeCloseTo(min, 4);
    }
  });

  it('elapsed > period wraps correctly (2× period same as 0 offset)', () => {
    for (const mood of ALL_MOODS) {
      const period = getMoodPulseRate(mood) * 1000;
      const a = computeAuraOpacity(mood, period * 2);
      const b = computeAuraOpacity(mood, 0);
      expect(a).toBeCloseTo(b, 5);
    }
  });
});

// ─── getMoodEmoji (regression) ─────────────────────────────────────────────────

describe('T-359 — getMoodEmoji: regression — still returns emoji for all moods', () => {
  it('getMoodEmoji returns non-empty string for all moods', () => {
    for (const mood of ALL_MOODS) {
      const emoji = getMoodEmoji(mood);
      expect(typeof emoji).toBe('string');
      expect(emoji.length).toBeGreaterThan(0);
    }
  });

  it('happy → 😊', () => expect(getMoodEmoji('happy')).toBe('😊'));
  it('excited → 🤩', () => expect(getMoodEmoji('excited')).toBe('🤩'));
  it('sad → 😔', () => expect(getMoodEmoji('sad')).toBe('😔'));
  it('anxious → 😰', () => expect(getMoodEmoji('anxious')).toBe('😰'));
  it('neutral → 😐', () => expect(getMoodEmoji('neutral')).toBe('😐'));
});

// ─── Mood broadcast message shape ─────────────────────────────────────────────

describe('T-359 — mood broadcast message shape validation', () => {
  it('valid mood values are a known set', () => {
    const validMoods = new Set(['happy', 'excited', 'sad', 'anxious', 'neutral']);
    for (const mood of ALL_MOODS) {
      expect(validMoods.has(mood)).toBe(true);
    }
  });

  it('getMoodColor handles all valid broadcast mood strings', () => {
    const broadcastMoods = ['happy', 'excited', 'sad', 'anxious', 'neutral'];
    for (const mood of broadcastMoods) {
      expect(() => getMoodColor(mood as Mood)).not.toThrow();
      expect(getMoodColor(mood as Mood)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('computeAuraOpacity handles all valid broadcast mood strings', () => {
    for (const mood of ALL_MOODS) {
      expect(() => computeAuraOpacity(mood, 1000)).not.toThrow();
      const opacity = computeAuraOpacity(mood, 1000);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });
});
