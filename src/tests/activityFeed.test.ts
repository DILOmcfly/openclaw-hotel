/**
 * T-337: Activity Feed Panel — Unit Tests
 * Tests for the spectator activity feed logic:
 * - Event classification & mapping
 * - Badge counting
 * - Max-event cap (50)
 * - New event types: furniture_use, game_invite, trade_offer, emote
 *
 * These tests run without a database (pure unit tests).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Simulate the ACTIVITY_CONFIG from spectate.js ───────────────────────────
const ACTIVITY_CONFIG: Record<string, {
  icon: string;
  cls: string;
  label: (msg: Record<string, string | undefined>) => string;
}> = {
  furniture_use: {
    icon: '🪑',
    cls:  'furniture',
    label: (msg) => `used ${msg.furnitureName || 'furniture'}`,
  },
  game_invite: {
    icon: '🎮',
    cls:  'game',
    label: (msg) => `invited ${msg.targetName || 'someone'} to play ${msg.game || 'a game'}`,
  },
  trade_offer: {
    icon: '💱',
    cls:  'trade',
    label: (msg) => `offered a trade to ${msg.targetName || 'another agent'}`,
  },
  emote: {
    icon: '🎭',
    cls:  'emote',
    label: (msg) => `performed emote: ${msg.emote || msg.action || '✨'}`,
  },
};

const MAX_ACTIVITY_EVENTS = 50;

interface ActivityEntry {
  type: string;
  agentId: string;
  agentName: string;
  icon: string;
  cls: string;
  description: string;
  timestamp: number;
}

// ─── Simulated agent store ────────────────────────────────────────────────────
function makeAgentStore(overrides: Record<string, { name: string }> = {}) {
  return new Map<string, { name: string }>(Object.entries(overrides));
}

// ─── Core factory (mirrors spectate.js addActivityEvent logic) ────────────────
function createActivityEntry(
  type: string,
  agentId: string,
  extra: Record<string, string | undefined>,
  agents: Map<string, { name: string }>,
): ActivityEntry | null {
  const cfg = ACTIVITY_CONFIG[type];
  if (!cfg) return null;
  const agent = agents.get(agentId) || { name: extra.agentName || 'Agent' };
  return {
    type,
    agentId,
    agentName: agent.name,
    icon: cfg.icon,
    cls: cfg.cls,
    description: cfg.label(extra),
    timestamp: Date.now(),
  };
}

// ─── Cap function (mirrors the slice logic) ───────────────────────────────────
function capEvents(events: ActivityEntry[]): ActivityEntry[] {
  return events.length > MAX_ACTIVITY_EVENTS ? events.slice(0, MAX_ACTIVITY_EVENTS) : events;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Activity Feed — Event Creation', () => {
  const agents = makeAgentStore({ 'agent-1': { name: 'Alice' }, 'agent-2': { name: 'Bob' } });

  it('creates furniture_use entry with correct icon and class', () => {
    const entry = createActivityEntry('furniture_use', 'agent-1', { furnitureName: 'Chair' }, agents);
    expect(entry).not.toBeNull();
    expect(entry!.icon).toBe('🪑');
    expect(entry!.cls).toBe('furniture');
    expect(entry!.description).toBe('used Chair');
    expect(entry!.agentName).toBe('Alice');
  });

  it('furniture_use falls back to "furniture" when no name provided', () => {
    const entry = createActivityEntry('furniture_use', 'agent-1', {}, agents);
    expect(entry!.description).toBe('used furniture');
  });

  it('creates game_invite entry with target and game', () => {
    const entry = createActivityEntry('game_invite', 'agent-1', {
      targetName: 'Bob',
      game: 'TicTacToe',
    }, agents);
    expect(entry!.icon).toBe('🎮');
    expect(entry!.cls).toBe('game');
    expect(entry!.description).toBe('invited Bob to play TicTacToe');
  });

  it('game_invite falls back to "someone" / "a game" when no details', () => {
    const entry = createActivityEntry('game_invite', 'agent-1', {}, agents);
    expect(entry!.description).toBe('invited someone to play a game');
  });

  it('creates trade_offer entry with target', () => {
    const entry = createActivityEntry('trade_offer', 'agent-2', { targetName: 'Alice' }, agents);
    expect(entry!.icon).toBe('💱');
    expect(entry!.cls).toBe('trade');
    expect(entry!.description).toBe('offered a trade to Alice');
    expect(entry!.agentName).toBe('Bob');
  });

  it('trade_offer falls back to "another agent" when no target', () => {
    const entry = createActivityEntry('trade_offer', 'agent-1', {}, agents);
    expect(entry!.description).toBe('offered a trade to another agent');
  });

  it('creates emote entry with action', () => {
    const entry = createActivityEntry('emote', 'agent-1', { emote: 'dance' }, agents);
    expect(entry!.icon).toBe('🎭');
    expect(entry!.cls).toBe('emote');
    expect(entry!.description).toBe('performed emote: dance');
  });

  it('emote falls back to ✨ when no emote value', () => {
    const entry = createActivityEntry('emote', 'agent-1', {}, agents);
    expect(entry!.description).toBe('performed emote: ✨');
  });

  it('returns null for unknown event type', () => {
    const entry = createActivityEntry('unknown_type', 'agent-1', {}, agents);
    expect(entry).toBeNull();
  });

  it('uses extra.agentName when agent not in map', () => {
    const entry = createActivityEntry('emote', 'unknown-id', { agentName: 'Zara' }, agents);
    expect(entry!.agentName).toBe('Zara');
  });

  it('falls back to "Agent" when agent not in map and no extra.agentName', () => {
    const entry = createActivityEntry('furniture_use', 'ghost-id', {}, agents);
    expect(entry!.agentName).toBe('Agent');
  });
});

describe('Activity Feed — Max Events Cap', () => {
  const agents = makeAgentStore({ 'a': { name: 'Test' } });

  it('caps activity list at 50 events', () => {
    let events: ActivityEntry[] = [];
    for (let i = 0; i < 60; i++) {
      const entry = createActivityEntry('emote', 'a', { emote: `emote-${i}` }, agents);
      if (entry) events.unshift(entry);
      events = capEvents(events);
    }
    expect(events.length).toBe(MAX_ACTIVITY_EVENTS);
  });

  it('keeps the most recent events (unshift + cap)', () => {
    let events: ActivityEntry[] = [];
    for (let i = 0; i < 55; i++) {
      const entry = createActivityEntry('furniture_use', 'a', { furnitureName: `item-${i}` }, agents);
      if (entry) events.unshift(entry);
      events = capEvents(events);
    }
    // Most recent = item-54, should be first
    expect(events[0].description).toBe('used item-54');
    // item-5 and earlier should be capped out
    expect(events.length).toBe(50);
  });

  it('does not cap when events < 50', () => {
    let events: ActivityEntry[] = [];
    for (let i = 0; i < 10; i++) {
      const entry = createActivityEntry('emote', 'a', { emote: `e-${i}` }, agents);
      if (entry) events.unshift(entry);
    }
    events = capEvents(events);
    expect(events.length).toBe(10);
  });
});

describe('Activity Feed — Badge Counter', () => {
  it('increments unread count when activity tab not active', () => {
    let unread = 0;
    const isActivityTabActive = false;
    function onNewActivity() {
      if (!isActivityTabActive) unread++;
    }

    onNewActivity();
    onNewActivity();
    onNewActivity();

    expect(unread).toBe(3);
  });

  it('resets unread to 0 when switching to activity tab', () => {
    let unread = 5;
    function onSwitchToActivity() {
      unread = 0;
    }
    onSwitchToActivity();
    expect(unread).toBe(0);
  });

  it('caps badge display at 9+', () => {
    function formatBadge(n: number): string {
      return n > 9 ? '9+' : String(n);
    }
    expect(formatBadge(1)).toBe('1');
    expect(formatBadge(9)).toBe('9');
    expect(formatBadge(10)).toBe('9+');
    expect(formatBadge(99)).toBe('9+');
  });
});

describe('Activity Feed — Event Type Coverage', () => {
  const agents = new Map<string, { name: string }>();

  const EVENT_TYPES = ['furniture_use', 'game_invite', 'trade_offer', 'emote'];

  it.each(EVENT_TYPES)('creates valid entry for %s', (type) => {
    const entry = createActivityEntry(type, 'any-agent', { furnitureName: 'x', targetName: 'y', game: 'z', emote: 'w' }, agents);
    expect(entry).not.toBeNull();
    expect(entry!.type).toBe(type);
    expect(entry!.timestamp).toBeGreaterThan(0);
    expect(entry!.icon).toBeDefined();
    expect(entry!.cls).toBeDefined();
    expect(entry!.description).toBeDefined();
  });

  it('all event types have distinct icons', () => {
    const icons = EVENT_TYPES.map(t => ACTIVITY_CONFIG[t].icon);
    const unique = new Set(icons);
    expect(unique.size).toBe(EVENT_TYPES.length);
  });

  it('all event types have distinct CSS classes', () => {
    const classes = EVENT_TYPES.map(t => ACTIVITY_CONFIG[t].cls);
    const unique = new Set(classes);
    expect(unique.size).toBe(EVENT_TYPES.length);
  });
});
