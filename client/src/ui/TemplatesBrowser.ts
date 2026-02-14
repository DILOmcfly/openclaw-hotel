/**
 * Templates Browser
 * Browse and create rooms from pre-built templates
 */

export interface RoomTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  layout: number[][];
  furniture_preset: Array<{
    furnitureId: string;
    x: number;
    y: number;
    rotation: number;
  }>;
  thumbnail_url: string | null;
  is_premium: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export class TemplatesBrowser {
  private panel!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private categoryFilter!: HTMLSelectElement;
  private templatesGrid!: HTMLElement;
  private templates: RoomTemplate[] = [];

  public onCreateRoom?: (templateId: string, roomName?: string) => void;

  constructor() {
    this.createPanel();
    this.attachListeners();
    this.loadTemplates();
  }

  private createPanel(): void {
    const existing = document.getElementById('templates-browser');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'templates-browser';
    panel.className = 'templates-browser hidden';
    panel.innerHTML = `
      <div class="templates-header">
        <h2>🏗️ Room Templates</h2>
        <p class="templates-subtitle">Create rooms from pre-designed templates</p>
      </div>
      
      <div class="templates-filters">
        <div class="search-bar">
          <input type="text" id="template-search" placeholder="🔍 Search templates..." class="search-input">
        </div>
        
        <div class="filter-row">
          <select id="template-category-filter" class="filter-select">
            <option value="">All Categories</option>
            <option value="lounge">Lounge</option>
            <option value="office">Office</option>
            <option value="cafe">Cafe</option>
            <option value="nightclub">Nightclub</option>
            <option value="garden">Garden</option>
            <option value="beach">Beach</option>
            <option value="library">Library</option>
            <option value="penthouse">Penthouse</option>
            <option value="custom">Custom</option>
          </select>
          
          <button id="popular-templates-btn" class="action-btn">
            ⭐ Popular
          </button>
        </div>
      </div>
      
      <div class="templates-content">
        <div class="templates-grid" id="templates-grid">
          <div class="loading-state">Loading templates...</div>
        </div>
      </div>
      
      <div class="templates-footer">
        <button id="close-templates" class="btn-secondary">Close</button>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    this.searchInput = panel.querySelector('#template-search')!;
    this.categoryFilter = panel.querySelector('#template-category-filter')!;
    this.templatesGrid = panel.querySelector('#templates-grid')!;
  }

  private attachListeners(): void {
    // Search
    this.searchInput.addEventListener('input', () => this.filterTemplates());
    
    // Category filter
    this.categoryFilter.addEventListener('change', () => this.filterTemplates());
    
    // Popular button
    this.panel.querySelector('#popular-templates-btn')?.addEventListener('click', () => {
      this.loadPopularTemplates();
    });
    
    // Close button
    this.panel.querySelector('#close-templates')?.addEventListener('click', () => this.hide());
  }

  public show(): void {
    this.panel.classList.remove('hidden');
    this.loadTemplates();
  }

  public hide(): void {
    this.panel.classList.add('hidden');
  }

  private async loadTemplates(): Promise<void> {
    try {
      this.showLoadingState();

      const category = this.categoryFilter.value;
      const url = `/api/room-templates${category ? `?category=${category}` : ''}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load templates');

      const data = await response.json();
      this.templates = data.templates;
      this.renderTemplates(this.templates);
    } catch (error) {
      console.error('Error loading templates:', error);
      this.showError('Failed to load templates. Please try again.');
    }
  }

  private async loadPopularTemplates(): Promise<void> {
    try {
      this.showLoadingState();

      const response = await fetch('/api/room-templates/popular?limit=10');
      if (!response.ok) throw new Error('Failed to load popular templates');

      const data = await response.json();
      this.templates = data.templates;
      this.renderTemplates(this.templates);
      
      // Reset filters
      this.searchInput.value = '';
      this.categoryFilter.value = '';
    } catch (error) {
      console.error('Error loading popular templates:', error);
      this.showError('Failed to load popular templates.');
    }
  }

  private filterTemplates(): void {
    const searchQuery = this.searchInput.value.toLowerCase();
    const category = this.categoryFilter.value;

    let filtered = this.templates;

    // Category filter
    if (category) {
      filtered = filtered.filter((t) => t.category === category);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((t) => 
        t.name.toLowerCase().includes(searchQuery) ||
        (t.description && t.description.toLowerCase().includes(searchQuery))
      );
    }

    this.renderTemplates(filtered);
  }

  private renderTemplates(templates: RoomTemplate[]): void {
    if (templates.length === 0) {
      this.templatesGrid.innerHTML = `
        <div class="empty-state">
          <p>No templates found.</p>
          <p class="hint">Try adjusting your filters or search query.</p>
        </div>
      `;
      return;
    }

    this.templatesGrid.innerHTML = templates.map((template) => this.templateCardHTML(template)).join('');

    // Attach create buttons
    templates.forEach((template) => {
      const btn = this.templatesGrid.querySelector(`[data-template-id="${template.id}"]`);
      btn?.addEventListener('click', () => this.createRoomFromTemplate(template));
    });
  }

  private templateCardHTML(template: RoomTemplate): string {
    const categoryEmoji = this.getCategoryEmoji(template.category);
    const premiumBadge = template.is_premium ? '<span class="premium-badge">✨ Premium</span>' : '';
    const layoutPreview = this.generateLayoutPreview(template.layout);

    return `
      <div class="template-card">
        <div class="template-preview">
          ${layoutPreview}
        </div>
        <div class="template-info">
          <div class="template-header">
            <h3>${categoryEmoji} ${this.escapeHTML(template.name)}</h3>
            ${premiumBadge}
          </div>
          <p class="template-description">${this.escapeHTML(template.description || 'No description')}</p>
          <div class="template-meta">
            <span class="template-category">${template.category}</span>
            <span class="template-uses">🏠 Used ${template.use_count} times</span>
          </div>
          <div class="template-details">
            <span>Size: ${template.layout[0]?.length || 0}x${template.layout.length}</span>
            <span>Furniture: ${template.furniture_preset.length} items</span>
          </div>
        </div>
        <button class="btn-primary" data-template-id="${template.id}">
          Create Room
        </button>
      </div>
    `;
  }

  private generateLayoutPreview(layout: number[][]): string {
    // Simple visual preview of heightmap (8x8 sample in center)
    const previewSize = Math.min(8, layout.length);
    const startY = Math.floor((layout.length - previewSize) / 2);
    const startX = Math.floor((layout[0]?.length || 0 - previewSize) / 2);

    let html = '<div class="layout-preview">';
    
    for (let y = startY; y < startY + previewSize && y < layout.length; y++) {
      for (let x = startX; x < startX + previewSize && layout[y] && x < layout[y].length; x++) {
        const tile = layout[y][x];
        const tileClass = this.getTileClass(tile);
        html += `<div class="preview-tile ${tileClass}"></div>`;
      }
    }

    html += '</div>';
    return html;
  }

  private getTileClass(height: number): string {
    if (height === 0) return 'tile-water';
    if (height === 1) return 'tile-floor';
    if (height === 2) return 'tile-floor-raised';
    if (height >= 3 && height <= 5) return 'tile-elevated';
    return 'tile-wall';
  }

  private getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      lounge: '🛋️',
      office: '💼',
      cafe: '☕',
      nightclub: '🎵',
      garden: '🌿',
      beach: '🏖️',
      library: '📚',
      penthouse: '🏙️',
      custom: '🎨',
    };
    return emojis[category] || '🏠';
  }

  private async createRoomFromTemplate(template: RoomTemplate): Promise<void> {
    const roomName = prompt(`Enter a name for your new room:`, template.name);
    if (!roomName) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to create a room');
        return;
      }

      const response = await fetch('/api/room-templates/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          templateId: template.id,
          roomName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create room');
      }

      const data = await response.json();
      alert(`✅ Room "${roomName}" created successfully!`);

      if (this.onCreateRoom) {
        this.onCreateRoom(data.roomId, roomName);
      }

      this.hide();
    } catch (error: any) {
      console.error('Create room error:', error);
      alert(`❌ Failed to create room: ${error.message}`);
    }
  }

  private showLoadingState(): void {
    this.templatesGrid.innerHTML = '<div class="loading-state">Loading templates...</div>';
  }

  private showError(message: string): void {
    this.templatesGrid.innerHTML = `
      <div class="error-state">
        <p>❌ ${this.escapeHTML(message)}</p>
      </div>
    `;
  }

  private escapeHTML(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
