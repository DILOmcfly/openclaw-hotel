/**
 * Navigator Panel
 * Enhanced room discovery with search, filters, favorites, and recent rooms
 */

export interface Room {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  occupants: number;
  maxOccupants: number;
  isFavorite?: boolean;
  lastVisited?: string | null;
}

export class Navigator {
  private panel!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private categoryFilter!: HTMLSelectElement;
  private tagFilter!: HTMLSelectElement;
  private sortBy!: HTMLSelectElement;
  private roomsContainer!: HTMLElement;
  private currentTab: 'all' | 'favorites' | 'recent' = 'all';
  private categories: string[] = [];
  private tags: string[] = [];
  
  public onJoinRoom?: (roomId: string) => void;
  public onToggleFavorite?: (roomId: string, isFavorite: boolean) => void;

  constructor() {
    this.createPanel();
    this.attachListeners();
    this.loadFilters();
  }

  private createPanel(): void {
    const existing = document.getElementById('navigator-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'navigator-panel';
    panel.className = 'navigator-panel';
    panel.innerHTML = `
      <div class="navigator-header">
        <h2>Room Navigator</h2>
        <div class="navigator-tabs">
          <button class="nav-tab active" data-tab="all">All Rooms</button>
          <button class="nav-tab" data-tab="favorites">Favorites</button>
          <button class="nav-tab" data-tab="recent">Recent</button>
        </div>
      </div>
      
      <div class="navigator-filters">
        <div class="search-bar">
          <input type="text" id="room-search" placeholder="🔍 Search rooms..." class="search-input">
        </div>
        
        <div class="filter-row">
          <select id="category-filter" class="filter-select">
            <option value="">All Categories</option>
          </select>
          
          <select id="tag-filter" class="filter-select">
            <option value="">All Tags</option>
          </select>
          
          <select id="sort-by" class="filter-select">
            <option value="occupants">Popular</option>
            <option value="name">Name (A-Z)</option>
            <option value="recent">Recently Visited</option>
          </select>
        </div>
      </div>
      
      <div class="navigator-content">
        <div class="rooms-grid" id="rooms-grid">
          <div class="loading-state">Loading rooms...</div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;
    
    // Cache elements
    this.searchInput = panel.querySelector('#room-search')!;
    this.categoryFilter = panel.querySelector('#category-filter')!;
    this.tagFilter = panel.querySelector('#tag-filter')!;
    this.sortBy = panel.querySelector('#sort-by')!;
    this.roomsContainer = panel.querySelector('#rooms-grid')!;
  }

  private attachListeners(): void {
    // Tab switching
    this.panel.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.getAttribute('data-tab') as 'all' | 'favorites' | 'recent';
        this.switchTab(tabName);
      });
    });

    // Search and filters
    this.searchInput.addEventListener('input', () => this.search());
    this.categoryFilter.addEventListener('change', () => this.search());
    this.tagFilter.addEventListener('change', () => this.search());
    this.sortBy.addEventListener('change', () => this.search());
  }

  private async loadFilters(): Promise<void> {
    try {
      // Load categories
      const catRes = await fetch('/api/navigator/categories');
      const catData = await catRes.json();
      this.categories = catData.categories || [];
      
      // Populate category filter
      this.categoryFilter.innerHTML = '<option value="">All Categories</option>' +
        this.categories.map(cat => `<option value="${cat}">${this.capitalize(cat)}</option>`).join('');

      // Load tags
      const tagRes = await fetch('/api/navigator/tags');
      const tagData = await tagRes.json();
      this.tags = tagData.tags || [];
      
      // Populate tag filter
      this.tagFilter.innerHTML = '<option value="">All Tags</option>' +
        this.tags.map(tag => `<option value="${tag}">#${tag}</option>`).join('');
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  }

  private switchTab(tab: 'all' | 'favorites' | 'recent'): void {
    this.currentTab = tab;
    
    // Update UI
    this.panel.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    this.panel.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
    
    // Load data
    if (tab === 'all') {
      this.search();
    } else if (tab === 'favorites') {
      this.loadFavorites();
    } else if (tab === 'recent') {
      this.loadRecent();
    }
  }

  public async search(): Promise<void> {
    if (this.currentTab !== 'all') return;

    const query = this.searchInput.value.trim();
    const category = this.categoryFilter.value;
    const tag = this.tagFilter.value;
    const sortBy = this.sortBy.value;

    try {
      const params = new URLSearchParams();
      if (query) params.set('query', query);
      if (category) params.set('category', category);
      if (tag) params.set('tag', tag);
      params.set('sortBy', sortBy);
      params.set('sortOrder', 'desc');

      const res = await fetch(`/api/navigator/search?${params}`, {
        headers: {
          'x-agent-id': localStorage.getItem('agentId') || ''
        }
      });
      const data = await res.json();
      
      this.renderRooms(data.rooms || []);
    } catch (error) {
      console.error('Search failed:', error);
      this.roomsContainer.innerHTML = '<div class="error-state">Failed to load rooms</div>';
    }
  }

  private async loadFavorites(): Promise<void> {
    try {
      const res = await fetch('/api/navigator/favorites', {
        headers: {
          'x-agent-id': localStorage.getItem('agentId') || '',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      
      this.renderRooms(data.favorites || []);
    } catch (error) {
      console.error('Load favorites failed:', error);
      this.roomsContainer.innerHTML = '<div class="error-state">Failed to load favorites</div>';
    }
  }

  private async loadRecent(): Promise<void> {
    try {
      const res = await fetch('/api/navigator/recent', {
        headers: {
          'x-agent-id': localStorage.getItem('agentId') || '',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      
      this.renderRooms(data.recent || []);
    } catch (error) {
      console.error('Load recent failed:', error);
      this.roomsContainer.innerHTML = '<div class="error-state">Failed to load recent rooms</div>';
    }
  }

  private renderRooms(rooms: Room[]): void {
    if (rooms.length === 0) {
      this.roomsContainer.innerHTML = '<div class="empty-state">No rooms found</div>';
      return;
    }

    this.roomsContainer.innerHTML = rooms.map(room => `
      <div class="room-card" data-room-id="${room.id}">
        <div class="room-card-header">
          <div class="room-title">
            <h4>${this.escapeHtml(room.name)}</h4>
            <button class="favorite-btn ${room.isFavorite ? 'active' : ''}" data-room-id="${room.id}">
              ${room.isFavorite ? '⭐' : '☆'}
            </button>
          </div>
          <span class="room-category">${this.capitalize(room.category)}</span>
        </div>
        
        ${room.description ? `<p class="room-description">${this.escapeHtml(room.description)}</p>` : ''}
        
        <div class="room-tags">
          ${room.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
        </div>
        
        <div class="room-card-footer">
          <span class="room-occupancy">
            ${room.occupants}/${room.maxOccupants}
            <span class="occupancy-icon">${room.occupants > 0 ? '👥' : '🏠'}</span>
          </span>
          <button class="btn-primary btn-sm join-room-btn" data-room-id="${room.id}">
            Join Room
          </button>
        </div>
      </div>
    `).join('');

    // Attach event listeners
    this.roomsContainer.querySelectorAll('.join-room-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roomId = (e.target as HTMLElement).getAttribute('data-room-id');
        if (roomId) this.onJoinRoom?.(roomId);
      });
    });

    this.roomsContainer.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const roomId = (e.target as HTMLElement).getAttribute('data-room-id');
        const isFavorite = (e.target as HTMLElement).classList.contains('active');
        
        if (roomId) {
          await this.toggleFavorite(roomId, !isFavorite);
          this.onToggleFavorite?.(roomId, !isFavorite);
        }
      });
    });
  }

  private async toggleFavorite(roomId: string, favorite: boolean): Promise<void> {
    try {
      const method = favorite ? 'POST' : 'DELETE';
      await fetch(`/api/navigator/favorites/${roomId}`, {
        method,
        headers: {
          'x-agent-id': localStorage.getItem('agentId') || '',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      // Update UI
      const btn = this.roomsContainer.querySelector(`.favorite-btn[data-room-id="${roomId}"]`);
      if (btn) {
        btn.textContent = favorite ? '⭐' : '☆';
        btn.classList.toggle('active', favorite);
      }
    } catch (error) {
      console.error('Toggle favorite failed:', error);
    }
  }

  public show(): void {
    this.panel.classList.add('visible');
    this.search();
  }

  public hide(): void {
    this.panel.classList.remove('visible');
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
