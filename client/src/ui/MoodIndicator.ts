/**
 * MoodIndicator.ts — T-362: Agent Mood Indicators in Room View
 *
 * Renders a mood emoji in a small bubble above an agent sprite.
 * Supports smooth crossfade transitions between moods.
 *
 * Designed to be used alongside AgentRenderer (PixiJS) but all pure-logic
 * constants and helpers are exported so they can be unit-tested in Node
 * without any DOM / PIXI dependency.
 */

// ── Exported constants (testable without DOM / PIXI) ─────────────────────────

/** Vertical offset above the agent sprite anchor (pixels) */
export const INDICATOR_Y_OFFSET = -48;

/** Crossfade duration in milliseconds */
export const CROSSFADE_DURATION_MS = 600;

/** Font size of the emoji bubble (CSS px) */
export const EMOJI_FONT_SIZE = 22;

/** How long (ms) to wait before allowing a mood change (debounce) */
export const MOOD_CHANGE_DEBOUNCE_MS = 250;

// ── Mood type (mirrors moodService ActivityMood) ─────────────────────────────

export type IndicatorMood =
  | 'chatting'
  | 'trading'
  | 'excited'
  | 'bored'
  | 'tired'
  | 'happy';

export const INDICATOR_EMOJIS: Record<IndicatorMood, string> = {
  chatting: '💬',
  trading:  '🤝',
  excited:  '🤩',
  bored:    '😐',
  tired:    '😴',
  happy:    '😊',
} as const;

// ── Pure-logic helpers ────────────────────────────────────────────────────────

/**
 * Compute the crossfade alpha (0 → 1) for a transition that started
 * `elapsedMs` milliseconds ago.
 */
export function calcCrossfadeAlpha(elapsedMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs / CROSSFADE_DURATION_MS));
}

/**
 * Compute opacity of the *outgoing* mood during a crossfade.
 * Starts at 1 and reaches 0 when alpha === 1.
 */
export function calcOutgoingOpacity(alpha: number): number {
  return Math.max(0, 1 - alpha);
}

/**
 * Compute opacity of the *incoming* mood during a crossfade.
 * Starts at 0 and reaches 1 when alpha === 1.
 */
export function calcIncomingOpacity(alpha: number): number {
  return Math.min(1, alpha);
}

/**
 * Returns true when the crossfade is complete (alpha has reached 1).
 */
export function isCrossfadeComplete(alpha: number): boolean {
  return alpha >= 1;
}

/**
 * Return the emoji string for a mood identifier.
 */
export function moodToEmoji(mood: IndicatorMood): string {
  return INDICATOR_EMOJIS[mood] ?? INDICATOR_EMOJIS.happy;
}

// ── MoodIndicatorState ────────────────────────────────────────────────────────

export interface MoodIndicatorState {
  currentMood: IndicatorMood;
  pendingMood: IndicatorMood | null;
  transitionStartMs: number | null;
}

/**
 * Create a fresh indicator state (no transition in progress).
 */
export function createIndicatorState(initial: IndicatorMood = 'happy'): MoodIndicatorState {
  return { currentMood: initial, pendingMood: null, transitionStartMs: null };
}

/**
 * Request a mood change.  Returns a new state object; original is unchanged.
 * If the requested mood matches current, the state is returned as-is.
 */
export function requestMoodChange(
  state: MoodIndicatorState,
  newMood: IndicatorMood,
  now: number = Date.now(),
): MoodIndicatorState {
  if (newMood === state.currentMood && state.pendingMood === null) {
    return state;
  }
  if (newMood === state.currentMood) {
    // Cancel pending transition
    return { currentMood: state.currentMood, pendingMood: null, transitionStartMs: null };
  }
  // Start (or restart) a crossfade to the new mood
  return { currentMood: state.currentMood, pendingMood: newMood, transitionStartMs: now };
}

/**
 * Advance the indicator state by `deltaMs` milliseconds.
 * Returns a new state; original is unchanged.
 */
export function tickIndicatorState(
  state: MoodIndicatorState,
  now: number = Date.now(),
): MoodIndicatorState {
  if (state.pendingMood === null || state.transitionStartMs === null) {
    return state;
  }
  const elapsed = now - state.transitionStartMs;
  const alpha   = calcCrossfadeAlpha(elapsed);

  if (isCrossfadeComplete(alpha)) {
    // Transition finished — commit the pending mood
    return { currentMood: state.pendingMood, pendingMood: null, transitionStartMs: null };
  }

  return state; // still transitioning — no structural change yet
}

/**
 * Get the render descriptor for the current frame.
 * Returns opacity values for current and pending emoji.
 */
export function getRenderDescriptor(
  state: MoodIndicatorState,
  now: number = Date.now(),
): {
  emoji:          string;
  opacity:        number;
  pendingEmoji:   string | null;
  pendingOpacity: number;
} {
  if (state.pendingMood === null || state.transitionStartMs === null) {
    return {
      emoji:          moodToEmoji(state.currentMood),
      opacity:        1,
      pendingEmoji:   null,
      pendingOpacity: 0,
    };
  }

  const elapsed = now - state.transitionStartMs;
  const alpha   = calcCrossfadeAlpha(elapsed);

  return {
    emoji:          moodToEmoji(state.currentMood),
    opacity:        calcOutgoingOpacity(alpha),
    pendingEmoji:   moodToEmoji(state.pendingMood),
    pendingOpacity: calcIncomingOpacity(alpha),
  };
}

