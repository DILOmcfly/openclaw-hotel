/**
 * AgentProfilePopover.ts — T-363: Agent Mini-Profile Popover
 *
 * Renders a DOM popover when a user clicks an agent in the room.
 * The popover is anchored near the agent's screen position and shows:
 *   - name + avatar color swatch
 *   - top 3 badges
 *   - current mood emoji
 *   - last 3 messages
 *   - stats (messages / trades / rooms)
 *
 * Pure-logic helpers are exported for unit testing without DOM.
 * The DOM-bound class is only instantiated when a document is available.
 *
 * Close behaviour:
 *   - Click outside the popover
 *   - Press ESC
 *   - Call .hide() programmatically
 */

// ─── Shared types (mirrors agentProfileService) ───────────────────────────────

export interface PopoverBadge {
  id: number;
  name: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
}

export interface PopoverMessage {
  id: string;
  text: string;
  sentAt: Date;
}

export interface PopoverStats {
  messageCount: number;
  tradeCount: number;
  roomCount: number;
}

export interface PopoverData {
  agentId: string;
  name: string;
  /** CSS hex color, e.g. "#4ecdc4" */
  avatarColor: string;
  badges: PopoverBadge[];
  moodEmoji: string;
  recentMessages: PopoverMessage[];
  stats: PopoverStats;
}

// ─── Positioning state ────────────────────────────────────────────────────────

export interface PopoverPosition {
  left: number;
  top: number;
}

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

/** Popover dimensions (px) used for edge-clamping */
export const POPOVER_WIDTH  = 280;
export const POPOVER_HEIGHT = 320;
/** Offset from anchor point (px) */
export const POPOVER_OFFSET_X = 16;
export const POPOVER_OFFSET_Y = -32;

/** Rarity → CSS color mapping */
export const RARITY_COLORS: Record<PopoverBadge['rarity'], string> = {
  common:    '#9b9b9b',
  uncommon:  '#4ec94e',
  rare:      '#5b8dd9',
  epic:      '#9b59b6',
  legendary: '#f39c12',
};

/**
 * Compute the { left, top } position for the popover given the agent's screen
 * position and the viewport dimensions.
 *
 * The popover prefers to open to the right and above the anchor.
 * It is clamped so it never overflows the viewport.
 */
export function computePopoverPosition(
  anchorX: number,
  anchorY: number,
  viewportWidth:  number = window?.innerWidth  ?? 1280,
  viewportHeight: number = window?.innerHeight ?? 720,
): PopoverPosition {
  let left = anchorX + POPOVER_OFFSET_X;
  let top  = anchorY + POPOVER_OFFSET_Y - POPOVER_HEIGHT;

  // Flip horizontally when too close to right edge
  if (left + POPOVER_WIDTH > viewportWidth) {
    left = anchorX - POPOVER_WIDTH - POPOVER_OFFSET_X;
  }
  // Flip vertically when too close to top edge
  if (top < 0) {
    top = anchorY + POPOVER_OFFSET_Y + 16;
  }
  // Clamp to viewport bounds
  left = Math.max(4, Math.min(left, viewportWidth  - POPOVER_WIDTH  - 4));
  top  = Math.max(4, Math.min(top,  viewportHeight - POPOVER_HEIGHT - 4));

  return { left, top };
}

/**
 * Escape unsafe HTML characters.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format a Date as a short relative label, e.g. "just now", "5 min ago".
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs  = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH   < 24)  return `${diffH} h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} d ago`;
}

/**
 * Build the inner HTML string for the popover.
 * Pure function — safe to call in Node.js for snapshot tests.
 */
export function buildPopoverHtml(data: PopoverData): string {
  const badgesHtml =
    data.badges.length === 0
      ? `<span class="apo-empty">No badges yet</span>`
      : data.badges
          .slice(0, 3)
          .map(
            (b) => `
          <span
            class="apo-badge"
            title="${escapeHtml(b.name)}: ${escapeHtml(b.description)}"
            style="color:${RARITY_COLORS[b.rarity] ?? '#fff'}"
          >${escapeHtml(b.icon)}</span>`,
          )
          .join('');

  const messagesHtml =
    data.recentMessages.length === 0
      ? `<li class="apo-empty">No messages yet</li>`
      : data.recentMessages
          .slice(0, 3)
          .map(
            (m) => `
          <li class="apo-msg-item">
            <span class="apo-msg-text">${escapeHtml(m.text)}</span>
            <time class="apo-msg-time" datetime="${m.sentAt.toISOString()}">${formatRelativeTime(m.sentAt)}</time>
          </li>`,
          )
          .join('');

  return `
    <div class="apo-header">
      <span
        class="apo-avatar-swatch"
        style="background:${escapeHtml(data.avatarColor)}"
        aria-hidden="true"
      ></span>
      <div class="apo-name-block">
        <span class="apo-name">${escapeHtml(data.name)}</span>
        <span class="apo-mood" title="Current mood">${escapeHtml(data.moodEmoji)}</span>
      </div>
      <button class="apo-close" aria-label="Close profile popover">×</button>
    </div>

    <div class="apo-badges-row" aria-label="Badges">
      ${badgesHtml}
    </div>

    <section class="apo-messages" aria-label="Recent messages">
      <h4 class="apo-section-title">Recent</h4>
      <ul class="apo-msg-list">${messagesHtml}</ul>
    </section>

    <section class="apo-stats" aria-label="Agent stats">
      <div class="apo-stat" title="Total chat messages">
        <span class="apo-stat-icon">💬</span>
        <span class="apo-stat-val">${data.stats.messageCount}</span>
      </div>
      <div class="apo-stat" title="Completed trades">
        <span class="apo-stat-icon">🤝</span>
        <span class="apo-stat-val">${data.stats.tradeCount}</span>
      </div>
      <div class="apo-stat" title="Rooms visited">
        <span class="apo-stat-icon">🏠</span>
        <span class="apo-stat-val">${data.stats.roomCount}</span>
      </div>
    </section>
  `.trim();
}

