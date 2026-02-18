/**
 * watchlistService.ts — T-365: Agent Watchlist System
 *
 * Allows spectators to "follow" specific agents.
 * When a followed agent chats, moves, trades, or earns an achievement,
 * the spectator receives a targeted `watchlist.alert` notification.
 *
 * Architecture:
 *   - Pure in-memory store (Map + Set) — no DB dependency
 *   - Spectators are identified by a session ID (UUID assigned on WS connect)
 *   - Agent events are sourced from the live-events store and WS handler
 *   - All exported helpers are pure/injectable for unit-test coverage
 *
 * Capacity limits (prevent memory abuse):
 *   - MAX_WATCHLIST_SIZE   = 20 agents per spectator
 *   - MAX_WATCHERS_PER_AGENT = 200 spectators per agent
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum agents a single spectator may watch */
export const MAX_WATCHLIST_SIZE = 20;

/** Maximum spectators that may watch a single agent */
export const MAX_WATCHERS_PER_AGENT = 200;

/** TTL for inactive spectator watchlists (ms). 24 hours. */
export const WATCHLIST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type WatchEventKind = 'chat' | 'move' | 'trade' | 'achievement' | 'emote';

export interface WatchlistEntry {
  /** Agent being watched */
  agentId: string;
  /** Display name (populated lazily) */
  displayName?: string;
  /** ISO timestamp when this watch was added */
  addedAt: string;
  /** Latest event received from this agent */
  lastEvent?: {
    kind: WatchEventKind;
    summary: string;
    roomId: string;
    at: string;
  };
}

export interface WatchlistAlert {
  spectatorId: string;
  agentId: string;
  kind: WatchEventKind;
  summary: string;
  roomId: string;
  timestamp: string;
}

// ─── Internal store ───────────────────────────────────────────────────────────

// spectatorId → Map<agentId, WatchlistEntry>
const _watchlists = new Map<string, Map<string, WatchlistEntry>>();

// agentId → Set<spectatorId>  (reverse index for O(1) lookup)
const _watchers = new Map<string, Set<string>>();

// Last-active timestamps for TTL eviction
const _lastActive = new Map<string, number>();

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Return the number of active spectator watchlists.
 */
export function getWatchlistCount(): number {
  return _watchlists.size;
}

/**
 * Return the total number of (spectator, agent) watch pairs.
 */
export function getTotalWatchPairs(): number {
  let total = 0;
  for (const map of _watchlists.values()) {
    total += map.size;
  }
  return total;
}

/**
 * Return true when a spectator is currently watching an agent.
 */
export function isWatching(spectatorId: string, agentId: string): boolean {
  return _watchlists.get(spectatorId)?.has(agentId) ?? false;
}

/**
 * Return all agent IDs that a spectator is watching.
 */
export function getWatchlist(spectatorId: string): WatchlistEntry[] {
  const map = _watchlists.get(spectatorId);
  if (!map) return [];
  return Array.from(map.values());
}

/**
 * Return all spectator IDs watching a given agent.
 */
export function getWatchersForAgent(agentId: string): string[] {
  const set = _watchers.get(agentId);
  if (!set) return [];
  return Array.from(set);
}

/**
 * Add an agent to a spectator's watchlist.
 *
 * @returns 'ok' | 'already_watching' | 'watchlist_full' | 'too_many_watchers'
 */
export function addWatch(
  spectatorId: string,
  agentId: string,
  displayName?: string,
  now: number = Date.now(),
): 'ok' | 'already_watching' | 'watchlist_full' | 'too_many_watchers' {
  // Guard: already watching
  if (isWatching(spectatorId, agentId)) return 'already_watching';

  // Guard: spectator watchlist capacity
  const spectatorMap = _watchlists.get(spectatorId) ?? new Map<string, WatchlistEntry>();
  if (spectatorMap.size >= MAX_WATCHLIST_SIZE) return 'watchlist_full';

  // Guard: agent watcher capacity
  const agentWatchers = _watchers.get(agentId) ?? new Set<string>();
  if (agentWatchers.size >= MAX_WATCHERS_PER_AGENT) return 'too_many_watchers';

  // Commit
  const entry: WatchlistEntry = {
    agentId,
    displayName,
    addedAt: new Date(now).toISOString(),
  };
  spectatorMap.set(agentId, entry);
  _watchlists.set(spectatorId, spectatorMap);

  agentWatchers.add(spectatorId);
  _watchers.set(agentId, agentWatchers);

  _lastActive.set(spectatorId, now);
  return 'ok';
}

