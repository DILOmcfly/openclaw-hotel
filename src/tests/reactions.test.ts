/**
 * reactions.test.ts — T-360: Spectator Emoji Reactions
 *
 * Tests for:
 *  - ReactionBar pure logic (constants, isValidEmoji, buildReactionPayload,
 *    clientRateCheck, msTillNextReaction)
 *  - FloatingReaction pure logic (calcFloatY, calcOpacity, clampProgress,
 *    randomXOffset constants)
 *  - Server-side reaction rate limiting (checkReactionRateLimit, msUntilNextReaction)
 *
 * All tests run in Node environment — no DOM required.
 * DOM classes (ReactionBar, FloatingReaction) are not instantiated here.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ── ReactionBar pure imports ──────────────────────────────────────────────────
import {
  REACTION_EMOJIS,
  REACTION_RATE_LIMIT,
  REACTION_RATE_WINDOW,
  isValidEmoji,
  buildReactionPayload,
  clientRateCheck,
  msTillNextReaction,
} from '../../client/src/ui/ReactionBar.js';

// ── FloatingReaction pure imports ─────────────────────────────────────────────
import {
  FLOAT_DISTANCE,
  FLOAT_DURATION,
  X_OFFSET_RANGE,
  calcFloatY,
  calcOpacity,
  clampProgress,
  randomXOffset,
} from '../../client/src/ui/FloatingReaction.js';

// ── Server-side rate limiter imports ─────────────────────────────────────────
import {
  REACTION_RATE_LIMIT  as SERVER_RATE_LIMIT,
  REACTION_RATE_WINDOW_MS,
  ALLOWED_REACTION_EMOJIS,
  checkReactionRateLimit,
  msUntilNextReaction,
} from '../ws/spectator.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal WebSocket stub that satisfies the WeakMap key requirement */
function makeWs(): object {
  return Object.create(null); // unique object reference per call
}

// =============================================================================
// ReactionBar — constants & config
// =============================================================================

describe('ReactionBar — constants', () => {
  it('exports exactly 6 emojis', () => {
    expect(REACTION_EMOJIS).toHaveLength(6);
  });

  it('emoji list is the correct set', () => {
    const expected = ['❤️', '😂', '🔥', '👏', '😮', '💀'];
    expect(REACTION_EMOJIS).toEqual(expected);
  });

  it('client rate limit is 3', () => {
    expect(REACTION_RATE_LIMIT).toBe(3);
  });

  it('client rate window is 5000 ms', () => {
    expect(REACTION_RATE_WINDOW).toBe(5_000);
  });
});

// =============================================================================
// ReactionBar — isValidEmoji
// =============================================================================

describe('ReactionBar — isValidEmoji', () => {
  it('returns true for each allowed emoji', () => {
    for (const emoji of REACTION_EMOJIS) {
      expect(isValidEmoji(emoji)).toBe(true);
    }
  });

  it('returns false for an arbitrary string', () => {
    expect(isValidEmoji('hello')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidEmoji('')).toBe(false);
  });

  it('returns false for a similar-looking but wrong emoji', () => {
    expect(isValidEmoji('💛')).toBe(false);
  });
});

// =============================================================================
// ReactionBar — buildReactionPayload
// =============================================================================

describe('ReactionBar — buildReactionPayload', () => {
  it('returns correct type field', () => {
    const p = buildReactionPayload('❤️', 'room-1');
    expect(p.type).toBe('spectator.reaction');
  });

  it('preserves emoji and roomId', () => {
    const p = buildReactionPayload('🔥', 'room-99');
    expect(p.emoji).toBe('🔥');
    expect(p.roomId).toBe('room-99');
  });

  it('includes a timestamp close to Date.now()', () => {
    const before = Date.now();
    const p = buildReactionPayload('😂', 'r');
    const after = Date.now();
    expect(p.timestamp).toBeGreaterThanOrEqual(before);
    expect(p.timestamp).toBeLessThanOrEqual(after);
  });
});

// =============================================================================
// ReactionBar — clientRateCheck (sliding window)
// =============================================================================

