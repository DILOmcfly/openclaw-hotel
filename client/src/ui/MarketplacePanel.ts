/**
 * MarketplacePanel.ts
 * Marketplace interface for buying/selling furniture
 */

export type MarketplaceListing = {
  id: string;
  item_id: string;
  seller_id: string;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  created_at: string;
  sold_at: string | null;
  buyer_id: string | null;
  item_type?: string;
  seller_name?: string;
  buyer_name?: string;
};

export type MarketplaceStats = {
  total_active: number;
  total_sold_24h: number;
  avg_price: number;
};

export class MarketplacePanel {
  private container!: HTMLElement;
  private listings: MarketplaceListing[] = [];
  private myListings: MarketplaceListing[] = [];
  private stats: MarketplaceStats = { total_active: 0, total_sold_24h: 0, avg_price: 0 };
  private currentTab: 'browse' | 'my-listings' = 'browse';
  private currentFilter: {
    item_type?: string;
    min_price?: number;
    max_price?: number;
    search?: string;
  } = {};

  public onBuy?: (listingId: string) => void;
  public onCancelListing?: (listingId: string) => void;
  public onRefresh?: () => void;
  public onCreateListing?: (itemId: string, price: number) => void;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('marketplace-panel');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'marketplace-panel';
    container.className = 'marketplace-panel hidden';
    container.innerHTML = `
      <div class="panel-header">
        <h3>🛒 Marketplace</h3>
        <button class="panel-close" id="marketplace-close">×</button>
      </div>

      <div class="marketplace-stats" id="marketplace-stats">
        <div class="stat-item">
          <span class="stat-label">Active</span>
          <span class="stat-value" id="stat-active">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Sold (24h)</span>
          <span class="stat-value" id="stat-sold">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Avg Price</span>
          <span class="stat-value" id="stat-avg">0</span>
        </div>
      </div>

      <div class="marketplace-tabs">
        <button class="tab-btn active" id="tab-browse">Browse</button>
        <button class="tab-btn" id="tab-my-listings">My Listings</button>
      </div>

      <div class="marketplace-filters" id="marketplace-filters">
        <div class="filter-group">
          <select id="marketplace-item-type">
            <option value="">All Items</option>
            <option value="chair">Chairs</option>
            <option value="table">Tables</option>
            <option value="lamp">Lamps</option>
            <option value="plant">Plants</option>
            <option value="sofa">Sofas</option>
            <option value="bookshelf">Bookshelves</option>
          </select>
        </div>

        <div class="filter-group">
          <input 
            type="number" 
            id="marketplace-min-price" 
            placeholder="Min price" 
            min="0" 
            max="1000000"
          />
          <span>—</span>
          <input 
            type="number" 
            id="marketplace-max-price" 
            placeholder="Max price" 
            min="0" 
            max="1000000"
          />
        </div>

        <div class="filter-group">
          <input 
            type="text" 
            id="marketplace-search" 
            placeholder="Search..." 
            maxlength="50"
          />
        </div>
      </div>

      <div class="marketplace-content">
        <div class="marketplace-grid" id="marketplace-grid">
          <div class="loading">Loading listings...</div>
        </div>
      </div>

      <div class="marketplace-footer">
        <button class="refresh-btn" id="marketplace-refresh">🔄 Refresh</button>
        <span class="listing-count" id="marketplace-count">0 listings</span>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.attachListeners();
  }

  private attachListeners(): void {
    const closeBtn = document.getElementById('marketplace-close');
    closeBtn?.addEventListener('click', () => this.hide());

    const refreshBtn = document.getElementById('marketplace-refresh');
    refreshBtn?.addEventListener('click', () => {
      this.onRefresh?.();
    });

    // Tab switching
    const browseTab = document.getElementById('tab-browse');
    browseTab?.addEventListener('click', () => this.switchTab('browse'));

    const myListingsTab = document.getElementById('tab-my-listings');
    myListingsTab?.addEventListener('click', () => this.switchTab('my-listings'));

    // Filters
    const itemTypeFilter = document.getElementById('marketplace-item-type') as HTMLSelectElement;
    itemTypeFilter?.addEventListener('change', () => {
      this.currentFilter.item_type = itemTypeFilter.value || undefined;
      this.applyFilters();
    });

    const minPriceInput = document.getElementById('marketplace-min-price') as HTMLInputElement;
    minPriceInput?.addEventListener('input', () => {
      const value = parseInt(minPriceInput.value);
      this.currentFilter.min_price = isNaN(value) ? undefined : value;
      this.applyFilters();
    });

    const maxPriceInput = document.getElementById('marketplace-max-price') as HTMLInputElement;
    maxPriceInput?.addEventListener('input', () => {
      const value = parseInt(maxPriceInput.value);
      this.currentFilter.max_price = isNaN(value) ? undefined : value;
      this.applyFilters();
    });

    const searchInput = document.getElementById('marketplace-search') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.currentFilter.search = searchInput.value || undefined;
      this.applyFilters();
    });
  }

  private switchTab(tab: 'browse' | 'my-listings'): void {
    this.currentTab = tab;

    const browseTab = document.getElementById('tab-browse');
    const myListingsTab = document.getElementById('tab-my-listings');
    const filtersDiv = document.getElementById('marketplace-filters');

    browseTab?.classList.toggle('active', tab === 'browse');
    myListingsTab?.classList.toggle('active', tab === 'my-listings');

    // Hide filters in "My Listings" tab
    if (filtersDiv) {
      filtersDiv.style.display = tab === 'browse' ? 'flex' : 'none';
    }

    this.render();
  }

  private applyFilters(): void {
    this.render();
  }

  public show(): void {
    this.container.classList.remove('hidden');
  }

  public hide(): void {
    this.container.classList.add('hidden');
  }

  public setListings(listings: MarketplaceListing[]): void {
    this.listings = listings;
    if (this.currentTab === 'browse') {
      this.render();
    }
  }

  public setMyListings(listings: MarketplaceListing[]): void {
    this.myListings = listings;
    if (this.currentTab === 'my-listings') {
      this.render();
    }
  }

  public setStats(stats: MarketplaceStats): void {
    this.stats = stats;
    this.updateStats();
  }

  private updateStats(): void {
    const activeEl = document.getElementById('stat-active');
    const soldEl = document.getElementById('stat-sold');
    const avgEl = document.getElementById('stat-avg');

    if (activeEl) activeEl.textContent = this.stats.total_active.toString();
    if (soldEl) soldEl.textContent = this.stats.total_sold_24h.toString();
    if (avgEl) avgEl.textContent = `${Math.round(this.stats.avg_price)} 🪙`;
  }

  private render(): void {
    const grid = document.getElementById('marketplace-grid');
    if (!grid) return;

    const listingsToShow = this.currentTab === 'browse' ? this.filterListings() : this.myListings;

    if (listingsToShow.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          ${this.currentTab === 'browse' 
            ? 'No listings found' 
            : 'You have no active listings'}
        </div>
      `;
      this.updateCount(0);
      return;
    }

    grid.innerHTML = '';

    listingsToShow.forEach(listing => {
      const card = this.createListingCard(listing);
      grid.appendChild(card);
    });

    this.updateCount(listingsToShow.length);
  }

  private filterListings(): MarketplaceListing[] {
    let filtered = this.listings.filter(l => l.status === 'active');

    if (this.currentFilter.item_type) {
      filtered = filtered.filter(l => l.item_type === this.currentFilter.item_type);
    }

    if (this.currentFilter.min_price !== undefined) {
      filtered = filtered.filter(l => l.price >= this.currentFilter.min_price!);
    }

    if (this.currentFilter.max_price !== undefined) {
      filtered = filtered.filter(l => l.price <= this.currentFilter.max_price!);
    }

    if (this.currentFilter.search) {
      const query = this.currentFilter.search.toLowerCase();
      filtered = filtered.filter(l => 
        l.item_type?.toLowerCase().includes(query) ||
        l.seller_name?.toLowerCase().includes(query)
      );
    }

    // Sort by price (lowest first)
    filtered.sort((a, b) => a.price - b.price);

    return filtered;
  }

  private createListingCard(listing: MarketplaceListing): HTMLElement {
    const card = document.createElement('div');
    card.className = 'listing-card';

    const isMyListing = this.currentTab === 'my-listings';

    card.innerHTML = `
      <div class="listing-header">
        <span class="listing-item-type">${this.escapeHtml(listing.item_type || 'Item')}</span>
        <span class="listing-price">${listing.price} 🪙</span>
      </div>
      <div class="listing-body">
        <div class="listing-seller">
          Seller: <strong>${this.escapeHtml(listing.seller_name || 'Unknown')}</strong>
        </div>
        <div class="listing-date">
          Listed: ${this.formatDate(listing.created_at)}
        </div>
      </div>
      <div class="listing-actions">
        ${isMyListing
          ? `<button class="cancel-btn" data-id="${listing.id}">Cancel</button>`
          : `<button class="buy-btn" data-id="${listing.id}">Buy</button>`
        }
      </div>
    `;

    // Attach button listeners
    const buyBtn = card.querySelector('.buy-btn');
    buyBtn?.addEventListener('click', () => {
      if (confirm(`Buy ${listing.item_type} for ${listing.price} coins?`)) {
        this.onBuy?.(listing.id);
      }
    });

    const cancelBtn = card.querySelector('.cancel-btn');
    cancelBtn?.addEventListener('click', () => {
      if (confirm(`Cancel listing for ${listing.item_type}?`)) {
        this.onCancelListing?.(listing.id);
      }
    });

    return card;
  }

  private updateCount(count: number): void {
    const countEl = document.getElementById('marketplace-count');
    if (countEl) {
      countEl.textContent = `${count} listing${count !== 1 ? 's' : ''}`;
    }
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
