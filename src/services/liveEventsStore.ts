/**
 * liveEventsStore.ts — In-memory circular buffer for global live events.
 *
 * Captures notable events from across all rooms and exposes them via
 * GET /api/spectate/live-events — used by the spectator ticker.
 *
 * T-346: Global Live Events Ticker
 */

export interface LiveEvent {
  id: string;
  type: LiveEventType;
  roomId: string;
  roomName?: string;
  agentId?: string;
  agentName?: string;
  targetAgentId?: string;
  targetAgentName?: string;
  detail?: string;       // e.g. game name, item name, emote name
  icon: string;
  message: string;       // Human-readable sentence
  timestamp: number;     // Unix ms
}

export type LiveEventType =
  | 'chat'
  | 'emote'
  | 'trade'
  | 'game_win'
  | 'achievement'
  | 'room_enter'
  | 'room_leave'
  | 'furniture_use'
  | 'game_invite'
  | 'wander'
  | 'dance';

const MAX_EVENTS = 50;
const liveEvents: LiveEvent[] = [];
let eventCounter = 0;

/** Add a new live event to the buffer (oldest auto-evicted when full). */
export function addLiveEvent(event: Omit<LiveEvent, 'id' | 'timestamp'>): LiveEvent {
  const full: LiveEvent = {
    ...event,
    id: `ev-${++eventCounter}`,
    timestamp: Date.now(),
  };

  liveEvents.push(full);

  // Keep buffer size bounded
  if (liveEvents.length > MAX_EVENTS) {
    liveEvents.splice(0, liveEvents.length - MAX_EVENTS);
  }

  return full;
}

/** Return events sorted newest-first, optionally limited. */
export function getLiveEvents(limit = 20): LiveEvent[] {
  const sorted = [...liveEvents].sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

/** Return total number of events captured so far (monotonic). */
export function getTotalEventCount(): number {
  return eventCounter;
}

/** Clear all events (useful for tests). */
export function clearLiveEvents(): void {
  liveEvents.length = 0;
  // Do NOT reset eventCounter — it's monotonic
}

// ── Emoji icon map ─────────────────────────────────────────────────────────
export const EVENT_ICONS: Record<LiveEventType, string> = {
  chat:          '💬',
  emote:         '🎭',
  trade:         '💱',
  game_win:      '🏆',
  achievement:   '🏅',
  room_enter:    '🚪',
  room_leave:    '👋',
  furniture_use: '🪑',
  game_invite:   '🎮',
  wander:        '🚶',
  dance:         '💃',
};

/**
 * Build a human-readable ticker message from event data.
 * Called both on the server (for the REST endpoint) and duplicated in the
 * frontend (for WS-sourced events).
 */
export function buildEventMessage(
  type: LiveEventType,
  agentName: string,
  targetName?: string,
  detail?: string,
  roomName?: string,
): string {
  const room = roomName ? ` in ${roomName}` : '';
  const target = targetName || 'someone';

  switch (type) {
    case 'chat':
      return `${agentName} sent a message${room}`;
    case 'emote':
      return `${agentName} performed ${detail || 'an emote'}${room}`;
    case 'trade':
      return `${agentName} traded with ${target}${room}`;
    case 'game_win':
      return `${agentName} won ${detail || 'a game'} against ${target}${room}`;
    case 'achievement':
      return `${agentName} earned "${detail || 'an achievement'}"${room}`;
    case 'room_enter':
      return `${agentName} entered ${roomName || 'a room'}`;
    case 'room_leave':
      return `${agentName} left ${roomName || 'a room'}`;
    case 'furniture_use':
      return `${agentName} used ${detail || 'furniture'}${room}`;
    case 'game_invite':
      return `${agentName} invited ${target} to play ${detail || 'a game'}${room}`;
    default:
      return `${agentName} did something${room}`;
  }
}
