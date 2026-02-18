/**
 * T-370: Live Trade Announcement Banner — Unit Tests
 *
 * Tests for:
 * - show()      — banner creation, message format, items, return value
 * - Queue       — FIFO ordering, no overlap, sequential playback
 * - Auto-dismiss — timer fires after durationMs, advances queue
 * - Manual dismiss — immediate teardown, queue advance
 * - getState()  — idle / showing / dismissed transitions
 * - getQueue()  — snapshot of pending entries
 * - clearQueue() — drains pending without affecting current
 * - destroy()   — full teardown
 * - Edge cases  — empty strings, special chars, unicode, no items
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TradeBannerManager, BannerEntry, TradeItem } from '../tradeBanner.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMgr(durationMs = 3_000) {
  return new TradeBannerManager(durationMs);
}

// ─────────────────────────────────────────────────────────────────────────────

describe('T-370: TradeBannerManager — show() basics', () => {
  let mgr: TradeBannerManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mgr = makeMgr();
  });

  afterEach(() => {
    mgr.destroy();
    vi.useRealTimers();
  });

  it('returns a BannerEntry with correct agentA and agentB', () => {
    const entry = mgr.show('AgentAlpha', 'AgentBeta');
    expect(entry.agentA).toBe('AgentAlpha');
    expect(entry.agentB).toBe('AgentBeta');
  });

  it('formats message as "DEAL STRUCK: AgentA ↔ AgentB"', () => {
    const entry = mgr.show('Luna', 'Rex');
    expect(entry.message).toBe('DEAL STRUCK: Luna ↔ Rex');
  });

  it('assigns a unique id to every banner', () => {
    const e1 = mgr.show('A', 'B');
    const e2 = mgr.show('C', 'D');
    expect(e1.id).not.toBe(e2.id);
  });

  it('id is a non-empty string', () => {
    const entry = mgr.show('X', 'Y');
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
  });

  it('records createdAt as a recent timestamp', () => {
    const before = Date.now();
    const entry = mgr.show('A', 'B');
    const after = Date.now();
    expect(entry.createdAt).toBeGreaterThanOrEqual(before);
    expect(entry.createdAt).toBeLessThanOrEqual(after);
  });

  it('stores optional items on the entry', () => {
    const items: TradeItem[] = [{ name: 'Gold', quantity: 5 }];
    const entry = mgr.show('A', 'B', items);
    expect(entry.items).toEqual(items);
  });

  it('items is undefined when not provided', () => {
    const entry = mgr.show('A', 'B');
    expect(entry.items).toBeUndefined();
  });

  it('items can be an empty array', () => {
    const entry = mgr.show('A', 'B', []);
    expect(entry.items).toEqual([]);
  });

  it('handles agent names with spaces', () => {
    const entry = mgr.show('Agent One', 'Agent Two');
    expect(entry.message).toBe('DEAL STRUCK: Agent One ↔ Agent Two');
  });

  it('handles unicode / emoji in agent names', () => {
    const entry = mgr.show('🤖 RoboA', '🦾 RoboB');
    expect(entry.message).toContain('🤖 RoboA');
    expect(entry.message).toContain('🦾 RoboB');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-370: TradeBannerManager — getState()', () => {
  let mgr: TradeBannerManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mgr = makeMgr();
  });

  afterEach(() => {
    mgr.destroy();
    vi.useRealTimers();
  });

  it('starts in "idle" state', () => {
    expect(mgr.getState().status).toBe('idle');
  });

  it('transitions to "showing" after show()', () => {
    mgr.show('A', 'B');
    expect(mgr.getState().status).toBe('showing');
  });

  it('"showing" state contains the current banner', () => {
    const entry = mgr.show('Luna', 'Rex');
    const state = mgr.getState();
    expect(state.status).toBe('showing');
    if (state.status === 'showing') {
      expect(state.current).toBe(entry);
    }
  });

  it('"showing" queueLength is 0 when only one banner shown', () => {
    mgr.show('A', 'B');
    const state = mgr.getState();
    if (state.status === 'showing') {
      expect(state.queueLength).toBe(0);
    }
  });

  it('"showing" queueLength reflects pending banners', () => {
    mgr.show('A', 'B');
    mgr.show('C', 'D');
    mgr.show('E', 'F');
    const state = mgr.getState();
    if (state.status === 'showing') {
      expect(state.queueLength).toBe(2);
    }
  });

  it('transitions to "dismissed" after auto-dismiss timer fires', () => {
    mgr.show('A', 'B');
    vi.advanceTimersByTime(3_000);
    expect(mgr.getState().status).toBe('dismissed');
  });

  it('"dismissed" last references the banner that was shown', () => {
    const entry = mgr.show('Luna', 'Rex');
    vi.advanceTimersByTime(3_000);
    const state = mgr.getState();
    expect(state.status).toBe('dismissed');
    if (state.status === 'dismissed') {
      expect(state.last).toBe(entry);
    }
  });

  it('returns to "showing" when queue advances after dismiss', () => {
    mgr.show('A', 'B');
    mgr.show('C', 'D');
    vi.advanceTimersByTime(3_000);
    // First banner dismissed → second should now be showing
    expect(mgr.getState().status).toBe('showing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-370: TradeBannerManager — auto-dismiss timing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('banner is still visible at 2 999 ms (not yet dismissed)', () => {
    vi.useFakeTimers();
    const mgr = makeMgr(3_000);
    mgr.show('A', 'B');
    vi.advanceTimersByTime(2_999);
    expect(mgr.getState().status).toBe('showing');
    mgr.destroy();
  });

  it('banner is dismissed exactly at 3 000 ms', () => {
    vi.useFakeTimers();
    const mgr = makeMgr(3_000);
    mgr.show('A', 'B');
    vi.advanceTimersByTime(3_000);
    expect(mgr.getState().status).not.toBe('showing');
    mgr.destroy();
  });

  it('respects custom durationMs passed to constructor', () => {
    vi.useFakeTimers();
    const mgr = makeMgr(1_000);
    mgr.show('A', 'B');
    vi.advanceTimersByTime(999);
    expect(mgr.getState().status).toBe('showing');
    vi.advanceTimersByTime(1);
    expect(mgr.getState().status).not.toBe('showing');
    mgr.destroy();
  });

  it('durationMs is exposed on the instance', () => {
    const mgr = makeMgr(5_000);
    expect(mgr.durationMs).toBe(5_000);
    mgr.destroy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-370: TradeBannerManager — queue system', () => {
  let mgr: TradeBannerManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mgr = makeMgr();
  });

  afterEach(() => {
    mgr.destroy();
    vi.useRealTimers();
  });

  it('second show() while one is active does not change current banner', () => {
    const e1 = mgr.show('A', 'B');
    mgr.show('C', 'D');
    const state = mgr.getState();
    if (state.status === 'showing') {
      expect(state.current).toBe(e1);
    }
  });

  it('queued banners are processed in FIFO order', () => {
    mgr.show('first', 'X');
    mgr.show('second', 'X');
    mgr.show('third', 'X');

    vi.advanceTimersByTime(3_000); // dismiss first
    const s1 = mgr.getState();
    expect(s1.status).toBe('showing');
    if (s1.status === 'showing') expect(s1.current.agentA).toBe('second');

    vi.advanceTimersByTime(3_000); // dismiss second
    const s2 = mgr.getState();
    expect(s2.status).toBe('showing');
    if (s2.status === 'showing') expect(s2.current.agentA).toBe('third');
  });

  it('each queued banner stays for a full durationMs', () => {
    mgr.show('A', 'B');
    mgr.show('C', 'D');

    vi.advanceTimersByTime(3_000);       // first dismisses
    expect(mgr.getState().status).toBe('showing');
    vi.advanceTimersByTime(2_999);       // second nearly done
    expect(mgr.getState().status).toBe('showing');
    vi.advanceTimersByTime(1);           // second dismisses
    expect(mgr.getState().status).toBe('dismissed');
  });

  it('getQueue() returns pending entries (not current)', () => {
    mgr.show('A', 'B');
    mgr.show('C', 'D');
    mgr.show('E', 'F');
    const q = mgr.getQueue();
    expect(q).toHaveLength(2);
    expect(q[0].agentA).toBe('C');
    expect(q[1].agentA).toBe('E');
  });

  it('getQueue() returns a copy — mutating it does not affect internal queue', () => {
    mgr.show('A', 'B');
    mgr.show('C', 'D');
    const q = mgr.getQueue();
    q.pop(); // mutate copy
    expect(mgr.getQueue()).toHaveLength(1);
  });

  it('clearQueue() empties pending without affecting current', () => {
    const e1 = mgr.show('A', 'B');
    mgr.show('C', 'D');
    mgr.show('E', 'F');
    mgr.clearQueue();
    expect(mgr.getQueue()).toHaveLength(0);
    const state = mgr.getState();
    expect(state.status).toBe('showing');
    if (state.status === 'showing') expect(state.current).toBe(e1);
  });

  it('after clearQueue, banner finishes and goes to dismissed (no next)', () => {
    mgr.show('A', 'B');
    mgr.show('C', 'D');
    mgr.clearQueue();
    vi.advanceTimersByTime(3_000);
    expect(mgr.getState().status).toBe('dismissed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-370: TradeBannerManager — manual dismiss()', () => {
  let mgr: TradeBannerManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mgr = makeMgr();
  });

  afterEach(() => {
    mgr.destroy();
    vi.useRealTimers();
  });

  it('dismiss() while showing immediately clears current banner', () => {
    mgr.show('A', 'B');
    mgr.dismiss();
    expect(mgr.getState().status).not.toBe('showing');
  });

  it('dismiss() is safe to call when nothing is showing', () => {
    expect(() => mgr.dismiss()).not.toThrow();
  });

  it('dismiss() advances to the next queued banner', () => {
    mgr.show('A', 'B');
    const e2 = mgr.show('C', 'D');
    mgr.dismiss();
    const state = mgr.getState();
    expect(state.status).toBe('showing');
    if (state.status === 'showing') expect(state.current).toBe(e2);
  });

  it('dismiss() after auto-dismiss does not throw', () => {
    mgr.show('A', 'B');
    vi.advanceTimersByTime(3_000); // auto-dismissed
    expect(() => mgr.dismiss()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-370: TradeBannerManager — destroy()', () => {
  it('destroy() cancels pending timer (no state change after)', () => {
    vi.useFakeTimers();
    const mgr = makeMgr();
    mgr.show('A', 'B');
    mgr.destroy();
    vi.advanceTimersByTime(5_000); // timer would have fired
    // After destroy, state reflects destroyed manager (null current)
    expect(mgr.getState().status).not.toBe('showing');
    vi.useRealTimers();
  });

  it('destroy() is idempotent — calling twice does not throw', () => {
    const mgr = makeMgr();
    expect(() => {
      mgr.destroy();
      mgr.destroy();
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('T-370: TradeBannerManager — edge cases', () => {
  let mgr: TradeBannerManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mgr = makeMgr();
  });

  afterEach(() => {
    mgr.destroy();
    vi.useRealTimers();
  });

  it('handles empty-string agent names without throwing', () => {
    expect(() => mgr.show('', '')).not.toThrow();
  });

  it('message with empty agent names still contains ↔', () => {
    const entry = mgr.show('', '');
    expect(entry.message).toContain('↔');
    expect(entry.message).toContain('DEAL STRUCK');
  });

  it('items with quantity=0 are preserved', () => {
    const items: TradeItem[] = [{ name: 'Debt', quantity: 0 }];
    const entry = mgr.show('A', 'B', items);
    expect(entry.items![0].quantity).toBe(0);
  });

  it('many banners queued — all processed in order', () => {
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
    names.forEach(n => mgr.show(n, 'Z'));

    for (let i = 0; i < names.length; i++) {
      const state = mgr.getState();
      expect(state.status).toBe('showing');
      if (state.status === 'showing') {
        expect(state.current.agentA).toBe(names[i]);
      }
      vi.advanceTimersByTime(3_000);
    }
    expect(mgr.getState().status).toBe('dismissed');
  });

  it('id counter increments across multiple show() calls', () => {
    const ids = [mgr.show('A', 'B').id, mgr.show('C', 'D').id, mgr.show('E', 'F').id];
    const nums = ids.map(id => Number(id.split('-')[1]));
    expect(nums[0]).toBeLessThan(nums[1]);
    expect(nums[1]).toBeLessThan(nums[2]);
  });

  it('agent names with special characters render correctly in message', () => {
    const entry = mgr.show('<Hacker>', '"Agent"');
    expect(entry.message).toContain('<Hacker>');
    expect(entry.message).toContain('"Agent"');
  });
});
