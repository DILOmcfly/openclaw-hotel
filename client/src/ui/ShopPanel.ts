/**
 * ShopPanel.ts
 * Visual furniture shop UI with category filters, item previews, and purchasing
 */

import { SPRITES } from '../sprites.js';

export interface ShopItem {
  itemDefId: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  canSit?: boolean;
  walkable?: boolean;
  price: number;
  sprite?: string; // Maps to SPRITES key (e.g., 'furn_chair')
}

export interface ShopPanelCallbacks {
  onPurchase: (itemDefId: string, quantity: number) => void;
  onClose: () => void;
}

type Category = 'all' | 'seating' | 'tables' | 'lighting' | 'decoration' | 'plants' | 'electronics';

export class ShopPanel {
  private element: HTMLDivElement;
  private callbacks: ShopPanelCallbacks;
  private catalog: ShopItem[] = [];
  private selectedCategory: Category = 'all';
  private searchQuery = '';

  constructor(callbacks: ShopPanelCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'shop-panel hidden';
    this.render();
    document.body.appendChild(this.element);
  }

  public getElement(): HTMLDivElement {
    return this.element;
  }

  public show(): void {
    this.element.classList.remove('hidden');
    this.loadCatalog();
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }

  private async loadCatalog(): Promise<void> {
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        console.error('[ShopPanel] No auth token');
        return;
      }

