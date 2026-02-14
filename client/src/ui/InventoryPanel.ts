/**
 * InventoryPanel.ts
 * Furniture inventory management interface
 */

export type InventoryItem = {
  id: string;
  agentId: string;
  itemDefId: string;
  category: string;
  x: number | null;
  y: number | null;
  roomId: string | null;
  acquiredAt: string;
};

export class InventoryPanel {
  private container!: HTMLElement;
  private items: InventoryItem[] = [];
  private currentFilter: string = 'all';
  private searchQuery: string = '';
  private showOnlyStorage: boolean = true; // only show items NOT in a room

  public onPlace?: (itemId: string) => void;
  public onSell?: (itemId: string) => void;
  public onRefresh?: () => void;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('inventory-panel');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'inventory-panel';
    container.className = 'inventory-panel hidden';
    container.innerHTML = `
      <div class="panel-header">
        <h3>🎒 Inventory</h3>
        <button class="panel-close" id="inventory-close">×</button>
      </div>

      <div class="inventory-filters">
        <div class="filter-group">
          <label>
            <input type="checkbox" id="inventory-storage-only" checked />
            Storage only (not placed)
          </label>
        </div>

        <div class="filter-group">
          <select id="inventory-category-filter">
            <option value="all">All Categories</option>
            <option value="seating">Seating</option>
            <option value="tables">Tables</option>
            <option value="lighting">Lighting</option>
            <option value="decoration">Decoration</option>
            <option value="storage">Storage</option>
          </select>
        </div>

        <div class="filter-group">
          <input 
            type="text" 
            id="inventory-search" 
            placeholder="Search items..." 
            maxlength="50"
          />
        </div>
      </div>

      <div class="inventory-content">
        <div class="inventory-grid" id="inventory-grid">
          <div class="loading">Loading inventory...</div>
        </div>
      </div>

      <div class="inventory-footer">
        <button class="refresh-btn" id="inventory-refresh">🔄 Refresh</button>
        <span class="inventory-count" id="inventory-count">0 items</span>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.attachListeners();
  }

  private attachListeners(): void {
    const closeBtn = document.getElementById('inventory-close');
    closeBtn?.addEventListener('click', () => this.hide());

    const refreshBtn = document.getElementById('inventory-refresh');
    refreshBtn?.addEventListener('click', () => {
      this.onRefresh?.();
    });

    const storageCheckbox = document.getElementById('inventory-storage-only') as HTMLInputElement;
    storageCheckbox?.addEventListener('change', (e) => {
      this.showOnlyStorage = (e.target as HTMLInputElement).checked;
      this.renderItems();
    });

    const categoryFilter = document.getElementById('inventory-category-filter') as HTMLSelectElement;
    categoryFilter?.addEventListener('change', (e) => {
      this.currentFilter = (e.target as HTMLSelectElement).value;
      this.renderItems();
    });

    const searchInput = document.getElementById('inventory-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderItems();
    });
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

  public setItems(items: InventoryItem[]): void {
    this.items = items;
    this.renderItems();
  }

  public showLoading(): void {
    const grid = document.getElementById('inventory-grid');
    if (grid) {
      grid.innerHTML = '<div class="loading">Loading inventory...</div>';
    }
  }

  public showEmpty(): void {
    const grid = document.getElementById('inventory-grid');
    if (grid) {
      grid.innerHTML = '<div class="empty-state">Your inventory is empty. Buy furniture from the shop!</div>';
    }
  }

  private renderItems(): void {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;

    // Filter items
    let filtered = this.items.filter(item => {
      // Storage-only filter
      if (this.showOnlyStorage && item.roomId !== null) {
        return false;
      }

      // Category filter
      if (this.currentFilter !== 'all' && item.category !== this.currentFilter) {
        return false;
      }

      // Search filter
      if (this.searchQuery && !item.itemDefId.toLowerCase().includes(this.searchQuery)) {
        return false;
      }

      return true;
    });

    // Update count
    const countEl = document.getElementById('inventory-count');
    if (countEl) {
      countEl.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
      this.showEmpty();
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const isPlaced = item.roomId !== null;

      return `
        <div class="inventory-item ${isPlaced ? 'placed' : ''}" data-item-id="${item.id}">
          <div class="item-icon">
            ${this.getItemEmoji(item.itemDefId)}
          </div>
          <div class="item-info">
            <span class="item-name">${this.escapeHtml(item.itemDefId)}</span>
            <span class="item-category">${this.escapeHtml(item.category)}</span>
            ${isPlaced ? '<span class="item-status">📍 Placed</span>' : ''}
          </div>
          <div class="item-actions">
            ${!isPlaced ? `
              <button class="place-btn" data-item-id="${item.id}" title="Place in current room">
                📌 Place
              </button>
              <button class="sell-btn" data-item-id="${item.id}" title="Sell for 50% refund">
                💰 Sell
              </button>
            ` : `
              <span class="disabled-label">Remove from room first</span>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Attach button listeners
    this.attachItemButtonListeners();
  }

  private attachItemButtonListeners(): void {
    const placeButtons = this.container.querySelectorAll('.place-btn');
    placeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = (e.target as HTMLElement).getAttribute('data-item-id');
        if (itemId && this.onPlace) {
          this.onPlace(itemId);
        }
      });
    });

    const sellButtons = this.container.querySelectorAll('.sell-btn');
    sellButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = (e.target as HTMLElement).getAttribute('data-item-id');
        if (itemId && this.onSell) {
          // Confirm sell
          const item = this.items.find(i => i.id === itemId);
          if (item) {
            const confirm = window.confirm(`Sell ${item.itemDefId} for 50% refund?`);
            if (confirm) {
              this.onSell(itemId);
            }
          }
        }
      });
    });
  }

  private getItemEmoji(itemDefId: string): string {
    const emojis: Record<string, string> = {
      chair: '🪑',
      table: '🍽️',
      lamp: '💡',
      plant: '🌿',
      rug: '🧶',
      bookshelf: '📚',
      desk: '🖥️',
      sofa: '🛋️',
      bed: '🛏️',
      cabinet: '🗄️',
    };

    return emojis[itemDefId] || '📦';
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
