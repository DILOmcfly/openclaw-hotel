/**
 * heatmapService.ts
 * T-364 — Room Activity Heatmap Overlay
 *
 * Pure functions for tracking agent activity density per tile.
 * Rolling 5-minute window with automatic pruning of stale entries.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'move'
  | 'chat'
  | 'emote'
  | 'trade'
  | 'interact'
  | 'idle';

export interface ActivityEvent {
  tileX: number;
  tileY: number;
  type: ActivityType;
  timestamp: number;
  roomId: string;
}

export interface HeatmapCell {
  tileX: number;
  tileY: number;
  count: number;
  intensity: number; // 0–1 normalised
  color: string;     // rgba string
}

export interface HeatmapGrid {
  roomId: string;
  cells: HeatmapCell[];
  maxCount: number;
  generatedAt: number;
}

// ─── Internal store (module-level singleton) ──────────────────────────────────

/** All activity events, keyed by roomId */
const _store: Map<string, ActivityEvent[]> = new Map();

/** Rolling window duration in ms (5 minutes) */
export const WINDOW_MS = 5 * 60 * 1000;

// ─── Core pure helpers ────────────────────────────────────────────────────────

/**
 * Returns the current timestamp in ms. Overridable in tests via dependency injection.
 */
export type NowFn = () => number;
const defaultNow: NowFn = () => Date.now();

/**
 * Prune events older than WINDOW_MS from an array of events.
 * Returns a new array (pure).
 */
export function pruneOldEvents(events: ActivityEvent[], now: number = defaultNow()): ActivityEvent[] {
  const cutoff = now - WINDOW_MS;
  return events.filter((e) => e.timestamp >= cutoff);
}

/**
 * Track an activity event for a tile in a room.
 * Mutates the internal store (side-effectful, but contained).
 */
export function trackActivity(
  roomId: string,
  tileX: number,
  tileY: number,
  type: ActivityType,
  now: NowFn = defaultNow
): void {
  const event: ActivityEvent = { roomId, tileX, tileY, type, timestamp: now() };
  const existing = _store.get(roomId) ?? [];
  const pruned = pruneOldEvents(existing, now());
  pruned.push(event);
  _store.set(roomId, pruned);
}

/**
 * Retrieve and aggregate activity events into a HeatmapGrid.
 * Prunes stale entries before aggregation.
 */
export function getHeatmapGrid(roomId: string, now: NowFn = defaultNow): HeatmapGrid {
  const raw = _store.get(roomId) ?? [];
  const events = pruneOldEvents(raw, now());

  // Update store with pruned list
  _store.set(roomId, events);

  // Aggregate counts per tile
  const counts: Map<string, { tileX: number; tileY: number; count: number }> = new Map();
  for (const e of events) {
    const key = `${e.tileX}:${e.tileY}`;
    const entry = counts.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(key, { tileX: e.tileX, tileY: e.tileY, count: 1 });
    }
  }

  const entries = Array.from(counts.values());
  const maxCount = entries.reduce((m, e) => Math.max(m, e.count), 0);

  const cells: HeatmapCell[] = entries.map((e) => {
    const intensity = normalizeIntensity(e.count, maxCount);
    return {
      tileX: e.tileX,
      tileY: e.tileY,
      count: e.count,
      intensity,
      color: activityToColor(intensity),
    };
  });

  return { roomId, cells, maxCount, generatedAt: now() };
}

/**
 * Normalize a raw count to a 0–1 intensity value.
 * Returns 0 if max is 0 (no activity).
 */
export function normalizeIntensity(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0;
  return Math.min(count / max, 1);
}

/**
 * Map an intensity value (0–1) to an rgba color string.
 * Gradient: green (0) → yellow (0.5) → red (1)
 * Alpha is also scaled: 0.15 (min) → 0.75 (max)
 */
export function activityToColor(intensity: number): string {
  const t = Math.max(0, Math.min(1, intensity));

  let r: number, g: number, b: number;

  if (t <= 0.5) {
    // green → yellow
    const s = t / 0.5; // 0→1
    r = Math.round(s * 255);
    g = 200;
    b = 0;
  } else {
    // yellow → red
    const s = (t - 0.5) / 0.5; // 0→1
    r = 255;
    g = Math.round((1 - s) * 200);
    b = 0;
  }

  // Alpha: 0.15 at intensity 0, 0.75 at intensity 1
  const alpha = (0.15 + t * 0.60).toFixed(2);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Clear all activity data for a room.
 */
export function clearRoom(roomId: string): void {
  _store.delete(roomId);
}

/**
 * Clear ALL activity data across all rooms.
 * Primarily useful for testing.
 */
export function clearAll(): void {
  _store.clear();
}

/**
 * Return the raw (unpruned) event count for a room — for diagnostics.
 */
export function getRawEventCount(roomId: string): number {
  return (_store.get(roomId) ?? []).length;
}

/**
 * Get all room IDs currently tracked.
 */
export function getTrackedRooms(): string[] {
  return Array.from(_store.keys());
}
