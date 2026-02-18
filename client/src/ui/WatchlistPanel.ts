/**
 * WatchlistPanel.ts — T-365: Agent Watchlist System
 *
 * A collapsible sidebar panel showing the spectator's followed agents.
 * Each entry shows:
 *   - Agent name + avatar color swatch
 *   - Last known activity (kind + summary)
 *   - "Go watch" button → navigate to that agent's room
 *   - "Unwatch" button (×)
 *
 * A live badge pulses when a watched agent is active.
 *
 * Pure helper functions are exported for unit testing.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatchedAgent {
  agentId: string;
  displayName: string;
  avatarColor: string;
  lastEvent?: {
    kind: string;
    summary: string;
    roomId: string;
    at: string;
  };
}

export interface WatchlistState {
  spectatorId: string;
  agents: WatchedAgent[];
  /** True when the panel is expanded */
  expanded: boolean;
  /** Count of unseen alerts since last opened */
  unseenCount: number;
}

export interface WatchlistAlertMsg {
  type: 'watchlist.alert';
  agentId: string;
  kind: string;
  summary: string;
  roomId: string;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const WATCHLIST_KIND_ICONS: Record<string, string> = {
  chat:        '💬',
  move:        '🚶',
  trade:       '🤝',
  achievement: '🏆',
  emote:       '🎭',
};

export const WATCHLIST_KIND_LABELS: Record<string, string> = {
  chat:        'chatted',
  move:        'moved',
  trade:       'traded',
  achievement: 'earned badge',
  emote:       'emoted',
};

/** Maximum display name length before truncation */
export const MAX_DISPLAY_NAME_LEN = 18;

/** Maximum summary length in the panel */
export const MAX_SUMMARY_LEN = 50;

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

/** Truncate a string to maxLen, appending '…' if cut. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

/** Get icon + label for a watchlist event kind. */
export function getKindMeta(kind: string): { icon: string; label: string } {
  return {
    icon:  WATCHLIST_KIND_ICONS[kind]  ?? '•',
    label: WATCHLIST_KIND_LABELS[kind] ?? kind,
  };
}

/** Format the age of a timestamp (e.g. "just now", "2m ago"). */
export function formatAge(isoTs: string, now: number = Date.now()): string {
  const delta = now - new Date(isoTs).getTime();
  if (delta < 0)       return 'just now';
  if (delta < 60_000)  return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

/**
 * Generate a unique-enough spectatorId for local state
 * (persistent across page refreshes via localStorage).
 */
export function getOrCreateSpectatorId(): string {
  const stored = typeof localStorage !== 'undefined'
    ? localStorage.getItem('oc_spectator_id')
    : null;
  if (stored) return stored;

  const id = crypto.randomUUID();
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('oc_spectator_id', id);
  }
  return id;
}

/** Apply a watchlist.alert to an existing agent list (immutable update). */
export function applyAlert(
  agents: WatchedAgent[],
  alert: WatchlistAlertMsg,
): WatchedAgent[] {
  return agents.map(a => {
    if (a.agentId !== alert.agentId) return a;
    return {
      ...a,
      lastEvent: {
        kind:    alert.kind,
        summary: alert.summary,
        roomId:  alert.roomId,
        at:      alert.timestamp,
      },
    };
  });
}

/** Sort agents: those with recent events first, then alphabetically. */
export function sortAgents(agents: WatchedAgent[]): WatchedAgent[] {
  return [...agents].sort((a, b) => {
    const tA = a.lastEvent?.at ?? '';
    const tB = b.lastEvent?.at ?? '';
    if (tA && tB) return tB.localeCompare(tA);
    if (tA) return -1;
    if (tB) return  1;
    return a.displayName.localeCompare(b.displayName);
  });
}

// ─── WatchlistPanel class ──────────────────────────────────────────────────────

export class WatchlistPanel {
  private state: WatchlistState;
  private container!: HTMLElement;
  private onGoWatch?: (roomId: string, agentId: string) => void;
  private onUnwatch?: (agentId: string) => void;

  constructor(
    spectatorId: string,
    opts?: {
      onGoWatch?: (roomId: string, agentId: string) => void;
      onUnwatch?: (agentId: string) => void;
    },
  ) {
    this.state = {
      spectatorId,
      agents:      [],
      expanded:    false,
      unseenCount: 0,
    };
    this.onGoWatch = opts?.onGoWatch;
    this.onUnwatch = opts?.onUnwatch;
    this.mount();
  }

