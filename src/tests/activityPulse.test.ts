/**
 * T-369: Activity Pulse — Unit Tests
 *
 * Tests for ActivityPulseTracker:
 *   - recordEvent & rolling-window eviction
 *   - getEventsPerMinute accuracy
 *   - getHeatLevel thresholds (quiet / moderate / busy / hot)
 *   - reset()
 *   - getSnapshot()
 *   - Static helpers: colorForLevel, pulseDurationMs, THRESHOLDS
 *   - Edge cases: empty tracker, exact boundary counts, large bursts,
 *     custom window, constructor validation
 *
 * Pure unit tests — no database, no network.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ActivityPulseTracker, HeatLevel } from '../activityPulse';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a fake clock that starts at `start` and advances by `step` each call */
function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => { t += ms; },
    set: (ms: number) => { t = ms; },
  };
}

/** Record `n` events using tracker.recordEvent() */
function recordN(tracker: ActivityPulseTracker, n: number) {
  for (let i = 0; i < n; i++) tracker.recordEvent();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ActivityPulseTracker — constructor', () => {
  it('1. creates with default 60 s window', () => {
    const t = new ActivityPulseTracker();
    expect(t.getEventsPerMinute()).toBe(0);
  });

  it('2. accepts a custom window (e.g. 30 s)', () => {
    const clock = fakeClock(0);
    const t = new ActivityPulseTracker(30_000, clock.now);
    t.recordEvent();
    clock.advance(29_000);
    expect(t.getEventsPerMinute()).toBe(1);
    clock.advance(2_000); // now 31 s later — event should be pruned
    expect(t.getEventsPerMinute()).toBe(0);
  });

  it('3. throws RangeError when windowMs <= 0', () => {
    expect(() => new ActivityPulseTracker(0)).toThrow(RangeError);
    expect(() => new ActivityPulseTracker(-1000)).toThrow(RangeError);
  });
});

describe('ActivityPulseTracker — recordEvent & getEventsPerMinute', () => {
  it('4. starts at 0 events/min', () => {
    const clock = fakeClock(1_000_000);
    const t = new ActivityPulseTracker(60_000, clock.now);
    expect(t.getEventsPerMinute()).toBe(0);
  });

  it('5. records a single event', () => {
    const clock = fakeClock(1_000_000);
    const t = new ActivityPulseTracker(60_000, clock.now);
    t.recordEvent();
    expect(t.getEventsPerMinute()).toBe(1);
  });

  it('6. counts multiple events recorded at the same timestamp', () => {
    const clock = fakeClock(1_000_000);
    const t = new ActivityPulseTracker(60_000, clock.now);
    recordN(t, 10);
    expect(t.getEventsPerMinute()).toBe(10);
  });

  it('7. evicts events exactly at the window boundary', () => {
    const clock = fakeClock(0);
    const t = new ActivityPulseTracker(60_000, clock.now);
    t.recordEvent(); // t=0
    clock.advance(60_000); // now t=60000 — boundary: event recorded at t=0 is <= cutoff (60000-60000=0) → evicted
    expect(t.getEventsPerMinute()).toBe(0);
  });

  it('8. keeps events just inside the window (1 ms before boundary)', () => {
    const clock = fakeClock(0);
    const t = new ActivityPulseTracker(60_000, clock.now);
    t.recordEvent(); // t=0
    clock.advance(59_999); // cutoff = 59999-60000 = -1 → event at 0 is kept
    expect(t.getEventsPerMinute()).toBe(1);
  });

  it('9. evicts only old events, keeps recent ones', () => {
    const clock = fakeClock(0);
    const t = new ActivityPulseTracker(60_000, clock.now);
    recordN(t, 3);   // 3 events at t=0
    clock.advance(61_000); // those 3 are evicted
    recordN(t, 5);   // 5 fresh events at t=61000
    expect(t.getEventsPerMinute()).toBe(5);
  });

  it('10. handles a large burst of events (100)', () => {
    const clock = fakeClock(1_000_000);
    const t = new ActivityPulseTracker(60_000, clock.now);
    recordN(t, 100);
    expect(t.getEventsPerMinute()).toBe(100);
  });

  it('11. events recorded across the window remain counted correctly', () => {
    const clock = fakeClock(0);
    const t = new ActivityPulseTracker(60_000, clock.now);
    t.recordEvent(); // t=0
    clock.advance(30_000);
    t.recordEvent(); // t=30000
    clock.advance(29_999); // total = 59999; both events still inside window
    expect(t.getEventsPerMinute()).toBe(2);
  });

  it('12. rolling window slides correctly over time', () => {
    const clock = fakeClock(0);
    const t = new ActivityPulseTracker(60_000, clock.now);
    recordN(t, 5); // t=0 → 5 events
    clock.advance(30_000);
    recordN(t, 3); // t=30000 → 3 events
    clock.advance(31_000); // t=61000 — first 5 are now evicted; 3 remain
    expect(t.getEventsPerMinute()).toBe(3);
  });
});

