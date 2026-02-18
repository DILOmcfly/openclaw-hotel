/**
 * hotRoomsDetector.ts — T-368: "Hot Right Now" Activity Spike Detector
 *
 * Analyzes the in-memory liveEventsStore to find rooms with activity spikes.
 * A room is "hot" when it has significantly more events in a short window
 * than its recent baseline.
 *
 * Design goals:
 *  - Zero DB queries (reads only the in-memory event buffer)
 *  - Sub-millisecond latency (runs in tight loops)
 *  - Deterministic: same events → same result
 */

import { getLiveEvents, type LiveEvent, type LiveEventType } from './liveEventsStore.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HotRoom {
  roomId: string;
  roomName: string;
  eventCount: number;       // Events in the spike window
  eventsPerMinute: number;  // Activity rate
  topAgents: string[];      // Most active agent names (deduplicated)
  headline: string;         // Human-readable "what's happening" summary
  dominantType: LiveEventType | null;  // Most common event type
  hotScore: number;         // Composite score 0–100
}

export interface HotRoomsResult {
  rooms: HotRoom[];
  totalHotRooms: number;
  snapshotMs: number;       // Window size used
  generatedAt: string;      // ISO timestamp
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** How recent events must be to count as "hot" (milliseconds). */
export const HOT_WINDOW_MS = 90_000; // 90 seconds

/** Minimum events in window to qualify as hot. */
export const HOT_THRESHOLD = 3;

/** Maximum rooms returned. */
export const MAX_HOT_ROOMS = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Count occurrences of each item in an array.
 * Returns a Map<value, count>.
 */
export function countBy<T>(arr: T[]): Map<T, number> {
  const map = new Map<T, number>();
  for (const item of arr) {
    map.set(item, (map.get(item) || 0) + 1);
  }
  return map;
}

/**
 * Get the key with the highest count from a Map.
 * Returns null if map is empty.
 */
export function maxByCount<T>(map: Map<T, number>): T | null {
  let best: T | null = null;
  let bestCount = 0;
  for (const [key, count] of map) {
    if (count > bestCount) {
      bestCount = count;
      best = key;
    }
  }
  return best;
}

/**
 * Deduplicate an array of strings preserving order.
 */
export function dedupeStr(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter(s => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

/**
 * Build a human-readable headline for a hot room.
 *
 * @param roomName - Room display name
 * @param events   - Events in the spike window
 * @param topAgents - Top agent names
 * @param dominantType - Most common event type
 */
export function buildHeadline(
  roomName: string,
  events: LiveEvent[],
  topAgents: string[],
  dominantType: LiveEventType | null,
): string {
  if (events.length === 0) return `Something is happening in ${roomName}`;

  const count = events.length;
  const agent = topAgents[0] || 'Agents';
  const room = roomName || 'a room';

  // Find if there are multiple agents
  const uniqueAgents = dedupeStr(events.map(e => e.agentName || '').filter(Boolean));

  switch (dominantType) {
    case 'trade':
      return uniqueAgents.length > 1
        ? `Trading frenzy in ${room}! ${uniqueAgents.slice(0, 2).join(' & ')} are exchanging items`
        : `${agent} is trading in ${room}`;
    case 'game_win':
      return `${agent} is on a winning streak in ${room}! 🏆`;
    case 'achievement':
      return `Achievement rush in ${room}! ${count} unlocked in the last 90 seconds`;
    case 'chat':
      return uniqueAgents.length > 2
        ? `Lively conversation in ${room} — ${uniqueAgents.length} agents chatting at once!`
        : `${uniqueAgents.slice(0, 2).join(' & ')} are deep in conversation in ${room}`;
    case 'emote':
      return `Dance party in ${room}! ${count} emotes flying`;
    case 'game_invite':
      return `Game night in ${room}! Agents are challenging each other`;
    case 'furniture_use':
      return `Interior design action in ${room}!`;
    default:
      if (count >= 8) return `${room} is on 🔥 — ${count} events in 90 seconds!`;
      if (uniqueAgents.length >= 3) return `${room} is buzzing with ${uniqueAgents.length} active agents`;
      return `Activity spike in ${room}: ${count} events just happened`;
  }
}

/**
 * Compute a composite "hot score" (0–100) for ranking.
 *
 * Factors:
 *  - Raw event count in window (primary)
 *  - Recency of last event (more recent = higher score)
 *  - Variety bonus (multiple event types = more interesting)
 */
export function computeHotScore(
  events: LiveEvent[],
  nowMs: number,
): number {
  if (events.length === 0) return 0;

  const count = events.length;
  // Raw count normalized to 0–60 (60 is "epic" — 1 event per 1.5s)
  const countScore = Math.min(60, count * 8);

  // Recency: most recent event (0 = now, 90000 = 90s ago → 0 score)
  const mostRecent = Math.max(...events.map(e => e.timestamp));
  const ageMs = nowMs - mostRecent;
  const recencyScore = Math.max(0, 30 - (ageMs / HOT_WINDOW_MS) * 30);

  // Variety bonus: up to 10 points for having ≥3 distinct event types
  const types = new Set(events.map(e => e.type));
  const varietyScore = Math.min(10, types.size * 3);

  return Math.round(countScore + recencyScore + varietyScore);
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Detect hot rooms from the in-memory event buffer.
 *
 * @param nowMs  - Current timestamp (injectable for testing)
 * @param limit  - Max rooms to return
 */
export function detectHotRooms(
  nowMs: number = Date.now(),
  limit: number = MAX_HOT_ROOMS,
): HotRoomsResult {
  const allEvents = getLiveEvents(50);
  const cutoff = nowMs - HOT_WINDOW_MS;

  // Filter to recent events only
  const recentEvents = allEvents.filter(e => e.timestamp >= cutoff);

  // Group by roomId
  const byRoom = new Map<string, LiveEvent[]>();
  for (const ev of recentEvents) {
    if (!ev.roomId) continue;
    if (!byRoom.has(ev.roomId)) byRoom.set(ev.roomId, []);
    byRoom.get(ev.roomId)!.push(ev);
  }

  // Build HotRoom objects for rooms above threshold
  const hotRooms: HotRoom[] = [];

  for (const [roomId, events] of byRoom) {
    if (events.length < HOT_THRESHOLD) continue;

    const roomName = events[0]?.roomName || roomId;
    const typeCounts = countBy(events.map(e => e.type));
    const dominantType = maxByCount(typeCounts) as LiveEventType | null;

    const agentNames = dedupeStr(events.map(e => e.agentName || '').filter(Boolean));
    const topAgents = agentNames.slice(0, 3);

    const headline = buildHeadline(roomName, events, topAgents, dominantType);
    const hotScore = computeHotScore(events, nowMs);
    const windowMinutes = HOT_WINDOW_MS / 60_000;
    const eventsPerMinute = Math.round((events.length / windowMinutes) * 10) / 10;

    hotRooms.push({
      roomId,
      roomName,
      eventCount: events.length,
      eventsPerMinute,
      topAgents,
      headline,
      dominantType,
      hotScore,
    });
  }

  // Sort by hotScore descending
  hotRooms.sort((a, b) => b.hotScore - a.hotScore);

  return {
    rooms: hotRooms.slice(0, limit),
    totalHotRooms: hotRooms.length,
    snapshotMs: HOT_WINDOW_MS,
    generatedAt: new Date(nowMs).toISOString(),
  };
}