  /** Mount the panel into the document. */
  private mount(): void {
    if (typeof document === 'undefined') return;

    const existing = document.getElementById('watchlist-panel');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'watchlist-panel';
    this.container.className = 'watchlist-panel collapsed';
    document.body.appendChild(this.container);

    this.injectStyles();
    this.render();
  }

  /** Handle an incoming watchlist.alert WS message. */
  handleAlert(alert: WatchlistAlertMsg): void {
    this.state.agents = applyAlert(this.state.agents, alert);
    if (!this.state.expanded) {
      this.state.unseenCount++;
    }
    this.render();
    this.flashBadge();
  }

  /** Add an agent to the local list (from REST API response). */
  addAgent(agent: WatchedAgent): void {
    if (this.state.agents.some(a => a.agentId === agent.agentId)) return;
    this.state.agents = sortAgents([...this.state.agents, agent]);
    this.render();
  }

  /** Remove an agent from the local list. */
  removeAgent(agentId: string): void {
    this.state.agents = this.state.agents.filter(a => a.agentId !== agentId);
    this.render();
  }

  /** Load watchlist from REST API. */
  async loadFromApi(baseUrl = ''): Promise<void> {
    try {
      const resp = await fetch(
        `${baseUrl}/api/spectate/watchlist?spectatorId=${this.state.spectatorId}`,
      );
      if (!resp.ok) return;
      const data = await resp.json();
      this.state.agents = sortAgents(
        (data.agents ?? []).map((e: any) => ({
          agentId:     e.agentId,
          displayName: e.displayName ?? `Agent ${e.agentId.slice(0, 8)}`,
          avatarColor: e.avatarColor ?? '#4ecdc4',
          lastEvent:   e.lastEvent,
        })),
      );
      this.render();
    } catch { /* non-critical */ }
  }

  /** Toggle panel expanded/collapsed. */
  toggle(): void {
    this.state.expanded = !this.state.expanded;
    if (this.state.expanded) this.state.unseenCount = 0;
    this.render();
  }

  /** Expose current state (read-only). */
  getState(): Readonly<WatchlistState> {
    return { ...this.state, agents: [...this.state.agents] };
  }

