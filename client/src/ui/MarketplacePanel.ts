/**
 * MarketplacePanel.ts
 * Agent-to-agent marketplace for buying/selling furniture
 */

export type MarketplaceListing = {
  id: string;
  itemId: string;
  sellerId: string;
  itemType: string;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  buyerId: string | null;
  createdAt: string;
  soldAt: string | null;
};

export class MarketplacePanel {
  private container!: HTMLElement;
  private listings: MarketplaceListing[] = [];
  private myListings: MarketplaceListing[] = [];
  private currentTab: 'browse' | 'myListings' | 'create' = 'browse';
  private searchQuery: string = '';
  private itemTypeFilter: string = 'all';
  private sortBy: 'newest' | 'price-low' | 'price-high' = 'newest';
  private inventoryItems: any[] = [];

  public onRefresh?: () => void;
  public onBuy?: (listingId: string) => void;
  public onCreateListing?: (itemId: string, price: number) => void;
  public onCancelListing?: (listingId: string) => void;

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

      <div class="marketplace-tabs">
        <button class="tab-btn active" data-tab="browse">Browse</button>
        <button class="tab-btn" data-tab="myListings">My Listings</button>
        <button class="tab-btn" data-tab="create">Create Listing</button>
      </div>

      <div class="marketplace-content">
        <!-- Browse Tab -->
        <div class="tab-content active" data-tab-content="browse">
          <div class="marketplace-filters">
            <input 
              type="text" 
              id="marketplace-search" 
              placeholder="Search items..." 
              maxlength="50"
            />
            
            <select id="marketplace-type-filter">
              <option value="all">All Items</option>
              <option value="chair">Chairs</option>
              <option value="table">Tables</option>
              <option value="lamp">Lamps</option>
              <option value="sofa">Sofas</option>
              <option value="bed">Beds</option>
            </select>

            <select id="marketplace-sort">
              <option value="newest">Newest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>

          <div class="marketplace-grid" id="marketplace-browse-grid">
            <div class="loading">Loading marketplace...</div>
          </div>
        </div>

        <!-- My Listings Tab -->
        <div class="tab-content" data-tab-content="myListings">
          <div class="marketplace-grid" id="marketplace-my-grid">
            <div class="loading">Loading your listings...</div>
          </div>
        </div>

        <!-- Create Listing Tab -->
        <div class="tab-content" data-tab-content="create">
          <div class="create-listing-form">
            <h4>List an Item for Sale</h4>
            <div class="form-group">
              <label>Select Item from Inventory (storage only):</label>
              <select id="listing-item-select">
                <option value="">-- Select an item --</option>
              </select>
            </div>

            <div class="form-group">
              <label>Price (coins):</label>
              <input 
                type="number" 
                id="listing-price" 
                min="1" 
                max="100000" 
                placeholder="Enter price (1-100,000)"
              />
            </div>

            <button class="create-listing-btn" id="create-listing-submit">
              Create Listing
            </button>

            <div class="form-hint">
              💡 Only items in your storage (not placed in a room) can be listed.
            </div>
          </div>
        </div>
      </div>