describe('ActivityPulseTracker — getHeatLevel', () => {
  let clock: ReturnType<typeof fakeClock>;
  let tracker: ActivityPulseTracker;

  beforeEach(() => {
    clock = fakeClock(1_000_000);
    tracker = new ActivityPulseTracker(60_000, clock.now);
  });

  it('13. returns "quiet" with 0 events', () => {
    expect(tracker.getHeatLevel()).toBe('quiet');
  });

  it('14. returns "quiet" with 4 events (upper boundary)', () => {
    recordN(tracker, 4);
    expect(tracker.getHeatLevel()).toBe('quiet');
  });

  it('15. returns "moderate" with 5 events (lower boundary)', () => {
    recordN(tracker, 5);
    expect(tracker.getHeatLevel()).toBe('moderate');
  });

  it('16. returns "moderate" with 14 events (upper boundary)', () => {
    recordN(tracker, 14);
    expect(tracker.getHeatLevel()).toBe('moderate');
  });

  it('17. returns "busy" with 15 events (lower boundary)', () => {
    recordN(tracker, 15);
    expect(tracker.getHeatLevel()).toBe('busy');
  });

  it('18. returns "busy" with 29 events (upper boundary)', () => {
    recordN(tracker, 29);
    expect(tracker.getHeatLevel()).toBe('busy');
  });

  it('19. returns "hot" with 30 events (lower boundary)', () => {
    recordN(tracker, 30);
    expect(tracker.getHeatLevel()).toBe('hot');
  });

  it('20. returns "hot" with 100 events (large burst)', () => {
    recordN(tracker, 100);
    expect(tracker.getHeatLevel()).toBe('hot');
  });

  it('21. heat level degrades after events fall out of window', () => {
    recordN(tracker, 30); // hot
    expect(tracker.getHeatLevel()).toBe('hot');
    clock.advance(61_000); // all evicted
    expect(tracker.getHeatLevel()).toBe('quiet');
  });
});

describe('ActivityPulseTracker — reset()', () => {
  it('22. reset clears all events', () => {
    const clock = fakeClock(1_000_000);
    const t = new ActivityPulseTracker(60_000, clock.now);
    recordN(t, 20);
    expect(t.getEventsPerMinute()).toBe(20);
    t.reset();
    expect(t.getEventsPerMinute()).toBe(0);
    expect(t.getHeatLevel()).toBe('quiet');
  });

  it('23. can record new events after reset', () => {
    const clock = fakeClock(1_000_000);
    const t = new ActivityPulseTracker(60_000, clock.now);
    recordN(t, 20);
    t.reset();
    recordN(t, 7);
    expect(t.getEventsPerMinute()).toBe(7);
    expect(t.getHeatLevel()).toBe('moderate');
  });
});

describe('ActivityPulseTracker — getSnapshot()', () => {
  it('24. snapshot reflects current state', () => {
    const clock = fakeClock(1_000_000);
    const t = new ActivityPulseTracker(60_000, clock.now);
    recordN(t, 18);
    const snap = t.getSnapshot();
    expect(snap.eventsPerMinute).toBe(18);
    expect(snap.heatLevel).toBe('busy');
    expect(snap.eventCount).toBe(18);
  });

  it('25. snapshot on empty tracker', () => {
    const t = new ActivityPulseTracker();
    const snap = t.getSnapshot();
    expect(snap.eventsPerMinute).toBe(0);
    expect(snap.heatLevel).toBe('quiet');
    expect(snap.eventCount).toBe(0);
  });
});

describe('ActivityPulseTracker — static colorForLevel()', () => {
  it('26. returns correct colors for each level', () => {
    expect(ActivityPulseTracker.colorForLevel('quiet')).toBe('#3b82f6');
    expect(ActivityPulseTracker.colorForLevel('moderate')).toBe('#22c55e');
    expect(ActivityPulseTracker.colorForLevel('busy')).toBe('#f97316');
    expect(ActivityPulseTracker.colorForLevel('hot')).toBe('#ef4444');
  });
});

describe('ActivityPulseTracker — static pulseDurationMs()', () => {
  it('27. pulse duration decreases with activity (faster = more activity)', () => {
    const durations = (['quiet', 'moderate', 'busy', 'hot'] as HeatLevel[])
      .map(l => ActivityPulseTracker.pulseDurationMs(l));
    // Each subsequent level must be strictly faster (lower ms)
    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]).toBeLessThan(durations[i - 1]);
    }
  });

  it('28. all durations are positive numbers', () => {
    const levels: HeatLevel[] = ['quiet', 'moderate', 'busy', 'hot'];
    for (const l of levels) {
      expect(ActivityPulseTracker.pulseDurationMs(l)).toBeGreaterThan(0);
    }
  });
});

describe('ActivityPulseTracker — static THRESHOLDS', () => {
  it('29. threshold ranges are consistent and non-overlapping', () => {
    const { quiet, moderate, busy, hot } = ActivityPulseTracker.THRESHOLDS;
    expect(quiet.min).toBe(0);
    expect(moderate.min).toBe(quiet.max + 1);
    expect(busy.min).toBe(moderate.max + 1);
    expect(hot.min).toBe(busy.max + 1);
    expect(hot.max).toBe(Infinity);
  });
});

describe('ActivityPulseTracker — concurrent / integration scenarios', () => {
  it('30. simulates a real 60-second session with mixed activity', () => {
    const clock = fakeClock(0);
    const t = new ActivityPulseTracker(60_000, clock.now);

    // 0–10 s: 4 events → quiet
    recordN(t, 4);
    clock.advance(10_000);
    expect(t.getHeatLevel()).toBe('quiet');

    // 10–30 s: 8 more events → 12 total in window → moderate
    recordN(t, 8);
    clock.advance(20_000);
    expect(t.getHeatLevel()).toBe('moderate');

    // 30–60 s: 10 more events → 22 total in window → busy
    recordN(t, 10);
    clock.advance(30_000); // t=60000; events at t=0 (4 events) are now evicted (they are at 0, cutoff=0 → evicted)
    // remaining: 8 events (recorded at t=10000) + 10 events (at t=30000) = 18
    expect(t.getEventsPerMinute()).toBe(18);
    expect(t.getHeatLevel()).toBe('busy');

    // After reset: back to quiet
    t.reset();
    expect(t.getHeatLevel()).toBe('quiet');
  });
});