describe('ReactionBar — clientRateCheck', () => {
  let ts: number[];
  const T0 = 1_000_000;

  beforeEach(() => {
    ts = [];
  });

  it('allows first reaction', () => {
    expect(clientRateCheck(ts, T0)).toBe(true);
  });

  it('allows up to REACTION_RATE_LIMIT reactions', () => {
    for (let i = 0; i < REACTION_RATE_LIMIT; i++) {
      expect(clientRateCheck(ts, T0 + i)).toBe(true);
    }
  });

  it('blocks the (RATE_LIMIT + 1)th reaction in the window', () => {
    for (let i = 0; i < REACTION_RATE_LIMIT; i++) {
      clientRateCheck(ts, T0 + i);
    }
    expect(clientRateCheck(ts, T0 + REACTION_RATE_LIMIT)).toBe(false);
  });

  it('allows a reaction after the window has expired', () => {
    // fill the window
    for (let i = 0; i < REACTION_RATE_LIMIT; i++) {
      clientRateCheck(ts, T0 + i);
    }
    // advance past the window — all old timestamps should expire
    const afterWindow = T0 + REACTION_RATE_WINDOW + 1;
    expect(clientRateCheck(ts, afterWindow)).toBe(true);
  });

  it('prunes stale timestamps from the array', () => {
    clientRateCheck(ts, T0);
    // Jump past window
    clientRateCheck(ts, T0 + REACTION_RATE_WINDOW + 100);
    // Only the most recent timestamp should remain
    expect(ts).toHaveLength(1);
  });
});

// =============================================================================
// ReactionBar — msTillNextReaction
// =============================================================================

describe('ReactionBar — msTillNextReaction', () => {
  const T0 = 2_000_000;

  it('returns 0 when no reactions have been sent', () => {
    expect(msTillNextReaction([], T0)).toBe(0);
  });

  it('returns 0 when under the rate limit', () => {
    const ts = [T0 - 1000, T0 - 500]; // 2 reactions, limit is 3
    expect(msTillNextReaction(ts, T0)).toBe(0);
  });

  it('returns positive ms when rate-limited', () => {
    const ts = [T0 - 4000, T0 - 3000, T0 - 2000]; // 3 in window
    const wait = msTillNextReaction(ts, T0);
    expect(wait).toBeGreaterThan(0);
  });

  it('returns 0 after window expires', () => {
    // 3 reactions all sent exactly REACTION_RATE_WINDOW ms ago (just expired)
    const old = T0 - REACTION_RATE_WINDOW - 1;
    const ts = [old, old + 1, old + 2];
    expect(msTillNextReaction(ts, T0)).toBe(0);
  });
});

// =============================================================================
// FloatingReaction — constants
// =============================================================================

describe('FloatingReaction — constants', () => {
  it('FLOAT_DISTANCE is 100', () => {
    expect(FLOAT_DISTANCE).toBe(100);
  });

  it('FLOAT_DURATION is 1500', () => {
    expect(FLOAT_DURATION).toBe(1500);
  });

  it('X_OFFSET_RANGE is 20', () => {
    expect(X_OFFSET_RANGE).toBe(20);
  });
});

// =============================================================================
// FloatingReaction — calcFloatY
// =============================================================================

describe('FloatingReaction — calcFloatY', () => {
  it('returns startY at progress 0', () => {
    expect(calcFloatY(300, 0)).toBe(300);
  });

  it('returns startY - FLOAT_DISTANCE at progress 1', () => {
    expect(calcFloatY(300, 1)).toBe(300 - FLOAT_DISTANCE);
  });

  it('returns midpoint at progress 0.5', () => {
    expect(calcFloatY(200, 0.5)).toBe(200 - FLOAT_DISTANCE * 0.5);
  });

  it('is monotonically decreasing as progress increases', () => {
    const ys = [0, 0.25, 0.5, 0.75, 1].map(p => calcFloatY(500, p));
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeLessThan(ys[i - 1]);
    }
  });
});

// =============================================================================
// FloatingReaction — calcOpacity
// =============================================================================

describe('FloatingReaction — calcOpacity', () => {
  it('is 1 at progress 0', () => {
    expect(calcOpacity(0)).toBe(1);
  });

  it('is 0 at progress 1', () => {
    expect(calcOpacity(1)).toBe(0);
  });

  it('is 0.5 at progress 0.5', () => {
    expect(calcOpacity(0.5)).toBeCloseTo(0.5);
  });

  it('never goes below 0 (progress > 1)', () => {
    expect(calcOpacity(2)).toBe(0);
  });
});

// =============================================================================
// FloatingReaction — clampProgress
// =============================================================================

describe('FloatingReaction — clampProgress', () => {
  it('returns 0 for elapsed 0', () => {
    expect(clampProgress(0, 1500)).toBe(0);
  });

  it('returns 1 for elapsed >= duration', () => {
    expect(clampProgress(1500, 1500)).toBe(1);
    expect(clampProgress(2000, 1500)).toBe(1);
  });

  it('returns fractional value mid-flight', () => {
    expect(clampProgress(750, 1500)).toBeCloseTo(0.5);
  });

  it('never returns negative for negative elapsed', () => {
    expect(clampProgress(-100, 1500)).toBe(0);
  });
});

// =============================================================================
// FloatingReaction — randomXOffset
// =============================================================================

