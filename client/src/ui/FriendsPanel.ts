/**
 * FriendsPanel.ts
 * Friends list and management interface for OpenClaw Hotel
 */

export type Friend = {
  id: string;
  agentId: string;
  displayName: string;
  isOnline: boolean;
};

export type PendingRequest = {
  id: string;
  requesterId: string;
  requesterName: string;
  createdAt: string;
};

export class FriendsPanel {
  private container!: HTMLElement;
  private friends: Friend[] = [];
  private pendingRequests: PendingRequest[] = [];
  private currentTab: 'friends' | 'pending' = 'friends';

  public onAcceptRequest?: (friendshipId: string) => void;
  public onRejectRequest?: (friendshipId: string) => void;
  public onRemoveFriend?: (friendshipId: string) => void;
  public onWhisper?: (agentId: string) => void;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('friends-panel');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'friends-panel';
    container.className = 'friends-panel hidden';
    container.innerHTML = `
      <div class="panel-header">
        <h3>Friends</h3>
        <button class="panel-close" id="friends-close">×</button>
      </div>
      
      <div class="panel-tabs">
        <button class="panel-tab active" data-friends-tab="friends">
          Friends <span class="tab-badge" id="friends-count">0</span>
        </button>
        <button class="panel-tab" data-friends-tab="pending">
          Pending <span class="tab-badge" id="pending-count">0</span>
        </button>
      </div>

      <div class="friends-content">
        <!-- Friends List -->
        <div class="tab-content active" id="friends-list-tab">
          <div class="friends-list" id="friends-list">
            <div class="empty-state">No friends yet</div>
          </div>
        </div>

        <!-- Pending Requests -->
        <div class="tab-content" id="pending-list-tab">
          <div class="friends-list" id="pending-list">
            <div class="empty-state">No pending requests</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.attachListeners();
  }

  private attachListeners(): void {
    const closeBtn = document.getElementById('friends-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Tab switching
    const tabs = this.container.querySelectorAll('.panel-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-friends-tab') as 'friends' | 'pending';
        this.switchTab(tabName);
      });
    });
  }

  private switchTab(tab: 'friends' | 'pending'): void {
    this.currentTab = tab;

    // Update tab buttons
    const tabs = this.container.querySelectorAll('.panel-tab');
    tabs.forEach(t => {
      const tabName = t.getAttribute('data-friends-tab');
      t.classList.toggle('active', tabName === tab);
    });

    // Update tab content
    const friendsTab = document.getElementById('friends-list-tab');
    const pendingTab = document.getElementById('pending-list-tab');

    friendsTab?.classList.toggle('active', tab === 'friends');
    pendingTab?.classList.toggle('active', tab === 'pending');
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

  public setFriends(friends: Friend[]): void {
    this.friends = friends;
    this.renderFriendsList();
    this.updateBadges();
  }

  public setPendingRequests(requests: PendingRequest[]): void {
    this.pendingRequests = requests;
    this.renderPendingList();
    this.updateBadges();
  }

  public updateOnlineStatus(agentId: string, isOnline: boolean): void {
    const friend = this.friends.find(f => f.agentId === agentId);
    if (friend) {
      friend.isOnline = isOnline;
      this.renderFriendsList();
    }
  }

  private renderFriendsList(): void {
    const listContainer = document.getElementById('friends-list');
    if (!listContainer) return;

    if (this.friends.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">No friends yet</div>';
      return;
    }

    listContainer.innerHTML = this.friends.map(friend => `
      <div class="friend-item" data-agent-id="${friend.agentId}">
        <div class="friend-info">
          <span class="online-indicator ${friend.isOnline ? 'online' : 'offline'}"></span>
          <span class="friend-name">${this.escapeHtml(friend.displayName)}</span>
        </div>
        <div class="friend-actions">
          <button class="btn-icon whisper-btn" data-agent-id="${friend.agentId}" title="Whisper">
            💬
          </button>
          <button class="btn-icon remove-btn" data-friendship-id="${friend.id}" title="Remove Friend">
            ❌
          </button>
        </div>
      </div>
    `).join('');

    // Attach action listeners
    listContainer.querySelectorAll('.whisper-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const agentId = btn.getAttribute('data-agent-id');
        if (agentId) {
          this.onWhisper?.(agentId);
        }
      });
    });

    listContainer.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const friendshipId = btn.getAttribute('data-friendship-id');
        if (friendshipId && confirm('Are you sure you want to remove this friend?')) {
          this.onRemoveFriend?.(friendshipId);
        }
      });
    });
  }

  private renderPendingList(): void {
    const listContainer = document.getElementById('pending-list');
    if (!listContainer) return;

    if (this.pendingRequests.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">No pending requests</div>';
      return;
    }

    listContainer.innerHTML = this.pendingRequests.map(request => `
      <div class="friend-item pending-item">
        <div class="friend-info">
          <span class="friend-name">${this.escapeHtml(request.requesterName)}</span>
          <span class="request-time">${this.formatTime(request.createdAt)}</span>
        </div>
        <div class="friend-actions">
          <button class="btn-success accept-btn" data-friendship-id="${request.id}">
            ✓
          </button>
          <button class="btn-danger reject-btn" data-friendship-id="${request.id}">
            ✗
          </button>
        </div>
      </div>
    `).join('');

    // Attach action listeners
    listContainer.querySelectorAll('.accept-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const friendshipId = btn.getAttribute('data-friendship-id');
        if (friendshipId) {
          this.onAcceptRequest?.(friendshipId);
        }
      });
    });

    listContainer.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const friendshipId = btn.getAttribute('data-friendship-id');
        if (friendshipId) {
          this.onRejectRequest?.(friendshipId);
        }
      });
    });
  }

  private updateBadges(): void {
    const friendsCount = document.getElementById('friends-count');
    const pendingCount = document.getElementById('pending-count');

    if (friendsCount) {
      friendsCount.textContent = this.friends.length.toString();
    }

    if (pendingCount) {
      pendingCount.textContent = this.pendingRequests.length.toString();
      pendingCount.style.display = this.pendingRequests.length > 0 ? 'inline' : 'none';
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

  private formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}
