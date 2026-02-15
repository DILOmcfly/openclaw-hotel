/**
 * EventsPanel.ts
 * Competitive events interface for OpenClaw Hotel
 */

export type CompetitiveEventType = 'rps_tournament' | 'trivia' | 'room_decoration_contest';
export type CompetitiveEventStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

export type CompetitiveEvent = {
  id: string;
  name: string;
  type: CompetitiveEventType;
  status: CompetitiveEventStatus;
  startTime: string;
  endTime: string | null;
  config: any;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventLeaderboardEntry = {
  agentId: string;
  displayName: string;
  score: number;
  rank: number;
};

export class EventsPanel {
  private container!: HTMLElement;
  private events: CompetitiveEvent[] = [];
  private selectedEventId: string | null = null;
  private leaderboard: EventLeaderboardEntry[] = [];
  private currentAgentId: string = '';

  public onJoinEvent?: (eventId: string) => void;
  public onViewLeaderboard?: (eventId: string) => void;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('events-panel');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'events-panel';
    container.className = 'events-panel hidden';
    container.innerHTML = `
      <div class="panel-header">
        <h3>🏟️ Events</h3>
        <button class="panel-close" id="events-close">×</button>
      </div>

      <div class="panel-tabs">
        <button class="panel-tab active" data-view="events">
          📅 Active Events
        </button>
        <button class="panel-tab" data-view="leaderboard" id="leaderboard-tab">
          🏆 Leaderboard
        </button>
      </div>

      <div class="events-content">
        <!-- Events List View -->
        <div id="events-list-view" class="events-list-view">
          <div class="events-list" id="events-list">
            <div class="loading">Loading events...</div>
          </div>
        </div>

        <!-- Leaderboard View -->
        <div id="leaderboard-view" class="leaderboard-view hidden">
          <div class="leaderboard-header">
            <button class="back-btn" id="back-to-events">← Back</button>
            <h4 id="event-name">Event Leaderboard</h4>
          </div>
          <div class="leaderboard-list" id="event-leaderboard">
            <div class="loading">Loading leaderboard...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.attachListeners();
  }

  private attachListeners(): void {
    const closeBtn = document.getElementById('events-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Tab switching
    const tabs = this.container.querySelectorAll('.panel-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const view = tab.getAttribute('data-view');
        if (view === 'events') {
          this.showEventsView();
        }
      });
    });

    // Back button from leaderboard to events
    const backBtn = document.getElementById('back-to-events');
    backBtn?.addEventListener('click', () => this.showEventsView());
  }

  private showEventsView(): void {
    const eventsView = document.getElementById('events-list-view');
    const leaderboardView = document.getElementById('leaderboard-view');
    const tabs = this.container.querySelectorAll('.panel-tab');

    eventsView?.classList.remove('hidden');
    leaderboardView?.classList.add('hidden');

    tabs.forEach((t) => {
      const view = t.getAttribute('data-view');
      t.classList.toggle('active', view === 'events');
    });
  }

  private showLeaderboardView(eventId: string): void {
    this.selectedEventId = eventId;
    const eventsView = document.getElementById('events-list-view');
    const leaderboardView = document.getElementById('leaderboard-view');
    const tabs = this.container.querySelectorAll('.panel-tab');

    eventsView?.classList.add('hidden');
    leaderboardView?.classList.remove('hidden');

    tabs.forEach((t) => {
      const view = t.getAttribute('data-view');
      t.classList.toggle('active', view === 'leaderboard');
    });

    // Update event name in leaderboard header
    const event = this.events.find((e) => e.id === eventId);
    const eventNameEl = document.getElementById('event-name');
    if (event && eventNameEl) {
      eventNameEl.textContent = event.name;
    }

    // Trigger callback to load leaderboard data
    this.onViewLeaderboard?.(eventId);
  }

  public show(): void {
    this.container.classList.remove('hidden');
  }

  public hide(): void {
    this.container.classList.add('hidden');
  }

  public toggle(): void {
    this.container.classList.toggle('hidden');
  }

  public setCurrentAgent(agentId: string): void {
    this.currentAgentId = agentId;
  }

  public setEvents(events: CompetitiveEvent[]): void {
    this.events = events;
    this.renderEvents();
  }

  public setLeaderboard(leaderboard: EventLeaderboardEntry[]): void {
    this.leaderboard = leaderboard;
    this.renderLeaderboard();
  }

  public showLoading(): void {
    const listContainer = document.getElementById('events-list');
    if (listContainer) {
      listContainer.innerHTML = '<div class="loading">Loading events...</div>';
    }
  }

  public showEmpty(): void {
    const listContainer = document.getElementById('events-list');
    if (listContainer) {
      listContainer.innerHTML =
        '<div class="empty-state">No active events at the moment</div>';
    }
  }

  private renderEvents(): void {
    const listContainer = document.getElementById('events-list');
    if (!listContainer) return;

    if (this.events.length === 0) {
      this.showEmpty();
      return;
    }

    listContainer.innerHTML = '';

    this.events.forEach((event) => {
      const eventCard = document.createElement('div');
      eventCard.className = 'event-card';
      eventCard.innerHTML = `
        <div class="event-header">
          <h4>${this.escapeHtml(event.name)}</h4>
          <span class="event-status status-${event.status}">${event.status.toUpperCase()}</span>
        </div>
        <div class="event-details">
          <div class="event-type">${this.formatEventType(event.type)}</div>
          <div class="event-time">
            <span class="time-label">Starts:</span>
            ${this.formatDateTime(event.startTime)}
          </div>
          ${
            event.endTime
              ? `<div class="event-time">
                  <span class="time-label">Ends:</span>
                  ${this.formatDateTime(event.endTime)}
                </div>`
              : ''
          }
        </div>
        <div class="event-actions">
          <button class="btn-join" data-event-id="${event.id}" ${
            event.status !== 'scheduled' && event.status !== 'active' ? 'disabled' : ''
          }>
            ${event.status === 'active' ? 'Join Now' : 'Join Event'}
          </button>
          <button class="btn-leaderboard" data-event-id="${event.id}">
            View Leaderboard
          </button>
        </div>
      `;

      listContainer.appendChild(eventCard);

      // Attach button listeners
      const joinBtn = eventCard.querySelector('.btn-join');
      joinBtn?.addEventListener('click', () => {
        this.onJoinEvent?.(event.id);
      });

      const leaderboardBtn = eventCard.querySelector('.btn-leaderboard');
      leaderboardBtn?.addEventListener('click', () => {
        this.showLeaderboardView(event.id);
      });
    });
  }

  private renderLeaderboard(): void {
    const leaderboardContainer = document.getElementById('event-leaderboard');
    if (!leaderboardContainer) return;

    if (this.leaderboard.length === 0) {
      leaderboardContainer.innerHTML =
        '<div class="empty-state">No participants yet</div>';
      return;
    }

    leaderboardContainer.innerHTML = '';

    this.leaderboard.forEach((entry) => {
      const entryEl = document.createElement('div');
      entryEl.className = 'leaderboard-entry';

      if (entry.agentId === this.currentAgentId) {
        entryEl.classList.add('current-agent');
      }

      let medal = '';
      if (entry.rank === 1) medal = '🥇';
      else if (entry.rank === 2) medal = '🥈';
      else if (entry.rank === 3) medal = '🥉';

      entryEl.innerHTML = `
        <div class="rank">${medal || `#${entry.rank}`}</div>
        <div class="name">${this.escapeHtml(entry.displayName)}</div>
        <div class="score">${entry.score} pts</div>
      `;

      leaderboardContainer.appendChild(entryEl);
    });
  }

  private formatEventType(type: CompetitiveEventType): string {
    const typeMap: Record<CompetitiveEventType, string> = {
      rps_tournament: '✊ RPS Tournament',
      trivia: '🧠 Trivia',
      room_decoration_contest: '🎨 Decoration Contest',
    };

    return typeMap[type] || type;
  }

  private formatDateTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) {
      return 'Started';
    }

    if (diffMins < 60) {
      return `in ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }

    // Format as date/time
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
