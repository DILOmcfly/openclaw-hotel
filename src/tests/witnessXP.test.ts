/**
 * T-368: Spectator "Witness XP" Gamification System — Unit Tests
 *
 * 25+ tests covering:
 *   - XP accumulation per event type
 *   - Level thresholds (all 8 levels)
 *   - Level progress calculation
 *   - Persistence via localStorage (mocked MemoryStorage)
 *   - Stats summary
 *   - Reset functionality
 *   - Edge cases (unknown events, zero XP, max level, corrupt storage)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WitnessXPTracker,
  MemoryStorage,
  XP_AWARDS,
  LEVELS,
  type LevelDef,
  type LevelProgress,
  type WitnessStats,
} from '../witnessXP.js';

// ── Helper: create fresh tracker with isolated in-memory storage ──────────────

function makeTracker(initialData?: string): { tracker: WitnessXPTracker; storage: MemoryStorage } {
  const storage = new MemoryStorage();
  if (initialData) {
    storage.setItem('witnessXP', initialData);
  }
  const tracker = new WitnessXPTracker(storage);
  return { tracker, storage };
}

// ── XP Award Constants ────────────────────────────────────────────────────────

describe('XP_AWARDS constants', () => {
  it('should define trade_offer as +5 XP', () => {
    expect(XP_AWARDS['trade_offer']).toBe(5);
  });

  it('should define trade_complete as +15 XP', () => {
    expect(XP_AWARDS['trade_complete']).toBe(15);
  });

  it('should define achievement as +20 XP', () => {
    expect(XP_AWARDS['achievement']).toBe(20);
  });

  it('should define game_win as +25 XP', () => {
    expect(XP_AWARDS['game_win']).toBe(25);
  });

  it('should define chat as +1 XP', () => {
    expect(XP_AWARDS['chat']).toBe(1);
  });

  it('should define level_up as +30 XP', () => {
    expect(XP_AWARDS['level_up']).toBe(30);
  });

  it('should define emote as +3 XP', () => {
    expect(XP_AWARDS['emote']).toBe(3);
  });
});

// ── LEVELS constant ───────────────────────────────────────────────────────────

describe('LEVELS constant', () => {
  it('should have 8 levels', () => {
    expect(LEVELS).toHaveLength(8);
  });

  it('should start with Newcomer at 0 XP', () => {
    expect(LEVELS[0]).toEqual({ name: 'Newcomer', minXP: 0 });
  });

  it('should end with Mythic at 10000 XP', () => {
    expect(LEVELS[7]).toEqual({ name: 'Mythic', minXP: 10000 });
  });

  it('should have ascending XP thresholds', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minXP).toBeGreaterThan(LEVELS[i - 1].minXP);
    }
  });
});

// ── addXP ─────────────────────────────────────────────────────────────────────

describe('WitnessXPTracker.addXP()', () => {
  it('should start at 0 XP', () => {
    const { tracker } = makeTracker();
    expect(tracker.getTotalXP()).toBe(0);
  });

  it('should return XP amount for known event', () => {
    const { tracker } = makeTracker();
    const awarded = tracker.addXP('chat');
    expect(awarded).toBe(1);
  });

  it('should accumulate XP across multiple events', () => {
    const { tracker } = makeTracker();
    tracker.addXP('chat');        // +1
    tracker.addXP('emote');       // +3
    tracker.addXP('trade_offer'); // +5
    expect(tracker.getTotalXP()).toBe(9);
  });

  it('should return 0 for unknown event type', () => {
    const { tracker } = makeTracker();
    const awarded = tracker.addXP('unknown_event');
    expect(awarded).toBe(0);
  });

  it('should not change XP for unknown event type', () => {
    const { tracker } = makeTracker();
    tracker.addXP('nonexistent');
    expect(tracker.getTotalXP()).toBe(0);
  });

  it('should track event counts per type', () => {
    const { tracker } = makeTracker();
    tracker.addXP('chat');
    tracker.addXP('chat');
    tracker.addXP('emote');

    const stats = tracker.getStats();
    expect(stats.eventCounts['chat']).toBe(2);
    expect(stats.eventCounts['emote']).toBe(1);
  });

  it('should accumulate high XP correctly', () => {
    const { tracker } = makeTracker();
    // 400 × chat = 400 XP
    for (let i = 0; i < 400; i++) tracker.addXP('chat');
    expect(tracker.getTotalXP()).toBe(400);
  });

  it('should return correct XP for each event type', () => {
    const types: Array<[string, number]> = [
      ['trade_offer', 5],
      ['trade_complete', 15],
      ['achievement', 20],
      ['game_win', 25],
      ['chat', 1],
      ['level_up', 30],
      ['emote', 3],
    ];
    for (const [type, expected] of types) {
      const { tracker } = makeTracker();
      expect(tracker.addXP(type)).toBe(expected);
    }
  });
});

// ── getLevel ──────────────────────────────────────────────────────────────────

describe('WitnessXPTracker.getLevel()', () => {
  it('should return Newcomer at 0 XP', () => {
    const { tracker } = makeTracker();
    expect(tracker.getLevel().name).toBe('Newcomer');
  });

  it('should return Newcomer just below Observer threshold', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 99; i++) tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Newcomer');
  });

  it('should return Observer at exactly 100 XP', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 100; i++) tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Observer');
  });

  it('should return Watcher at exactly 250 XP', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 250; i++) tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Watcher');
  });

  it('should return Witness at exactly 500 XP', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 500; i++) tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Witness');
  });

  it('should return Veteran at exactly 1000 XP', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 1000; i++) tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Veteran');
  });

  it('should return Sage at exactly 2500 XP', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 2500; i++) tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Sage');
  });

  it('should return Legend at exactly 5000 XP', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 5000; i++) tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Legend');
  });

  it('should return Mythic at exactly 10000 XP', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 10000; i++) tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Mythic');
  });

  it('should stay Mythic beyond 10000 XP', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 15000; i++) tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Mythic');
  });
});

// ── getLevelProgress ──────────────────────────────────────────────────────────

describe('WitnessXPTracker.getLevelProgress()', () => {
  it('should return 0 fraction at 0 XP', () => {
    const { tracker } = makeTracker();
    const progress = tracker.getLevelProgress();
    expect(progress.fraction).toBe(0);
    expect(progress.xpIntoLevel).toBe(0);
    expect(progress.xpForLevel).toBe(100); // 0 → 100
  });

  it('should return 0.5 fraction at halfway through Newcomer band', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 50; i++) tracker.addXP('chat');
    const progress = tracker.getLevelProgress();
    expect(progress.fraction).toBe(0.5);
  });

  it('should return null nextLevel at max level (Mythic)', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 10000; i++) tracker.addXP('chat');
    const progress = tracker.getLevelProgress();
    expect(progress.nextLevel).toBeNull();
    expect(progress.xpForLevel).toBeNull();
    expect(progress.fraction).toBe(1);
  });

  it('should have correct currentLevel name after leveling up', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 100; i++) tracker.addXP('chat');
    const progress = tracker.getLevelProgress();
    expect(progress.currentLevel.name).toBe('Observer');
    expect(progress.nextLevel?.name).toBe('Watcher');
  });

  it('should report xpIntoLevel correctly mid-level', () => {
    const { tracker } = makeTracker();
    // 100 (Observer threshold) + 50 more = 150 total, 50 into Observer band
    for (let i = 0; i < 150; i++) tracker.addXP('chat');
    const progress = tracker.getLevelProgress();
    expect(progress.currentLevel.name).toBe('Observer');
    expect(progress.xpIntoLevel).toBe(50);
    expect(progress.xpForLevel).toBe(150); // 250 - 100
  });

  it('should clamp fraction to 1 even if XP exceeds next level', () => {
    const { tracker } = makeTracker();
    // 5001 XP: Legend level (5000), 1 XP into Legend band (5000→10000)
    for (let i = 0; i < 5001; i++) tracker.addXP('chat');
    const progress = tracker.getLevelProgress();
    expect(progress.fraction).toBeLessThanOrEqual(1);
    expect(progress.fraction).toBeGreaterThan(0);
  });
});

// ── getStats ──────────────────────────────────────────────────────────────────

describe('WitnessXPTracker.getStats()', () => {
  it('should return correct totalXP', () => {
    const { tracker } = makeTracker();
    tracker.addXP('achievement'); // +20
    tracker.addXP('emote');       // +3
    const stats = tracker.getStats();
    expect(stats.totalXP).toBe(23);
  });

  it('should return level name in stats', () => {
    const { tracker } = makeTracker();
    const stats = tracker.getStats();
    expect(stats.level).toBe('Newcomer');
  });

  it('should return levelIndex 0 at start', () => {
    const { tracker } = makeTracker();
    expect(tracker.getStats().levelIndex).toBe(0);
  });

  it('should return correct levelIndex for Observer', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 100; i++) tracker.addXP('chat');
    expect(tracker.getStats().levelIndex).toBe(1);
  });

  it('should count total events witnessed', () => {
    const { tracker } = makeTracker();
    tracker.addXP('chat');
    tracker.addXP('emote');
    tracker.addXP('chat');
    const stats = tracker.getStats();
    expect(stats.totalEventsWitnessed).toBe(3);
  });

  it('should not count unknown events in totalEventsWitnessed', () => {
    const { tracker } = makeTracker();
    tracker.addXP('chat');
    tracker.addXP('nonexistent');
    const stats = tracker.getStats();
    expect(stats.totalEventsWitnessed).toBe(1);
  });

  it('should return a lastUpdated timestamp', () => {
    const { tracker } = makeTracker();
    tracker.addXP('chat');
    const stats = tracker.getStats();
    expect(stats.lastUpdated).toBeGreaterThan(0);
    expect(typeof stats.lastUpdated).toBe('number');
  });
});

// ── Persistence (MemoryStorage) ───────────────────────────────────────────────

describe('WitnessXPTracker persistence', () => {
  it('should persist XP to storage after addXP', () => {
    const { tracker, storage } = makeTracker();
    tracker.addXP('game_win'); // +25
    const raw = storage.getItem('witnessXP');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.totalXP).toBe(25);
  });

  it('should restore XP from existing storage on construction', () => {
    const { storage } = makeTracker();
    const saved = JSON.stringify({ totalXP: 500, eventCounts: { chat: 5 }, lastUpdated: Date.now() });
    storage.setItem('witnessXP', saved);

    const tracker2 = new WitnessXPTracker(storage);
    expect(tracker2.getTotalXP()).toBe(500);
    expect(tracker2.getLevel().name).toBe('Witness');
  });

  it('should persist event counts per type', () => {
    const { tracker, storage } = makeTracker();
    tracker.addXP('emote');
    tracker.addXP('emote');
    const parsed = JSON.parse(storage.getItem('witnessXP')!);
    expect(parsed.eventCounts.emote).toBe(2);
  });

  it('should handle corrupt storage gracefully (start fresh)', () => {
    const storage = new MemoryStorage();
    storage.setItem('witnessXP', '{ invalid json !!!');
    const tracker = new WitnessXPTracker(storage);
    expect(tracker.getTotalXP()).toBe(0);
    expect(tracker.getLevel().name).toBe('Newcomer');
  });

  it('should handle storage with missing fields gracefully', () => {
    const storage = new MemoryStorage();
    storage.setItem('witnessXP', '{}');
    const tracker = new WitnessXPTracker(storage);
    expect(tracker.getTotalXP()).toBe(0);
  });

  it('should clamp negative totalXP from storage to 0', () => {
    const storage = new MemoryStorage();
    storage.setItem('witnessXP', JSON.stringify({ totalXP: -100, eventCounts: {}, lastUpdated: Date.now() }));
    const tracker = new WitnessXPTracker(storage);
    expect(tracker.getTotalXP()).toBe(0);
  });
});

// ── reset ─────────────────────────────────────────────────────────────────────

describe('WitnessXPTracker.reset()', () => {
  it('should reset totalXP to 0', () => {
    const { tracker } = makeTracker();
    tracker.addXP('level_up'); // +30
    tracker.addXP('game_win'); // +25
    tracker.reset();
    expect(tracker.getTotalXP()).toBe(0);
  });

  it('should reset level to Newcomer after reset', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 500; i++) tracker.addXP('chat');
    tracker.reset();
    expect(tracker.getLevel().name).toBe('Newcomer');
  });

  it('should clear event counts on reset', () => {
    const { tracker } = makeTracker();
    tracker.addXP('emote');
    tracker.addXP('chat');
    tracker.reset();
    const stats = tracker.getStats();
    expect(stats.totalEventsWitnessed).toBe(0);
    expect(Object.keys(stats.eventCounts)).toHaveLength(0);
  });

  it('should persist the reset to storage', () => {
    const { tracker, storage } = makeTracker();
    tracker.addXP('trade_complete');
    tracker.reset();
    const parsed = JSON.parse(storage.getItem('witnessXP')!);
    expect(parsed.totalXP).toBe(0);
  });

  it('should allow XP accumulation after reset', () => {
    const { tracker } = makeTracker();
    for (let i = 0; i < 200; i++) tracker.addXP('chat');
    tracker.reset();
    tracker.addXP('trade_offer');
    expect(tracker.getTotalXP()).toBe(5);
  });
});

// ── MemoryStorage ─────────────────────────────────────────────────────────────

describe('MemoryStorage', () => {
  it('should store and retrieve items', () => {
    const storage = new MemoryStorage();
    storage.setItem('foo', 'bar');
    expect(storage.getItem('foo')).toBe('bar');
  });

  it('should return null for missing keys', () => {
    const storage = new MemoryStorage();
    expect(storage.getItem('missing')).toBeNull();
  });

  it('should remove items', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', 'v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('should clear all items', () => {
    const storage = new MemoryStorage();
    storage.setItem('a', '1');
    storage.setItem('b', '2');
    storage.clear();
    expect(storage.length).toBe(0);
  });

  it('should report correct length', () => {
    const storage = new MemoryStorage();
    expect(storage.length).toBe(0);
    storage.setItem('x', 'y');
    expect(storage.length).toBe(1);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('should handle empty string event type', () => {
    const { tracker } = makeTracker();
    const awarded = tracker.addXP('');
    expect(awarded).toBe(0);
    expect(tracker.getTotalXP()).toBe(0);
  });

  it('should handle rapid sequential XP additions', () => {
    const { tracker } = makeTracker();
    const events = ['chat', 'emote', 'trade_offer', 'achievement', 'game_win', 'level_up', 'trade_complete'];
    for (const ev of events) tracker.addXP(ev);
    // 1 + 3 + 5 + 20 + 25 + 30 + 15 = 99
    expect(tracker.getTotalXP()).toBe(99);
    expect(tracker.getLevel().name).toBe('Newcomer'); // just below Observer
  });

  it('should level up from Newcomer to Observer with exactly right XP', () => {
    const { tracker } = makeTracker();
    // One more XP brings us to 100
    for (let i = 0; i < 99; i++) tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Newcomer');
    tracker.addXP('chat');
    expect(tracker.getLevel().name).toBe('Observer');
  });

  it('should handle all 8 levels in progression', () => {
    const xpThresholds = [0, 100, 250, 500, 1000, 2500, 5000, 10000];
    const levelNames = ['Newcomer', 'Observer', 'Watcher', 'Witness', 'Veteran', 'Sage', 'Legend', 'Mythic'];

    for (let i = 0; i < xpThresholds.length; i++) {
      const { tracker } = makeTracker();
      for (let j = 0; j < xpThresholds[i]; j++) tracker.addXP('chat');
      expect(tracker.getLevel().name).toBe(levelNames[i]);
    }
  });

  it('getStats() eventCounts should be a copy, not a reference', () => {
    const { tracker } = makeTracker();
    tracker.addXP('chat');
    const stats = tracker.getStats();
    stats.eventCounts['chat'] = 999; // mutate external copy
    // Internal state should be unchanged
    const stats2 = tracker.getStats();
    expect(stats2.eventCounts['chat']).toBe(1);
  });
});
