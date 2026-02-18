/**
 * watchlistService.test.ts — T-365
 * Unit tests for the Agent Watchlist System service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addWatch,
  removeWatch,
  clearWatchlist,
  isWatching,
  getWatchlist,
  getWatchersForAgent,
  recordAgentEvent,
  evictStaleSessions,
  getWatchlistCount,
  getTotalWatchPairs,
  buildEventSummary,
  _resetWatchlistStore,
  MAX_WATCHLIST_SIZE,
  MAX_WATCHERS_PER_AGENT,
  WATCHLIST_SESSION_TTL_MS,
} from '../watchlistService.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetWatchlistStore();
});

// ─── addWatch ─────────────────────────────────────────────────────────────────

describe('addWatch', () => {
  it('returns ok for a fresh watch', () => {
    expect(addWatch('sp1', 'ag1')).toBe('ok');
  });

  it('registers the watcher in both indexes', () => {
    addWatch('sp1', 'ag1');
    expect(isWatching('sp1', 'ag1')).toBe(true);
    expect(getWatchersForAgent('ag1')).toContain('sp1');
  });

  it('returns already_watching for duplicate add', () => {
    addWatch('sp1', 'ag1');
    expect(addWatch('sp1', 'ag1')).toBe('already_watching');
  });

  it('returns watchlist_full when spectator has MAX_WATCHLIST_SIZE agents', () => {
    for (let i = 0; i < MAX_WATCHLIST_SIZE; i++) {
      addWatch('sp1', `ag${i}`);
    }
    expect(addWatch('sp1', 'overflow')).toBe('watchlist_full');
  });

  it('returns too_many_watchers when agent has MAX_WATCHERS_PER_AGENT spectators', () => {
    // Fill up watchers for ag1
    for (let i = 0; i < MAX_WATCHERS_PER_AGENT; i++) {
      addWatch(`sp${i}`, 'ag1');
    }
    expect(addWatch('sp_overflow', 'ag1')).toBe('too_many_watchers');
  });

  it('stores displayName in the entry', () => {
    addWatch('sp1', 'ag1', 'Cleo');
    const list = getWatchlist('sp1');
    expect(list[0].displayName).toBe('Cleo');
  });

  it('stores addedAt ISO timestamp', () => {
    const now = 1708000000000;
    addWatch('sp1', 'ag1', undefined, now);
    const list = getWatchlist('sp1');
    expect(list[0].addedAt).toBe(new Date(now).toISOString());
  });

  it('multiple spectators can watch the same agent', () => {
    addWatch('sp1', 'ag1');
    addWatch('sp2', 'ag1');
    addWatch('sp3', 'ag1');
    expect(getWatchersForAgent('ag1')).toHaveLength(3);
  });

  it('one spectator can watch multiple agents', () => {
    addWatch('sp1', 'ag1');
    addWatch('sp1', 'ag2');
    addWatch('sp1', 'ag3');
    expect(getWatchlist('sp1')).toHaveLength(3);
  });
});

// ─── removeWatch ──────────────────────────────────────────────────────────────

describe('removeWatch', () => {
  it('returns true when successfully removed', () => {
    addWatch('sp1', 'ag1');
    expect(removeWatch('sp1', 'ag1')).toBe(true);
  });

  it('returns false when not watching', () => {
    expect(removeWatch('sp1', 'ag1')).toBe(false);
  });

  it('clears both indexes after removal', () => {
    addWatch('sp1', 'ag1');
    removeWatch('sp1', 'ag1');
    expect(isWatching('sp1', 'ag1')).toBe(false);
    expect(getWatchersForAgent('ag1')).not.toContain('sp1');
  });

  it('removes spectator map when last agent is removed', () => {
    addWatch('sp1', 'ag1');
    removeWatch('sp1', 'ag1');
    expect(getWatchlist('sp1')).toHaveLength(0);
    expect(getWatchlistCount()).toBe(0);
  });

  it('removes agent watcher set when last spectator unwatches', () => {
    addWatch('sp1', 'ag1');
    removeWatch('sp1', 'ag1');
    expect(getWatchersForAgent('ag1')).toHaveLength(0);
  });

  it('does not affect other agents in watchlist', () => {
    addWatch('sp1', 'ag1');
    addWatch('sp1', 'ag2');
    removeWatch('sp1', 'ag1');
    expect(isWatching('sp1', 'ag2')).toBe(true);
    expect(getWatchlist('sp1')).toHaveLength(1);
  });
});

// ─── clearWatchlist ───────────────────────────────────────────────────────────

describe('clearWatchlist', () => {
  it('removes all watches for the spectator', () => {
    addWatch('sp1', 'ag1');
    addWatch('sp1', 'ag2');
    addWatch('sp1', 'ag3');
    clearWatchlist('sp1');
    expect(getWatchlist('sp1')).toHaveLength(0);
    expect(getWatchlistCount()).toBe(0);
  });

  it('removes spectator from all reverse-index sets', () => {
    addWatch('sp1', 'ag1');
    addWatch('sp1', 'ag2');
    clearWatchlist('sp1');
    expect(getWatchersForAgent('ag1')).not.toContain('sp1');
    expect(getWatchersForAgent('ag2')).not.toContain('sp1');
  });

  it('does not affect other spectators watching the same agent', () => {
    addWatch('sp1', 'ag1');
    addWatch('sp2', 'ag1');
    clearWatchlist('sp1');
    expect(getWatchersForAgent('ag1')).toContain('sp2');
  });

  it('is a no-op for an unknown spectator', () => {
    expect(() => clearWatchlist('nonexistent')).not.toThrow();
  });
});

// ─── isWatching ───────────────────────────────────────────────────────────────

describe('isWatching', () => {
  it('returns false for unknown spectator', () => {
    expect(isWatching('sp_unknown', 'ag1')).toBe(false);
  });

  it('returns false for unwatched agent', () => {
    addWatch('sp1', 'ag1');
    expect(isWatching('sp1', 'ag2')).toBe(false);
  });

  it('returns true after addWatch', () => {
    addWatch('sp1', 'ag1');
    expect(isWatching('sp1', 'ag1')).toBe(true);
  });

  it('returns false after removeWatch', () => {
    addWatch('sp1', 'ag1');
    removeWatch('sp1', 'ag1');
    expect(isWatching('sp1', 'ag1')).toBe(false);
  });
});

// ─── getWatchlist ─────────────────────────────────────────────────────────────

describe('getWatchlist', () => {
  it('returns empty array for unknown spectator', () => {
    expect(getWatchlist('nobody')).toEqual([]);
  });

  it('returns all watched agents', () => {
    addWatch('sp1', 'ag1', 'Alice');
    addWatch('sp1', 'ag2', 'Bob');
    const list = getWatchlist('sp1');
    expect(list).toHaveLength(2);
    const ids = list.map(e => e.agentId);
    expect(ids).toContain('ag1');
    expect(ids).toContain('ag2');
  });

  it('entries include agentId and addedAt', () => {
    const now = 1708000000000;
    addWatch('sp1', 'ag1', 'Alice', now);
    const list = getWatchlist('sp1');
    expect(list[0].agentId).toBe('ag1');
    expect(list[0].addedAt).toBe(new Date(now).toISOString());
  });
});

// ─── recordAgentEvent ─────────────────────────────────────────────────────────

describe('recordAgentEvent', () => {
  it('returns empty array when no watchers', () => {
    const alerts = recordAgentEvent('ag1', 'chat', 'Hello!', 'room1');
    expect(alerts).toHaveLength(0);
  });

  it('returns one alert per watcher', () => {
    addWatch('sp1', 'ag1');
    addWatch('sp2', 'ag1');
    const alerts = recordAgentEvent('ag1', 'chat', 'Hello', 'room1');
    expect(alerts).toHaveLength(2);
  });

  it('alert contains correct fields', () => {
    const now = 1708000000000;
    addWatch('sp1', 'ag1');
    const alerts = recordAgentEvent('ag1', 'trade', 'item_sword', 'room_lobby', now);
    expect(alerts[0]).toEqual({
      spectatorId: 'sp1',
      agentId:     'ag1',
      kind:        'trade',
      summary:     'item_sword',
      roomId:      'room_lobby',
      timestamp:   new Date(now).toISOString(),
    });
  });

  it('updates lastEvent on the watchlist entry', () => {
    addWatch('sp1', 'ag1');
    recordAgentEvent('ag1', 'achievement', 'First Trade', 'room1');
    const entry = getWatchlist('sp1').find(e => e.agentId === 'ag1');
    expect(entry?.lastEvent?.kind).toBe('achievement');
    expect(entry?.lastEvent?.summary).toBe('First Trade');
  });

  it('does not include spectators who stopped watching', () => {
    addWatch('sp1', 'ag1');
    addWatch('sp2', 'ag1');
    removeWatch('sp2', 'ag1');
    const alerts = recordAgentEvent('ag1', 'chat', 'Hi', 'room1');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].spectatorId).toBe('sp1');
  });

  it('handles multiple event types', () => {
    addWatch('sp1', 'ag1');
    const kinds: Array<Parameters<typeof recordAgentEvent>[1]> = [
      'chat', 'move', 'trade', 'achievement', 'emote',
    ];
    for (const kind of kinds) {
      const alerts = recordAgentEvent('ag1', kind, 'detail', 'room1');
      expect(alerts[0].kind).toBe(kind);
    }
  });
});

// ─── evictStaleSessions ───────────────────────────────────────────────────────

describe('evictStaleSessions', () => {
  it('evicts sessions beyond TTL', () => {
    const start = 1708000000000;
    addWatch('sp1', 'ag1', undefined, start);
    // Advance time past TTL
    const evicted = evictStaleSessions(start + WATCHLIST_SESSION_TTL_MS + 1);
    expect(evicted).toBe(1);
    expect(getWatchlist('sp1')).toHaveLength(0);
  });

  it('does not evict active sessions', () => {
    const start = 1708000000000;
    addWatch('sp1', 'ag1', undefined, start);
    const evicted = evictStaleSessions(start + WATCHLIST_SESSION_TTL_MS - 1);
    expect(evicted).toBe(0);
    expect(isWatching('sp1', 'ag1')).toBe(true);
  });

  it('refreshes last-active on recordAgentEvent', () => {
    const start = 1708000000000;
    addWatch('sp1', 'ag1', undefined, start);
    // Activity refreshes TTL
    const midpoint = start + WATCHLIST_SESSION_TTL_MS / 2;
    recordAgentEvent('ag1', 'chat', 'hi', 'room', midpoint);
    // Check just past the original TTL — should NOT be evicted since activity reset it
    const evicted = evictStaleSessions(start + WATCHLIST_SESSION_TTL_MS + 1);
    expect(evicted).toBe(0);
  });

  it('returns 0 when nothing to evict', () => {
    expect(evictStaleSessions()).toBe(0);
  });
});

// ─── buildEventSummary ────────────────────────────────────────────────────────

describe('buildEventSummary', () => {
  it('formats chat messages with truncation', () => {
    const long = 'a'.repeat(100);
    const result = buildEventSummary('chat', 'Zara', long);
    expect(result).toMatch(/^Zara: "/);
    expect(result.length).toBeLessThanOrEqual('Zara: "'.length + 60 + 1);
  });

  it('formats move events', () => {
    expect(buildEventSummary('move', 'Orion', 'tile (3,4)')).toBe('Orion moved to tile (3,4)');
  });

  it('formats trade events without detail', () => {
    expect(buildEventSummary('trade', 'Nova')).toBe('Nova completed a trade');
  });

  it('formats achievement events with detail', () => {
    expect(buildEventSummary('achievement', 'Rex', 'First Blood'))
      .toBe('Rex earned "First Blood"');
  });

  it('formats emote events', () => {
    expect(buildEventSummary('emote', 'Luna', 'wave')).toBe('Luna performed wave');
  });

  it('handles unknown kinds gracefully', () => {
    // @ts-expect-error — test invalid kind
    expect(buildEventSummary('unknown', 'Bot')).toContain('Bot');
  });
});

// ─── getWatchlistCount / getTotalWatchPairs ───────────────────────────────────

describe('counters', () => {
  it('getWatchlistCount reflects active spectators', () => {
    expect(getWatchlistCount()).toBe(0);
    addWatch('sp1', 'ag1');
    expect(getWatchlistCount()).toBe(1);
    addWatch('sp2', 'ag1');
    expect(getWatchlistCount()).toBe(2);
    clearWatchlist('sp1');
    expect(getWatchlistCount()).toBe(1);
  });

  it('getTotalWatchPairs counts all (spectator, agent) pairs', () => {
    expect(getTotalWatchPairs()).toBe(0);
    addWatch('sp1', 'ag1');
    addWatch('sp1', 'ag2');
    addWatch('sp2', 'ag1');
    expect(getTotalWatchPairs()).toBe(3);
    removeWatch('sp1', 'ag1');
    expect(getTotalWatchPairs()).toBe(2);
  });
});
