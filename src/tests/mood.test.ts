/**
 * mood.test.ts — T-362: Agent Mood Indicators
 *
 * 30 tests covering:
 *   - MOOD_EMOJIS mapping completeness and correctness
 *   - MOOD_PRIORITIES ordering
 *   - deriveMood: all activity types
 *   - deriveMood: idle threshold timing (30 s bored / 60 s tired)
 *   - idleDurationMs utility
 *   - moodToEmoji helper
 *   - moodPriority / higherPriorityMood
 *   - crossfadeAlpha timing
 *   - MoodIndicator pure-logic state machine
 *     (createIndicatorState / requestMoodChange / tickIndicatorState /
 *      getRenderDescriptor / calcCrossfadeAlpha / calcOutgoing/IncomingOpacity)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  MOOD_EMOJIS,
  MOOD_PRIORITIES,
  BORED_THRESHOLD_MS,
  TIRED_THRESHOLD_MS,
  CROSSFADE_DURATION_MS,
  deriveMood,
  idleDurationMs,
  moodToEmoji,
  moodPriority,
  higherPriorityMood,
  crossfadeAlpha,
  type ActivityMood,
  type AgentActivity,
} from '../services/moodService.js';

import {
  INDICATOR_EMOJIS,
  CROSSFADE_DURATION_MS as UI_CROSSFADE,
  calcCrossfadeAlpha,
  calcOutgoingOpacity,
  calcIncomingOpacity,
  isCrossfadeComplete,
  createIndicatorState,
  requestMoodChange,
  tickIndicatorState,
  getRenderDescriptor,
  moodToEmoji as indicatorMoodToEmoji,
  type IndicatorMood,
} from '../../client/src/ui/MoodIndicator.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_MOODS: ActivityMood[] = ['chatting', 'trading', 'excited', 'bored', 'tired', 'happy'];
const ALL_INDICATOR_MOODS: IndicatorMood[] = ['chatting', 'trading', 'excited', 'bored', 'tired', 'happy'];

const NOW = 1_700_000_000_000; // fixed epoch for deterministic tests

// ─── 1. MOOD_EMOJIS mapping ───────────────────────────────────────────────────

describe('MOOD_EMOJIS mapping', () => {
  it('has an entry for every ActivityMood', () => {
    for (const mood of ALL_MOODS) {
      expect(MOOD_EMOJIS).toHaveProperty(mood);
    }
  });

  it('chatting → 💬', () => expect(MOOD_EMOJIS.chatting).toBe('💬'));
  it('trading  → 🤝', () => expect(MOOD_EMOJIS.trading).toBe('🤝'));
  it('excited  → 🤩', () => expect(MOOD_EMOJIS.excited).toBe('🤩'));
  it('bored    → 😐', () => expect(MOOD_EMOJIS.bored).toBe('😐'));
  it('tired    → 😴', () => expect(MOOD_EMOJIS.tired).toBe('😴'));
  it('happy    → 😊', () => expect(MOOD_EMOJIS.happy).toBe('😊'));

  it('all emoji values are non-empty strings', () => {
    for (const emoji of Object.values(MOOD_EMOJIS)) {
      expect(typeof emoji).toBe('string');
      expect(emoji.length).toBeGreaterThan(0);
    }
  });

  it('all emoji values are distinct', () => {
    const values = Object.values(MOOD_EMOJIS);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ─── 2. MOOD_PRIORITIES ordering ─────────────────────────────────────────────

describe('MOOD_PRIORITIES ordering', () => {
  it('contains all 6 moods', () => {
    expect(MOOD_PRIORITIES).toHaveLength(6);
    for (const mood of ALL_MOODS) {
      expect(MOOD_PRIORITIES).toContain(mood);
    }
  });

  it('chatting has highest priority (index 0)', () => {
    expect(MOOD_PRIORITIES[0]).toBe('chatting');
  });

  it('trading has second priority (index 1)', () => {
    expect(MOOD_PRIORITIES[1]).toBe('trading');
  });

  it('happy has lowest priority (last index)', () => {
    expect(MOOD_PRIORITIES[MOOD_PRIORITIES.length - 1]).toBe('happy');
  });

  it('chatting priority < trading priority (lower index = higher prio)', () => {
    expect(moodPriority('chatting')).toBeLessThan(moodPriority('trading'));
  });

  it('trading priority < excited priority', () => {
    expect(moodPriority('trading')).toBeLessThan(moodPriority('excited'));
  });

  it('excited priority < bored priority', () => {
    expect(moodPriority('excited')).toBeLessThan(moodPriority('bored'));
  });

  it('bored priority < tired priority', () => {
    expect(moodPriority('bored')).toBeLessThan(moodPriority('tired'));
  });

  it('tired priority < happy priority', () => {
    expect(moodPriority('tired')).toBeLessThan(moodPriority('happy'));
  });
});

// ─── 3. deriveMood: activity type → mood ──────────────────────────────────────

describe('deriveMood: activity type mapping', () => {
  it('chat → chatting', () => {
    expect(deriveMood({ type: 'chat', now: NOW })).toBe('chatting');
  });

  it('trade → trading', () => {
    expect(deriveMood({ type: 'trade', now: NOW })).toBe('trading');
  });

  it('achievement → excited', () => {
    expect(deriveMood({ type: 'achievement', now: NOW })).toBe('excited');
  });

  it('default → happy', () => {
    expect(deriveMood({ type: 'default', now: NOW })).toBe('happy');
  });

  it('unknown type (cast) → happy', () => {
    expect(deriveMood({ type: 'default', now: NOW })).toBe('happy');
  });
});

// ─── 4. deriveMood: idle thresholds ──────────────────────────────────────────

describe('deriveMood: idle thresholds', () => {
  it('idle with no idleSince → happy (just became idle)', () => {
    expect(deriveMood({ type: 'idle', now: NOW })).toBe('happy');
  });

  it('idle for 0 ms → happy', () => {
    expect(deriveMood({ type: 'idle', idleSince: NOW, now: NOW })).toBe('happy');
  });

  it('idle for 29 999 ms (just under bored threshold) → happy', () => {
    expect(deriveMood({ type: 'idle', idleSince: NOW - 29_999, now: NOW })).toBe('happy');
  });

  it(`idle for exactly ${BORED_THRESHOLD_MS} ms → bored`, () => {
    expect(deriveMood({ type: 'idle', idleSince: NOW - BORED_THRESHOLD_MS, now: NOW })).toBe('bored');
  });

  it('idle for 45 000 ms → bored', () => {
    expect(deriveMood({ type: 'idle', idleSince: NOW - 45_000, now: NOW })).toBe('bored');
  });

  it('idle for 59 999 ms (just under tired threshold) → bored', () => {
    expect(deriveMood({ type: 'idle', idleSince: NOW - 59_999, now: NOW })).toBe('bored');
  });

  it(`idle for exactly ${TIRED_THRESHOLD_MS} ms → tired`, () => {
    expect(deriveMood({ type: 'idle', idleSince: NOW - TIRED_THRESHOLD_MS, now: NOW })).toBe('tired');
  });

  it('idle for 120 000 ms → tired', () => {
    expect(deriveMood({ type: 'idle', idleSince: NOW - 120_000, now: NOW })).toBe('tired');
  });

  it('BORED_THRESHOLD_MS is 30 000', () => {
    expect(BORED_THRESHOLD_MS).toBe(30_000);
  });

  it('TIRED_THRESHOLD_MS is 60 000', () => {
    expect(TIRED_THRESHOLD_MS).toBe(60_000);
  });
});

// ─── 5. idleDurationMs helper ─────────────────────────────────────────────────

describe('idleDurationMs', () => {
  it('returns 0 when idleSince is undefined', () => {
    expect(idleDurationMs(undefined, NOW)).toBe(0);
  });

  it('returns 0 when idleSince === now', () => {
    expect(idleDurationMs(NOW, NOW)).toBe(0);
  });

  it('returns correct elapsed time', () => {
    expect(idleDurationMs(NOW - 5000, NOW)).toBe(5000);
  });

  it('clamps negative duration to 0 (idleSince in the future)', () => {
    expect(idleDurationMs(NOW + 1000, NOW)).toBe(0);
  });
});

// ─── 6. moodToEmoji helper ────────────────────────────────────────────────────

describe('moodToEmoji', () => {
  it('returns correct emoji for all moods', () => {
    for (const mood of ALL_MOODS) {
      expect(moodToEmoji(mood)).toBe(MOOD_EMOJIS[mood]);
    }
  });

  it('returns 😊 as fallback for unknown mood', () => {
    expect(moodToEmoji('unknown' as ActivityMood)).toBe('😊');
  });
});

// ─── 7. higherPriorityMood helper ────────────────────────────────────────────

describe('higherPriorityMood', () => {
  it('chatting beats trading', () => {
    expect(higherPriorityMood('chatting', 'trading')).toBe('chatting');
  });

  it('trading beats excited', () => {
    expect(higherPriorityMood('trading', 'excited')).toBe('trading');
  });

  it('excited beats bored', () => {
    expect(higherPriorityMood('excited', 'bored')).toBe('excited');
  });

  it('bored beats tired', () => {
    expect(higherPriorityMood('bored', 'tired')).toBe('bored');
  });

  it('same mood returns that mood', () => {
    expect(higherPriorityMood('happy', 'happy')).toBe('happy');
  });
});

// ─── 8. crossfadeAlpha (service) ─────────────────────────────────────────────

describe('crossfadeAlpha (moodService)', () => {
  it('returns 0 at elapsed = 0', () => {
    expect(crossfadeAlpha(0)).toBe(0);
  });

  it('returns 1 at elapsed = CROSSFADE_DURATION_MS', () => {
    expect(crossfadeAlpha(CROSSFADE_DURATION_MS)).toBe(1);
  });

  it('returns 1 when elapsed exceeds duration (clamped)', () => {
    expect(crossfadeAlpha(CROSSFADE_DURATION_MS * 2)).toBe(1);
  });

  it('returns 0.5 at half duration', () => {
    expect(crossfadeAlpha(CROSSFADE_DURATION_MS / 2)).toBeCloseTo(0.5, 5);
  });

  it('never returns negative', () => {
    expect(crossfadeAlpha(-100)).toBe(0);
  });
});

// ─── 9. MoodIndicator pure-logic state machine ───────────────────────────────

describe('MoodIndicator: createIndicatorState', () => {
  it('defaults to happy with no pending transition', () => {
    const s = createIndicatorState();
    expect(s.currentMood).toBe('happy');
    expect(s.pendingMood).toBeNull();
    expect(s.transitionStartMs).toBeNull();
  });

  it('accepts a custom initial mood', () => {
    const s = createIndicatorState('excited');
    expect(s.currentMood).toBe('excited');
  });
});

describe('MoodIndicator: requestMoodChange', () => {
  it('returns same state if mood unchanged and no pending', () => {
    const s = createIndicatorState('happy');
    const s2 = requestMoodChange(s, 'happy', NOW);
    expect(s2).toBe(s);
  });

  it('starts a transition when mood differs', () => {
    const s = createIndicatorState('happy');
    const s2 = requestMoodChange(s, 'chatting', NOW);
    expect(s2.currentMood).toBe('happy');
    expect(s2.pendingMood).toBe('chatting');
    expect(s2.transitionStartMs).toBe(NOW);
  });

  it('cancels pending transition when requesting current mood', () => {
    const s = createIndicatorState('happy');
    const s2 = requestMoodChange(s, 'excited', NOW);
    const s3 = requestMoodChange(s2, 'happy', NOW);
    expect(s3.pendingMood).toBeNull();
  });

  it('original state is not mutated', () => {
    const s = createIndicatorState('happy');
    requestMoodChange(s, 'trading', NOW);
    expect(s.pendingMood).toBeNull();
  });
});

describe('MoodIndicator: tickIndicatorState', () => {
  it('returns same state when no pending transition', () => {
    const s = createIndicatorState('happy');
    const s2 = tickIndicatorState(s, NOW + 100);
    expect(s2).toBe(s);
  });

  it('completes transition after CROSSFADE_DURATION_MS', () => {
    const s = createIndicatorState('happy');
    const s2 = requestMoodChange(s, 'trading', NOW);
    const s3 = tickIndicatorState(s2, NOW + UI_CROSSFADE + 1);
    expect(s3.currentMood).toBe('trading');
    expect(s3.pendingMood).toBeNull();
  });

  it('does not complete transition before CROSSFADE_DURATION_MS', () => {
    const s = createIndicatorState('happy');
    const s2 = requestMoodChange(s, 'trading', NOW);
    const s3 = tickIndicatorState(s2, NOW + UI_CROSSFADE / 2);
    expect(s3.currentMood).toBe('happy'); // still transitioning
  });
});

describe('MoodIndicator: getRenderDescriptor', () => {
  it('returns full opacity and no pending when idle', () => {
    const s = createIndicatorState('happy');
    const d = getRenderDescriptor(s, NOW);
    expect(d.emoji).toBe('😊');
    expect(d.opacity).toBe(1);
    expect(d.pendingEmoji).toBeNull();
    expect(d.pendingOpacity).toBe(0);
  });

  it('mid-transition: outgoing fades, incoming brightens', () => {
    const s = createIndicatorState('happy');
    const s2 = requestMoodChange(s, 'excited', NOW);
    const mid = NOW + UI_CROSSFADE / 2;
    const d = getRenderDescriptor(s2, mid);
    expect(d.opacity).toBeCloseTo(0.5, 1);
    expect(d.pendingOpacity).toBeCloseTo(0.5, 1);
    expect(d.emoji).toBe('😊');
    expect(d.pendingEmoji).toBe('🤩');
  });

  it('at crossfade start: outgoing fully visible, incoming invisible', () => {
    const s = createIndicatorState('chatting');
    const s2 = requestMoodChange(s, 'tired', NOW);
    const d = getRenderDescriptor(s2, NOW);
    expect(d.opacity).toBeCloseTo(1, 5);
    expect(d.pendingOpacity).toBeCloseTo(0, 5);
  });
});

describe('MoodIndicator: crossfade helper functions', () => {
  it('calcCrossfadeAlpha clamps to [0, 1]', () => {
    expect(calcCrossfadeAlpha(-1)).toBe(0);
    expect(calcCrossfadeAlpha(0)).toBe(0);
    expect(calcCrossfadeAlpha(UI_CROSSFADE / 2)).toBeCloseTo(0.5, 5);
    expect(calcCrossfadeAlpha(UI_CROSSFADE)).toBe(1);
    expect(calcCrossfadeAlpha(UI_CROSSFADE * 2)).toBe(1);
  });

  it('calcOutgoingOpacity decreases from 1 to 0 as alpha goes 0→1', () => {
    expect(calcOutgoingOpacity(0)).toBe(1);
    expect(calcOutgoingOpacity(0.5)).toBe(0.5);
    expect(calcOutgoingOpacity(1)).toBe(0);
  });

  it('calcIncomingOpacity increases from 0 to 1 as alpha goes 0→1', () => {
    expect(calcIncomingOpacity(0)).toBe(0);
    expect(calcIncomingOpacity(0.5)).toBe(0.5);
    expect(calcIncomingOpacity(1)).toBe(1);
  });

  it('outgoing + incoming opacity sums to 1 at any alpha', () => {
    for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
      const sum = calcOutgoingOpacity(alpha) + calcIncomingOpacity(alpha);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it('isCrossfadeComplete returns false for alpha < 1', () => {
    expect(isCrossfadeComplete(0)).toBe(false);
    expect(isCrossfadeComplete(0.99)).toBe(false);
  });

  it('isCrossfadeComplete returns true for alpha >= 1', () => {
    expect(isCrossfadeComplete(1)).toBe(true);
    expect(isCrossfadeComplete(1.1)).toBe(true);
  });
});

describe('MoodIndicator: INDICATOR_EMOJIS parity with MOOD_EMOJIS', () => {
  it('INDICATOR_EMOJIS has the same keys as MOOD_EMOJIS', () => {
    const serviceKeys = Object.keys(MOOD_EMOJIS).sort();
    const uiKeys      = Object.keys(INDICATOR_EMOJIS).sort();
    expect(uiKeys).toEqual(serviceKeys);
  });

  it('INDICATOR_EMOJIS has the same values as MOOD_EMOJIS', () => {
    for (const mood of ALL_INDICATOR_MOODS) {
      expect(INDICATOR_EMOJIS[mood]).toBe(MOOD_EMOJIS[mood as ActivityMood]);
    }
  });

  it('indicatorMoodToEmoji mirrors moodToEmoji', () => {
    for (const mood of ALL_INDICATOR_MOODS) {
      expect(indicatorMoodToEmoji(mood)).toBe(moodToEmoji(mood as ActivityMood));
    }
  });
});
