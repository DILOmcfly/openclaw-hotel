/**
 * T-369: Activity Pulse — Live Room Activity Gauge
 *
 * Tracks room events over a rolling 60-second window and exposes
 * a heat level used to drive the HUD visual pulse indicator.
 *
 * Heat levels:
 *   quiet    (blue)   — 0–4 events/min
 *   moderate (green)  — 5–14 events/min
 *   busy     (orange) — 15–29 events/min
 *   hot      (red)    — 30+ events/min
 */

export type HeatLevel = 'quiet' | 'moderate' | 'busy' | 'hot';

export interface PulseSnapshot {
  eventsPerMinute: number;
  heatLevel: HeatLevel;
  eventCount: number;
}

export class ActivityPulseTracker {
  /** Rolling window in milliseconds (default: 60 000 ms = 60 s) */
  private readonly windowMs: number;

  /** Timestamps of recorded events (ms since epoch) */
  private timestamps: number[] = [];

  /** Injectable clock — defaults to Date.now, overridable in tests */
  private readonly now: () => number;

  constructor(windowMs = 60_000, now: () => number = Date.now) {
    if (windowMs <= 0) throw new RangeError('windowMs must be > 0');
    this.windowMs = windowMs;
    this.now = now;
  }

  // ─── Core API ────────────────────────────────────────────────────────────────

  /**
   * Record a room event at the current (or injected) time.
   */
  recordEvent(): void {
    const ts = this.now();
    this.timestamps.push(ts);
    this.prune(ts);
  }

  /**
   * Returns the number of events in the current rolling window.
   */
  getEventsPerMinute(): number {
    this.prune(this.now());
    return this.timestamps.length;
  }

  /**
   * Returns the qualitative heat level based on events/min.
   */
  getHeatLevel(): HeatLevel {
    const epm = this.getEventsPerMinute();
    if (epm >= 30) return 'hot';
    if (epm >= 15) return 'busy';
    if (epm >= 5)  return 'moderate';
    return 'quiet';
  }

  /**
   * Returns a combined snapshot: eventsPerMinute, heatLevel, eventCount.
   */
  getSnapshot(): PulseSnapshot {
    const eventsPerMinute = this.getEventsPerMinute();
    return {
      eventsPerMinute,
      heatLevel: this.getHeatLevel(),
      eventCount: eventsPerMinute,
    };
  }

  /**
   * Clears all recorded events.
   */
  reset(): void {
    this.timestamps = [];
  }

  // ─── Heat-level thresholds (static helpers) ──────────────────────────────────

  static readonly THRESHOLDS = {
    quiet:    { min: 0,  max: 4  },
    moderate: { min: 5,  max: 14 },
    busy:     { min: 15, max: 29 },
    hot:      { min: 30, max: Infinity },
  } as const;

  /**
   * Returns the CSS color associated with a heat level.
   */
  static colorForLevel(level: HeatLevel): string {
    switch (level) {
      case 'quiet':    return '#3b82f6'; // blue-500
      case 'moderate': return '#22c55e'; // green-500
      case 'busy':     return '#f97316'; // orange-500
      case 'hot':      return '#ef4444'; // red-500
    }
  }

  /**
   * Returns the animation duration (in ms) for the CSS pulse at a given level.
   * Faster pulse = higher activity.
   */
  static pulseDurationMs(level: HeatLevel): number {
    switch (level) {
      case 'quiet':    return 2400;
      case 'moderate': return 1600;
      case 'busy':     return 1000;
      case 'hot':      return 600;
    }
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  /** Remove timestamps older than the rolling window. */
  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    // timestamps are push-ordered; prune from the front
    let i = 0;
    while (i < this.timestamps.length && this.timestamps[i] <= cutoff) i++;
    if (i > 0) this.timestamps = this.timestamps.slice(i);
  }
}
