/**
 * T-346: Global Live Events Ticker — Unit Tests
 *
 * Tests the liveEventsStore service:
 * - addLiveEvent / getLiveEvents
 * - Circular buffer (max 50 events)
 * - buildEventMessage formatting
 * - getTotalEventCount (monotonic)
 * - clearLiveEvents (for test isolation)
 *
 * Also tests /api/spectate/live-events endpoint logic.
 *
 * Pure unit tests — no database required.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addLiveEvent,
  getLiveEvents,
  getTotalEventCount,
  clearLiveEvents,
  buildEventMessage,
  EVENT_ICONS,
  type LiveEventType,
} from '../../src/services/liveEventsStore.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<Parameters<typeof addLiveEvent>[0]> = {}) {
  return addLiveEvent({
    type: 'chat',
    roomId: 'room-001',
    agentId: 'agent-abc',
    agentName: 'Orion',
    icon: EVENT_ICONS.chat,
    message: 'Orion said something',
    ...overrides,
  });
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('liveEventsStore', () => {
  beforeEach(() => {
    clearLiveEvents();
  });

  // ── addLiveEvent ────────────────────────────────────────────────────────────

  describe('addLiveEvent', () => {
    it('returns a LiveEvent with generated id and timestamp', () => {
      const ev = makeEvent();
      expect(ev.id).toMatch(/^ev-\d+$/);
      expect(ev.timestamp).toBeCloseTo(Date.now(), -2); // within 100ms
    });

    it('stores all provided fields', () => {
      const ev = addLiveEvent({
        type: 'trade',
        roomId: 'room-42',
        agentId: 'agent-111',
        agentName: 'Lyra',
        targetAgentId: 'agent-222',
        targetAgentName: 'Zephyr',
        detail: 'rare sword',
        icon: '💱',
        message: 'Lyra traded with Zephyr',
      });
      expect(ev.type).toBe('trade');
      expect(ev.roomId).toBe('room-42');
      expect(ev.agentName).toBe('Lyra');
      expect(ev.targetAgentName).toBe('Zephyr');
      expect(ev.detail).toBe('rare sword');
      expect(ev.message).toBe('Lyra traded with Zephyr');
    });

    it('assigns monotonically increasing ids', () => {
      const a = makeEvent();
      const b = makeEvent();
      const c = makeEvent();
      const idA = parseInt(a.id.split('-')[1]);
      const idB = parseInt(b.id.split('-')[1]);
      const idC = parseInt(c.id.split('-')[1]);
      expect(idB).toBeGreaterThan(idA);
      expect(idC).toBeGreaterThan(idB);
    });

    it('keeps the buffer at max 50 events', () => {
      // Add 60 events
      for (let i = 0; i < 60; i++) {
        makeEvent({ message: `event ${i}` });
      }
      const events = getLiveEvents(100);
      expect(events.length).toBe(50);
    });

    it('evicts oldest events when buffer is full', () => {
      // Add 52 events with distinct messages
      for (let i = 0; i < 52; i++) {
        makeEvent({ message: `msg-${i}` });
      }
      const events = getLiveEvents(100);
      // Oldest (msg-0, msg-1) should be evicted
      expect(events.find((e) => e.message === 'msg-0')).toBeUndefined();
      expect(events.find((e) => e.message === 'msg-1')).toBeUndefined();
      // Recent events should be present
      expect(events.find((e) => e.message === 'msg-51')).toBeDefined();
    });
  });

  // ── getLiveEvents ──────────────────────────────────────────────────────────

  describe('getLiveEvents', () => {
    it('returns empty array when no events added', () => {
      expect(getLiveEvents()).toEqual([]);
    });

    it('returns events sorted newest-first', async () => {
      makeEvent({ message: 'first' });
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 2));
      makeEvent({ message: 'second' });
      await new Promise((r) => setTimeout(r, 2));
      makeEvent({ message: 'third' });

      const events = getLiveEvents();
      expect(events[0].message).toBe('third');
      expect(events[1].message).toBe('second');
      expect(events[2].message).toBe('first');
    });

    it('respects the limit parameter', () => {
      for (let i = 0; i < 10; i++) makeEvent();
      expect(getLiveEvents(3).length).toBe(3);
      expect(getLiveEvents(5).length).toBe(5);
      expect(getLiveEvents(10).length).toBe(10);
    });

    it('returns all events when limit > buffer size', () => {
      for (let i = 0; i < 5; i++) makeEvent();
      expect(getLiveEvents(100).length).toBe(5);
    });

    it('defaults to limit 20', () => {
      for (let i = 0; i < 25; i++) makeEvent();
      expect(getLiveEvents().length).toBe(20);
    });
  });

  // ── getTotalEventCount ─────────────────────────────────────────────────────

  describe('getTotalEventCount', () => {
    it('increases monotonically regardless of clearLiveEvents', () => {
      const before = getTotalEventCount();
      makeEvent();
      makeEvent();
      expect(getTotalEventCount()).toBe(before + 2);
      clearLiveEvents();
      makeEvent();
      expect(getTotalEventCount()).toBe(before + 3);
    });
  });

  // ── clearLiveEvents ────────────────────────────────────────────────────────

  describe('clearLiveEvents', () => {
    it('removes all events from the buffer', () => {
      for (let i = 0; i < 5; i++) makeEvent();
      clearLiveEvents();
      expect(getLiveEvents()).toEqual([]);
    });

    it('does not reset the event counter', () => {
      const before = getTotalEventCount();
      makeEvent();
      makeEvent();
      clearLiveEvents();
      expect(getTotalEventCount()).toBe(before + 2);
    });
  });

  // ── buildEventMessage ──────────────────────────────────────────────────────

  describe('buildEventMessage', () => {
    const cases: Array<[LiveEventType, string, string?, string?, string?, string]> = [
      ['chat',          'Orion', undefined, undefined, 'Lobby', 'Orion sent a message in Lobby'],
      ['chat',          'Lyra',  undefined, undefined, undefined, 'Lyra sent a message'],
      ['emote',         'Nova',  undefined, 'wave',    'Arcade', 'Nova performed wave in Arcade'],
      ['trade',         'Zeph',  'Echo',    undefined, 'Market', 'Zeph traded with Echo in Market'],
      ['trade',         'Zeph',  undefined, undefined, undefined, 'Zeph traded with someone'],
      ['game_win',      'Orion', 'Lyra',   'ConnectFour', 'Arcade', 'Orion won ConnectFour against Lyra in Arcade'],
      ['achievement',   'Nova',  undefined, 'Social Butterfly', undefined, 'Nova earned "Social Butterfly"'],
      ['room_enter',    'Echo',  undefined, undefined,  'Pool',  'Echo entered Pool'],
      ['room_leave',    'Zeph',  undefined, undefined,  'Pool',  'Zeph left Pool'],
      ['furniture_use', 'Orion', undefined, 'sofa',    'Lounge', 'Orion used sofa in Lounge'],
      ['game_invite',   'Lyra',  'Nova',    'TicTacToe', 'Arcade', 'Lyra invited Nova to play TicTacToe in Arcade'],
    ];

    cases.forEach(([type, agent, target, detail, room, expected]) => {
      it(`formats "${type}" correctly`, () => {
        expect(buildEventMessage(type, agent, target, detail, room)).toBe(expected);
      });
    });

    it('handles unknown type with fallback', () => {
      const result = buildEventMessage('unknown' as LiveEventType, 'Someone');
      expect(result).toContain('Someone');
    });
  });

  // ── EVENT_ICONS ────────────────────────────────────────────────────────────

  describe('EVENT_ICONS', () => {
    const expectedTypes: LiveEventType[] = [
      'chat', 'emote', 'trade', 'game_win', 'achievement',
      'room_enter', 'room_leave', 'furniture_use', 'game_invite',
    ];

    expectedTypes.forEach((type) => {
      it(`has an icon for event type "${type}"`, () => {
        expect(EVENT_ICONS[type]).toBeDefined();
        expect(typeof EVENT_ICONS[type]).toBe('string');
        expect(EVENT_ICONS[type].length).toBeGreaterThan(0);
      });
    });
  });

  // ── Multi-type events ──────────────────────────────────────────────────────

  describe('Mixed event types', () => {
    it('stores and retrieves events of all supported types', () => {
      const types: LiveEventType[] = [
        'chat', 'emote', 'trade', 'game_win', 'achievement',
        'room_enter', 'room_leave', 'furniture_use', 'game_invite',
      ];
      types.forEach((type) => {
        addLiveEvent({
          type,
          roomId: 'room-x',
          agentName: 'TestAgent',
          icon: EVENT_ICONS[type],
          message: `Test ${type} event`,
        });
      });
      const events = getLiveEvents(50);
      types.forEach((type) => {
        expect(events.find((e) => e.type === type)).toBeDefined();
      });
    });
  });

  // ── Endpoint logic simulation ──────────────────────────────────────────────

  describe('Endpoint logic', () => {
    it('validates limit clamp (1-50)', () => {
      // Simulate the endpoint's limit clamping logic
      function clampLimit(raw: number) {
        return Math.min(Math.max(1, raw), 50);
      }
      expect(clampLimit(-5)).toBe(1);
      expect(clampLimit(0)).toBe(1);
      expect(clampLimit(20)).toBe(20);
      expect(clampLimit(51)).toBe(50);
      expect(clampLimit(9999)).toBe(50);
    });

    it('returns correct structure when events are present', () => {
      addLiveEvent({
        type: 'emote',
        roomId: 'room-1',
        agentName: 'Agent',
        icon: '🎭',
        message: 'Agent performed wave',
      });
      const events = getLiveEvents(20);
      const response = { events, total: events.length };
      expect(response.events).toHaveLength(1);
      expect(response.total).toBe(1);
    });

    it('returns empty events array when store is empty', () => {
      const events = getLiveEvents(20);
      expect(events).toEqual([]);
    });
  });
});