// ─── Popover state machine (pure, no DOM) ─────────────────────────────────────

export type PopoverState =
  | { visible: false; agentId: null }
  | { visible: true;  agentId: string; position: PopoverPosition; data: PopoverData };

/** Create the initial hidden state. */
export function createPopoverState(): PopoverState {
  return { visible: false, agentId: null };
}

/** Transition to visible with data and position. */
export function showState(
  state: PopoverState,
  agentId: string,
  data: PopoverData,
  position: PopoverPosition,
): PopoverState {
  // Opening same agent: just update position / data
  return { visible: true, agentId, position, data };
}

/** Transition to hidden. */
export function hideState(_state: PopoverState): PopoverState {
  return { visible: false, agentId: null };
}

/** Returns true when the given agentId is the currently shown popover. */
export function isShowingAgent(state: PopoverState, agentId: string): boolean {
  return state.visible && state.agentId === agentId;
}

// ─── DOM-bound class ──────────────────────────────────────────────────────────

export class AgentProfilePopover {
  private el: HTMLElement;
  private state: PopoverState = createPopoverState();

  /** Fired when user clicks the popover's close button (or outside). */
  public onClose?: () => void;

  constructor() {
    this.el = this.createElement();
    document.body.appendChild(this.el);
    this.attachGlobalListeners();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private createElement(): HTMLElement {
    const el = document.createElement('div');
    el.id          = 'agent-profile-popover';
    el.className   = 'apo-popover hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Agent profile');
    el.setAttribute('aria-modal', 'false');
    return el;
  }

  private attachGlobalListeners(): void {
    // Outside click
    document.addEventListener('mousedown', this.handleDocumentClick, true);
    // ESC key
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  private handleDocumentClick = (e: MouseEvent): void => {
    if (!this.state.visible) return;
    if (this.el.contains(e.target as Node)) return;
    this.hide();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.state.visible) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.hide();
    }
  };

  private handleCloseBtn = (e: MouseEvent): void => {
    e.stopPropagation();
    this.hide();
  };

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Show the popover for `agentId` at the given screen coordinates.
   */
  public show(
    agentId: string,
    data: PopoverData,
    anchorX: number,
    anchorY: number,
  ): void {
    const position = computePopoverPosition(anchorX, anchorY);
    this.state = showState(this.state, agentId, data, position);

    // Render
    this.el.innerHTML = buildPopoverHtml(data);
    this.el.style.left = `${position.left}px`;
    this.el.style.top  = `${position.top}px`;
    this.el.classList.remove('hidden');
    this.el.setAttribute('aria-hidden', 'false');

    // Wire close button
    const closeBtn = this.el.querySelector('.apo-close');
    closeBtn?.addEventListener('click', this.handleCloseBtn);
  }

  /**
   * Hide the popover.
   */
  public hide(): void {
    this.state = hideState(this.state);
    this.el.classList.add('hidden');
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = '';
    this.onClose?.();
  }

  /**
   * Toggle: show if hidden, hide if already showing this agent.
   */
  public toggle(
    agentId: string,
    data: PopoverData,
    anchorX: number,
    anchorY: number,
  ): void {
    if (isShowingAgent(this.state, agentId)) {
      this.hide();
    } else {
      this.show(agentId, data, anchorX, anchorY);
    }
  }

  /** Returns true when the popover is currently visible. */
  public get isVisible(): boolean {
    return this.state.visible;
  }

  /** Returns the agentId currently shown, or null. */
  public get currentAgentId(): string | null {
    return this.state.visible ? this.state.agentId : null;
  }

  /**
   * Remove the popover element from the DOM and unbind all listeners.
   * Call this when the room view is destroyed.
   */
  public destroy(): void {
    this.hide();
    document.removeEventListener('mousedown', this.handleDocumentClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    this.el.remove();
  }
}
