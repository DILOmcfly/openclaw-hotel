/**
 * watchlistBroadcast.test.ts — T-365
 * Unit tests for the watchlist WS broadcast module.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import WebSocket from 'ws';
import {
  registerSpectatorWs,
  unregisterSpectatorWs,
  getRegisteredSpectatorCount,
  isSpectatorConnected,
  buildWatchlistAlertPayload,
  dispatchWatchlistAlerts,
  notifyWatchlistEvent,
  _resetBroadcastRegistry,
} from '../../ws/watchlistBroadcast.js';
import {
  addWatch,
  _resetWatchlistStore,
} from '../watchlistService.js';

// ─── Mock WebSocket ───────────────────────────────────────────────────────────

function makeMockWs(readyState = WebSocket.OPEN): WebSocket {
  return {
    readyState,
    send: vi.fn(),
  } as unknown as WebSocket;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetBroadcastRegistry();
  _resetWatchlistStore();
});

// ─── registerSpectatorWs ─────────────────────────────────────────────────────

describe('registerSpectatorWs', () => {
  it('increases registered count', () => {
    const ws = makeMockWs();
    registerSpectatorWs('sp1', ws);
    expect(getRegisteredSpectatorCount()).toBe(1);
  });

  it('replacing same spectatorId does not increase count', () => {
    const ws1 = makeMockWs();
    const ws2 = makeMockWs();
    registerSpectatorWs('sp1', ws1);
    registerSpectatorWs('sp1', ws2);
    expect(getRegisteredSpectatorCount()).toBe(1);
  });

  it('two different spectators are both registered', () => {
    registerSpectatorWs('sp1', makeMockWs());
    registerSpectatorWs('sp2', makeMockWs());
    expect(getRegisteredSpectatorCount()).toBe(2);
  });
});

// ─── unregisterSpectatorWs ───────────────────────────────────────────────────

describe('unregisterSpectatorWs', () => {
  it('reduces count after unregister', () => {
    const ws = makeMockWs();
    registerSpectatorWs('sp1', ws);
    unregisterSpectatorWs(ws);
    expect(getRegisteredSpectatorCount()).toBe(0);
  });

  it('is a no-op for unknown ws', () => {
    expect(() => unregisterSpectatorWs(makeMockWs())).not.toThrow();
  });

  it('does not affect other registered spectators', () => {
    const ws1 = makeMockWs();
    const ws2 = makeMockWs();
    registerSpectatorWs('sp1', ws1);
    registerSpectatorWs('sp2', ws2);
    unregisterSpectatorWs(ws1);
    expect(getRegisteredSpectatorCount()).toBe(1);
    expect(isSpectatorConnected('sp2')).toBe(true);
  });
});

// ─── isSpectatorConnected ─────────────────────────────────────────────────────

describe('isSpectatorConnected', () => {
  it('returns false for unknown spectator', () => {
    expect(isSpectatorConnected('nobody')).toBe(false);
  });

  it('returns true for an open WS', () => {
    const ws = makeMockWs(WebSocket.OPEN);
    registerSpectatorWs('sp1', ws);
    expect(isSpectatorConnected('sp1')).toBe(true);
  });

  it('returns false for a closed WS', () => {
    const ws = makeMockWs(WebSocket.CLOSED);
    registerSpectatorWs('sp1', ws);
    expect(isSpectatorConnected('sp1')).toBe(false);
  });

  it('returns false after unregister', () => {
    const ws = makeMockWs();
    registerSpectatorWs('sp1', ws);
    unregisterSpectatorWs(ws);
    expect(isSpectatorConnected('sp1')).toBe(false);
  });
});

// ─── buildWatchlistAlertPayload ───────────────────────────────────────────────

describe('buildWatchlistAlertPayload', () => {
  it('returns payload with correct type and fields', () => {
    const alert = {
      spectatorId: 'sp1',
      agentId:     'ag1',
      kind:        'chat' as const,
      summary:     'Hello!',
      roomId:      'room_lobby',
      timestamp:   '2026-02-18T10:00:00Z',
    };
    const payload = buildWatchlistAlertPayload(alert);
    expect(payload).toEqual({
      type:      'watchlist.alert',
      agentId:   'ag1',
      kind:      'chat',
      summary:   'Hello!',
      roomId:    'room_lobby',
      timestamp: '2026-02-18T10:00:00Z',
    });
  });

  it('does not include spectatorId in the payload (client privacy)', () => {
    const payload = buildWatchlistAlertPayload({
      spectatorId: 'sp1',
      agentId:     'ag1',
      kind:        'trade' as const,
      summary:     'traded',
      roomId:      'r1',
      timestamp:   '2026-01-01T00:00:00Z',
    });
    expect(payload).not.toHaveProperty('spectatorId');
  });
});

// ─── dispatchWatchlistAlerts ──────────────────────────────────────────────────

describe('dispatchWatchlistAlerts', () => {
  it('sends to open connections', () => {
    const ws = makeMockWs(WebSocket.OPEN);
    registerSpectatorWs('sp1', ws);

    const alerts = [{
      spectatorId: 'sp1',
      agentId:     'ag1',
      kind:        'chat' as const,
      summary:     'Hello',
      roomId:      'r1',
      timestamp:   '2026-01-01T00:00:00Z',
    }];

    const sent = dispatchWatchlistAlerts(alerts);
    expect(sent).toBe(1);
    expect(ws.send).toHaveBeenCalledOnce();
    const payload = JSON.parse((ws.send as any).mock.calls[0][0]);
    expect(payload.type).toBe('watchlist.alert');
    expect(payload.kind).toBe('chat');
  });

  it('skips closed connections', () => {
    const ws = makeMockWs(WebSocket.CLOSED);
    registerSpectatorWs('sp1', ws);

    const alerts = [{
      spectatorId: 'sp1',
      agentId: 'ag1', kind: 'chat' as const, summary: 'hi', roomId: 'r1',
      timestamp: new Date().toISOString(),
    }];

    const sent = dispatchWatchlistAlerts(alerts);
    expect(sent).toBe(0);
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('skips unregistered spectators', () => {
    const alerts = [{
      spectatorId: 'nobody',
      agentId: 'ag1', kind: 'chat' as const, summary: 'hi', roomId: 'r1',
      timestamp: new Date().toISOString(),
    }];
    expect(dispatchWatchlistAlerts(alerts)).toBe(0);
  });

  it('sends to multiple spectators watching the same agent', () => {
    const ws1 = makeMockWs();
    const ws2 = makeMockWs();
    registerSpectatorWs('sp1', ws1);
    registerSpectatorWs('sp2', ws2);

    const alerts = [
      { spectatorId: 'sp1', agentId: 'ag1', kind: 'trade' as const, summary: 'traded', roomId: 'r1', timestamp: new Date().toISOString() },
      { spectatorId: 'sp2', agentId: 'ag1', kind: 'trade' as const, summary: 'traded', roomId: 'r1', timestamp: new Date().toISOString() },
    ];

    const sent = dispatchWatchlistAlerts(alerts);
    expect(sent).toBe(2);
    expect(ws1.send).toHaveBeenCalledOnce();
    expect(ws2.send).toHaveBeenCalledOnce();
  });

  it('handles empty alerts array', () => {
    expect(dispatchWatchlistAlerts([])).toBe(0);
  });
});

// ─── notifyWatchlistEvent ─────────────────────────────────────────────────────

describe('notifyWatchlistEvent', () => {
  it('sends alert when spectator is watching and connected', () => {
    const ws = makeMockWs();
    registerSpectatorWs('sp1', ws);
    addWatch('sp1', 'ag1', 'Alice');

    const sent = notifyWatchlistEvent('ag1', 'chat', 'Alice', 'Hello there!', 'room_lobby');
    expect(sent).toBe(1);
    expect(ws.send).toHaveBeenCalledOnce();

    const payload = JSON.parse((ws.send as any).mock.calls[0][0]);
    expect(payload.type).toBe('watchlist.alert');
    expect(payload.agentId).toBe('ag1');
    expect(payload.kind).toBe('chat');
    expect(payload.summary).toContain('Alice');
    expect(payload.roomId).toBe('room_lobby');
  });

  it('returns 0 when no watchers', () => {
    const sent = notifyWatchlistEvent('ag_nobody', 'chat', 'Ghost', 'hello', 'r1');
    expect(sent).toBe(0);
  });

  it('returns 0 when watcher is not connected', () => {
    addWatch('sp1', 'ag1');
    // sp1 is watching ag1 but has no WS connection registered
    const sent = notifyWatchlistEvent('ag1', 'chat', 'Agent', 'hi', 'r1');
    expect(sent).toBe(0);
  });

  it('builds summary using buildEventSummary logic', () => {
    const ws = makeMockWs();
    registerSpectatorWs('sp1', ws);
    addWatch('sp1', 'ag1', 'Nova');

    notifyWatchlistEvent('ag1', 'achievement', 'Nova', 'First Trade', 'r1');
    const payload = JSON.parse((ws.send as any).mock.calls[0][0]);
    expect(payload.summary).toBe('Nova earned "First Trade"');
  });

  it('handles multiple watchers for same agent', () => {
    const ws1 = makeMockWs();
    const ws2 = makeMockWs();
    registerSpectatorWs('sp1', ws1);
    registerSpectatorWs('sp2', ws2);
    addWatch('sp1', 'ag1');
    addWatch('sp2', 'ag1');

    const sent = notifyWatchlistEvent('ag1', 'trade', 'Rex', 'item', 'r1');
    expect(sent).toBe(2);
  });
});
