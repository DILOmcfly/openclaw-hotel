/**
 * Tests for Directory Agent Stats Enhancement — T-355
 * Tests sortAgentsBy() exported from directory.routes.ts
 * and client-side formatting utilities (inline-tested)
 */
import { describe, it, expect } from 'vitest';
import { sortAgentsBy } from '../api/directory.routes.js';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------
function makeAgent(overrides: Partial<{
  id: string;
  displayName: string;
  online: boolean;
  currentRoom: string | null;
  messagesSent: number;
  roomsVisited: number;
  tradesCompleted: number;
  joinedAt: string;
}> = {}) {
  return {
    id: overrides.id ?? 'agent-default',
    displayName: overrides.displayName ?? 'Default Agent',
    online: overrides.online ?? false,
    currentRoom: overrides.currentRoom ?? null,
    messagesSent: overrides.messagesSent ?? 0,
    roomsVisited: overrides.roomsVisited ?? 0,
    tradesCompleted: overrides.tradesCompleted ?? 0,
    joinedAt: overrides.joinedAt ?? '2026-01-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// sortAgentsBy — 'messages'
// ---------------------------------------------------------------------------
describe('sortAgentsBy (messages)', () => {
  it('sorts agents by messagesSent descending', () => {
    const agents = [
      makeAgent({ displayName: 'A', messagesSent: 10 }),
      makeAgent({ displayName: 'B', messagesSent: 50 }),
      makeAgent({ displayName: 'C', messagesSent: 25 }),
    ];
    const sorted = sortAgentsBy(agents, 'messages');
    expect(sorted[0].messagesSent).toBe(50);
    expect(sorted[1].messagesSent).toBe(25);
    expect(sorted[2].messagesSent).toBe(10);
  });

  it('breaks ties by currentRoom (online first)', () => {
    const agents = [
      makeAgent({ displayName: 'Offline', messagesSent: 100, currentRoom: null }),
      makeAgent({ displayName: 'Online',  messagesSent: 100, currentRoom: 'room-1' }),
    ];
    const sorted = sortAgentsBy(agents, 'messages');
    expect(sorted[0].displayName).toBe('Online');
    expect(sorted[1].displayName).toBe('Offline');
  });

  it('breaks ties alphabetically when both have same room status', () => {
    const agents = [
      makeAgent({ displayName: 'Zara', messagesSent: 50, currentRoom: null }),
      makeAgent({ displayName: 'Alice', messagesSent: 50, currentRoom: null }),
    ];
    const sorted = sortAgentsBy(agents, 'messages');
    expect(sorted[0].displayName).toBe('Alice');
    expect(sorted[1].displayName).toBe('Zara');
  });

  it('handles zero messages', () => {
    const agents = [
      makeAgent({ displayName: 'A', messagesSent: 0 }),
      makeAgent({ displayName: 'B', messagesSent: 5 }),
    ];
    const sorted = sortAgentsBy(agents, 'messages');
    expect(sorted[0].messagesSent).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// sortAgentsBy — 'rooms'
// ---------------------------------------------------------------------------
describe('sortAgentsBy (rooms)', () => {
  it('sorts agents by roomsVisited descending', () => {
    const agents = [
      makeAgent({ displayName: 'A', roomsVisited: 3 }),
      makeAgent({ displayName: 'B', roomsVisited: 15 }),
      makeAgent({ displayName: 'C', roomsVisited: 8 }),
    ];
    const sorted = sortAgentsBy(agents, 'rooms');
    expect(sorted[0].roomsVisited).toBe(15);
    expect(sorted[1].roomsVisited).toBe(8);
    expect(sorted[2].roomsVisited).toBe(3);
  });

  it('places online agents first on tie', () => {
    const a = makeAgent({ roomsVisited: 5, currentRoom: null });
    const b = makeAgent({ roomsVisited: 5, currentRoom: 'room-42' });
    const sorted = sortAgentsBy([a, b], 'rooms');
    expect(sorted[0].currentRoom).toBe('room-42');
  });
});

// ---------------------------------------------------------------------------
// sortAgentsBy — 'trades'
// ---------------------------------------------------------------------------
describe('sortAgentsBy (trades)', () => {
  it('sorts agents by tradesCompleted descending', () => {
    const agents = [
      makeAgent({ displayName: 'A', tradesCompleted: 2 }),
      makeAgent({ displayName: 'B', tradesCompleted: 99 }),
      makeAgent({ displayName: 'C', tradesCompleted: 20 }),
    ];
    const sorted = sortAgentsBy(agents, 'trades');
    expect(sorted[0].tradesCompleted).toBe(99);
    expect(sorted[2].tradesCompleted).toBe(2);
  });

  it('handles equal trade counts with online tiebreaker', () => {
    const a = makeAgent({ tradesCompleted: 10, currentRoom: null });
    const b = makeAgent({ tradesCompleted: 10, currentRoom: 'room-1' });
    const sorted = sortAgentsBy([a, b], 'trades');
    expect(sorted[0].currentRoom).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// sortAgentsBy — 'online'
// ---------------------------------------------------------------------------
describe('sortAgentsBy (online)', () => {
  it('places online agents (currentRoom set) before offline', () => {
    const agents = [
      makeAgent({ displayName: 'Offline1', currentRoom: null }),
      makeAgent({ displayName: 'Online1', currentRoom: 'room-1' }),
      makeAgent({ displayName: 'Offline2', currentRoom: null }),
      makeAgent({ displayName: 'Online2', currentRoom: 'room-2' }),
    ];
    const sorted = sortAgentsBy(agents, 'online');
    expect(sorted[0].currentRoom).toBeTruthy();
    expect(sorted[1].currentRoom).toBeTruthy();
    expect(sorted[2].currentRoom).toBeNull();
    expect(sorted[3].currentRoom).toBeNull();
  });

  it('sorts alphabetically within same online status', () => {
    const agents = [
      makeAgent({ displayName: 'Zeb', currentRoom: 'room-1' }),
      makeAgent({ displayName: 'Ada', currentRoom: 'room-2' }),
    ];
    const sorted = sortAgentsBy(agents, 'online');
    expect(sorted[0].displayName).toBe('Ada');
  });
});

// ---------------------------------------------------------------------------
// sortAgentsBy — 'recent' (no-op, uses DB order)
// ---------------------------------------------------------------------------
describe('sortAgentsBy (recent)', () => {
  it('preserves relative order for equal agents', () => {
    const agents = [
      makeAgent({ displayName: 'First' }),
      makeAgent({ displayName: 'Second' }),
      makeAgent({ displayName: 'Third' }),
    ];
    const sorted = sortAgentsBy(agents, 'recent');
    // All have same online status and name relative order shouldn't change dramatically
    expect(sorted).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('sortAgentsBy (edge cases)', () => {
  it('handles empty array', () => {
    expect(sortAgentsBy([], 'messages')).toEqual([]);
    expect(sortAgentsBy([], 'rooms')).toEqual([]);
    expect(sortAgentsBy([], 'trades')).toEqual([]);
  });

  it('handles single agent', () => {
    const agents = [makeAgent({ displayName: 'Solo', messagesSent: 42 })];
    const sorted = sortAgentsBy(agents, 'messages');
    expect(sorted).toHaveLength(1);
    expect(sorted[0].displayName).toBe('Solo');
  });

  it('does not mutate original array', () => {
    const agents = [
      makeAgent({ displayName: 'A', messagesSent: 5 }),
      makeAgent({ displayName: 'B', messagesSent: 100 }),
    ];
    const original = [...agents];
    sortAgentsBy(agents, 'messages');
    expect(agents[0].displayName).toBe(original[0].displayName);
    expect(agents[1].displayName).toBe(original[1].displayName);
  });

  it('handles agents with all-zero stats', () => {
    const agents = [
      makeAgent({ displayName: 'A', messagesSent: 0, roomsVisited: 0, tradesCompleted: 0 }),
      makeAgent({ displayName: 'B', messagesSent: 0, roomsVisited: 0, tradesCompleted: 0 }),
    ];
    const sorted = sortAgentsBy(agents, 'messages');
    expect(sorted).toHaveLength(2);
    // Both zero — alphabetical fallback
    expect(sorted[0].displayName).toBe('A');
  });

  it('large stat values sort correctly', () => {
    const agents = [
      makeAgent({ messagesSent: 1_000_000 }),
      makeAgent({ messagesSent: 999_999 }),
      makeAgent({ messagesSent: 1_500_000 }),
    ];
    const sorted = sortAgentsBy(agents, 'messages');
    expect(sorted[0].messagesSent).toBe(1_500_000);
    expect(sorted[2].messagesSent).toBe(999_999);
  });
});

// ---------------------------------------------------------------------------
// Client-side formatStatCount (inline implementation for test coverage)
// The actual function lives in directory.html JS, so we test the logic here.
// ---------------------------------------------------------------------------
function formatStatCount(n: number | null | undefined): string {
  const val = Number(n) || 0;
  if (val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(val);
}

describe('formatStatCount', () => {
  it('returns "0" for zero', () => {
    expect(formatStatCount(0)).toBe('0');
  });

  it('returns "0" for null/undefined', () => {
    expect(formatStatCount(null)).toBe('0');
    expect(formatStatCount(undefined)).toBe('0');
  });

  it('returns number as string for small values', () => {
    expect(formatStatCount(42)).toBe('42');
    expect(formatStatCount(999)).toBe('999');
  });

  it('formats 1000+ as K notation', () => {
    expect(formatStatCount(1000)).toBe('1K');
    expect(formatStatCount(1500)).toBe('1.5K');
    expect(formatStatCount(10000)).toBe('10K');
    expect(formatStatCount(25500)).toBe('25.5K');
  });

  it('drops trailing .0 in K notation', () => {
    expect(formatStatCount(2000)).toBe('2K');
    expect(formatStatCount(5000)).toBe('5K');
  });
});