      <div class="marketplace-footer">
        <button class="refresh-btn" id="marketplace-refresh">🔄 Refresh</button>
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
    const tabBtns = this.container.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.target as HTMLElement).getAttribute('data-tab') as 'browse' | 'myListings' | 'create';
        this.switchTab(tab);
      });
    });

    // Filters
    const searchInput = document.getElementById('marketplace-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderBrowseListings();
    });

    const typeFilter = document.getElementById('marketplace-type-filter') as HTMLSelectElement;
    typeFilter?.addEventListener('change', (e) => {
      this.itemTypeFilter = (e.target as HTMLSelectElement).value;
      this.renderBrowseListings();
    });

    const sortSelect = document.getElementById('marketplace-sort') as HTMLSelectElement;
    sortSelect?.addEventListener('change', (e) => {
      this.sortBy = (e.target as HTMLSelectElement).value as 'newest' | 'price-low' | 'price-high';
      this.renderBrowseListings();
    });

    // Create listing form
    const createBtn = document.getElementById('create-listing-submit');
    createBtn?.addEventListener('click', () => this.handleCreateListing());
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

  private switchTab(tab: 'browse' | 'myListings' | 'create'): void {
    this.currentTab = tab;

    // Update tab buttons
    const tabBtns = this.container.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      if (btn.getAttribute('data-tab') === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update tab content
    const tabContents = this.container.querySelectorAll('.tab-content');
    tabContents.forEach((content) => {
      if (content.getAttribute('data-tab-content') === tab) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    // Load data for the tab
    if (tab === 'myListings') {
      this.renderMyListings();
    } else if (tab === 'create') {
      this.renderCreateForm();
    }
  }

  public setListings(listings: MarketplaceListing[]): void {
    this.listings = listings;
    this.renderBrowseListings();
  }

  public setMyListings(listings: MarketplaceListing[]): void {
    this.myListings = listings;
    this.renderMyListings();
  }

  public setInventoryItems(items: any[]): void {
    this.inventoryItems = items.filter(item => item.roomId === null);
    this.renderCreateForm();
  }

  private renderBrowseListings(): void {
    const grid = document.getElementById('marketplace-browse-grid');
    if (!grid) return;

    let filtered = this.listings.filter(listing => listing.status === 'active');

    // Apply filters
    if (this.itemTypeFilter !== 'all') {
      filtered = filtered.filter(l => l.itemType === this.itemTypeFilter);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(l => 
        l.itemType.toLowerCase().includes(this.searchQuery)
      );
    }

    // Apply sorting
    filtered = this.sortListings(filtered);

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state">No listings found</div>';
      return;
    }

    grid.innerHTML = filtered.map(listing => `
      <div class="marketplace-card">
        <div class="card-icon">${this.getItemEmoji(listing.itemType)}</div>
        <div class="card-info">
          <h4>${this.escapeHtml(listing.itemType)}</h4>
          <p class="card-price">🪙 ${listing.price}</p>
          <p class="card-seller">Seller: ${this.escapeHtml(listing.sellerId.substring(0, 8))}...</p>
        </div>
        <button class="buy-btn" data-listing-id="${listing.id}">
          Buy Now
        </button>
      </div>
    `).join('');

    this.attachBuyButtons();
  }

  private renderMyListings(): void {
    const grid = document.getElementById('marketplace-my-grid');
    if (!grid) return;

    if (this.myListings.length === 0) {
      grid.innerHTML = '<div class="empty-state">You have no listings yet</div>';
      return;
    }

    grid.innerHTML = this.myListings.map(listing => `
      <div class="marketplace-card ${listing.status !== 'active' ? 'inactive' : ''}">
        <div class="card-icon">${this.getItemEmoji(listing.itemType)}</div>
        <div class="card-info">
          <h4>${this.escapeHtml(listing.itemType)}</h4>
          <p class="card-price">🪙 ${listing.price}</p>
          <p class="card-status status-${listing.status}">${listing.status.toUpperCase()}</p>
          ${listing.buyerId ? `<p class="card-buyer">Buyer: ${this.escapeHtml(listing.buyerId.substring(0, 8))}...</p>` : ''}
        </div>
        ${listing.status === 'active' ? `
          <button class="cancel-btn" data-listing-id="${listing.id}">
            Cancel
          </button>
        ` : ''}
      </div>
    `).join('');

    this.attachCancelButtons();
  }

  private renderCreateForm(): void {
    const select = document.getElementById('listing-item-select') as HTMLSelectElement;
    if (!select) return;

    if (this.inventoryItems.length === 0) {
      select.innerHTML = '<option value="">No items available in storage</option>';
      return;
    }

    select.innerHTML = '<option value="">-- Select an item --</option>' +
      this.inventoryItems.map(item => `
        <option value="${item.id}" data-type="${item.itemDefId}">
          ${this.getItemEmoji(item.itemDefId)} ${this.escapeHtml(item.itemDefId)}
        </option>
      `).join('');
  }

  private sortListings(listings: MarketplaceListing[]): MarketplaceListing[] {
    const sorted = [...listings];

    if (this.sortBy === 'newest') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (this.sortBy === 'price-low') {
      sorted.sort((a, b) => a.price - b.price);
    } else if (this.sortBy === 'price-high') {
      sorted.sort((a, b) => b.price - a.price);
    }

    return sorted;
  }

  private attachBuyButtons(): void {
    const buyButtons = this.container.querySelectorAll('.buy-btn');
    buyButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const listingId = (e.target as HTMLElement).getAttribute('data-listing-id');
        if (listingId) {
          const listing = this.listings.find(l => l.id === listingId);
          if (listing && confirm(`Buy ${listing.itemType} for ${listing.price} coins?`)) {
            this.onBuy?.(listingId);
          }
        }
      });
    });
  }

  private attachCancelButtons(): void {
    const cancelButtons = this.container.querySelectorAll('.cancel-btn');
    cancelButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const listingId = (e.target as HTMLElement).getAttribute('data-listing-id');
        if (listingId) {
          if (confirm('Cancel this listing?')) {
            this.onCancelListing?.(listingId);
          }
        }
      });
    });
  }

  private handleCreateListing(): void {
    const select = document.getElementById('listing-item-select') as HTMLSelectElement;
    const priceInput = document.getElementById('listing-price') as HTMLInputElement;

    const itemId = select.value;
    const price = parseInt(priceInput.value, 10);

    if (!itemId) {
      alert('Please select an item');
      return;
    }

    if (isNaN(price) || price < 1 || price > 100000) {
      alert('Please enter a valid price (1-100,000 coins)');
      return;
    }

    this.onCreateListing?.(itemId, price);
  }

  private getItemEmoji(itemType: string): string {
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

    return emojis[itemType] || '📦';
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
