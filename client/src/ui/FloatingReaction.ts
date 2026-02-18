/**
 * FloatingReaction.ts — T-360: Spectator Emoji Reactions
 *
 * Renders a single emoji that floats upward ~100px over 1.5 seconds with
 * fade-out and a randomised x-offset of ±20px from the spawn point.
 *
 * Pure-logic constants are exported so they can be tested in node env
 * without any DOM dependency.
 */

// ── Exported constants (testable without DOM) ───────────────────────────────

/** Vertical rise distance in pixels */
export const FLOAT_DISTANCE = 100;

/** Total animation duration in milliseconds */
export const FLOAT_DURATION = 1500;

/** Maximum x-offset in either direction (pixels) */
export const X_OFFSET_RANGE = 20;

// ── Pure-logic helpers (also exported for unit tests) ───────────────────────

/**
 * Calculate the current Y position given elapsed progress (0..1).
 * Returns startY − (progress × FLOAT_DISTANCE).
 */
export function calcFloatY(startY: number, progress: number): number {
  return startY - FLOAT_DISTANCE * progress;
}

/**
 * Calculate opacity given elapsed progress (0..1).
 * Starts at 1, linearly reaches 0.
 */
export function calcOpacity(progress: number): number {
  return Math.max(0, 1 - progress);
}

/**
 * Clamp progress to [0, 1].
 */
export function clampProgress(elapsed: number, duration: number): number {
  return Math.min(1, Math.max(0, elapsed / duration));
}

/**
 * Generate a random x-offset in the range [−X_OFFSET_RANGE, +X_OFFSET_RANGE].
 * A `rand` parameter (defaults to Math.random) lets tests pass a seed.
 */
export function randomXOffset(rand: () => number = Math.random): number {
  return (rand() * 2 - 1) * X_OFFSET_RANGE;
}

// ── DOM component ────────────────────────────────────────────────────────────

export interface FloatingReactionOptions {
  onComplete?: () => void;
  /** Override Math.random for deterministic x-offset in tests */
  rand?: () => number;
}

/**
 * A single floating emoji reaction.
 *
 * Usage:
 *   const fr = new FloatingReaction('🔥', containerEl, clickX, clickY);
 *   // It animates and removes itself automatically.
 */
export class FloatingReaction {
  private element: HTMLElement;
  private container: HTMLElement;
  private spawnX: number;
  private spawnY: number;
  private startTime: number | null = null;
  private rafId: number | null = null;
  private onComplete: (() => void) | null;
  private _destroyed = false;

  constructor(
    emoji: string,
    container: HTMLElement,
    x: number,
    y: number,
    options: FloatingReactionOptions = {},
  ) {
    this.container = container;
    this.onComplete = options.onComplete ?? null;

    // Apply random x-offset
    const offset = randomXOffset(options.rand);
    this.spawnX = x + offset;
    this.spawnY = y;

    // Build DOM element
    this.element = document.createElement('div');
    this.element.className = 'floating-reaction';
    this.element.setAttribute('aria-hidden', 'true');
    Object.assign(this.element.style, {
      position:      'absolute',
      left:          `${this.spawnX}px`,
      top:           `${this.spawnY}px`,
      fontSize:      '28px',
      lineHeight:    '1',
      pointerEvents: 'none',
      userSelect:    'none',
      zIndex:        '9999',
      opacity:       '1',
      willChange:    'top, opacity',
    } as CSSStyleDeclaration);
    this.element.textContent = emoji;

    container.appendChild(this.element);
    this.scheduleFrame();
  }

  // ── Animation ─────────────────────────────────────────────────────────────

  private scheduleFrame(): void {
    this.rafId = requestAnimationFrame((now) => {
      if (this._destroyed) return;
      if (this.startTime === null) this.startTime = now;

      const elapsed  = now - this.startTime;
      const progress = clampProgress(elapsed, FLOAT_DURATION);

      this.element.style.top     = `${calcFloatY(this.spawnY, progress)}px`;
      this.element.style.opacity = `${calcOpacity(progress)}`;

      if (progress < 1) {
        this.scheduleFrame();
      } else {
        this.destroy();
        this.onComplete?.();
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Force-destroy the reaction before animation completes */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
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

  getSpawnX(): number {
    return this.spawnX;
  }
}
