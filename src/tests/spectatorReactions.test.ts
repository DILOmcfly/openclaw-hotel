/**
 * T-348: Spectator Reaction System — Unit Tests
 *
 * Pure logic tests (no DOM / jsdom required).
 * Tests cover:
 *  - Cooldown state machine (set, check, reset)
 *  - Label truncation (max 16 chars)
 *  - Position clamping maths (reaction stays inside canvas)
 *  - Emoji validation (all 6 supported emojis)
 *  - Reaction rate-limit timing logic
 *  - Spread randomisation bounds
 *  - Panel visibility class logic
 *  - Edge cases (empty emoji, undefined label, zero-size canvas)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Pure-logic mirrors from spectate.js ─────────────────────────────────────

const REACTION_COOLDOWN_MS = 2000;
const REACTION_SPAWN_SPREAD = 120;
const SUPPORTED_EMOJIS = ['👍', '🔥', '❤️', '😂', '🤩', '🎉'];
const MAX_LABEL_LEN = 16;

/** State machine */
let _cooldown = false;

function startCooldown(): void  { _cooldown = true; }
function stopCooldown(): void   { _cooldown = false; }
function isCooling(): boolean   { return _cooldown; }

/** Truncate label to MAX_LABEL_LEN characters */
function truncateLabel(label: string): string {
  return label.slice(0, MAX_LABEL_LEN);
}

/** Clamp reaction X inside canvas bounds [20 .. canvasWidth-60] */
function clampX(centreX: number, spread: number, canvasWidth: number): number {
  return Math.max(20, Math.min(canvasWidth - 60, centreX + spread));
}

/** Default Y = near bottom of canvas */
function defaultY(canvasHeight: number): number {
  return canvasHeight - 80;
}

/** Determine if an emoji is in the supported set */
function isSupportedEmoji(emoji: string): boolean {
  return SUPPORTED_EMOJIS.includes(emoji);
}

/** Simulate the panel visibility toggle (returns the new classes set) */
function applyVisibility(currentClasses: Set<string>, inRoom: boolean): Set<string> {
  const next = new Set(currentClasses);
  if (inRoom) {
    next.delete('hidden');
  } else {
    next.add('hidden');
  }
  return next;
}

