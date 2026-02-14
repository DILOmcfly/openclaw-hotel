/**
 * LeaderboardPanel.ts
 * Leaderboard rankings interface for OpenClaw Hotel
 */

export type LeaderboardCategory = 'coins' | 'trades' | 'friends' | 'achievements' | 'games_won' | 'top_rated_rooms';

export type LeaderboardEntry = {
  rank: number;
  agentId: string;
  displayName: string;
  value: number;
  roomId?: string; // For top_rated_rooms category
  roomName?: string; // For top_rated_rooms category
  ratingCount?: number; // For top_rated_rooms category
};

export class LeaderboardPanel {
  private container!: HTMLElement;
  private currentCategory: LeaderboardCategory = 'coins';
  private entries: LeaderboardEntry[] = [];
  private currentAgentId: string = '';

  public onCategoryChange?: (category: LeaderboardCategory) => void;
  public onJoinRoom?: (roomId: string) => void;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('leaderboard-panel');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'leaderboard-panel';
    container.className = 'leaderboard-panel hidden';
    container.innerHTML = `
      <div class="panel-header">
        <h3>🏆 Leaderboard</h3>
        <button class="panel-close" id="leaderboard-close">×</button>
      </div>
      
      <div class="panel-tabs">
        <button class="panel-tab active" data-category="coins" title="Top coin holders">
          🪙 Coins
        </button>
        <button class="panel-tab" data-category="trades" title="Most trades completed">
          🤝 Trades
        </button>
        <button class="panel-tab" data-category="friends" title="Most friends made">
          👥 Friends
        </button>
        <button class="panel-tab" data-category="achievements" title="Most achievements unlocked">
          🏅 Achievements
        </button>
        <button class="panel-tab" data-category="games_won" title="Most games won">
          🎮 Games
        </button>
        <button class="panel-tab" data-category="top_rated_rooms" title="Highest rated rooms">
          ⭐ Rooms
        </button>
      </div>

      <div class="leaderboard-content">
        <div class="leaderboard-list" id="leaderboard-list">
          <div class="loading">Loading rankings...</div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.attachListeners();
  }

  private attachListeners(): void {
    const closeBtn = document.getElementById('leaderboard-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Tab switching
    const tabs = this.container.querySelectorAll('.panel-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const category = tab.getAttribute('data-category') as LeaderboardCategory;
        this.switchCategory(category);
      });
    });
  }

  private switchCategory(category: LeaderboardCategory): void {
    this.currentCategory = category;

    // Update tab buttons
    const tabs = this.container.querySelectorAll('.panel-tab');
    tabs.forEach(t => {
      const tabCategory = t.getAttribute('data-category');
      t.classList.toggle('active', tabCategory === category);
    });

    // Trigger callback to load new data
    this.onCategoryChange?.(category);
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

  public setEntries(entries: LeaderboardEntry[]): void {
    this.entries = entries;
    this.renderLeaderboard();
  }

  public showLoading(): void {
    const listContainer = document.getElementById('leaderboard-list');
    if (listContainer) {
      listContainer.innerHTML = '<div class="loading">Loading rankings...</div>';
    }
  }

  public showEmpty(): void {
    const listContainer = document.getElementById('leaderboard-list');
    if (listContainer) {
      listContainer.innerHTML = '<div class="empty-state">No rankings available yet</div>';
    }
  }

  private renderLeaderboard(): void {
    const listContainer = document.getElementById('leaderboard-list');
    if (!listContainer) return;

    if (this.entries.length === 0) {
      this.showEmpty();
      return;
    }

    listContainer.innerHTML = this.entries.map(entry => {
      const isCurrentUser = entry.agentId === this.currentAgentId;
      const medal = this.getMedal(entry.rank);

      // Special rendering for top_rated_rooms
      if (this.currentCategory === 'top_rated_rooms' && entry.roomId && entry.roomName) {
        const stars = this.renderStars(entry.value);
        return `
          <div class="leaderboard-item room-item" data-rank="${entry.rank}">
            <div class="rank-badge ${medal ? 'medal' : ''}">
              ${medal || `#${entry.rank}`}
            </div>
            <div class="leaderboard-info room-info">
              <span class="room-name">${this.escapeHtml(entry.roomName)}</span>
              <span class="room-owner">by ${this.escapeHtml(entry.displayName)}</span>
              <span class="room-rating">${stars} (${entry.ratingCount} rating${entry.ratingCount !== 1 ? 's' : ''})</span>
            </div>
            <div class="leaderboard-value">
              <button class="join-room-btn" data-room-id="${entry.roomId}">Join</button>
            </div>
          </div>
        `;
      }

      // Default rendering for other categories
      const valueLabel = this.getValueLabel(entry.value);
      return `
        <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}" data-rank="${entry.rank}">
          <div class="rank-badge ${medal ? 'medal' : ''}">
            ${medal || `#${entry.rank}`}
          </div>
          <div class="leaderboard-info">
            <span class="player-name">${this.escapeHtml(entry.displayName)}</span>
            ${isCurrentUser ? '<span class="you-badge">YOU</span>' : ''}
          </div>
          <div class="leaderboard-value">
            ${valueLabel}
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners to join buttons
    if (this.currentCategory === 'top_rated_rooms') {
      this.attachJoinButtonListeners();
    }
  }

  private attachJoinButtonListeners(): void {
    const joinButtons = this.container.querySelectorAll('.join-room-btn');
    joinButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roomId = (e.target as HTMLElement).getAttribute('data-room-id');
        if (roomId && this.onJoinRoom) {
          this.onJoinRoom(roomId);
        }
      });
    });
  }

  private renderStars(avgRating: number): string {
    const fullStars = Math.floor(avgRating);
    const hasHalfStar = avgRating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) stars += '☆';
    stars += '☆'.repeat(emptyStars);

    return `<span class="stars">${stars}</span>`;
  }

  private getMedal(rank: number): string {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '';
    }
  }

  private getValueLabel(value: number): string {
    switch (this.currentCategory) {
      case 'coins':
        return `${value.toLocaleString()} 🪙`;
      case 'trades':
        return `${value} trade${value !== 1 ? 's' : ''}`;
      case 'friends':
        return `${value} friend${value !== 1 ? 's' : ''}`;
      case 'achievements':
        return `${value} achievement${value !== 1 ? 's' : ''}`;
      case 'games_won':
        return `${value} win${value !== 1 ? 's' : ''}`;
      case 'top_rated_rooms':
        return `${value.toFixed(1)} ⭐`;
      default:
        return value.toString();
    }
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public getCurrentCategory(): LeaderboardCategory {
    return this.currentCategory;
  }
}
