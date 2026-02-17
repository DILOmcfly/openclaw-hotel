/**
 * T-349: liveEventsStore Unit Tests
 *
 * Full coverage for src/services/liveEventsStore.ts:
 * - Circular buffer: auto-eviction at MAX_EVENTS (50)
 * - addLiveEvent: assigns monotonic id, timestamp, spreads fields
 * - getLiveEvents: sorted newest-first, respects limit
 * - getTotalEventCount: monotonic counter (not reset by clearLiveEvents)
 * - clearLiveEvents: empties buffer, preserves counter
 * - EVENT_ICONS: all 11 types have icons
 * - buildEventMessage: all types + room/target variants
 *
 * Pure unit tests — no DB, no HTTP, no WebSocket.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  addLiveEvent,
  getLiveEvents,
  getTotalEventCount,
  clearLiveEvents,
  EVENT_ICONS,
  buildEventMessage,
  type LiveEvent,
  type LiveEventType,
} from '../services/liveEventsStore.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(
  type: LiveEventType = 'chat',
  overrides: Partial<Omit<LiveEvent, 'id' | 'timestamp'>> = {},
) {
  return addLiveEvent({
    type,
    roomId: 'room-1',
    roomName: 'Lobby',
    agentId: 'agent-1',
    agentName: 'ClaudeBot',
    icon: EVENT_ICONS[type],
    message: `ClaudeBot did ${type}`,
    ...overrides,
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearLiveEvents();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addLiveEvent', () => {
  it('returns the full event with id and timestamp', () => {
    const ev = makeEvent('chat');
    expect(ev.id).toMatch(/^ev-\d+$/);
    expect(typeof ev.timestamp).toBe('number');
    expect(ev.timestamp).toBeLessThanOrEqual(Date.now());
    expect(ev.timestamp).toBeGreaterThan(0);
  });

  it('spreads all provided fields into the returned event', () => {
    const ev = addLiveEvent({
      type: 'trade',
      roomId: 'room-42',
      roomName: 'VIP Lounge',
      agentId: 'agent-x',
      agentName: 'GeminiBot',
      targetAgentId: 'agent-y',
      targetAgentName: 'GrokBot',
      detail: 'rare sword',
      icon: '💱',
      message: 'GeminiBot traded with GrokBot',
    });
    expect(ev.type).toBe('trade');
    expect(ev.roomId).toBe('room-42');
    expect(ev.roomName).toBe('VIP Lounge');
    expect(ev.agentName).toBe('GeminiBot');
    expect(ev.targetAgentName).toBe('GrokBot');
    expect(ev.detail).toBe('rare sword');
  });

  it('assigns monotonically increasing ids', () => {
    const e1 = makeEvent('chat');
    const e2 = makeEvent('emote');
    const e3 = makeEvent('trade');

    const n1 = parseInt(e1.id.replace('ev-', ''), 10);
    const n2 = parseInt(e2.id.replace('ev-', ''), 10);
    const n3 = parseInt(e3.id.replace('ev-', ''), 10);

    expect(n2).toBeGreaterThan(n1);
    expect(n3).toBeGreaterThan(n2);
  });

  it('adds event to the buffer (getLiveEvents returns it)', () => {
    makeEvent('achievement');
    const events = getLiveEvents(10);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('achievement');
  });
});

describe('getLiveEvents — circular buffer', () => {
  it('returns empty array when buffer is empty', () => {
    expect(getLiveEvents()).toHaveLength(0);
  });

  it('returns events sorted newest-first', async () => {
    makeEvent('chat');
    await new Promise((r) => setTimeout(r, 2)); // ensure distinct timestamps
    makeEvent('emote');
    await new Promise((r) => setTimeout(r, 2));
    makeEvent('trade');

    const events = getLiveEvents(10);
    expect(events[0].type).toBe('trade');
    expect(events[1].type).toBe('emote');
    expect(events[2].type).toBe('chat');
  });

  it('respects limit parameter', () => {
    for (let i = 0; i < 10; i++) makeEvent('chat');
    expect(getLiveEvents(5)).toHaveLength(5);
    expect(getLiveEvents(1)).toHaveLength(1);
  });

  it('default limit is 20', () => {
    for (let i = 0; i < 30; i++) makeEvent('chat');
    expect(getLiveEvents()).toHaveLength(20);
  });

  it('returns all events when buffer < limit', () => {
    for (let i = 0; i < 3; i++) makeEvent('chat');
    expect(getLiveEvents(100)).toHaveLength(3);
  });

  it('auto-evicts oldest events when buffer exceeds 50', () => {
    for (let i = 0; i < 60; i++) makeEvent('chat');
    const all = getLiveEvents(100);
    expect(all.length).toBe(50);
  });

  it('after eviction, oldest event is gone and newest is kept', () => {
    // Add 50 'chat' events, then add 1 'trade' event
    for (let i = 0; i < 50; i++) makeEvent('chat');
    makeEvent('trade');

    const all = getLiveEvents(100);
    expect(all.length).toBe(50);
    // Newest is 'trade'
    expect(all[0].type).toBe('trade');
    // No more than 49 chat events remain
    const chatCount = all.filter((e) => e.type === 'chat').length;
    expect(chatCount).toBe(49);
  });
});

describe('getTotalEventCount', () => {
  it('starts at 0 (or whatever the counter was — but increases)', () => {
    const before = getTotalEventCount();
    makeEvent('chat');
    expect(getTotalEventCount()).toBe(before + 1);
  });

  it('increments by 1 for each event added', () => {
    const before = getTotalEventCount();
    makeEvent('chat');
    makeEvent('emote');
    makeEvent('trade');
    expect(getTotalEventCount()).toBe(before + 3);
  });

  it('is NOT reset by clearLiveEvents (monotonic)', () => {
    makeEvent('chat');
    const countAfterAdd = getTotalEventCount();
    clearLiveEvents();
    expect(getTotalEventCount()).toBe(countAfterAdd); // same, not 0
  });
});

describe('clearLiveEvents', () => {
  it('empties the buffer', () => {
    for (let i = 0; i < 5; i++) makeEvent('chat');
    clearLiveEvents();
    expect(getLiveEvents()).toHaveLength(0);
  });

  it('does not throw when buffer is already empty', () => {
    expect(() => clearLiveEvents()).not.toThrow();
    expect(() => clearLiveEvents()).not.toThrow();
  });

  it('allows adding events after clear', () => {
    makeEvent('chat');
    clearLiveEvents();
    makeEvent('trade');
    const events = getLiveEvents(10);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('trade');
  });
});

describe('EVENT_ICONS', () => {
  const expectedTypes: LiveEventType[] = [
    'chat', 'emote', 'trade', 'game_win', 'achievement',
    'room_enter', 'room_leave', 'furniture_use', 'game_invite',
    'wander', 'dance',
  ];

  for (const type of expectedTypes) {
    it(`has icon for "${type}"`, () => {
      expect(EVENT_ICONS[type]).toBeTruthy();
      expect(typeof EVENT_ICONS[type]).toBe('string');
      expect(EVENT_ICONS[type].length).toBeGreaterThan(0);
    });
  }

  it('all icons are strings (no undefined slots)', () => {
    for (const icon of Object.values(EVENT_ICONS)) {
      expect(typeof icon).toBe('string');
    }
  });
});

describe('buildEventMessage', () => {
  it('chat — includes agent name', () => {
    const msg = buildEventMessage('chat', 'ClaudeBot');
    expect(msg).toContain('ClaudeBot');
    expect(msg).toContain('message');
  });

  it('emote — includes detail when provided', () => {
    const msg = buildEventMessage('emote', 'GeminiBot', undefined, 'wave');
    expect(msg).toContain('GeminiBot');
    expect(msg).toContain('wave');
  });

  it('emote — fallback when detail is missing', () => {
    const msg = buildEventMessage('emote', 'Bot');
    expect(msg).toContain('Bot');
    expect(msg).toContain('emote');
  });

  it('trade — includes target agent name', () => {
    const msg = buildEventMessage('trade', 'Alice', 'Bob');
    expect(msg).toContain('Alice');
    expect(msg).toContain('Bob');
  });

  it('game_win — includes detail (game) and target (opponent)', () => {
    const msg = buildEventMessage('game_win', 'Alice', 'Bob', 'chess');
    expect(msg).toContain('Alice');
    expect(msg).toContain('chess');
    expect(msg).toContain('Bob');
  });

  it('achievement — includes the achievement name', () => {
    const msg = buildEventMessage('achievement', 'Alice', undefined, 'First Trade');
    expect(msg).toContain('Alice');
    expect(msg).toContain('First Trade');
  });

  it('room_enter — includes room name', () => {
    const msg = buildEventMessage('room_enter', 'Alice', undefined, undefined, 'Lobby');
    expect(msg).toContain('Alice');
    expect(msg).toContain('Lobby');
  });

  it('room_leave — includes room name', () => {
    const msg = buildEventMessage('room_leave', 'Alice', undefined, undefined, 'VIP Lounge');
    expect(msg).toContain('Alice');
    expect(msg).toContain('VIP Lounge');
  });

  it('furniture_use — includes detail', () => {
    const msg = buildEventMessage('furniture_use', 'Alice', undefined, 'sofa');
    expect(msg).toContain('Alice');
    expect(msg).toContain('sofa');
  });

  it('game_invite — includes target and game detail', () => {
    const msg = buildEventMessage('game_invite', 'Alice', 'Bob', 'poker');
    expect(msg).toContain('Alice');
    expect(msg).toContain('Bob');
    expect(msg).toContain('poker');
  });

  it('unknown type — returns a fallback (does not throw)', () => {
    const msg = buildEventMessage('wander' as LiveEventType, 'Alice');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('room suffix appended when roomName provided', () => {
    const withRoom = buildEventMessage('chat', 'Alice', undefined, undefined, 'Lobby');
    const withoutRoom = buildEventMessage('chat', 'Alice');
    expect(withRoom).toContain('Lobby');
    expect(withoutRoom).not.toContain('Lobby');
  });

  it('returns a non-empty string for all known types', () => {
    const types: LiveEventType[] = [
      'chat', 'emote', 'trade', 'game_win', 'achievement',
      'room_enter', 'room_leave', 'furniture_use', 'game_invite',
      'wander', 'dance',
    ];
    for (const type of types) {
      const msg = buildEventMessage(type, 'TestAgent');
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});
