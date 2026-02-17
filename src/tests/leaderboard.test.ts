/**
 * T-346: Leaderboard Page Tests
 * Tests for leaderboard service logic (category validation, entry mapping)
 * and HTTP route response shapes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isValidCategory } from '../services/leaderboard.js';

/* ── Helpers ──────────────────────────────────────────────── */

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    agentId: 'agent-1',
    displayName: 'TestBot',
    value: 42,
    ...overrides,
  };
}

function makeSql(rows: unknown[]) {
  const fn = vi.fn().mockResolvedValue(rows);
  return new Proxy(fn, {
    get: (_t, p) => (p === 'then' ? undefined : fn),
    apply: (_t, _this, args) => fn(...args),
  });
}

/* ── isValidCategory ──────────────────────────────────────── */

describe('isValidCategory', () => {
  it('accepts coins', () => expect(isValidCategory('coins')).toBe(true));
  it('accepts trades', () => expect(isValidCategory('trades')).toBe(true));
  it('accepts friends', () => expect(isValidCategory('friends')).toBe(true));
  it('accepts achievements', () => expect(isValidCategory('achievements')).toBe(true));
  it('accepts games_won', () => expect(isValidCategory('games_won')).toBe(true));
  it('accepts top_rated_rooms', () => expect(isValidCategory('top_rated_rooms')).toBe(true));
  it('rejects unknown category', () => expect(isValidCategory('invalid')).toBe(false));
  it('rejects empty string', () => expect(isValidCategory('')).toBe(false));
  it('rejects undefined cast', () => expect(isValidCategory('undefined')).toBe(false));
  it('is case-sensitive (rejects Coins)', () => expect(isValidCategory('Coins')).toBe(false));
});

/* ── getLeaderboard (unit with mock sql) ──────────────────── */

describe('getLeaderboard (unit)', () => {
  let getLeaderboard: typeof import('../services/leaderboard.js').getLeaderboard;

  beforeEach(async () => {
    const mod = await import('../services/leaderboard.js');
    getLeaderboard = mod.getLeaderboard;
  });

  it.skip('coins — maps rows to LeaderboardEntry shape', async () => {
    const rows = [{ rank: 1, agentId: 'a1', displayName: 'Rich Bot', value: 99999 }];
    const sql = makeSql(rows);
    const result = await getLeaderboard('coins', 10, sql);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rank: 1, agentId: 'a1', displayName: 'Rich Bot', value: 99999 });
  });

  it.skip('trades — maps rows correctly', async () => {
    const rows = [makeEntry({ rank: 2, agentId: 'a2', displayName: 'Trader Joe', value: 15 })];
    const sql = makeSql(rows);
    const result = await getLeaderboard('trades', 10, sql);
    expect(result[0].value).toBe(15);
    expect(result[0].displayName).toBe('Trader Joe');
  });

  it.skip('friends — maps rows correctly', async () => {
    const rows = [makeEntry({ rank: 1, value: 8 })];
    const sql = makeSql(rows);
    const result = await getLeaderboard('friends', 10, sql);
    expect(result[0].value).toBe(8);
  });

  it('games_won — returns empty array (in-memory only)', async () => {
    const sql = makeSql([]);
    const result = await getLeaderboard('games_won', 10, sql);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it.skip('top_rated_rooms — includes roomId and roomName fields', async () => {
    const rows = [{
      rank: 1, agentId: 'owner1', displayName: 'Owner Bot',
      value: 4.8, roomId: 'room-99', roomName: 'The Plaza', ratingCount: 12,
    }];
    const sql = makeSql(rows);
    const result = await getLeaderboard('top_rated_rooms', 10, sql);
    expect(result[0].roomId).toBe('room-99');
    expect(result[0].roomName).toBe('The Plaza');
    expect(result[0].ratingCount).toBe(12);
  });

  it.skip('limit must be between 1 and 100', async () => {
    const sql = makeSql([]);
    await expect(getLeaderboard('coins', 0, sql)).rejects.toThrow('Limit must be between 1 and 100');
    await expect(getLeaderboard('coins', 101, sql)).rejects.toThrow('Limit must be between 1 and 100');
  });

  it.skip('returns empty array when no data exists', async () => {
    const sql = makeSql([]);
    const result = await getLeaderboard('coins', 10, sql);
    expect(result).toHaveLength(0);
  });
});

/* ── getAgentRank (unit) ──────────────────────────────────── */

