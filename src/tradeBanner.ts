/**
 * T-370: Live Trade Announcement Banner
 *
 * TradeBannerManager — Displays dramatic "DEAL STRUCK" banners when trades
 * complete. Banners auto-dismiss after 3 s; any banners arriving while one
 * is visible are queued and shown sequentially (no overlaps).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TradeItem {
  name: string;
  quantity?: number;
}

export interface BannerEntry {
  /** Unique, monotonically increasing banner id. */
  id: string;
  agentA: string;
  agentB: string;
  items?: TradeItem[];
  /** Pre-formatted headline text. */
  message: string;
  /** Unix ms timestamp recorded at show() time. */
  createdAt: number;
}

export type BannerState =
  | { status: 'idle' }
  | { status: 'showing'; current: BannerEntry; queueLength: number }
  | { status: 'dismissed'; last: BannerEntry };

// ─── TradeBannerManager ───────────────────────────────────────────────────────

export class TradeBannerManager {
  private current: BannerEntry | null = null;
  private queue: BannerEntry[] = [];
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private lastDismissed: BannerEntry | null = null;
  private idCounter = 0;
  readonly durationMs: number;

  /**
   * @param durationMs  How long each banner stays visible (default 3 000 ms).
   */
  constructor(durationMs = 3_000) {
    this.durationMs = durationMs;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Request a trade banner.
   * If no banner is currently showing it appears immediately; otherwise it
   * is appended to the queue and shown once all earlier banners have cleared.
   */
  show(agentA: string, agentB: string, items?: TradeItem[]): BannerEntry {
    const entry: BannerEntry = {
      id: `banner-${++this.idCounter}`,
      agentA,
      agentB,
      items,
      message: `DEAL STRUCK: ${agentA} ↔ ${agentB}`,
      createdAt: Date.now(),
    };

    if (this.current === null) {
      this._display(entry);
    } else {
      this.queue.push(entry);
    }

    return entry;
  }

  /**
   * Manually dismiss the current banner immediately (skips remainder of
   * auto-dismiss timer). The next queued banner (if any) is shown at once.
   * Safe to call when nothing is showing.
   */
  dismiss(): void {
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    this._advance();
  }

  /**
   * Returns a snapshot of the current banner state.
   *   'idle'      — nothing showing, queue empty, no history
   *   'showing'   — banner on screen (includes queueLength of pending items)
   *   'dismissed' — nothing showing right now but last banner is recorded
   */
  getState(): BannerState {
    if (this.current !== null) {
      return {
        status: 'showing',
        current: this.current,
        queueLength: this.queue.length,
      };
    }
    if (this.lastDismissed !== null) {
      return { status: 'dismissed', last: this.lastDismissed };
    }
    return { status: 'idle' };
  }

  /** Returns a copy of the pending queue (does not include the current banner). */
  getQueue(): BannerEntry[] {
    return [...this.queue];
  }

  /** Remove all pending banners from the queue. Does not affect the current banner. */
  clearQueue(): void {
    this.queue = [];
  }

  /** Tear down: cancel any timer, clear state. Call on cleanup / test teardown. */
  destroy(): void {
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    this.current = null;
    this.queue = [];
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _display(entry: BannerEntry): void {
    this.current = entry;
    this.dismissTimer = setTimeout(() => this._advance(), this.durationMs);
  }

  /** Called when the timer fires OR dismiss() is invoked. */
  private _advance(): void {
    if (this.current === null) return;
    this.lastDismissed = this.current;
    this.current = null;
    this.dismissTimer = null;

    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this._display(next);
    }
  }
}