      const response = await fetch('/api/furniture/catalog', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch catalog: ${response.statusText}`);
      }

      const data = await response.json();
      this.catalog = data.items || [];
      this.renderItems();
    } catch (error) {
      console.error('[ShopPanel] Failed to load catalog:', error);
      this.showError('Failed to load shop items');
    }
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="shop-header">
        <h2>🏪 Furniture Shop</h2>
        <button class="shop-close-btn" data-action="close">✕</button>
      </div>

      <div class="shop-filters">
        <input
          type="text"
          class="shop-search"
          placeholder="Search items..."
          data-search
        />
        <div class="shop-categories">
          <button class="shop-category-btn active" data-category="all">All</button>
          <button class="shop-category-btn" data-category="seating">Seating</button>
          <button class="shop-category-btn" data-category="tables">Tables</button>
          <button class="shop-category-btn" data-category="lighting">Lighting</button>
          <button class="shop-category-btn" data-category="decoration">Decor</button>
          <button class="shop-category-btn" data-category="plants">Plants</button>
          <button class="shop-category-btn" data-category="electronics">Tech</button>
        </div>
      </div>

      <div class="shop-items-grid" data-items-container></div>

      <div class="shop-error hidden" data-error></div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Close button
    const closeBtn = this.element.querySelector('[data-action="close"]') as HTMLButtonElement;
    closeBtn?.addEventListener('click', () => this.callbacks.onClose());

    // Search input
    const searchInput = this.element.querySelector('[data-search]') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderItems();
    });

    // Category filters
    const categoryBtns = this.element.querySelectorAll('[data-category]');
    categoryBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const category = target.dataset.category as Category;

        // Update active state
        categoryBtns.forEach((b) => b.classList.remove('active'));
        target.classList.add('active');

        this.selectedCategory = category;
        this.renderItems();
      });
    });
  }

  private renderItems(): void {
    const container = this.element.querySelector('[data-items-container]') as HTMLDivElement;
    if (!container) return;

    const filtered = this.filterItems();

    if (filtered.length === 0) {
      container.innerHTML = '<div class="shop-empty">No items found</div>';
      return;
    }

    container.innerHTML = filtered
      .map((item) => this.renderItemCard(item))
      .join('');

    // Attach purchase handlers
    const buyButtons = container.querySelectorAll('[data-buy]');
    buyButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const itemDefId = target.dataset.buy!;
        const quantityInput = target.parentElement?.querySelector('[data-quantity]') as HTMLInputElement;
        const quantity = parseInt(quantityInput?.value || '1', 10);

        this.handlePurchase(itemDefId, quantity);
      });
    });
  }

  private filterItems(): ShopItem[] {
    let filtered = this.catalog;

    // Filter by category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter((item) => this.getCategoryForItem(item) === this.selectedCategory);
    }

    // Filter by search query
    if (this.searchQuery) {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(this.searchQuery)
      );
    }

    return filtered;
  }

  private getCategoryForItem(item: ShopItem): Category {
    const name = item.name.toLowerCase();
    const id = item.itemDefId.toLowerCase();

    if (name.includes('chair') || name.includes('sofa') || name.includes('bench') || item.canSit) {
      return 'seating';
    }
    if (name.includes('table') || name.includes('desk')) {
      return 'tables';
    }
    if (name.includes('lamp') || name.includes('light')) {
      return 'lighting';
    }
    if (name.includes('plant') || id.includes('plant')) {
      return 'plants';
    }
    if (name.includes('tv') || name.includes('computer') || name.includes('screen') || id.includes('tv') || id.includes('computer')) {
      return 'electronics';
    }

    return 'decoration';
  }

  private renderItemCard(item: ShopItem): string {
    const sprite = this.getItemSprite(item);
    const spritePreview = sprite ? `<img src="${SPRITES[sprite]}" alt="${item.name}" class="shop-item-preview" />` : '<div class="shop-item-preview-placeholder">🪑</div>';

    return `
      <div class="shop-item-card">
        <div class="shop-item-image">
          ${spritePreview}
        </div>
        <div class="shop-item-info">
          <h3>${this.escapeHtml(item.name)}</h3>
          <p class="shop-item-size">${item.width}×${item.depth}×${item.height}</p>
          ${item.canSit ? '<span class="shop-item-tag">🪑 Sittable</span>' : ''}
          ${item.walkable ? '<span class="shop-item-tag">👣 Walkable</span>' : ''}
        </div>
        <div class="shop-item-footer">
          <span class="shop-item-price">🪙 ${item.price}</span>
          <div class="shop-item-actions">
            <input type="number" min="1" max="10" value="1" class="shop-quantity-input" data-quantity />
            <button class="shop-buy-btn" data-buy="${item.itemDefId}">Buy</button>
          </div>
        </div>
      </div>
    `;
  }

  private getItemSprite(item: ShopItem): string | null {
    // Try to map item.itemDefId or item.name to FURNITURE_SPRITES
    const id = item.itemDefId.toLowerCase();
    const name = item.name.toLowerCase();

    // Direct mapping first
    if (id.includes('chair')) return 'furn_chair';
    if (id.includes('table')) return 'furn_table';
    if (id.includes('lamp')) return 'furn_lamp';
    if (id.includes('sofa')) return 'furn_sofa';
    if (id.includes('plant')) return 'furn_plant';
    if (id.includes('bookshelf')) return 'furn_bookshelf';
    if (id.includes('computer') || id.includes('desk')) return 'furn_computer';
    if (id.includes('bed')) return 'furn_bed';
    if (id.includes('fridge')) return 'furn_fridge';
    if (id.includes('tv') || id.includes('screen')) return 'furn_tv';

    // Fallback to name matching
    if (name.includes('chair')) return 'furn_chair';
    if (name.includes('table')) return 'furn_table';
    if (name.includes('lamp')) return 'furn_lamp';
    if (name.includes('sofa')) return 'furn_sofa';
    if (name.includes('plant')) return 'furn_plant';
    if (name.includes('shelf')) return 'furn_bookshelf';
    if (name.includes('computer') || name.includes('desk')) return 'furn_computer';
    if (name.includes('bed')) return 'furn_bed';
    if (name.includes('fridge')) return 'furn_fridge';
    if (name.includes('tv')) return 'furn_tv';

    return null;
  }

  private async handlePurchase(itemDefId: string, quantity: number): Promise<void> {
    const token = localStorage.getItem('agent_token');
    if (!token) {
      this.showError('Not authenticated');
      return;
    }

    const item = this.catalog.find((i) => i.itemDefId === itemDefId);
    if (!item) {
      this.showError('Item not found');
      return;
    }

    const totalCost = item.price * quantity;

    // Confirm purchase
    if (!confirm(`Purchase ${quantity}× ${item.name} for 🪙 ${totalCost}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/furniture/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemDefId, quantity }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Purchase failed');
      }

      const result = await response.json();

      // Success feedback
      this.showSuccess(`✅ Purchased ${quantity}× ${item.name}! (${result.balance} coins remaining)`);
      this.callbacks.onPurchase(itemDefId, quantity);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Purchase failed';
      this.showError(message);
    }
  }

  private showError(message: string): void {
    const errorEl = this.element.querySelector('[data-error]') as HTMLDivElement;
    if (!errorEl) return;

    errorEl.textContent = message;
    errorEl.classList.remove('hidden');

    setTimeout(() => {
      errorEl.classList.add('hidden');
    }, 5000);
  }

  private showSuccess(message: string): void {
    // Reuse error element for success (with different styling via CSS class)
    const errorEl = this.element.querySelector('[data-error]') as HTMLDivElement;
    if (!errorEl) return;

    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    errorEl.classList.add('shop-success');

    setTimeout(() => {
      errorEl.classList.add('hidden');
      errorEl.classList.remove('shop-success');
    }, 5000);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
