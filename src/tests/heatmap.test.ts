/**
 * heatmap.test.ts
 * T-364 — Room Activity Heatmap Overlay
 *
 * 25+ tests covering:
 *  - Activity tracking
 *  - Intensity normalization
 *  - Color gradient (green→yellow→red)
 *  - Rolling window pruning
 *  - Grid aggregation
 *  - Toggle state (via HeatmapOverlay pure helpers)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackActivity,
  getHeatmapGrid,
  normalizeIntensity,
  activityToColor,
  pruneOldEvents,
  clearAll,
  clearRoom,
  getRawEventCount,
  getTrackedRooms,
  WINDOW_MS,
  type ActivityEvent,
  type ActivityType,
} from '../services/heatmapService.js';

import {
  normalizeIntensity as clientNormalizeIntensity,
  activityToColor as clientActivityToColor,
  parseRgba,
} from '../../client/src/ui/heatmapHelpers.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROOM_A = 'room-alpha';
const ROOM_B = 'room-beta';

/** Simulate time by building a mock now fn */
function makeClock(startMs: number): { now: () => number; advance: (ms: number) => void } {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms: number) => { current += ms; },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearAll();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Activity Tracking
// ═══════════════════════════════════════════════════════════════════════════════

describe('Activity Tracking', () => {
  it('tracks a single activity event', () => {
    trackActivity(ROOM_A, 3, 4, 'move');
    expect(getRawEventCount(ROOM_A)).toBe(1);
  });

  it('tracks multiple events for the same tile', () => {
    trackActivity(ROOM_A, 1, 1, 'chat');
    trackActivity(ROOM_A, 1, 1, 'chat');
    trackActivity(ROOM_A, 1, 1, 'emote');
    expect(getRawEventCount(ROOM_A)).toBe(3);
  });

  it('tracks events for different tiles independently', () => {
    trackActivity(ROOM_A, 0, 0, 'move');
    trackActivity(ROOM_A, 5, 5, 'trade');
    expect(getRawEventCount(ROOM_A)).toBe(2);
  });

  it('tracks events across multiple rooms without cross-contamination', () => {
    trackActivity(ROOM_A, 2, 2, 'idle');
    trackActivity(ROOM_B, 3, 3, 'interact');
    expect(getRawEventCount(ROOM_A)).toBe(1);
    expect(getRawEventCount(ROOM_B)).toBe(1);
  });

  it('accepts all valid activity types', () => {
    const types: ActivityType[] = ['move', 'chat', 'emote', 'trade', 'interact', 'idle'];
    for (const type of types) {
      trackActivity(ROOM_A, 0, 0, type);
    }
    expect(getRawEventCount(ROOM_A)).toBe(6);
  });

  it('registers room in tracked rooms list', () => {
    trackActivity(ROOM_A, 0, 0, 'move');
    expect(getTrackedRooms()).toContain(ROOM_A);
  });

  it('clearRoom removes only the target room', () => {
    trackActivity(ROOM_A, 0, 0, 'move');
    trackActivity(ROOM_B, 0, 0, 'move');
    clearRoom(ROOM_A);
    expect(getRawEventCount(ROOM_A)).toBe(0);
    expect(getRawEventCount(ROOM_B)).toBe(1);
  });

  it('clearAll removes all rooms', () => {
    trackActivity(ROOM_A, 0, 0, 'move');
    trackActivity(ROOM_B, 0, 0, 'move');
    clearAll();
    expect(getTrackedRooms()).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Rolling Window Pruning
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rolling Window Pruning', () => {
  it('keeps events within the 5-min window', () => {
    const clock = makeClock(1_000_000);
    const events: ActivityEvent[] = [
      { roomId: ROOM_A, tileX: 0, tileY: 0, type: 'move', timestamp: clock.now() - 4 * 60 * 1000 }, // 4 min ago — keep
      { roomId: ROOM_A, tileX: 1, tileY: 1, type: 'chat', timestamp: clock.now() - 1 * 60 * 1000 }, // 1 min ago — keep
    ];
    const result = pruneOldEvents(events, clock.now());
    expect(result).toHaveLength(2);
  });

  it('prunes events older than 5 minutes', () => {
    const clock = makeClock(1_000_000);
    const events: ActivityEvent[] = [
      { roomId: ROOM_A, tileX: 0, tileY: 0, type: 'move', timestamp: clock.now() - WINDOW_MS - 1 }, // expired
      { roomId: ROOM_A, tileX: 1, tileY: 1, type: 'chat', timestamp: clock.now() - 1000 },           // fresh
    ];
    const result = pruneOldEvents(events, clock.now());
    expect(result).toHaveLength(1);
    expect(result[0].tileX).toBe(1);
  });

  it('prunes all events if all are expired', () => {
    const clock = makeClock(1_000_000);
    const events: ActivityEvent[] = [
      { roomId: ROOM_A, tileX: 0, tileY: 0, type: 'idle', timestamp: clock.now() - WINDOW_MS - 1000 },
      { roomId: ROOM_A, tileX: 2, tileY: 2, type: 'idle', timestamp: clock.now() - WINDOW_MS * 2 },
    ];
    expect(pruneOldEvents(events, clock.now())).toHaveLength(0);
  });

  it('pruneOldEvents is a pure function (does not mutate input)', () => {
    const clock = makeClock(1_000_000);
    const original: ActivityEvent[] = [
      { roomId: ROOM_A, tileX: 0, tileY: 0, type: 'move', timestamp: clock.now() - WINDOW_MS - 1 },
    ];
    pruneOldEvents(original, clock.now());
    expect(original).toHaveLength(1); // unchanged
  });

  it('getHeatmapGrid auto-prunes stale entries from store', () => {
    const clock = makeClock(1_000_000);
    // Insert a stale event directly via clock-aware trackActivity
    trackActivity(ROOM_A, 0, 0, 'move', () => clock.now() - WINDOW_MS - 5000);
    // Advance clock and query
    clock.advance(WINDOW_MS + 10_000);
    const grid = getHeatmapGrid(ROOM_A, clock.now);
    expect(grid.cells).toHaveLength(0);
    expect(getRawEventCount(ROOM_A)).toBe(0);
  });

  it('WINDOW_MS is 5 minutes', () => {
    expect(WINDOW_MS).toBe(300_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Grid Aggregation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Grid Aggregation', () => {
  it('returns empty grid for room with no activity', () => {
    const grid = getHeatmapGrid(ROOM_A);
    expect(grid.cells).toHaveLength(0);
    expect(grid.maxCount).toBe(0);
  });

  it('aggregates multiple events on the same tile into one cell', () => {
    trackActivity(ROOM_A, 2, 3, 'chat');
    trackActivity(ROOM_A, 2, 3, 'emote');
    trackActivity(ROOM_A, 2, 3, 'move');
    const grid = getHeatmapGrid(ROOM_A);
    expect(grid.cells).toHaveLength(1);
    expect(grid.cells[0].count).toBe(3);
    expect(grid.cells[0].tileX).toBe(2);
    expect(grid.cells[0].tileY).toBe(3);
  });

  it('produces separate cells for different tiles', () => {
    trackActivity(ROOM_A, 0, 0, 'move');
    trackActivity(ROOM_A, 1, 0, 'chat');
    trackActivity(ROOM_A, 0, 1, 'idle');
    const grid = getHeatmapGrid(ROOM_A);
    expect(grid.cells).toHaveLength(3);
  });

  it('sets maxCount to the highest tile count', () => {
    trackActivity(ROOM_A, 0, 0, 'move');
    trackActivity(ROOM_A, 1, 1, 'chat');
    trackActivity(ROOM_A, 1, 1, 'emote');
    trackActivity(ROOM_A, 1, 1, 'trade');
    const grid = getHeatmapGrid(ROOM_A);
    expect(grid.maxCount).toBe(3);
  });

  it('assigns intensity 1 to the hottest tile', () => {
    trackActivity(ROOM_A, 5, 5, 'move');
    trackActivity(ROOM_A, 5, 5, 'chat');
    trackActivity(ROOM_A, 0, 0, 'idle');
    const grid = getHeatmapGrid(ROOM_A);
    const hot = grid.cells.find((c) => c.tileX === 5 && c.tileY === 5)!;
    expect(hot.intensity).toBe(1);
  });

  it('assigns a valid rgba color to each cell', () => {
    trackActivity(ROOM_A, 0, 0, 'move');
    const grid = getHeatmapGrid(ROOM_A);
    expect(grid.cells[0].color).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
  });

  it('grid includes roomId and generatedAt', () => {
    const grid = getHeatmapGrid(ROOM_A);
    expect(grid.roomId).toBe(ROOM_A);
    expect(typeof grid.generatedAt).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Intensity Normalization
// ═══════════════════════════════════════════════════════════════════════════════

describe('normalizeIntensity', () => {
  it('returns 0 when max is 0', () => {
    expect(normalizeIntensity(0, 0)).toBe(0);
  });

  it('returns 0 when count is 0', () => {
    expect(normalizeIntensity(0, 10)).toBe(0);
  });

  it('returns 1 when count equals max', () => {
    expect(normalizeIntensity(5, 5)).toBe(1);
  });

  it('returns 0.5 for half of max', () => {
    expect(normalizeIntensity(5, 10)).toBeCloseTo(0.5);
  });

  it('clamps to 1 if count exceeds max', () => {
    expect(normalizeIntensity(15, 10)).toBe(1);
  });

  it('server and client implementations agree', () => {
    const pairs = [[3, 10], [7, 7], [0, 5], [1, 100]] as const;
    for (const [c, m] of pairs) {
      expect(normalizeIntensity(c, m)).toBeCloseTo(clientNormalizeIntensity(c, m), 10);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Color Gradient
// ═══════════════════════════════════════════════════════════════════════════════

describe('activityToColor', () => {
  it('returns a valid rgba string for intensity 0', () => {
    const c = activityToColor(0);
    expect(c).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
  });

  it('intensity 0 yields green-leaning color', () => {
    const c = activityToColor(0);
    const [, alpha] = parseRgba(c);
    // At 0, r=0, g=200, b=0
    expect(c).toBe('rgba(0,200,0,0.15)');
    expect(alpha).toBeCloseTo(0.15, 2);
  });

  it('intensity 1 yields red color', () => {
    const c = activityToColor(1);
    // At 1, r=255, g=0, b=0, alpha=0.75
    expect(c).toBe('rgba(255,0,0,0.75)');
  });

  it('intensity 0.5 yields yellow-ish color', () => {
    const c = activityToColor(0.5);
    // At exactly 0.5: r=255, g=200, b=0 (transition boundary)
    expect(c).toBe('rgba(255,200,0,0.45)');
  });

  it('alpha increases with intensity', () => {
    const low = activityToColor(0.1);
    const high = activityToColor(0.9);
    const [, a1] = parseRgba(low);
    const [, a2] = parseRgba(high);
    expect(a2).toBeGreaterThan(a1);
  });

  it('clamps intensities above 1 to 1', () => {
    expect(activityToColor(1.5)).toBe(activityToColor(1));
  });

  it('clamps intensities below 0 to 0', () => {
    expect(activityToColor(-0.5)).toBe(activityToColor(0));
  });

  it('server and client implementations produce identical output', () => {
    const intensities = [0, 0.25, 0.5, 0.75, 1];
    for (const i of intensities) {
      expect(activityToColor(i)).toBe(clientActivityToColor(i));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. parseRgba helper (client)
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseRgba (client helper)', () => {
  it('parses a valid rgba string', () => {
    const [hex, alpha] = parseRgba('rgba(255,128,0,0.5)');
    expect(hex).toBe((255 << 16) | (128 << 8) | 0);
    expect(alpha).toBeCloseTo(0.5, 2);
  });

  it('parses rgb string without alpha', () => {
    const [, alpha] = parseRgba('rgb(0,200,0)');
    expect(alpha).toBe(1);
  });

  it('returns fallback for invalid string', () => {
    const [hex, alpha] = parseRgba('invalid');
    expect(hex).toBe(0x00ff00);
    expect(alpha).toBeCloseTo(0.3, 2);
  });
});
