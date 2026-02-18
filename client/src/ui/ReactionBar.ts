/**
 * ReactionBar.ts — T-360: Spectator Emoji Reactions
 *
 * Renders a horizontal bar of 6 emoji buttons for spectators.
 * Clicking an emoji sends a `spectator.reaction` event over the
 * provided WebSocket connection and spawns a FloatingReaction on screen.
 *
 * Pure-logic constants/helpers are exported for unit tests (no DOM required).
 */

// ── Exported constants (testable without DOM) ───────────────────────────────

/** Ordered list of emojis available in the reaction bar */
export const REACTION_EMOJIS: readonly string[] = ['❤️', '😂', '🔥', '👏', '😮', '💀'];

/** Maximum reactions allowed per rate-limit window */
export const REACTION_RATE_LIMIT = 3;

/** Rate-limit window in milliseconds */
export const REACTION_RATE_WINDOW = 5_000;

/** Maximum label length (emoji display label on button tooltip) */
export const MAX_LABEL_LENGTH = 32;

// ── Pure-logic helpers (exported for unit tests) ─────────────────────────────

/**
 * Returns true if `emoji` is one of the allowed reaction emojis.
 */
export function isValidEmoji(emoji: string): boolean {
  return REACTION_EMOJIS.includes(emoji);
}

/**
 * Build the JSON payload sent over WebSocket when a reaction fires.
 */
export function buildReactionPayload(
  emoji: string,
  roomId: string,
): { type: string; emoji: string; roomId: string; timestamp: number } {
  return {
    type: 'spectator.reaction',
    emoji,
    roomId,
    timestamp: Date.now(),
  };
}

/**
 * Client-side reaction rate limiter.
 * Returns true if the reaction is allowed, false if rate-limited.
 * Keeps a sliding window of timestamps.
 *
 * @param timestamps - mutable array of past reaction timestamps (mutated in-place)
 * @param now        - current time in ms (injectable for tests)
 */
export function clientRateCheck(
  timestamps: number[],
  now: number = Date.now(),
): boolean {
  const cutoff = now - REACTION_RATE_WINDOW;

  // Prune stale entries in-place
  let i = 0;
  while (i < timestamps.length && timestamps[i] < cutoff) i++;
  timestamps.splice(0, i);

  if (timestamps.length >= REACTION_RATE_LIMIT) {
    return false;
  }

  timestamps.push(now);
  return true;
}

/**
 * Compute the number of milliseconds until the next reaction is allowed.
 * Returns 0 if a reaction is allowed right now.
 */
export function msTillNextReaction(
  timestamps: number[],
  now: number = Date.now(),
): number {
  const cutoff = now - REACTION_RATE_WINDOW;
  const active = timestamps.filter(t => t >= cutoff);
  if (active.length < REACTION_RATE_LIMIT) return 0;
  return active[0] + REACTION_RATE_WINDOW - now;
}

// ── DOM component ─────────────────────────────────────────────────────────────

export interface ReactionBarOptions {
  /** CSS class(es) appended to the container element */
  className?: string;
  /**
   * Callback invoked when a valid, non-rate-limited emoji is clicked.
   * Use this to trigger FloatingReaction or any other visual effect.
   */
  onReaction?: (emoji: string) => void;
  /**
   * Callback invoked when a click is rejected by the client-side rate limiter.
   * Receives ms until the next reaction is allowed.
   */
  onRateLimited?: (retryAfterMs: number) => void;
}

/**
 * A horizontal bar of 6 emoji reaction buttons for spectators.
 *
 * Usage:
 *   const bar = new ReactionBar(ws, 'room-42', container);
 *   // Clicking ❤️ sends spectator.reaction over ws and calls onReaction?.
 */
export class ReactionBar {
  private container: HTMLElement;
  private ws: { send(data: string): void; readyState: number } | null;
  private roomId: string;
  private onReaction: ((emoji: string) => void) | null;
  private onRateLimited: ((ms: number) => void) | null;
  private reactionTimestamps: number[] = [];
  private _destroyed = false;
  private buttons: HTMLButtonElement[] = [];
  private element: HTMLElement;

  constructor(
    ws: { send(data: string): void; readyState: number } | null,
    roomId: string,
    container: HTMLElement,
    options: ReactionBarOptions = {},
  ) {
    this.ws = ws;
    this.roomId = roomId;
    this.container = container;
    this.onReaction = options.onReaction ?? null;
    this.onRateLimited = options.onRateLimited ?? null;

    // Build wrapper element
    this.element = document.createElement('div');
    this.element.className = ['reaction-bar', options.className]
      .filter(Boolean)
      .join(' ');
    Object.assign(this.element.style, {
      display:        'flex',
      flexDirection:  'row',
      gap:            '8px',
      padding:        '8px 12px',
      background:     'rgba(0,0,0,0.55)',
      borderRadius:   '24px',
      backdropFilter: 'blur(4px)',
      userSelect:     'none',
    } as Partial<CSSStyleDeclaration>);

    // Build one button per emoji
    for (const emoji of REACTION_EMOJIS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = emoji;
      btn.setAttribute('aria-label', `React with ${emoji}`);
      btn.setAttribute('data-emoji', emoji);
      Object.assign(btn.style, {
        background:  'none',
        border:      'none',
        fontSize:    '24px',
        cursor:      'pointer',
        padding:     '4px',
        lineHeight:  '1',
        transition:  'transform 0.1s ease',
        borderRadius: '50%',
      } as Partial<CSSStyleDeclaration>);

      btn.addEventListener('click', () => this.handleClick(emoji));
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.25)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });

      this.element.appendChild(btn);
      this.buttons.push(btn);
    }

    container.appendChild(this.element);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private handleClick(emoji: string): void {
    if (this._destroyed) return;

    const now = Date.now();
    const allowed = clientRateCheck(this.reactionTimestamps, now);

    if (!allowed) {
      const wait = msTillNextReaction(this.reactionTimestamps, now);
      this.onRateLimited?.(wait);
      this.flashRateLimited();
      return;
    }

    // Send over WebSocket if connected
    if (this.ws && this.ws.readyState === 1 /* OPEN */) {
      const payload = buildReactionPayload(emoji, this.roomId);
      this.ws.send(JSON.stringify(payload));
    }

    this.onReaction?.(emoji);
  }

  /** Brief visual feedback when rate-limited */
  private flashRateLimited(): void {
    this.element.style.opacity = '0.4';
    setTimeout(() => {
      if (!this._destroyed) {
        this.element.style.opacity = '';
      }
    }, 400);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Remove the bar from the DOM and prevent further interactions */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this.element.parentNode) {
      this.element.remove();
    }
  }

  isDestroyed(): boolean {
    return this._destroyed;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  getButtons(): HTMLButtonElement[] {
    return [...this.buttons];
  }

  /** How many valid reactions remain in the current window */
  remainingReactions(now: number = Date.now()): number {
    const cutoff = now - REACTION_RATE_WINDOW;
    const active = this.reactionTimestamps.filter(t => t >= cutoff);
    return Math.max(0, REACTION_RATE_LIMIT - active.length);
  }

  /** Inject a fake ws (useful for testing) */
  setWs(ws: { send(data: string): void; readyState: number } | null): void {
    this.ws = ws;
  }
}
