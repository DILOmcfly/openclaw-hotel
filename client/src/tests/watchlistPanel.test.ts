/**
 * watchlistPanel.test.ts — T-365
 * Unit tests for WatchlistPanel pure helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  truncate,
  getKindMeta,
  formatAge,
  applyAlert,
  sortAgents,
  WATCHLIST_KIND_ICONS,
  WATCHLIST_KIND_LABELS,
  type WatchedAgent,
  type WatchlistAlertMsg,
} from '../ui/WatchlistPanel.js';

// ─── truncate ─────────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('returns string unchanged when within limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates and appends ellipsis when over limit', () => {
    expect(truncate('hello world', 5)).toBe('hello…');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('handles exact boundary', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates at 1 char limit', () => {
    expect(truncate('abc', 1)).toBe('a…');
  });
});

// ─── getKindMeta ──────────────────────────────────────────────────────────────

describe('getKindMeta', () => {
  it('returns correct icon and label for chat', () => {
    const { icon, label } = getKindMeta('chat');
    expect(icon).toBe(WATCHLIST_KIND_ICONS.chat);
    expect(label).toBe(WATCHLIST_KIND_LABELS.chat);
  });

  it('returns correct icon and label for trade', () => {
    expect(getKindMeta('trade').icon).toBe('🤝');
  });

  it('returns correct icon and label for achievement', () => {
    expect(getKindMeta('achievement').icon).toBe('🏆');
  });

  it('returns correct icon and label for move', () => {
    expect(getKindMeta('move').icon).toBe('🚶');
  });

  it('returns correct icon and label for emote', () => {
    expect(getKindMeta('emote').icon).toBe('🎭');
  });

  it('returns bullet and raw kind for unknown events', () => {
    const { icon, label } = getKindMeta('unknown_xyz');
    expect(icon).toBe('•');
    expect(label).toBe('unknown_xyz');
  });
});

// ─── formatAge ────────────────────────────────────────────────────────────────

describe('formatAge', () => {
  const baseNow = 1708000000000;

  it('returns just now for events < 1 min ago', () => {
    const ts = new Date(baseNow - 30_000).toISOString();
    expect(formatAge(ts, baseNow)).toBe('just now');
  });

  it('returns just now for events exactly at now', () => {
    const ts = new Date(baseNow).toISOString();
    expect(formatAge(ts, baseNow)).toBe('just now');
  });

  it('returns Xm ago for events 1-59 min ago', () => {
    const ts = new Date(baseNow - 5 * 60_000).toISOString();
    expect(formatAge(ts, baseNow)).toBe('5m ago');
  });

  it('returns 1m ago for exactly 1 minute ago', () => {
    const ts = new Date(baseNow - 60_001).toISOString();
    expect(formatAge(ts, baseNow)).toBe('1m ago');
  });

  it('returns Xh ago for events 1-23h ago', () => {
    const ts = new Date(baseNow - 3 * 3_600_000).toISOString();
    expect(formatAge(ts, baseNow)).toBe('3h ago');
  });

  it('returns Xd ago for events 1+ day ago', () => {
    const ts = new Date(baseNow - 2 * 86_400_000).toISOString();
    expect(formatAge(ts, baseNow)).toBe('2d ago');
  });

  it('returns just now for future timestamps', () => {
    const ts = new Date(baseNow + 5_000).toISOString();
    expect(formatAge(ts, baseNow)).toBe('just now');
  });
});

// ─── applyAlert ───────────────────────────────────────────────────────────────

describe('applyAlert', () => {
  const makeAgent = (agentId: string, displayName = 'Test'): WatchedAgent => ({
    agentId, displayName, avatarColor: '#4ecdc4',
  });

  const makeAlert = (agentId: string, kind = 'chat'): WatchlistAlertMsg => ({
    type: 'watchlist.alert',
    agentId,
    kind,
    summary: `Alert for ${agentId}`,
    roomId: 'room_test',
    timestamp: new Date(1708000000000).toISOString(),
  });

  it('updates lastEvent for the matching agent', () => {
    const agents = [makeAgent('ag1'), makeAgent('ag2')];
    const result = applyAlert(agents, makeAlert('ag1', 'trade'));
    const ag1 = result.find(a => a.agentId === 'ag1')!;
    expect(ag1.lastEvent?.kind).toBe('trade');
    expect(ag1.lastEvent?.roomId).toBe('room_test');
  });

  it('does not modify agents not in the alert', () => {
    const agents = [makeAgent('ag1'), makeAgent('ag2')];
    const result = applyAlert(agents, makeAlert('ag1'));
    const ag2 = result.find(a => a.agentId === 'ag2')!;
    expect(ag2.lastEvent).toBeUndefined();
  });

  it('is immutable — returns a new array', () => {
    const agents = [makeAgent('ag1')];
    const result = applyAlert(agents, makeAlert('ag1'));
    expect(result).not.toBe(agents);
    expect(result[0]).not.toBe(agents[0]);
  });

  it('does nothing when agent not in list', () => {
    const agents = [makeAgent('ag1')];
    const result = applyAlert(agents, makeAlert('ag_not_present'));
    expect(result).toEqual(agents);
  });

  it('updates summary text correctly', () => {
    const agents = [makeAgent('ag1')];
    const alert = makeAlert('ag1');
    alert.summary = 'Hello there!';
    const result = applyAlert(agents, alert);
    expect(result[0].lastEvent?.summary).toBe('Hello there!');
  });
});

// ─── sortAgents ───────────────────────────────────────────────────────────────

describe('sortAgents', () => {
  const makeAgent = (agentId: string, at?: string): WatchedAgent => ({
    agentId,
    displayName: agentId,
    avatarColor: '#4ecdc4',
    lastEvent: at ? { kind: 'chat', summary: 'x', roomId: 'r1', at } : undefined,
  });

  it('sorts agents with recent events first', () => {
    const agents = [
      makeAgent('ag1', '2026-01-01T10:00:00Z'),
      makeAgent('ag2', '2026-01-01T12:00:00Z'), // newer
      makeAgent('ag3', '2026-01-01T08:00:00Z'),
    ];
    const sorted = sortAgents(agents);
    expect(sorted[0].agentId).toBe('ag2');
    expect(sorted[2].agentId).toBe('ag3');
  });

  it('sorts agents without events after agents with events', () => {
    const agents = [
      makeAgent('ag1'),  // no event
      makeAgent('ag2', '2026-01-01T12:00:00Z'),
    ];
    const sorted = sortAgents(agents);
    expect(sorted[0].agentId).toBe('ag2');
    expect(sorted[1].agentId).toBe('ag1');
  });

  it('sorts agents without events alphabetically', () => {
    const agents = [
      makeAgent('Zara'),
      makeAgent('Alice'),
      makeAgent('Mia'),
    ];
    const sorted = sortAgents(agents);
    expect(sorted[0].agentId).toBe('Alice');
    expect(sorted[1].agentId).toBe('Mia');
    expect(sorted[2].agentId).toBe('Zara');
  });

  it('is immutable — returns a new array', () => {
    const agents = [makeAgent('ag1')];
    const sorted = sortAgents(agents);
    expect(sorted).not.toBe(agents);
  });

  it('handles empty array', () => {
    expect(sortAgents([])).toEqual([]);
  });
});