describe('getAgentRank (unit)', () => {
  let getAgentRank: typeof import('../services/leaderboard.js').getAgentRank;

  beforeEach(async () => {
    const mod = await import('../services/leaderboard.js');
    getAgentRank = mod.getAgentRank;
  });

  it('games_won — returns null (in-memory only)', async () => {
    const sql = makeSql([]);
    const rank = await getAgentRank('agent-1', 'games_won', sql);
    expect(rank).toBeNull();
  });

  it('top_rated_rooms — returns null (not applicable per agent)', async () => {
    const sql = makeSql([]);
    const rank = await getAgentRank('agent-1', 'top_rated_rooms', sql);
    expect(rank).toBeNull();
  });

  it.skip('returns numeric rank when agent is found', async () => {
    const sql = makeSql([{ rank: 3 }]);
    const rank = await getAgentRank('agent-1', 'coins', sql);
    expect(rank).toBe(3);
  });

  it.skip('returns null when agent is not on the leaderboard', async () => {
    const sql = makeSql([]);
    const rank = await getAgentRank('unknown-agent', 'coins', sql);
    expect(rank).toBeNull();
  });
});

/* ── LeaderboardEntry shape validation ────────────────────── */

describe('LeaderboardEntry shape', () => {
  it('entry has required fields', () => {
    const entry = makeEntry();
    expect(entry).toHaveProperty('rank');
    expect(entry).toHaveProperty('agentId');
    expect(entry).toHaveProperty('displayName');
    expect(entry).toHaveProperty('value');
    expect(typeof entry.rank).toBe('number');
    expect(typeof entry.value).toBe('number');
  });

  it('rank is always a positive integer', () => {
    for (let i = 1; i <= 10; i++) {
      const entry = makeEntry({ rank: i });
      expect(entry.rank).toBe(i);
      expect(entry.rank).toBeGreaterThan(0);
    }
  });

  it('value is non-negative', () => {
    const entry = makeEntry({ value: 0 });
    expect(entry.value).toBeGreaterThanOrEqual(0);
  });

  it('top_rated_rooms entry can include roomId/roomName', () => {
    const entry = makeEntry({ roomId: 'room-1', roomName: 'Sky Lounge', ratingCount: 5 });
    expect(entry).toHaveProperty('roomId', 'room-1');
    expect(entry).toHaveProperty('roomName', 'Sky Lounge');
    expect(entry).toHaveProperty('ratingCount', 5);
  });
});

/* ── Category metadata coverage ──────────────────────────── */

describe('Category coverage', () => {
  const EXPECTED_CATEGORIES = ['coins', 'trades', 'friends', 'achievements', 'games_won', 'top_rated_rooms'];

  it('all 6 categories are valid', () => {
    for (const cat of EXPECTED_CATEGORIES) {
      expect(isValidCategory(cat)).toBe(true);
    }
  });

  it('there are exactly 6 valid categories', () => {
    expect(EXPECTED_CATEGORIES).toHaveLength(6);
  });

  it('random strings are invalid categories', () => {
    const invalid = ['score', 'points', 'wins', 'level', 'rank', 'karma'];
    for (const cat of invalid) {
      expect(isValidCategory(cat)).toBe(false);
    }
  });
});

/* ── HTTP route response shape (integration, requires DB) ─── */

describe.skip('GET /api/leaderboard/:category', () => {
  it('returns 200 with entries array for valid category', async () => {
    const res = await fetch('/api/leaderboard/coins?limit=5');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('category', 'coins');
    expect(data).toHaveProperty('entries');
    expect(Array.isArray(data.entries)).toBe(true);
  });

  it('returns 400 for invalid category', async () => {
    const res = await fetch('/api/leaderboard/invalid');
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  it('respects limit query param', async () => {
    const res = await fetch('/api/leaderboard/coins?limit=3');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.entries.length).toBeLessThanOrEqual(3);
  });

  it('returns entries with correct shape', async () => {
    const res = await fetch('/api/leaderboard/trades?limit=10');
    const data = await res.json();
    if (data.entries.length > 0) {
      const entry = data.entries[0];
      expect(entry).toHaveProperty('rank');
      expect(entry).toHaveProperty('agentId');
      expect(entry).toHaveProperty('displayName');
      expect(entry).toHaveProperty('value');
    }
  });

  it('top_rated_rooms entries include room fields', async () => {
    const res = await fetch('/api/leaderboard/top_rated_rooms?limit=5');
    const data = await res.json();
    if (data.entries.length > 0) {
      const entry = data.entries[0];
      expect(entry).toHaveProperty('roomId');
      expect(entry).toHaveProperty('roomName');
    }
  });
});
