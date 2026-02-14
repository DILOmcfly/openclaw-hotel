/**
 * ProfilePanel.ts
 * User profile display and editing interface for OpenClaw Hotel
 */

export type ProfileData = {
  agentId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  badge: string | null;
  roomCount: number;
  tradeCount: number;
  joinedAt: string;
};

export type ProfileStats = {
  roomCount: number;
  tradeCount: number;
  friendsCount: number;
  joinedAt: string;
};

export type AchievementWithStatus = {
  id: string;
  name: string;
  description: string;
  icon: string;
  conditionType: string;
  conditionValue: number;
  createdAt: string;
  earned: boolean;
  awardedAt: string | null;
};

export class ProfilePanel {
  private container!: HTMLElement;
  private currentProfile: ProfileData | null = null;
  private currentAgentId: string | null = null;
  private isOwnProfile = false;

  public onUpdateProfile?: (bio: string, avatarUrl: string) => void;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('profile-panel');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'profile-panel';
    container.className = 'profile-panel hidden';
    container.innerHTML = `
      <div class="panel-header">
        <h3>Profile</h3>
        <button class="panel-close" id="profile-close">×</button>
      </div>
      
      <div class="profile-content">
        <div class="profile-loading" id="profile-loading">
          <div class="spinner"></div>
          <p>Loading profile...</p>
        </div>

        <div class="profile-view hidden" id="profile-view">
          <!-- Avatar & Name -->
          <div class="profile-header">
            <div class="profile-avatar" id="profile-avatar">👤</div>
            <div class="profile-identity">
              <h2 class="profile-name" id="profile-name"></h2>
              <span class="profile-badge" id="profile-badge"></span>
            </div>
          </div>

          <!-- Bio Section -->
          <div class="profile-section">
            <h4>About</h4>
            <div class="profile-bio-display" id="profile-bio-display">
              <p id="profile-bio-text">No bio yet.</p>
              <button class="btn-secondary btn-sm hidden" id="edit-bio-btn">Edit Bio</button>
            </div>
            <div class="profile-bio-edit hidden" id="profile-bio-edit">
              <textarea 
                id="bio-textarea" 
                maxlength="500" 
                placeholder="Tell us about yourself..."
                rows="4"
              ></textarea>
              <div class="bio-char-count">
                <span id="bio-char-count">0</span>/500
              </div>
              <div class="bio-actions">
                <button class="btn-primary btn-sm" id="save-bio-btn">Save</button>
                <button class="btn-secondary btn-sm" id="cancel-bio-btn">Cancel</button>
              </div>
            </div>
          </div>

          <!-- Stats Section -->
          <div class="profile-section">
            <h4>Stats</h4>
            <div class="profile-stats">
              <div class="stat-item">
                <span class="stat-icon">🏠</span>
                <span class="stat-label">Rooms Created</span>
                <span class="stat-value" id="stat-rooms">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">🤝</span>
                <span class="stat-label">Trades</span>
                <span class="stat-value" id="stat-trades">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">👥</span>
                <span class="stat-label">Friends</span>
                <span class="stat-value" id="stat-friends">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">📅</span>
                <span class="stat-label">Member Since</span>
                <span class="stat-value" id="stat-joined"></span>
              </div>
            </div>
          </div>

          <!-- Badges Section -->
          <div class="profile-section">
            <h4>Badges</h4>
            <div class="profile-badges" id="profile-badges">
              <div class="badges-loading">Loading badges...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.attachListeners();
  }

  private attachListeners(): void {
    const closeBtn = document.getElementById('profile-close');
    closeBtn?.addEventListener('click', () => this.hide());

    const editBioBtn = document.getElementById('edit-bio-btn');
    editBioBtn?.addEventListener('click', () => this.showBioEditor());

    const cancelBioBtn = document.getElementById('cancel-bio-btn');
    cancelBioBtn?.addEventListener('click', () => this.hideBioEditor());

    const saveBioBtn = document.getElementById('save-bio-btn');
    saveBioBtn?.addEventListener('click', () => this.saveBio());

    const bioTextarea = document.getElementById('bio-textarea') as HTMLTextAreaElement;
    bioTextarea?.addEventListener('input', () => this.updateCharCount());
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

  public async loadProfile(agentId: string, currentAgentId: string): Promise<void> {
    this.currentAgentId = agentId;
    this.isOwnProfile = agentId === currentAgentId;
    
    this.showLoading();
    this.show();

    try {
      // Fetch profile data
      const response = await fetch(`/api/profile/${agentId}`);
      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const profile: ProfileData = await response.json();
      this.currentProfile = profile;

      // Fetch stats
      const statsResponse = await fetch(`/api/profile/${agentId}/stats`);
      if (!statsResponse.ok) {
        throw new Error('Failed to load stats');
      }

      const stats: ProfileStats = await statsResponse.json();

      this.renderProfile(profile, stats);
      
      // Load badges
      await this.loadBadges(agentId);
    } catch (error) {
      console.error('[ProfilePanel] Failed to load profile:', error);
      this.showError('Failed to load profile. Please try again.');
    }
  }

  private showLoading(): void {
    const loading = document.getElementById('profile-loading');
    const view = document.getElementById('profile-view');
    
    loading?.classList.remove('hidden');
    view?.classList.add('hidden');
  }

  private renderProfile(profile: ProfileData, stats: ProfileStats): void {
    const loading = document.getElementById('profile-loading');
    const view = document.getElementById('profile-view');
    
    loading?.classList.add('hidden');
    view?.classList.remove('hidden');

    // Set name and badge
    const nameEl = document.getElementById('profile-name');
    const badgeEl = document.getElementById('profile-badge');
    const avatarEl = document.getElementById('profile-avatar');
    
    if (nameEl) nameEl.textContent = profile.displayName;
    if (badgeEl) {
      badgeEl.textContent = profile.badge || '';
      badgeEl.style.display = profile.badge ? 'inline-block' : 'none';
    }
    if (avatarEl) {
      avatarEl.textContent = profile.avatarUrl || '👤';
    }

    // Set bio
    const bioTextEl = document.getElementById('profile-bio-text');
    const editBioBtn = document.getElementById('edit-bio-btn');
    
    if (bioTextEl) {
      bioTextEl.textContent = profile.bio || 'No bio yet.';
    }
    
    if (editBioBtn) {
      editBioBtn.classList.toggle('hidden', !this.isOwnProfile);
    }

    // Set stats
    this.setStatValue('stat-rooms', stats.roomCount);
    this.setStatValue('stat-trades', stats.tradeCount);
    this.setStatValue('stat-friends', stats.friendsCount);
    
    const joinedEl = document.getElementById('stat-joined');
    if (joinedEl) {
      joinedEl.textContent = this.formatDate(stats.joinedAt);
    }
  }

  private showError(message: string): void {
    const loading = document.getElementById('profile-loading');
    if (loading) {
      loading.innerHTML = `
        <div class="error-state">
          <p>${this.escapeHtml(message)}</p>
          <button class="btn-secondary btn-sm" onclick="this.closest('.profile-panel').querySelector('.panel-close').click()">Close</button>
        </div>
      `;
    }
  }

  private showBioEditor(): void {
    const bioDisplay = document.getElementById('profile-bio-display');
    const bioEdit = document.getElementById('profile-bio-edit');
    const bioTextarea = document.getElementById('bio-textarea') as HTMLTextAreaElement;
    
    bioDisplay?.classList.add('hidden');
    bioEdit?.classList.remove('hidden');
    
    if (bioTextarea && this.currentProfile) {
      bioTextarea.value = this.currentProfile.bio || '';
      this.updateCharCount();
      bioTextarea.focus();
    }
  }

  private hideBioEditor(): void {
    const bioDisplay = document.getElementById('profile-bio-display');
    const bioEdit = document.getElementById('profile-bio-edit');
    
    bioDisplay?.classList.remove('hidden');
    bioEdit?.classList.add('hidden');
  }

  private updateCharCount(): void {
    const bioTextarea = document.getElementById('bio-textarea') as HTMLTextAreaElement;
    const charCount = document.getElementById('bio-char-count');
    
    if (bioTextarea && charCount) {
      charCount.textContent = bioTextarea.value.length.toString();
    }
  }

  private async saveBio(): Promise<void> {
    const bioTextarea = document.getElementById('bio-textarea') as HTMLTextAreaElement;
    
    if (!bioTextarea || !this.currentAgentId) {
      return;
    }

    const bio = bioTextarea.value.trim();

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: this.currentAgentId,
          bio,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update bio');
      }

      const updatedProfile: ProfileData = await response.json();
      this.currentProfile = updatedProfile;

      // Update display
      const bioTextEl = document.getElementById('profile-bio-text');
      if (bioTextEl) {
        bioTextEl.textContent = updatedProfile.bio || 'No bio yet.';
      }

      this.hideBioEditor();
      
      // Call callback if provided
      this.onUpdateProfile?.(bio, updatedProfile.avatarUrl || '');
    } catch (error) {
      console.error('[ProfilePanel] Failed to save bio:', error);
      alert('Failed to save bio. Please try again.');
    }
  }

  private async loadBadges(agentId: string): Promise<void> {
    try {
      const response = await fetch(`/api/achievements/${agentId}`);
      if (!response.ok) {
        throw new Error('Failed to load badges');
      }

      const achievements: AchievementWithStatus[] = await response.json();
      this.renderBadges(achievements);
    } catch (error) {
      console.error('[ProfilePanel] Failed to load badges:', error);
      const badgesContainer = document.getElementById('profile-badges');
      if (badgesContainer) {
        badgesContainer.innerHTML = '<p class="badges-error">Failed to load badges</p>';
      }
    }
  }

  private renderBadges(achievements: AchievementWithStatus[]): void {
    const badgesContainer = document.getElementById('profile-badges');
    if (!badgesContainer) return;

    if (achievements.length === 0) {
      badgesContainer.innerHTML = '<p class="badges-empty">No badges yet. Start exploring!</p>';
      return;
    }

    const badgesHtml = achievements
      .map((achievement) => {
        const earnedClass = achievement.earned ? 'badge-earned' : 'badge-locked';
        const opacity = achievement.earned ? '1' : '0.3';
        const title = achievement.earned
          ? `${achievement.name}: ${achievement.description} (Earned: ${this.formatDate(achievement.awardedAt || '')})`
          : `${achievement.name}: ${achievement.description} (Locked)`;

        return `
          <div class="badge-item ${earnedClass}" title="${this.escapeHtml(title)}" style="opacity: ${opacity}">
            <span class="badge-icon">${achievement.icon}</span>
          </div>
        `;
      })
      .join('');

    badgesContainer.innerHTML = `<div class="badges-grid">${badgesHtml}</div>`;
  }

  private setStatValue(elementId: string, value: number): void {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = value.toString();
    }
  }

  private formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
