/**
 * watchlistBroadcast.ts — T-365: Agent Watchlist System — WS Dispatch
 *
 * Bridges the watchlistService (pure in-memory store) with the live
 * WebSocket connections managed by spectator.ts.
 *
 * Usage flow:
 *   1. A spectator sends { type: "spectator.watchlist.register", spectatorId: "xxx" }
 *      → spectator.ts calls registerSpectatorWs(spectatorId, ws)
 *   2. When an agent event fires (chat, move, trade, etc.) in handler.ts:
 *      → call notifyWatchlistEvent(agentId, kind, summary, roomId, agentDisplayName)
 *      → alerts are dispatched to the spectators' WebSocket connections
 *   3. On WS disconnect → spectator.ts calls unregisterSpectatorWs(ws)
 *
 * Design:
 *   - No circular imports (imported by both handler.ts and spectator.ts)
 *   - Exported pure helpers are unit-testable without a live WS server
 */

import WebSocket from 'ws';
import {
  recordAgentEvent,
  buildEventSummary,
  type WatchEventKind,
  type WatchlistAlert,
} from '../services/watchlistService.js';

// ─── Connection registry ──────────────────────────────────────────────────────

/** spectatorId → active WebSocket connection */
const _spectatorConnections = new Map<string, WebSocket>();

/** WebSocket → spectatorId (reverse index for O(1) cleanup) */
const _wsToSpectatorId = new WeakMap<WebSocket, string>();

// ─── Registry management ──────────────────────────────────────────────────────

/**
 * Register a WebSocket connection for a spectator session.
 * If this spectatorId already has a connection, the old one is replaced.
 */
export function registerSpectatorWs(spectatorId: string, ws: WebSocket): void {
  const existing = _spectatorConnections.get(spectatorId);
  if (existing && existing !== ws) {
    _wsToSpectatorId.delete(existing);
  }
  _spectatorConnections.set(spectatorId, ws);
  _wsToSpectatorId.set(ws, spectatorId);
}

/**
 * Remove a WebSocket from the registry (on disconnect / close).
 */
export function unregisterSpectatorWs(ws: WebSocket): void {
  const spectatorId = _wsToSpectatorId.get(ws);
  if (!spectatorId) return;

  _wsToSpectatorId.delete(ws);

  const current = _spectatorConnections.get(spectatorId);
  if (current === ws) {
    _spectatorConnections.delete(spectatorId);
  }
}

/**
 * Return the number of registered spectator WebSocket connections.
 */
export function getRegisteredSpectatorCount(): number {
  return _spectatorConnections.size;
}

/**
 * Return true when a given spectatorId has an active WS connection.
 */
export function isSpectatorConnected(spectatorId: string): boolean {
  const ws = _spectatorConnections.get(spectatorId);
  return !!ws && ws.readyState === WebSocket.OPEN;
}

// ─── Alert dispatch ───────────────────────────────────────────────────────────

/**
 * Build a watchlist.alert WS message payload (exported for unit tests).
 */
export function buildWatchlistAlertPayload(alert: WatchlistAlert): object {
  return {
    type: 'watchlist.alert',
    agentId:   alert.agentId,
    kind:      alert.kind,
    summary:   alert.summary,
    roomId:    alert.roomId,
    timestamp: alert.timestamp,
  };
}

/**
 * Send watchlist alerts to all connected spectators.
 * Non-throwing — ignores closed/unavailable connections.
 *
 * @returns number of alerts successfully sent
 */
export function dispatchWatchlistAlerts(alerts: WatchlistAlert[]): number {
  let sent = 0;
  for (const alert of alerts) {
    const ws = _spectatorConnections.get(alert.spectatorId);
    if (!ws || ws.readyState !== WebSocket.OPEN) continue;

    try {
      ws.send(JSON.stringify(buildWatchlistAlertPayload(alert)));
      sent++;
    } catch {
      // Non-critical — ignore send errors
    }
  }
  return sent;
}

/**
 * Convenience: record an agent event in the watchlist store AND immediately
 * dispatch the alerts to connected spectators.
 *
 * Called from handler.ts after chat / move / trade / achievement events.
 *
 * @returns number of spectators notified
 */
export function notifyWatchlistEvent(
  agentId:         string,
  kind:            WatchEventKind,
  agentDisplayName: string,
  detail:          string,
  roomId:          string,
  now:             number = Date.now(),
): number {
  const summary = buildEventSummary(kind, agentDisplayName, detail);
  const alerts  = recordAgentEvent(agentId, kind, summary, roomId, now);
  return dispatchWatchlistAlerts(alerts);
}

/**
 * Reset the connection registry (used in tests only).
 */
export function _resetBroadcastRegistry(): void {
  _spectatorConnections.clear();
}