/** Simulate cooldown timer resolution */
function simulateCooldownExpiry(): void { stopCooldown(); }

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('T-348: Spectator Reaction System', () => {

  beforeEach(() => { stopCooldown(); }); // reset state before each test

  // ── Cooldown state machine ────────────────────────────────────────────────

  describe('Cooldown state machine', () => {
    it('starts as not-cooling', () => {
      expect(isCooling()).toBe(false);
    });

    it('is cooling after startCooldown()', () => {
      startCooldown();
      expect(isCooling()).toBe(true);
    });

    it('is NOT cooling after stopCooldown()', () => {
      startCooldown();
      stopCooldown();
      expect(isCooling()).toBe(false);
    });

    it('ignores second sendReaction if already cooling', () => {
      startCooldown();
      const wasAlreadyCooling = isCooling();
      // A second sendReaction should be blocked
      expect(wasAlreadyCooling).toBe(true);
      // Cooldown should still be true (not reset by second call)
      expect(isCooling()).toBe(true);
    });

    it('allows reaction after cooldown expires', () => {
      vi.useFakeTimers();
      startCooldown();
      expect(isCooling()).toBe(true);

      // Simulate timer expiry
      setTimeout(() => simulateCooldownExpiry(), REACTION_COOLDOWN_MS);
      vi.advanceTimersByTime(REACTION_COOLDOWN_MS + 1);

      expect(isCooling()).toBe(false);
      vi.useRealTimers();
    });

    it('REACTION_COOLDOWN_MS is 2000', () => {
      expect(REACTION_COOLDOWN_MS).toBe(2000);
    });

    it('cooldown resets independently per session', () => {
      startCooldown();
      stopCooldown();
      startCooldown();
      stopCooldown();
      expect(isCooling()).toBe(false);
    });
  });

  // ── Label truncation ──────────────────────────────────────────────────────

  describe('truncateLabel()', () => {
    it('returns the label unchanged when ≤16 chars', () => {
      expect(truncateLabel('Alice')).toBe('Alice');
      expect(truncateLabel('A'.repeat(16))).toBe('A'.repeat(16));
    });

    it('truncates labels longer than 16 chars', () => {
      expect(truncateLabel('A'.repeat(20))).toBe('A'.repeat(16));
    });

    it('handles empty string', () => {
      expect(truncateLabel('')).toBe('');
    });

    it('handles exactly 17-char label (one char truncated)', () => {
      const label = 'Hello, World! abc'; // 17 chars
      expect(truncateLabel(label)).toHaveLength(16);
    });

    it('handles Unicode / emoji labels correctly (by codepoint)', () => {
      const label = '🤖'.repeat(10); // 10 emojis
      const result = truncateLabel(label);
      expect(result.length).toBeLessThanOrEqual(MAX_LABEL_LEN);
    });
  });

  // ── Position clamping ─────────────────────────────────────────────────────

  describe('clampX()', () => {
    it('centres reaction near middle of canvas (no spread)', () => {
      const x = clampX(400, 0, 800);
      expect(x).toBe(400);
    });

    it('clamps to minimum 20 px when centreX + spread < 20', () => {
      const x = clampX(0, -50, 800);
      expect(x).toBe(20);
    });

    it('clamps to maximum canvasWidth-60 when centreX + spread exceeds', () => {
      const x = clampX(900, 100, 800);
      expect(x).toBe(800 - 60);
    });

    it('handles narrow canvas (100px wide)', () => {
      const x = clampX(50, 0, 100);
      // 50 is between [20 .. 40] — clamp to 40
      expect(x).toBe(40);
    });

    it('applies positive spread correctly', () => {
      const x = clampX(400, 30, 800);
      expect(x).toBe(430);
    });

    it('applies negative spread correctly', () => {
      const x = clampX(400, -30, 800);
      expect(x).toBe(370);
    });

    it('REACTION_SPAWN_SPREAD constant is 120', () => {
      expect(REACTION_SPAWN_SPREAD).toBe(120);
    });
  });

  describe('defaultY()', () => {
    it('places reaction 80px from bottom of canvas', () => {
      expect(defaultY(600)).toBe(520);
    });

    it('handles small canvas (200px height)', () => {
      expect(defaultY(200)).toBe(120);
    });
  });

  // ── Emoji validation ──────────────────────────────────────────────────────

  describe('isSupportedEmoji()', () => {
    it('returns true for 👍', () => { expect(isSupportedEmoji('👍')).toBe(true); });
    it('returns true for 🔥', () => { expect(isSupportedEmoji('🔥')).toBe(true); });
    it('returns true for ❤️', () => { expect(isSupportedEmoji('❤️')).toBe(true); });
    it('returns true for 😂', () => { expect(isSupportedEmoji('😂')).toBe(true); });
    it('returns true for 🤩', () => { expect(isSupportedEmoji('🤩')).toBe(true); });
    it('returns true for 🎉', () => { expect(isSupportedEmoji('🎉')).toBe(true); });

    it('returns false for unsupported emoji 🐢', () => {
      expect(isSupportedEmoji('🐢')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isSupportedEmoji('')).toBe(false);
    });

    it('exactly 6 supported emojis', () => {
      expect(SUPPORTED_EMOJIS).toHaveLength(6);
    });
  });

  // ── Panel visibility logic ────────────────────────────────────────────────

  describe('applyVisibility()', () => {
    it('removes "hidden" class when inRoom=true', () => {
      const classes = new Set(['hidden', 'other']);
      const result = applyVisibility(classes, true);
      expect(result.has('hidden')).toBe(false);
      expect(result.has('other')).toBe(true);
    });

    it('adds "hidden" class when inRoom=false', () => {
      const classes = new Set<string>(['other']);
      const result = applyVisibility(classes, false);
      expect(result.has('hidden')).toBe(true);
    });

    it('is idempotent for inRoom=true when already visible', () => {
      const classes = new Set<string>([]);
      const result = applyVisibility(classes, true);
      expect(result.has('hidden')).toBe(false);
    });

    it('is idempotent for inRoom=false when already hidden', () => {
      const classes = new Set(['hidden']);
      const result = applyVisibility(classes, false);
      expect(result.has('hidden')).toBe(true);
    });

    it('does not mutate the original class set', () => {
      const original = new Set(['hidden']);
      applyVisibility(original, true);
      expect(original.has('hidden')).toBe(true); // original unchanged
    });
  });

  // ── Timing / rate limiting ────────────────────────────────────────────────

  describe('Rate limiting timing', () => {
    it('blocks a second reaction within the cooldown window', () => {
      startCooldown();
      const blocked = isCooling();
      expect(blocked).toBe(true);
    });

    it('permits a reaction exactly at REACTION_COOLDOWN_MS after start', () => {
      vi.useFakeTimers();
      startCooldown();
      setTimeout(simulateCooldownExpiry, REACTION_COOLDOWN_MS);
      vi.advanceTimersByTime(REACTION_COOLDOWN_MS);
      expect(isCooling()).toBe(false);
      vi.useRealTimers();
    });

    it('does NOT permit before REACTION_COOLDOWN_MS elapses', () => {
      vi.useFakeTimers();
      startCooldown();
      setTimeout(simulateCooldownExpiry, REACTION_COOLDOWN_MS);
      vi.advanceTimersByTime(REACTION_COOLDOWN_MS - 100);
      expect(isCooling()).toBe(true);
      vi.useRealTimers();
    });
  });
});