  /** Destroy the panel. */
  destroy(): void {
    this.container?.remove();
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  private render(): void {
    if (!this.container) return;

    const { agents, expanded, unseenCount } = this.state;
    const sorted = sortAgents(agents);

    const badgeHtml = unseenCount > 0
      ? `<span class="wl-badge">${unseenCount > 9 ? '9+' : unseenCount}</span>`
      : '';

    const agentRows = sorted.map(agent => {
      const { icon, label } = getKindMeta(agent.lastEvent?.kind ?? '');
      const summary = agent.lastEvent
        ? truncate(agent.lastEvent.summary, MAX_SUMMARY_LEN)
        : 'No recent activity';
      const ageStr = agent.lastEvent
        ? formatAge(agent.lastEvent.at)
        : '';
      const roomId = agent.lastEvent?.roomId ?? '';

      return `
        <div class="wl-agent-row" data-agent-id="${agent.agentId}">
          <div class="wl-avatar" style="background:${agent.avatarColor}">
            ${agent.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div class="wl-agent-info">
            <div class="wl-agent-name">${truncate(agent.displayName, MAX_DISPLAY_NAME_LEN)}</div>
            ${agent.lastEvent ? `
              <div class="wl-last-event">
                <span class="wl-kind-icon">${icon}</span>
                <span class="wl-summary">${summary}</span>
                <span class="wl-age">${ageStr}</span>
              </div>
            ` : '<div class="wl-last-event wl-no-activity">No recent activity</div>'}
          </div>
          <div class="wl-actions">
            ${roomId ? `
              <button class="wl-go-btn" data-room-id="${roomId}" data-agent-id="${agent.agentId}" title="Go watch this agent">👁</button>
            ` : ''}
            <button class="wl-unwatch-btn" data-agent-id="${agent.agentId}" title="Stop watching">×</button>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <button class="wl-toggle-btn" id="wl-toggle">
        ★ Following (${agents.length})
        ${badgeHtml}
      </button>
      ${expanded ? `
        <div class="wl-panel-body">
          <div class="wl-header">Following Agents</div>
          ${agents.length === 0
            ? '<div class="wl-empty">No agents followed yet.<br>Click ★ on an agent profile to follow.</div>'
            : agentRows
          }
        </div>
      ` : ''}
    `;

    this.container.className = `watchlist-panel ${expanded ? 'expanded' : 'collapsed'}`;
    this.bindEvents();
  }

  private bindEvents(): void {
    const toggleBtn = this.container.querySelector('#wl-toggle');
    toggleBtn?.addEventListener('click', () => this.toggle());

    this.container.querySelectorAll('.wl-go-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const roomId  = el.dataset.roomId  ?? '';
        const agentId = el.dataset.agentId ?? '';
        if (roomId && this.onGoWatch) this.onGoWatch(roomId, agentId);
      });
    });

    this.container.querySelectorAll('.wl-unwatch-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const el = e.currentTarget as HTMLElement;
        const agentId = el.dataset.agentId ?? '';
        if (!agentId) return;

        try {
          await fetch(
            `/api/spectate/watchlist/${agentId}?spectatorId=${this.state.spectatorId}`,
            { method: 'DELETE' },
          );
        } catch { /* best-effort */ }

        this.removeAgent(agentId);
        if (this.onUnwatch) this.onUnwatch(agentId);
      });
    });
  }

  private flashBadge(): void {
    this.container.classList.add('wl-flash');
    setTimeout(() => this.container.classList.remove('wl-flash'), 600);
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  private injectStyles(): void {
    if (document.getElementById('wl-styles')) return;
    const style = document.createElement('style');
    style.id = 'wl-styles';
    style.textContent = `
      .watchlist-panel {
        position: fixed;
        bottom: 60px;
        right: 12px;
        z-index: 400;
        font-family: 'Press Start 2P', 'Courier New', monospace;
        font-size: 10px;
        max-width: 280px;
      }

      .wl-toggle-btn {
        background: rgba(20,20,30,0.92);
        color: #ffd700;
        border: 1px solid #ffd700;
        border-radius: 4px;
        padding: 6px 10px;
        cursor: pointer;
        font-family: inherit;
        font-size: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: background 0.2s;
      }

      .wl-toggle-btn:hover {
        background: rgba(40,40,60,0.95);
      }

      .wl-badge {
        background: #ff4444;
        color: #fff;
        border-radius: 50%;
        padding: 2px 5px;
        font-size: 9px;
        min-width: 16px;
        text-align: center;
      }

      .wl-panel-body {
        background: rgba(15,15,25,0.96);
        border: 1px solid #333;
        border-radius: 4px;
        margin-bottom: 4px;
        max-height: 320px;
        overflow-y: auto;
      }

      .wl-header {
        padding: 8px 10px;
        color: #ffd700;
        border-bottom: 1px solid #333;
        font-size: 9px;
      }

      .wl-empty {
        padding: 16px 10px;
        color: #666;
        text-align: center;
        line-height: 1.8;
        font-size: 9px;
      }

      .wl-agent-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px;
        border-bottom: 1px solid #1a1a2a;
        transition: background 0.15s;
      }

      .wl-agent-row:hover {
        background: rgba(255,215,0,0.05);
      }

      .wl-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        color: #fff;
        flex-shrink: 0;
      }

      .wl-agent-info {
        flex: 1;
        min-width: 0;
      }

      .wl-agent-name {
        color: #e0e0e0;
        font-size: 9px;
        margin-bottom: 3px;
      }

      .wl-last-event {
        display: flex;
        gap: 4px;
        align-items: center;
        color: #888;
        font-size: 8px;
        flex-wrap: wrap;
      }

      .wl-no-activity { color: #444; }

      .wl-kind-icon { font-size: 10px; }
      .wl-summary { color: #aaa; flex: 1; }
      .wl-age { color: #555; flex-shrink: 0; }

      .wl-actions {
        display: flex;
        flex-direction: column;
        gap: 3px;
        flex-shrink: 0;
      }

      .wl-go-btn, .wl-unwatch-btn {
        background: rgba(40,40,60,0.9);
        border: 1px solid #333;
        border-radius: 3px;
        color: #aaa;
        cursor: pointer;
        padding: 3px 5px;
        font-size: 9px;
        transition: all 0.15s;
      }

      .wl-go-btn:hover { border-color: #4ecdc4; color: #4ecdc4; }
      .wl-unwatch-btn:hover { border-color: #ff4444; color: #ff4444; }

      @keyframes wl-flash {
        0%, 100% { box-shadow: none; }
        50% { box-shadow: 0 0 8px 2px #ffd700; }
      }

      .wl-flash .wl-toggle-btn {
        animation: wl-flash 0.6s ease-in-out;
      }
    `;
    document.head.appendChild(style);
  }
}
