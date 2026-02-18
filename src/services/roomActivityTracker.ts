/**
 * Room Activity Tracker — T-360
 *
 * Tracks real-time activity per room in a sliding time window.
 * Calculates an "activity score" for each room based on weighted event types.
 * Used by: spectator API (room hotness), TV Mode (prefer active rooms).
 *
 * Pure in-memory — no DB required, no persistence across restarts.
 */

export type ActivityEventType =
  | 'message'   // agent chat — weight 3
  | 'trade'     // completed trade — weight 5
  | 'emote'     // emote action — weight 2
  | 'move'      // agent movement — weight 1
  | 'furniture' // furniture interaction — weight 2
  | 'game'      // game action (dice, blackjack…) — weight 4
  | 'join'      // agent joined room — weight 2
  | 'leave';    // agent left room — weight 1

export interface ActivityEvent {
  type: ActivityEventType;
  timestamp: number; // Unix ms
}

export interface RoomActivity {
  roomId: string;
  events: ActivityEvent[];
  score: number;
  hotLevel: HotLevel;
  lastUpdated: number;
}

export type HotLevel = 'cold' | 'warm' | 'hot' | 'blazing';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Window for sliding event count (ms) */
export const ACTIVITY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum events to keep in memory per room */
export const MAX_EVENTS_PER_ROOM = 500;

/** Score weights per event type */
export const EVENT_WEIGHTS: Record<ActivityEventType, number> = {
  message:   3,
  trade:     5,
  emote:     2,
  move:      1,
  furniture: 2,
  game:      4,
  join:      2,
  leave:     1,
};

/** Hot level score thresholds */
export const HOT_THRESHOLDS = {
  warm:    10,  // 10+ points in window
  hot:     30,  // 30+ points
  blazing: 80,  // 80+ points
} as const;

// ── State ──────────────────────────────────────────────────────────────────────

const roomMap = new Map<string, ActivityEvent[]>();

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Record an activity event for a room.
 * Called by WebSocket handler on every broadcast.
 */
export function recordEvent(roomId: string, type: ActivityEventType): void {
  if (!roomId || !type) return;

  const now = Date.now();

  let events = roomMap.get(roomId) ?? [];

  // Prune old events outside the window first (keep array small)
  events = pruneEvents(events, now);

  events.push({ type, timestamp: now });

  // Hard cap to prevent memory bloat
  if (events.length > MAX_EVENTS_PER_ROOM) {
    events = events.slice(events.length - MAX_EVENTS_PER_ROOM);
  }

  roomMap.set(roomId, events);
}

/**
 * Remove events older than ACTIVITY_WINDOW_MS.
 */
export function pruneEvents(
  events: ActivityEvent[],
  now: number = Date.now(),
): ActivityEvent[] {
  const cutoff = now - ACTIVITY_WINDOW_MS;
  return events.filter(e => e.timestamp >= cutoff);
}

/**
 * Calculate the activity score for a room.
 * Returns 0 for unknown rooms.
 */
export function getActivityScore(
  roomId: string,
  now: number = Date.now(),
): number {
  const events = roomMap.get(roomId);
  if (!events || events.length === 0) return 0;

  const cutoff = now - ACTIVITY_WINDOW_MS;
  let score = 0;

  for (const event of events) {
    if (event.timestamp < cutoff) continue;

    const weight = EVENT_WEIGHTS[event.type] ?? 1;

    // Apply recency decay: events in the last 60 s are worth 2×
    const ageMs = now - event.timestamp;
    const recencyMultiplier = ageMs < 60_000 ? 2 : 1;

    score += weight * recencyMultiplier;
  }

  return score;
}

/**
 * Classify a score into a hot level label.
 */
export function getHotLevel(score: number): HotLevel {
  if (score >= HOT_THRESHOLDS.blazing) return 'blazing';
  if (score >= HOT_THRESHOLDS.hot)     return 'hot';
  if (score >= HOT_THRESHOLDS.warm)    return 'warm';
  return 'cold';
}

/**
 * Get a human-friendly heat emoji for a hot level.
 */
export function getHotEmoji(level: HotLevel): string {
  switch (level) {
    case 'blazing': return '🔥🔥';
    case 'hot':     return '🔥';
    case 'warm':    return '✨';
    case 'cold':    return '';
  }
}

/**
 * Return the activity data for a specific room.
 * Prunes stale events before returning.
 */
export function getRoomActivity(roomId: string): RoomActivity {
  const now = Date.now();
  const raw = roomMap.get(roomId) ?? [];
  const events = pruneEvents(raw, now);
  roomMap.set(roomId, events); // write back pruned
  const score = getActivityScore(roomId, now);
  return {
    roomId,
    events,
    score,
    hotLevel: getHotLevel(score),
    lastUpdated: now,
  };
}

/**
 * Return activity data for ALL tracked rooms, sorted by score descending.
 */
export function getAllRoomActivities(): RoomActivity[] {
  const now = Date.now();
  const result: RoomActivity[] = [];

  for (const roomId of roomMap.keys()) {
    const raw = roomMap.get(roomId) ?? [];
    const events = pruneEvents(raw, now);
    roomMap.set(roomId, events);
    const score = getActivityScore(roomId, now);
    result.push({
      roomId,
      events,
      score,
      hotLevel: getHotLevel(score),
      lastUpdated: now,
    });
  }

  // Sort hottest first
  result.sort((a, b) => b.score - a.score);
  return result;
}

/**
 * Get the hottest room ID (highest score).
 * Returns null if no rooms are tracked.
 */
export function getHottestRoomId(): string | null {
  const activities = getAllRoomActivities();
  if (activities.length === 0) return null;
  return activities[0].score > 0 ? activities[0].roomId : null;
}

/**
 * Get top N hottest rooms.
 */
export function getTopRooms(n: number): RoomActivity[] {
  return getAllRoomActivities().slice(0, Math.max(1, n));
}

/**
 * Reset all activity data (used in tests).
 */
export function resetAllActivity(): void {
  roomMap.clear();
}

/**
 * Reset activity for a specific room.
 */
export function resetRoomActivity(roomId: string): void {
  roomMap.delete(roomId);
}

/**
 * Map a WebSocket broadcast event type to an ActivityEventType.
 * Returns null for events we don't track.
 */
export function mapBroadcastType(wsType: string): ActivityEventType | null {
  switch (wsType) {
    case 'message.new':
    case 'chat':
      return 'message';
    case 'trade_offer':
    case 'trade_completed':
    case 'trade_accepted':
      return 'trade';
    case 'emote':
    case 'dance':
      return 'emote';
    case 'agent.moved':
    case 'move':
      return 'move';
    case 'furniture_use':
    case 'furniture_placed':
    case 'furniture_removed':
      return 'furniture';
    case 'game_invite':
    case 'game_result':
    case 'blackjack':
    case 'dice_roll':
      return 'game';
    case 'agent.joined':
      return 'join';
    case 'agent.left':
      return 'leave';
    default:
      return null;
  }
}
