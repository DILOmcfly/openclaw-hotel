/**
 * TradeWindow.ts
 * Trading interface for OpenClaw Hotel (Habbo-style)
 */

export type TradeItem = {
  itemDefId: string;
  quantity: number;
  name?: string;
};

export type TradeState = 'pending' | 'accepted' | 'completed' | 'cancelled';

export class TradeWindow {
  private container!: HTMLElement;
  private tradeId: string | null = null;
  private otherAgentId: string | null = null;
  private otherAgentName: string = 'Unknown';
  private myItems: TradeItem[] = [];
  private theirItems: TradeItem[] = [];
  private myAccepted: boolean = false;
  private theirAccepted: boolean = false;

  private onAccept?: (tradeId: string) => void;
  private onReject?: (tradeId: string) => void;
  private onCancel?: (tradeId: string) => void;
  private onUpdateItems?: (tradeId: string, items: TradeItem[]) => void;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('trade-window');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'trade-window';
    container.className = 'trade-window hidden';
    container.innerHTML = `
      <div class="trade-header">
        <h3>Trading with <span id="trade-partner-name">...</span></h3>
        <button class="trade-close" id="trade-close-btn">×</button>
      </div>
      
      <div class="trade-content">
        <!-- My Offer Panel -->
        <div class="trade-panel my-panel">
          <div class="panel-title">Your Offer</div>
          <div class="trade-items-list" id="my-trade-items">
            <div class="empty-offer">Drag items from inventory</div>
          </div>
          <div class="panel-status">
            <span id="my-status" class="status-indicator">Waiting...</span>
          </div>
        </div>

        <!-- Their Offer Panel -->
        <div class="trade-panel their-panel">
          <div class="panel-title">Their Offer</div>
          <div class="trade-items-list" id="their-trade-items">
            <div class="empty-offer">Waiting for offer...</div>
          </div>
          <div class="panel-status">
            <span id="their-status" class="status-indicator">Waiting...</span>
          </div>
        </div>
      </div>

      <div class="trade-footer">
        <button class="btn-secondary" id="trade-cancel-btn">Cancel</button>
        <button class="btn-primary" id="trade-accept-btn">Accept</button>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.attachListeners();
  }

  private attachListeners(): void {
    const closeBtn = document.getElementById('trade-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    const cancelBtn = document.getElementById('trade-cancel-btn');
    cancelBtn?.addEventListener('click', () => {
      if (this.tradeId) {
        this.onCancel?.(this.tradeId);
      }
      this.close();
    });

    const acceptBtn = document.getElementById('trade-accept-btn');
    acceptBtn?.addEventListener('click', () => {
      if (this.tradeId && !this.myAccepted) {
        this.myAccepted = true;
        this.updateStatus();
        this.onAccept?.(this.tradeId);
      }
    });

    // Enable drag-drop from inventory
    const myItemsList = document.getElementById('my-trade-items');
    myItemsList?.addEventListener('dragover', (e) => {
      e.preventDefault();
      myItemsList.classList.add('drag-over');
    });

    myItemsList?.addEventListener('dragleave', () => {
      myItemsList.classList.remove('drag-over');
    });

    myItemsList?.addEventListener('drop', (e) => {
      e.preventDefault();
      myItemsList.classList.remove('drag-over');

      const itemDefId = e.dataTransfer?.getData('itemDefId');
      if (itemDefId) {
        this.addMyItem(itemDefId);
      }
    });
  }

  private addMyItem(itemDefId: string, quantity: number = 1): void {
    // Check if item already exists
    const existing = this.myItems.find(item => item.itemDefId === itemDefId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.myItems.push({ itemDefId, quantity });
    }

    this.renderMyItems();
    
    // Notify server
    if (this.tradeId) {
      this.onUpdateItems?.(this.tradeId, this.myItems);
    }
  }

  private removeMyItem(itemDefId: string): void {
    this.myItems = this.myItems.filter(item => item.itemDefId !== itemDefId);
    this.renderMyItems();

    // Notify server
    if (this.tradeId) {
      this.onUpdateItems?.(this.tradeId, this.myItems);
    }
  }

  private renderMyItems(): void {
    const container = document.getElementById('my-trade-items');
    if (!container) return;

    if (this.myItems.length === 0) {
      container.innerHTML = '<div class="empty-offer">Drag items from inventory</div>';
      return;
    }

    container.innerHTML = this.myItems.map(item => `
      <div class="trade-item">
        <div class="item-icon">${this.getFurnitureIcon(item.itemDefId)}</div>
        <div class="item-name">${item.name || item.itemDefId}</div>
        <div class="item-quantity">×${item.quantity}</div>
        <button class="item-remove" data-item-def-id="${item.itemDefId}">×</button>
      </div>
    `).join('');

    // Attach remove listeners
    container.querySelectorAll('.item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemDefId = btn.getAttribute('data-item-def-id');
        if (itemDefId) {
          this.removeMyItem(itemDefId);
        }
      });
    });
  }

  private renderTheirItems(): void {
    const container = document.getElementById('their-trade-items');
    if (!container) return;

    if (this.theirItems.length === 0) {
      container.innerHTML = '<div class="empty-offer">Waiting for offer...</div>';
      return;
    }

    container.innerHTML = this.theirItems.map(item => `
      <div class="trade-item">
        <div class="item-icon">${this.getFurnitureIcon(item.itemDefId)}</div>
        <div class="item-name">${item.name || item.itemDefId}</div>
        <div class="item-quantity">×${item.quantity}</div>
      </div>
    `).join('');
  }

  private updateStatus(): void {
    const myStatus = document.getElementById('my-status');
    const theirStatus = document.getElementById('their-status');
    const acceptBtn = document.getElementById('trade-accept-btn') as HTMLButtonElement;

    if (myStatus) {
      myStatus.textContent = this.myAccepted ? '✓ Accepted' : 'Waiting...';
      myStatus.className = this.myAccepted ? 'status-indicator accepted' : 'status-indicator';
    }

    if (theirStatus) {
      theirStatus.textContent = this.theirAccepted ? '✓ Accepted' : 'Waiting...';
      theirStatus.className = this.theirAccepted ? 'status-indicator accepted' : 'status-indicator';
    }

    if (acceptBtn) {
      acceptBtn.disabled = this.myAccepted;
      acceptBtn.textContent = this.myAccepted ? 'Waiting for them...' : 'Accept';
    }
  }

  private getFurnitureIcon(itemDefId: string): string {
    const iconMap: Record<string, string> = {
      chair_wood: '🪑',
      table_round: '🪑',
      lamp_floor: '💡',
      plant_pot: '🪴',
      bookshelf: '📚',
      sofa_2seat: '🛋️',
      desk_office: '🖥️',
      bed_single: '🛏️',
    };
    return iconMap[itemDefId] || '📦';
  }

  // Public API
  public open(tradeId: string, otherAgentId: string, otherAgentName: string): void {
    this.tradeId = tradeId;
    this.otherAgentId = otherAgentId;
    this.otherAgentName = otherAgentName;
    this.myItems = [];
    this.theirItems = [];
    this.myAccepted = false;
    this.theirAccepted = false;

    const partnerName = document.getElementById('trade-partner-name');
    if (partnerName) {
      partnerName.textContent = otherAgentName;
    }

    this.renderMyItems();
    this.renderTheirItems();
    this.updateStatus();

    this.container.classList.remove('hidden');
  }

  public close(): void {
    this.container.classList.add('hidden');
    this.tradeId = null;
    this.otherAgentId = null;
    this.myItems = [];
    this.theirItems = [];
    this.myAccepted = false;
    this.theirAccepted = false;
  }

  public updateTheirOffer(items: TradeItem[]): void {
    this.theirItems = items;
    this.renderTheirItems();
    
    // Reset acceptance if items changed
    this.theirAccepted = false;
    this.myAccepted = false;
    this.updateStatus();
  }

  public markAccepted(agentId: string): void {
    if (agentId === this.otherAgentId) {
      this.theirAccepted = true;
    } else {
      this.myAccepted = true;
    }
    this.updateStatus();
  }

  public showCompleted(): void {
    const footer = this.container.querySelector('.trade-footer');
    if (footer) {
      footer.innerHTML = `
        <div class="trade-completed">
          <span class="success-icon">✓</span>
          <span>Trade completed!</span>
        </div>
        <button class="btn-primary" id="trade-close-completed-btn">Close</button>
      `;

      const closeBtn = document.getElementById('trade-close-completed-btn');
      closeBtn?.addEventListener('click', () => this.close());
    }
  }

  public showCancelled(reason: string): void {
    const footer = this.container.querySelector('.trade-footer');
    if (footer) {
      footer.innerHTML = `
        <div class="trade-cancelled">
          <span class="error-icon">×</span>
          <span>Trade ${reason}</span>
        </div>
        <button class="btn-secondary" id="trade-close-cancelled-btn">Close</button>
      `;

      const closeBtn = document.getElementById('trade-close-cancelled-btn');
      closeBtn?.addEventListener('click', () => this.close());
    }
  }

  // Event handlers (set by main.ts)
  public setOnAccept(callback: (tradeId: string) => void): void {
    this.onAccept = callback;
  }

  public setOnReject(callback: (tradeId: string) => void): void {
    this.onReject = callback;
  }

  public setOnCancel(callback: (tradeId: string) => void): void {
    this.onCancel = callback;
  }

  public setOnUpdateItems(callback: (tradeId: string, items: TradeItem[]) => void): void {
    this.onUpdateItems = callback;
  }

  public isOpen(): boolean {
    return !this.container.classList.contains('hidden');
  }

  public getTradeId(): string | null {
    return this.tradeId;
  }
}