/**
 * Remove an agent from a spectator's watchlist.
 *
 * @returns true if it was removed, false if it was not being watched.
 */
export function removeWatch(
  spectatorId: string,
  agentId: string,
): boolean {
  const spectatorMap = _watchlists.get(spectatorId);
  if (!spectatorMap?.has(agentId)) return false;

  spectatorMap.delete(agentId);
  if (spectatorMap.size === 0) {
    _watchlists.delete(spectatorId);
  }

  const agentWatchers = _watchers.get(agentId);
  if (agentWatchers) {
    agentWatchers.delete(spectatorId);
    if (agentWatchers.size === 0) {
      _watchers.delete(agentId);
    }
  }

  return true;
}

/**
 * Clear all watches for a spectator (e.g. on WS disconnect).
 */
export function clearWatchlist(spectatorId: string): void {
  const spectatorMap = _watchlists.get(spectatorId);
  if (!spectatorMap) return;

  for (const agentId of spectatorMap.keys()) {
    const agentWatchers = _watchers.get(agentId);
    if (agentWatchers) {
      agentWatchers.delete(spectatorId);
      if (agentWatchers.size === 0) {
        _watchers.delete(agentId);
      }
    }
  }

  _watchlists.delete(spectatorId);
  _lastActive.delete(spectatorId);
}

/**
 * Record the latest event for an agent on all their watchers' watchlists.
 * Returns the list of alerts to be dispatched (one per watcher).
 */
export function recordAgentEvent(
  agentId: string,
  kind: WatchEventKind,
  summary: string,
  roomId: string,
  now: number = Date.now(),
): WatchlistAlert[] {
  const watchers = _watchers.get(agentId);
  if (!watchers || watchers.size === 0) return [];

  const timestamp = new Date(now).toISOString();
  const alerts: WatchlistAlert[] = [];

  for (const spectatorId of watchers) {
    const spectatorMap = _watchlists.get(spectatorId);
    if (!spectatorMap) continue;

    const entry = spectatorMap.get(agentId);
    if (entry) {
      entry.lastEvent = { kind, summary, roomId, at: timestamp };
    }

    _lastActive.set(spectatorId, now);

    alerts.push({ spectatorId, agentId, kind, summary, roomId, timestamp });
  }

  return alerts;
}

/**
 * Evict spectator watchlists that have been inactive for longer than TTL.
 * Returns the number of sessions evicted.
 */
export function evictStaleSessions(now: number = Date.now()): number {
  let evicted = 0;
  for (const [spectatorId, lastActive] of _lastActive) {
    if (now - lastActive > WATCHLIST_SESSION_TTL_MS) {
      clearWatchlist(spectatorId);
      evicted++;
    }
  }
  return evicted;
}

/**
 * Reset all state (used in tests only).
 */
export function _resetWatchlistStore(): void {
  _watchlists.clear();
  _watchers.clear();
  _lastActive.clear();
}

/**
 * Build a human-readable summary for an agent event.
 */
export function buildEventSummary(
  kind: WatchEventKind,
  agentName: string,
  detail: string = '',
): string {
  switch (kind) {
    case 'chat':        return `${agentName}: "${detail.slice(0, 60)}"`;
    case 'move':        return `${agentName} moved to ${detail}`;
    case 'trade':       return `${agentName} completed a trade`;
    case 'achievement': return `${agentName} earned "${detail}"`;
    case 'emote':       return `${agentName} performed ${detail}`;
    default:            return `${agentName} did something`;
  }
}