describe('FloatingReaction — randomXOffset', () => {
  it('stays within [-X_OFFSET_RANGE, +X_OFFSET_RANGE]', () => {
    for (let i = 0; i < 100; i++) {
      const offset = randomXOffset();
      expect(offset).toBeGreaterThanOrEqual(-X_OFFSET_RANGE);
      expect(offset).toBeLessThanOrEqual(X_OFFSET_RANGE);
    }
  });

  it('uses the supplied rand function', () => {
    // rand = 0 → offset = -X_OFFSET_RANGE
    expect(randomXOffset(() => 0)).toBeCloseTo(-X_OFFSET_RANGE);
    // rand = 1 → offset = +X_OFFSET_RANGE
    expect(randomXOffset(() => 1)).toBeCloseTo(X_OFFSET_RANGE);
    // rand = 0.5 → offset ≈ 0
    expect(randomXOffset(() => 0.5)).toBeCloseTo(0);
  });
});

// =============================================================================
// Server-side — ALLOWED_REACTION_EMOJIS
// =============================================================================

describe('Server — ALLOWED_REACTION_EMOJIS', () => {
  it('contains exactly 6 emojis', () => {
    expect(ALLOWED_REACTION_EMOJIS.size).toBe(6);
  });

  it('matches the client REACTION_EMOJIS list', () => {
    for (const emoji of REACTION_EMOJIS) {
      expect(ALLOWED_REACTION_EMOJIS.has(emoji)).toBe(true);
    }
  });

  it('rejects an arbitrary string', () => {
    expect(ALLOWED_REACTION_EMOJIS.has('💩')).toBe(false);
  });
});

// =============================================================================
// Server-side — checkReactionRateLimit
// =============================================================================

describe('Server — checkReactionRateLimit', () => {
  it('allows first reaction on a fresh connection', () => {
    const ws = makeWs() as any;
    expect(checkReactionRateLimit(ws, 1_000_000)).toBe(true);
  });

  it('allows exactly SERVER_RATE_LIMIT reactions in one window', () => {
    const ws = makeWs() as any;
    const base = 1_000_000;
    for (let i = 0; i < SERVER_RATE_LIMIT; i++) {
      expect(checkReactionRateLimit(ws, base + i * 100)).toBe(true);
    }
  });

  it('blocks the (limit + 1)th reaction', () => {
    const ws = makeWs() as any;
    const base = 1_000_000;
    for (let i = 0; i < SERVER_RATE_LIMIT; i++) {
      checkReactionRateLimit(ws, base + i * 100);
    }
    expect(checkReactionRateLimit(ws, base + SERVER_RATE_LIMIT * 100)).toBe(false);
  });

  it('resets after the window expires', () => {
    const ws = makeWs() as any;
    const base = 1_000_000;
    for (let i = 0; i < SERVER_RATE_LIMIT; i++) {
      checkReactionRateLimit(ws, base);
    }
    // Past the window
    const future = base + REACTION_RATE_WINDOW_MS + 1;
    expect(checkReactionRateLimit(ws, future)).toBe(true);
  });

  it('different WS objects have independent limits', () => {
    const ws1 = makeWs() as any;
    const ws2 = makeWs() as any;
    const base = 2_000_000;
    // Exhaust ws1
    for (let i = 0; i < SERVER_RATE_LIMIT; i++) {
      checkReactionRateLimit(ws1, base);
    }
    // ws2 should still be allowed
    expect(checkReactionRateLimit(ws2, base)).toBe(true);
  });
});

// =============================================================================
// Server-side — msUntilNextReaction
// =============================================================================

describe('Server — msUntilNextReaction', () => {
  it('returns 0 for a fresh connection', () => {
    const ws = makeWs() as any;
    expect(msUntilNextReaction(ws, 1_000_000)).toBe(0);
  });

  it('returns 0 when under the limit', () => {
    const ws = makeWs() as any;
    checkReactionRateLimit(ws, 1_000_000);
    expect(msUntilNextReaction(ws, 1_000_000 + 10)).toBe(0);
  });

  it('returns positive ms when rate-limited', () => {
    const ws = makeWs() as any;
    const base = 3_000_000;
    for (let i = 0; i < SERVER_RATE_LIMIT; i++) {
      checkReactionRateLimit(ws, base);
    }
    const wait = msUntilNextReaction(ws, base + 100);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(REACTION_RATE_WINDOW_MS);
  });

  it('decreases over time', () => {
    const ws = makeWs() as any;
    const base = 4_000_000;
    for (let i = 0; i < SERVER_RATE_LIMIT; i++) {
      checkReactionRateLimit(ws, base);
    }
    const wait1 = msUntilNextReaction(ws, base + 500);
    const wait2 = msUntilNextReaction(ws, base + 1000);
    expect(wait2).toBeLessThan(wait1);
  });
});