// ── DOM component (requires browser environment) ──────────────────────────────

export interface MoodIndicatorOptions {
  /** Extra CSS class names to apply to the root element */
  className?: string;
  /** Override crossfade duration (ms); defaults to CROSSFADE_DURATION_MS */
  crossfadeDurationMs?: number;
  /** Callback fired whenever the displayed mood changes */
  onMoodChanged?: (mood: IndicatorMood) => void;
}

/**
 * MoodIndicator — DOM widget
 *
 * Attach to an agent container element.  Call `setMood()` to transition.
 *
 * Usage:
 *   const indicator = new MoodIndicator(agentEl, { onMoodChanged: console.log });
 *   indicator.setMood('chatting');
 */
export class MoodIndicator {
  private root: HTMLElement;
  private primaryEl: HTMLElement;
  private secondaryEl: HTMLElement;

  private state: MoodIndicatorState;
  private rafId: number | null = null;
  private _destroyed = false;
  private readonly opts: Required<MoodIndicatorOptions>;

  constructor(container: HTMLElement, options: MoodIndicatorOptions = {}) {
    this.opts = {
      className: options.className ?? '',
      crossfadeDurationMs: options.crossfadeDurationMs ?? CROSSFADE_DURATION_MS,
      onMoodChanged: options.onMoodChanged ?? (() => {}),
    };

    this.state = createIndicatorState('happy');

    // Build DOM
    this.root = document.createElement('div');
    this.root.className = ['mood-indicator', this.opts.className].filter(Boolean).join(' ');
    Object.assign(this.root.style, {
      position:      'absolute',
      left:          '50%',
      transform:     'translateX(-50%)',
      bottom:        `${-INDICATOR_Y_OFFSET}px`,
      pointerEvents: 'none',
      userSelect:    'none',
      zIndex:        '100',
      width:         '32px',
      height:        '32px',
    } as Partial<CSSStyleDeclaration>);

    const sharedStyle = {
      position:   'absolute',
      left:       '0',
      top:        '0',
      width:      '100%',
      height:     '100%',
      fontSize:   `${EMOJI_FONT_SIZE}px`,
      lineHeight: '32px',
      textAlign:  'center',
      transition: `opacity ${this.opts.crossfadeDurationMs}ms ease`,
    } as Partial<CSSStyleDeclaration>;

    this.primaryEl = document.createElement('div');
    this.primaryEl.className = 'mood-emoji mood-primary';
    this.primaryEl.textContent = INDICATOR_EMOJIS.happy;
    Object.assign(this.primaryEl.style, sharedStyle);

    this.secondaryEl = document.createElement('div');
    this.secondaryEl.className = 'mood-emoji mood-secondary';
    this.secondaryEl.style.opacity = '0';
    Object.assign(this.secondaryEl.style, sharedStyle);

    this.root.appendChild(this.primaryEl);
    this.root.appendChild(this.secondaryEl);
    container.appendChild(this.root);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Transition to a new mood (crossfades over CROSSFADE_DURATION_MS) */
  setMood(mood: IndicatorMood): void {
    if (this._destroyed) return;
    if (mood === this.state.currentMood && this.state.pendingMood === null) return;

    const now = Date.now();
    this.state = requestMoodChange(this.state, mood, now);

    // Cross-fade: set secondary to incoming emoji, fade primary out
    if (this.state.pendingMood) {
      this.secondaryEl.textContent  = INDICATOR_EMOJIS[mood];
      this.primaryEl.style.opacity  = '0';
      this.secondaryEl.style.opacity = '1';

      // After transition, swap and reset
      this.rafId = window.setTimeout(() => {
        if (this._destroyed) return;
        // Commit
        this.primaryEl.textContent   = INDICATOR_EMOJIS[mood];
        this.primaryEl.style.opacity  = '1';
        this.secondaryEl.style.opacity = '0';
        this.state = tickIndicatorState(this.state, Date.now() + this.opts.crossfadeDurationMs);
        this.opts.onMoodChanged(mood);
      }, this.opts.crossfadeDurationMs) as unknown as number;
    }
  }

  /** Get the currently displayed mood */
  getCurrentMood(): IndicatorMood {
    return this.state.currentMood;
  }

  /** Show the indicator */
  show(): void {
    if (!this._destroyed) this.root.style.display = '';
  }

  /** Hide the indicator */
  hide(): void {
    if (!this._destroyed) this.root.style.display = 'none';
  }

  /** Remove from DOM and cancel any pending transitions */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this.rafId !== null) {
      clearTimeout(this.rafId);
      this.rafId = null;
    }
    if (this.root.parentNode) this.root.remove();
  }

  isDestroyed(): boolean {
    return this._destroyed;
  }

  getElement(): HTMLElement {
    return this.root;
  }
}
