/**
 * T-371: Spectator "Highlight Reel" Panel — Unit Tests
 *
 * Tests for:
 * - addMoment()         — valid / invalid inputs, persistence, returned shape
 * - getTopMoments()     — ordering by score, tie-breaking by timestamp, n param
 * - getBestByCategory() — best per category, ties, empty state
 * - getByCategory()     — filtering + ordering
 * - count()             — length tracking
 * - reset()             — clears in-memory and localStorage
 * - localStorage        — persistence across instances, corrupt data resilience
 * - STORAGE_KEY         — constant availability
 * - VALID_CATEGORIES    — completeness
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HighlightReel, Moment, MomentCategory } from '../highlightReel.js';

// ─── In-memory localStorage stub ─────────────────────────────────────────────

class MockStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number { return Object.keys(this.store).length; }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReel(storageOverride?: MockStorage): { reel: HighlightReel; store: MockStorage } {
  const store = storageOverride ?? new MockStorage();
  const reel = new HighlightReel(store);
  return { reel, store };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('T-371: HighlightReel — static constants', () => {
  it('STORAGE_KEY is "highlightReel"', () => {
    expect(HighlightReel.STORAGE_KEY).toBe('highlightReel');
  });

  it('VALID_CATEGORIES includes all four categories', () => {
    const expected: MomentCategory[] = ['trade', 'chat', 'achievement', 'game'];
    for (const cat of expected) {
      expect(HighlightReel.VALID_CATEGORIES).toContain(cat);
    }
  });

  it('VALID_CATEGORIES has exactly four entries', () => {
    expect(HighlightReel.VALID_CATEGORIES).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-371: addMoment() — basic behaviour', () => {
  let reel: HighlightReel;

  beforeEach(() => {
    ({ reel } = makeReel());
  });

  it('returns a Moment object with correct type, data, and score', () => {
    const m = reel.addMoment('trade', { buyer: 'Luna', amount: 500 }, 80);
    expect(m.type).toBe('trade');
    expect(m.data).toEqual({ buyer: 'Luna', amount: 500 });
    expect(m.score).toBe(80);
  });

  it('returned moment has a string id', () => {
    const m = reel.addMoment('chat', { text: 'lol' }, 10);
    expect(typeof m.id).toBe('string');
    expect(m.id.length).toBeGreaterThan(0);
  });

  it('returned moment has a numeric timestamp', () => {
    const m = reel.addMoment('achievement', { name: 'First Win' }, 50);
    expect(typeof m.timestamp).toBe('number');
    expect(m.timestamp).toBeGreaterThan(0);
  });

  it('each moment gets a unique id', () => {
    const m1 = reel.addMoment('trade', {}, 10);
    const m2 = reel.addMoment('trade', {}, 20);
    expect(m1.id).not.toBe(m2.id);
  });

  it('data object is cloned (mutations do not affect stored moment)', () => {
    const payload = { item: 'sword' };
    const m = reel.addMoment('trade', payload, 30);
    payload.item = 'shield'; // mutate original
    expect(m.data.item).toBe('sword');
  });

  it('stores moment and increments count', () => {
    expect(reel.count()).toBe(0);
    reel.addMoment('game', { event: 'win' }, 100);
    expect(reel.count()).toBe(1);
    reel.addMoment('chat', { text: 'gg' }, 5);
    expect(reel.count()).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-371: addMoment() — validation', () => {
  let reel: HighlightReel;

  beforeEach(() => {
    ({ reel } = makeReel());
  });

  it('throws RangeError for invalid category', () => {
    expect(() => reel.addMoment('unknown' as MomentCategory, {}, 10)).toThrow(RangeError);
  });

  it('throws RangeError with message mentioning the bad category', () => {
    expect(() => reel.addMoment('loot' as MomentCategory, {}, 10))
      .toThrow(/loot/);
  });

  it('throws TypeError for NaN score', () => {
    expect(() => reel.addMoment('chat', {}, NaN)).toThrow(TypeError);
  });

  it('throws TypeError for Infinity score', () => {
    expect(() => reel.addMoment('chat', {}, Infinity)).toThrow(TypeError);
  });

  it('throws TypeError for -Infinity score', () => {
    expect(() => reel.addMoment('chat', {}, -Infinity)).toThrow(TypeError);
  });

  it('accepts score of 0', () => {
    expect(() => reel.addMoment('chat', {}, 0)).not.toThrow();
  });

  it('accepts negative score', () => {
    expect(() => reel.addMoment('trade', {}, -5)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-371: getTopMoments()', () => {
  let reel: HighlightReel;

  beforeEach(() => {
    ({ reel } = makeReel());
  });

  it('returns empty array when no moments exist', () => {
    expect(reel.getTopMoments()).toEqual([]);
  });

  it('returns all moments when count < n', () => {
    reel.addMoment('trade', {}, 10);
    reel.addMoment('chat', {}, 20);
    expect(reel.getTopMoments(5)).toHaveLength(2);
  });

  it('returns exactly n moments when count > n', () => {
    for (let i = 0; i < 8; i++) reel.addMoment('game', {}, i);
    expect(reel.getTopMoments(5)).toHaveLength(5);
  });

  it('orders by score descending', () => {
    reel.addMoment('trade', { note: 'low' }, 10);
    reel.addMoment('trade', { note: 'high' }, 90);
    reel.addMoment('trade', { note: 'mid' }, 50);
    const top = reel.getTopMoments(3);
    expect(top[0].score).toBe(90);
    expect(top[1].score).toBe(50);
    expect(top[2].score).toBe(10);
  });

  it('breaks score ties by most recent timestamp', () => {
    let t = 1000;
    const fakeNow = () => t;
    const store = new MockStorage();
    const timedReel = new HighlightReel(store, fakeNow);

    t = 1000; timedReel.addMoment('chat', { msg: 'older' }, 50);
    t = 2000; timedReel.addMoment('chat', { msg: 'newer' }, 50);

    const top = timedReel.getTopMoments(2);
    expect(top[0].data.msg).toBe('newer');
    expect(top[1].data.msg).toBe('older');
  });

  it('defaults to n=5 when called without argument', () => {
    for (let i = 0; i < 10; i++) reel.addMoment('game', {}, i);
    expect(reel.getTopMoments()).toHaveLength(5);
  });

  it('returns empty array when n=0', () => {
    reel.addMoment('trade', {}, 100);
    expect(reel.getTopMoments(0)).toEqual([]);
  });

  it('does not mutate internal moments array', () => {
    reel.addMoment('trade', {}, 10);
    const top = reel.getTopMoments();
    top.push({ id: 'fake', type: 'game', data: {}, score: 999, timestamp: 0 });
    expect(reel.count()).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-371: getBestByCategory()', () => {
  let reel: HighlightReel;

  beforeEach(() => {
    ({ reel } = makeReel());
  });

  it('returns empty object when no moments exist', () => {
    expect(reel.getBestByCategory()).toEqual({});
  });

  it('returns best moment for each category present', () => {
    reel.addMoment('trade', { val: 'low' }, 20);
    reel.addMoment('trade', { val: 'high' }, 80);
    reel.addMoment('chat', { msg: 'ok' }, 30);

    const best = reel.getBestByCategory();
    expect(best.trade?.score).toBe(80);
    expect(best.chat?.score).toBe(30);
  });

  it('omits categories that have no moments', () => {
    reel.addMoment('achievement', { name: 'Test' }, 60);
    const best = reel.getBestByCategory();
    expect(Object.keys(best)).toEqual(['achievement']);
    expect(best.trade).toBeUndefined();
    expect(best.chat).toBeUndefined();
    expect(best.game).toBeUndefined();
  });

  it('handles all four categories simultaneously', () => {
    reel.addMoment('trade', {}, 10);
    reel.addMoment('chat', {}, 20);
    reel.addMoment('achievement', {}, 30);
    reel.addMoment('game', {}, 40);
    const best = reel.getBestByCategory();
    expect(Object.keys(best)).toHaveLength(4);
  });

  it('tie on score resolves to most recent timestamp', () => {
    let t = 1000;
    const store = new MockStorage();
    const timedReel = new HighlightReel(store, () => t);

    t = 1000; timedReel.addMoment('game', { note: 'older' }, 50);
    t = 2000; timedReel.addMoment('game', { note: 'newer' }, 50);

    const best = timedReel.getBestByCategory();
    expect(best.game?.data.note).toBe('newer');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-371: getByCategory()', () => {
  let reel: HighlightReel;

  beforeEach(() => {
    ({ reel } = makeReel());
    reel.addMoment('trade', { n: 1 }, 30);
    reel.addMoment('trade', { n: 2 }, 70);
    reel.addMoment('chat', { n: 3 }, 50);
  });

  it('returns only moments of the requested category', () => {
    const trades = reel.getByCategory('trade');
    expect(trades).toHaveLength(2);
    trades.forEach(m => expect(m.type).toBe('trade'));
  });

  it('returns empty array for category with no moments', () => {
    expect(reel.getByCategory('achievement')).toEqual([]);
  });

  it('results are ordered by score descending', () => {
    const trades = reel.getByCategory('trade');
    expect(trades[0].score).toBe(70);
    expect(trades[1].score).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-371: reset()', () => {
  it('clears all moments from memory', () => {
    const { reel } = makeReel();
    reel.addMoment('game', {}, 99);
    reel.reset();
    expect(reel.count()).toBe(0);
    expect(reel.getTopMoments()).toEqual([]);
  });

  it('removes the key from localStorage', () => {
    const { reel, store } = makeReel();
    reel.addMoment('chat', {}, 10);
    expect(store.getItem('highlightReel')).not.toBeNull();
    reel.reset();
    expect(store.getItem('highlightReel')).toBeNull();
  });

  it('allows adding moments again after reset', () => {
    const { reel } = makeReel();
    reel.addMoment('trade', {}, 50);
    reel.reset();
    reel.addMoment('achievement', { name: 'Comeback' }, 75);
    expect(reel.count()).toBe(1);
    expect(reel.getTopMoments()[0].type).toBe('achievement');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-371: localStorage persistence', () => {
  it('persists moments across separate instances sharing the same store', () => {
    const store = new MockStorage();

    const reel1 = new HighlightReel(store);
    reel1.addMoment('trade', { item: 'rare sword' }, 95);

    // New instance reads from same store
    const reel2 = new HighlightReel(store);
    expect(reel2.count()).toBe(1);
    expect(reel2.getTopMoments()[0].data.item).toBe('rare sword');
  });

  it('handles corrupt JSON gracefully (starts fresh)', () => {
    const store = new MockStorage();
    store.setItem('highlightReel', '{ "this is": "bad json ][[[');

    expect(() => new HighlightReel(store)).not.toThrow();
    const reel = new HighlightReel(store);
    expect(reel.count()).toBe(0);
  });

  it('handles missing moments array in stored data gracefully', () => {
    const store = new MockStorage();
    store.setItem('highlightReel', JSON.stringify({ version: 1 })); // no moments array

    const reel = new HighlightReel(store);
    expect(reel.count()).toBe(0);
  });

  it('serialises and deserialises moment data correctly', () => {
    const store = new MockStorage();
    const reel1 = new HighlightReel(store);
    reel1.addMoment('achievement', { name: 'Speed Runner', bonus: 1.5 }, 77);

    const reel2 = new HighlightReel(store);
    const loaded = reel2.getTopMoments()[0];
    expect(loaded.type).toBe('achievement');
    expect(loaded.data.name).toBe('Speed Runner');
    expect(loaded.data.bonus).toBe(1.5);
    expect(loaded.score).toBe(77);
  });

  it('throws if storage is not provided', () => {
    expect(() => new HighlightReel(null as any)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-371: injectable clock', () => {
  it('uses provided now() for moment timestamps', () => {
    const store = new MockStorage();
    const fixedTime = 9_999_000;
    const reel = new HighlightReel(store, () => fixedTime);
    const m = reel.addMoment('game', {}, 10);
    expect(m.timestamp).toBe(fixedTime);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-371: mixed category scenarios', () => {
  it('getTopMoments returns moments from multiple categories', () => {
    const { reel } = makeReel();
    reel.addMoment('trade',       { val: 'a' }, 60);
    reel.addMoment('chat',        { val: 'b' }, 80);
    reel.addMoment('achievement', { val: 'c' }, 40);
    reel.addMoment('game',        { val: 'd' }, 90);

    const top3 = reel.getTopMoments(3);
    const types = top3.map(m => m.type);
    expect(types).toContain('game');
    expect(types).toContain('chat');
    expect(types).toContain('trade');
  });

  it('large batch: getTopMoments(1) always returns the single highest', () => {
    const { reel } = makeReel();
    const categories: MomentCategory[] = ['trade', 'chat', 'achievement', 'game'];
    for (let i = 0; i < 40; i++) {
      reel.addMoment(categories[i % 4], {}, i * 3);
    }
    const top = reel.getTopMoments(1);
    expect(top).toHaveLength(1);
    expect(top[0].score).toBe(39 * 3);
  });
});
