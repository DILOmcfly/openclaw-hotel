/**
 * T-346 / T-347: Room Card Theme + Landing Live Events — Unit Tests
 *
 * Tests the room card theme helper logic (getRoomTheme, getRoomIcon)
 * and landing page live events feed helpers (timeAgo, highlightAgent).
 *
 * Pure unit tests — no database or DOM required.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Re-implement pure helpers for testing ────────────────────────────────────
// These mirror client/js/spectate.js getRoomTheme / getRoomIcon functions.
// Any change to the source must be reflected here.

function getRoomIcon(roomName: string): string {
  const name = roomName.toLowerCase();
  if (name.includes('lobby') || name.includes('main') || name.includes('entrance')) return '🏨';
  if (name.includes('trading') || name.includes('trade') || name.includes('market')) return '💼';
  if (name.includes('garden') || name.includes('park') || name.includes('nature')) return '🌳';
  if (name.includes('arcade') || name.includes('game') || name.includes('play')) return '🎮';
  if (name.includes('library') || name.includes('study') || name.includes('book')) return '📚';
  if (name.includes('chill') || name.includes('lounge') || name.includes('relax')) return '🛋️';
  if (name.includes('arena') || name.includes('battle') || name.includes('combat')) return '⚔️';
  if (name.includes('cafe') || name.includes('coffee') || name.includes('restaurant')) return '☕';
  if (name.includes('pool') || name.includes('swim') || name.includes('beach')) return '🏊';
  if (name.includes('gym') || name.includes('fitness') || name.includes('sport')) return '💪';
  if (name.includes('art') || name.includes('gallery') || name.includes('museum')) return '🎨';
  if (name.includes('music') || name.includes('concert') || name.includes('band')) return '🎵';
  if (name.includes('office') || name.includes('work') || name.includes('meeting')) return '💻';
  return '🏠';
}

interface RoomTheme {
  bar: string;
  glow: string;
  label: string;
}

function getRoomTheme(roomName: string): RoomTheme {
  const name = roomName.toLowerCase();
  if (name.includes('lobby') || name.includes('main') || name.includes('entrance'))
    return { bar: '#00D4AA', glow: 'rgba(0,212,170,0.08)', label: 'Lobby' };
  if (name.includes('trading') || name.includes('trade') || name.includes('market'))
    return { bar: '#fbbf24', glow: 'rgba(251,191,36,0.08)', label: 'Market' };
  if (name.includes('garden') || name.includes('park') || name.includes('nature'))
    return { bar: '#4ade80', glow: 'rgba(74,222,128,0.08)', label: 'Nature' };
  if (name.includes('arcade') || name.includes('game') || name.includes('play'))
    return { bar: '#f97316', glow: 'rgba(249,115,22,0.08)', label: 'Arcade' };
  if (name.includes('library') || name.includes('study') || name.includes('book'))
    return { bar: '#a78bfa', glow: 'rgba(167,139,250,0.08)', label: 'Library' };
  if (name.includes('chill') || name.includes('lounge') || name.includes('relax'))
    return { bar: '#60a5fa', glow: 'rgba(96,165,250,0.08)', label: 'Chill Zone' };
  if (name.includes('arena') || name.includes('battle') || name.includes('combat'))
    return { bar: '#ef4444', glow: 'rgba(239,68,68,0.08)', label: 'Arena' };
  if (name.includes('cafe') || name.includes('coffee') || name.includes('restaurant'))
    return { bar: '#d97706', glow: 'rgba(217,119,6,0.08)', label: 'Café' };
  if (name.includes('art') || name.includes('gallery') || name.includes('museum'))
    return { bar: '#ec4899', glow: 'rgba(236,72,153,0.08)', label: 'Gallery' };
  if (name.includes('music') || name.includes('concert') || name.includes('band'))
    return { bar: '#06b6d4', glow: 'rgba(6,182,212,0.08)', label: 'Stage' };
  return { bar: '#6b7280', glow: 'rgba(107,114,128,0.06)', label: 'Room' };
}

// ─── Landing page helpers (mirror client/index.html script) ──────────────────

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const s = Math.floor(diffMs / 1000);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function highlightAgent(msg: string, agentName: string | undefined): string {
  if (!agentName) return msg;
  return msg.replace(agentName, `<span class="feed-agent">${agentName}</span>`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getRoomIcon', () => {
  it('returns hotel emoji for lobby', () => {
    expect(getRoomIcon('Main Lobby')).toBe('🏨');
  });

  it('returns hotel emoji for entrance', () => {
    expect(getRoomIcon('Hotel Entrance')).toBe('🏨');
  });

  it('returns briefcase for trading room', () => {
    expect(getRoomIcon('Trading Post')).toBe('💼');
  });

  it('returns briefcase for market room', () => {
    expect(getRoomIcon('Black Market')).toBe('💼');
  });

  it('returns tree for garden', () => {
    expect(getRoomIcon('Secret Garden')).toBe('🌳');
  });

  it('returns game controller for arcade', () => {
    expect(getRoomIcon('Arcade Zone')).toBe('🎮');
  });

  it('returns books for library', () => {
    expect(getRoomIcon('Library of Wisdom')).toBe('📚');
  });

  it('returns couch for lounge/chill', () => {
    expect(getRoomIcon('Chill Lounge')).toBe('🛋️');
  });

  it('returns sword for arena', () => {
    expect(getRoomIcon('Battle Arena')).toBe('⚔️');
  });

  it('returns coffee for cafe', () => {
    expect(getRoomIcon('Rooftop Cafe')).toBe('☕');
    expect(getRoomIcon('Coffee Shop')).toBe('☕');
  });

  it('returns palette for art gallery', () => {
    expect(getRoomIcon('Art Gallery')).toBe('🎨');
  });

  it('returns music note for concert hall', () => {
    expect(getRoomIcon('Concert Hall')).toBe('🎵');
  });

  it('returns laptop for office/meeting', () => {
    expect(getRoomIcon('Meeting Room')).toBe('💻');
  });

  it('returns house emoji for unknown room type', () => {
    expect(getRoomIcon('Room 42')).toBe('🏠');
    expect(getRoomIcon('Quantum Nexus')).toBe('🏠');
    expect(getRoomIcon('')).toBe('🏠');
  });

  it('is case-insensitive', () => {
    expect(getRoomIcon('LOBBY')).toBe('🏨');
    expect(getRoomIcon('ARCADE')).toBe('🎮');
  });
});

describe('getRoomTheme', () => {
  it('returns teal theme for lobby', () => {
    const t = getRoomTheme('Main Lobby');
    expect(t.bar).toBe('#00D4AA');
    expect(t.label).toBe('Lobby');
    expect(t.glow).toContain('rgba');
  });

  it('returns yellow theme for market/trading', () => {
    const t = getRoomTheme('Trading Market');
    expect(t.bar).toBe('#fbbf24');
    expect(t.label).toBe('Market');
  });

  it('returns green theme for garden/nature', () => {
    const t = getRoomTheme('Nature Park');
    expect(t.bar).toBe('#4ade80');
    expect(t.label).toBe('Nature');
  });

  it('returns orange theme for arcade/game', () => {
    const t = getRoomTheme('Arcade Zone');
    expect(t.bar).toBe('#f97316');
    expect(t.label).toBe('Arcade');
  });

  it('returns purple theme for library', () => {
    const t = getRoomTheme('Library of Secrets');
    expect(t.bar).toBe('#a78bfa');
    expect(t.label).toBe('Library');
  });

  it('returns blue theme for chill/lounge', () => {
    const t = getRoomTheme('Chill Zone');
    expect(t.bar).toBe('#60a5fa');
    expect(t.label).toBe('Chill Zone');
  });

  it('returns red theme for arena/battle', () => {
    const t = getRoomTheme('Battle Arena');
    expect(t.bar).toBe('#ef4444');
    expect(t.label).toBe('Arena');
  });

  it('returns amber theme for cafe', () => {
    const t = getRoomTheme('Coffee Corner');
    expect(t.bar).toBe('#d97706');
    expect(t.label).toBe('Café');
  });

  it('returns pink theme for art gallery', () => {
    const t = getRoomTheme('Art Gallery');
    expect(t.bar).toBe('#ec4899');
    expect(t.label).toBe('Gallery');
  });

  it('returns cyan theme for music/concert', () => {
    const t = getRoomTheme('Concert Hall');
    expect(t.bar).toBe('#06b6d4');
    expect(t.label).toBe('Stage');
  });

  it('returns gray default for unknown rooms', () => {
    const t = getRoomTheme('Unknown Room');
    expect(t.bar).toBe('#6b7280');
    expect(t.label).toBe('Room');
  });

  it('returns bar, glow, and label for every named theme', () => {
    const rooms = [
      'Lobby', 'Trading Room', 'Garden', 'Arcade', 'Library',
      'Lounge', 'Arena', 'Café', 'Gallery', 'Concert',
    ];
    rooms.forEach(name => {
      const t = getRoomTheme(name);
      expect(t.bar).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.glow).toMatch(/^rgba\(/);
      expect(typeof t.label).toBe('string');
      expect(t.label.length).toBeGreaterThan(0);
    });
  });

  it('is case-insensitive', () => {
    expect(getRoomTheme('LOBBY').label).toBe('Lobby');
    expect(getRoomTheme('trading room').label).toBe('Market');
  });
});

describe('timeAgo (landing page helper)', () => {
  // Use fake timers so Date.now() is fixed and tests don't drift
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns "just now" for events less than 5 seconds ago', () => {
    const now = Date.now();
    expect(timeAgo(now - 1000)).toBe('just now');  // 1s ago
    expect(timeAgo(now - 4999)).toBe('just now');  // 4.999s ago
  });

  it('returns seconds for events 5-59 seconds ago', () => {
    const now = Date.now();
    expect(timeAgo(now - 5000)).toBe('5s ago');
    expect(timeAgo(now - 30000)).toBe('30s ago');
    expect(timeAgo(now - 59000)).toBe('59s ago');
  });

  it('returns minutes for events 1-59 minutes ago', () => {
    const now = Date.now();
    expect(timeAgo(now - 60000)).toBe('1m ago');
    expect(timeAgo(now - 120000)).toBe('2m ago');
    expect(timeAgo(now - 3599000)).toBe('59m ago');
  });

  it('returns hours for events 1+ hours ago', () => {
    const now = Date.now();
    expect(timeAgo(now - 3600000)).toBe('1h ago');
    expect(timeAgo(now - 7200000)).toBe('2h ago');
  });
});

describe('highlightAgent (landing page helper)', () => {
  it('wraps agent name in feed-agent span', () => {
    const result = highlightAgent('Luna sent a message', 'Luna');
    expect(result).toContain('<span class="feed-agent">Luna</span>');
    expect(result).toContain('sent a message');
  });

  it('returns original message when agentName is undefined', () => {
    expect(highlightAgent('some message', undefined)).toBe('some message');
  });

  it('returns original message when agentName is empty string', () => {
    // empty string is falsy → passthrough
    expect(highlightAgent('some message', '')).toBe('some message');
  });

  it('only replaces first occurrence of agent name', () => {
    // String.replace() without /g replaces first occurrence
    const result = highlightAgent('Rex challenged Rex', 'Rex');
    const spanCount = (result.match(/<span class="feed-agent">/g) || []).length;
    expect(spanCount).toBe(1);
  });

  it('handles agent name not present in message', () => {
    const result = highlightAgent('Luna did something', 'Rex');
    expect(result).toBe('Luna did something'); // no replacement
  });
});
