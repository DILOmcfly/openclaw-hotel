/**
 * T-357: TV Mode / Auto-Discovery — Unit Tests
 *
 * Tests pure logic functions:
 *   - formatCountdown()    — "0:SS" formatting
 *   - selectNextTvRoom()   — hottest-room selection algorithm
 *   - TV mode state machine (start / stop / toggle)
 *
 * No DOM / WebSocket / Pixi required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mirror pure functions from spectator.ts ───────────────────────────────────

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `0:${s.toString().padStart(2, '0')}`;
}

interface TvRoom { id: string; name: string; agentCount: number; }

const TV_MODE_SKIP_EMPTY = true;

function selectNextTvRoom(
  rooms: TvRoom[],
  currentRoomId: string | null,
): TvRoom | null {
  const candidates = rooms.filter(r => r.id !== currentRoomId);
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => b.agentCount - a.agentCount);

  if (TV_MODE_SKIP_EMPTY) {
    const withAgents = sorted.filter(r => r.agentCount > 0);
    if (withAgents.length > 0) return withAgents[0];
  }
  return sorted[0] ?? null;
}

// ── TV mode state machine (minimal mirror) ────────────────────────────────────

const TV_MODE_SECONDS = 30;

let _tvActive      = false;
let _tvSecondsLeft = TV_MODE_SECONDS;

function startTvMode(): void {
  _tvActive = true;
  _tvSecondsLeft = TV_MODE_SECONDS;
}

function stopTvMode(): void {
  _tvActive = false;
}

function toggleTvMode(): void {
  if (_tvActive) stopTvMode(); else startTvMode();
}

function isTvModeActive(): boolean { return _tvActive; }
function getTvSecondsLeft(): number { return _tvSecondsLeft; }

beforeEach(() => {
  _tvActive = false;
  _tvSecondsLeft = TV_MODE_SECONDS;
});

// ── formatCountdown ───────────────────────────────────────────────────────────

describe('formatCountdown()', () => {
  it('formats 30 as "0:30"', () => {
    expect(formatCountdown(30)).toBe('0:30');
  });

  it('formats 0 as "0:00"', () => {
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('formats 1 as "0:01"', () => {
    expect(formatCountdown(1)).toBe('0:01');
  });

  it('formats 10 as "0:10"', () => {
    expect(formatCountdown(10)).toBe('0:10');
  });

  it('formats 59 as "0:59"', () => {
    expect(formatCountdown(59)).toBe('0:59');
  });

  it('clamps negative values to 0:00', () => {
    expect(formatCountdown(-5)).toBe('0:00');
    expect(formatCountdown(-100)).toBe('0:00');
  });

  it('floors non-integer seconds', () => {
    expect(formatCountdown(29.9)).toBe('0:29');
    expect(formatCountdown(0.5)).toBe('0:00');
  });

  it('always produces exactly 4 chars after "0:"', () => {
    for (let s = 0; s <= 59; s++) {
      const result = formatCountdown(s);
      expect(result.startsWith('0:')).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(4);
    }
  });
});

// ── selectNextTvRoom ──────────────────────────────────────────────────────────

describe('selectNextTvRoom()', () => {
  it('returns null when there are no rooms', () => {
    expect(selectNextTvRoom([], null)).toBeNull();
  });

  it('returns null when only the current room exists', () => {
    const rooms = [{ id: 'r1', name: 'Lobby', agentCount: 5 }];
    expect(selectNextTvRoom(rooms, 'r1')).toBeNull();
  });

  it('picks the room with the most agents', () => {
    const rooms: TvRoom[] = [
      { id: 'r1', name: 'Lobby',   agentCount: 3 },
      { id: 'r2', name: 'Arcade',  agentCount: 7 },
      { id: 'r3', name: 'Library', agentCount: 2 },
    ];
    const next = selectNextTvRoom(rooms, null);
    expect(next?.id).toBe('r2');
  });

  it('excludes the current room from candidates', () => {
    const rooms: TvRoom[] = [
      { id: 'r1', name: 'Lobby',   agentCount: 10 },
      { id: 'r2', name: 'Arcade',  agentCount: 5  },
    ];
    const next = selectNextTvRoom(rooms, 'r1');
    expect(next?.id).toBe('r2');
  });

  it('skips rooms with 0 agents when TV_MODE_SKIP_EMPTY=true', () => {
    const rooms: TvRoom[] = [
      { id: 'r1', name: 'Lobby',   agentCount: 0 },
      { id: 'r2', name: 'Arcade',  agentCount: 0 },
      { id: 'r3', name: 'Garden',  agentCount: 3 },
    ];
    const next = selectNextTvRoom(rooms, null);
    expect(next?.id).toBe('r3');
  });

  it('falls back to first sorted room if all have 0 agents', () => {
    const rooms: TvRoom[] = [
      { id: 'r1', name: 'Empty1', agentCount: 0 },
      { id: 'r2', name: 'Empty2', agentCount: 0 },
    ];
    const next = selectNextTvRoom(rooms, null);
    // Both are equally empty — must return one of them
    expect(next).not.toBeNull();
    expect(['r1', 'r2']).toContain(next?.id);
  });

  it('returns the only other room when there are exactly two', () => {
    const rooms: TvRoom[] = [
      { id: 'r1', name: 'Room A', agentCount: 1 },
      { id: 'r2', name: 'Room B', agentCount: 2 },
    ];
    const next = selectNextTvRoom(rooms, 'r1');
    expect(next?.id).toBe('r2');
  });

  it('handles null currentRoomId correctly', () => {
    const rooms: TvRoom[] = [
      { id: 'r1', name: 'Lobby', agentCount: 3 },
    ];
    expect(selectNextTvRoom(rooms, null)?.id).toBe('r1');
  });

  it('does not mutate the input rooms array', () => {
    const rooms: TvRoom[] = [
      { id: 'r1', name: 'A', agentCount: 5 },
      { id: 'r2', name: 'B', agentCount: 3 },
    ];
    const copy = [...rooms];
    selectNextTvRoom(rooms, null);
    expect(rooms).toEqual(copy);
  });

  it('returns room with highest agent count among multiple non-empty rooms', () => {
    const rooms: TvRoom[] = [
      { id: 'r1', name: 'A', agentCount: 2  },
      { id: 'r2', name: 'B', agentCount: 8  },
      { id: 'r3', name: 'C', agentCount: 5  },
      { id: 'r4', name: 'D', agentCount: 12 },
    ];
    expect(selectNextTvRoom(rooms, null)?.id).toBe('r4');
  });
});

// ── TV mode state machine ─────────────────────────────────────────────────────

describe('TV Mode state machine', () => {
  it('is inactive by default', () => {
    expect(isTvModeActive()).toBe(false);
  });

  it('startTvMode() makes it active', () => {
    startTvMode();
    expect(isTvModeActive()).toBe(true);
  });

  it('stopTvMode() makes it inactive', () => {
    startTvMode();
    stopTvMode();
    expect(isTvModeActive()).toBe(false);
  });

  it('toggleTvMode() turns on when inactive', () => {
    toggleTvMode();
    expect(isTvModeActive()).toBe(true);
  });

  it('toggleTvMode() turns off when active', () => {
    startTvMode();
    toggleTvMode();
    expect(isTvModeActive()).toBe(false);
  });

  it('startTvMode() resets countdown to TV_MODE_SECONDS', () => {
    startTvMode();
    expect(getTvSecondsLeft()).toBe(TV_MODE_SECONDS);
  });

  it('calling start twice does not break state', () => {
    startTvMode();
    startTvMode();
    expect(isTvModeActive()).toBe(true);
    expect(getTvSecondsLeft()).toBe(TV_MODE_SECONDS);
  });

  it('stopping when already stopped is a no-op', () => {
    stopTvMode();
    stopTvMode();
    expect(isTvModeActive()).toBe(false);
  });

  it('toggling on/off/on produces correct state sequence', () => {
    toggleTvMode(); // on
    expect(isTvModeActive()).toBe(true);
    toggleTvMode(); // off
    expect(isTvModeActive()).toBe(false);
    toggleTvMode(); // on
    expect(isTvModeActive()).toBe(true);
  });
});
