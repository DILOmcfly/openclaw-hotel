/**
 * UI Overlay Manager for OpenClaw Hotel
 * Manages all HTML/CSS UI screens and transitions
 */

export type Screen = 'login' | 'navigator' | 'game';

export class UIManager {
  private currentScreen: Screen = 'login';
  private username: string = '';
  private token: string = '';
  
  private loginScreen!: HTMLElement;
  private navigatorScreen!: HTMLElement;
  private gameUI!: HTMLElement;
  
  constructor() {
    this.initScreens();
    this.showScreen('login');
  }

  private initScreens(): void {
    // Remove any existing UI overlays
    const existing = document.getElementById('ui-overlay');
    if (existing) existing.remove();

    // Create main overlay container
    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    overlay.innerHTML = `
      <!-- Login/Register Screen -->
      <div id="login-screen" class="screen">
        <div class="login-container">
          <div class="login-header">
            <h1 class="logo">OpenClaw Hotel</h1>
            <p class="tagline">Retro Isometric Social World</p>
          </div>
          
          <div class="login-tabs">
            <button class="tab-btn active" data-tab="login">Login</button>
            <button class="tab-btn" data-tab="register">Register</button>
            <button class="tab-btn" data-tab="guest">Guest</button>
          </div>

          <!-- Login Form -->
          <form id="login-form" class="auth-form active">
            <div class="form-group">
              <label>Username</label>
              <input type="text" id="login-username" placeholder="Enter username" required>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="login-password" placeholder="Enter password" required>
            </div>
            <button type="submit" class="btn-primary">Enter Hotel</button>
            <p class="form-error" id="login-error"></p>
          </form>

          <!-- Register Form -->
          <form id="register-form" class="auth-form">
            <div class="form-group">
              <label>Username</label>
              <input type="text" id="register-username" placeholder="Choose username" required>
            </div>
            <div class="form-group">
              <label>Display Name</label>
              <input type="text" id="register-displayname" placeholder="Your name in hotel" required>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="register-password" placeholder="Create password" required>
            </div>
            <div class="form-group">
              <label>Confirm Password</label>
              <input type="password" id="register-confirm" placeholder="Confirm password" required>
            </div>
            <button type="submit" class="btn-primary">Create Account</button>
            <p class="form-error" id="register-error"></p>
          </form>

          <!-- Guest Form -->
          <form id="guest-form" class="auth-form">
            <div class="form-group">
              <label>Guest Name</label>
              <input type="text" id="guest-name" placeholder="Pick a guest name" required>
            </div>
            <p class="guest-notice">Guest accounts are temporary and won't save progress.</p>
            <button type="submit" class="btn-primary">Enter as Guest</button>
            <p class="form-error" id="guest-error"></p>
          </form>
        </div>
      </div>

      <!-- Room Navigator Screen -->
      <div id="navigator-screen" class="screen hidden">
        <div class="navigator-container">
          <div class="navigator-header">
            <h2>Room Navigator</h2>
            <div class="user-info">
              <span class="username-display" id="nav-username"></span>
              <button class="btn-secondary btn-sm" id="nav-logout">Logout</button>
            </div>
          </div>

          <div class="navigator-content">
            <div class="room-list" id="room-list">
              <div class="loading">Loading rooms...</div>
            </div>

            <div class="room-create">
              <h3>Create New Room</h3>
              <div class="create-form">
                <input type="text" id="room-name" placeholder="Room name" maxlength="32">
                <select id="room-size">
                  <option value="small">Small (10x10)</option>
                  <option value="medium" selected>Medium (15x15)</option>
                  <option value="large">Large (20x20)</option>
                </select>
                <button class="btn-primary" id="create-room-btn">Create Room</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Game UI (HUD + Chat + Inventory) -->
      <div id="game-ui" class="screen hidden">
        <!-- HUD -->
        <div class="hud">
          <div class="hud-left">
            <div class="player-avatar" id="player-avatar"></div>
            <div class="player-info">
              <span class="player-name" id="player-name"></span>
              <span class="current-room" id="current-room">Lobby</span>
            </div>
          </div>
          <div class="hud-right">
            <button class="hud-btn" id="inventory-toggle" title="Inventory">
              <span class="icon">📦</span>
            </button>
            <button class="hud-btn" id="settings-btn" title="Settings">
              <span class="icon">⚙️</span>
            </button>
            <button class="hud-btn" id="logout-btn" title="Logout">
              <span class="icon">🚪</span>
            </button>
          </div>
        </div>

        <!-- Inventory Panel -->
        <div class="inventory-panel hidden" id="inventory-panel">
          <div class="panel-header">
            <h3>Inventory</h3>
            <button class="panel-close" id="inventory-close">×</button>
          </div>
          <div class="panel-tabs">
            <button class="panel-tab active" data-panel-tab="owned">Owned</button>
            <button class="panel-tab" data-panel-tab="catalog">Catalog</button>
          </div>
          <div class="inventory-content">
            <!-- Owned Furniture -->
            <div class="tab-content active" id="owned-furniture">
              <div class="furniture-grid" id="furniture-grid">
                <div class="empty-state">No furniture yet</div>
              </div>
            </div>
            <!-- Furniture Catalog -->
            <div class="tab-content" id="catalog-furniture">
              <div class="catalog-categories">
                <button class="category-btn active" data-category="all">All</button>
                <button class="category-btn" data-category="seating">Seating</button>
                <button class="category-btn" data-category="tables">Tables</button>
                <button class="category-btn" data-category="decoration">Decoration</button>
                <button class="category-btn" data-category="storage">Storage</button>
              </div>
              <div class="furniture-grid" id="catalog-grid">
                <div class="empty-state">Loading catalog...</div>
              </div>
            </div>
          </div>
          <div class="panel-footer">
            <button class="btn-secondary" id="place-furniture" disabled>Place Selected</button>
            <button class="btn-primary hidden" id="buy-furniture" disabled>Buy (100 coins)</button>
          </div>
        </div>

        <!-- Settings Panel -->
        <div class="settings-panel hidden" id="settings-panel">
          <div class="panel-header">
            <h3>Settings</h3>
            <button class="panel-close" id="settings-close">×</button>
          </div>
          <div class="settings-content">
            <div class="setting-group">
              <label for="master-volume">Master Volume</label>
              <input type="range" id="master-volume" min="0" max="100" value="70" step="1">
              <span class="volume-value" id="master-volume-value">70%</span>
            </div>
            <div class="setting-group">
              <label>
                <input type="checkbox" id="sound-enabled" checked>
                Enable Sound Effects
              </label>
            </div>
            <div class="setting-group">
              <label>
                <input type="checkbox" id="joystick-enabled">
                Virtual Joystick (Mobile)
              </label>
            </div>
            <div class="setting-group">
              <label for="joystick-position">Joystick Position</label>
              <select id="joystick-position">
                <option value="left">Left Side</option>
                <option value="right">Right Side</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Chat -->
        <div class="chat-container">
          <div class="chat-messages" id="chat-messages">
            <div class="chat-welcome">Welcome to OpenClaw Hotel! Type /help for commands.</div>
          </div>
          <div class="chat-input-wrapper">
            <input type="text" id="chat-input" placeholder="Type a message..." maxlength="256">
            <button id="chat-send" class="btn-primary">Send</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    
    // Cache screen references
    this.loginScreen = document.getElementById('login-screen')!;
    this.navigatorScreen = document.getElementById('navigator-screen')!;
    this.gameUI = document.getElementById('game-ui')!;

    // Attach event listeners
    this.attachLoginListeners();
    this.attachNavigatorListeners();
    this.attachGameListeners();
  }

  private attachLoginListeners(): void {
    // Tab switching
    const tabs = this.loginScreen.querySelectorAll('.tab-btn');
    const forms = this.loginScreen.querySelectorAll('.auth-form');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        forms.forEach(f => f.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.getAttribute('data-tab');
        const form = document.getElementById(`${tabName}-form`);
        if (form) form.classList.add('active');
      });
    });

    // Login form
    const loginForm = document.getElementById('login-form') as HTMLFormElement;
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (document.getElementById('login-username') as HTMLInputElement).value;
      const password = (document.getElementById('login-password') as HTMLInputElement).value;
      await this.handleLogin(username, password);
    });

    // Register form
    const registerForm = document.getElementById('register-form') as HTMLFormElement;
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (document.getElementById('register-username') as HTMLInputElement).value;
      const displayName = (document.getElementById('register-displayname') as HTMLInputElement).value;
      const password = (document.getElementById('register-password') as HTMLInputElement).value;
      const confirm = (document.getElementById('register-confirm') as HTMLInputElement).value;
      
      if (password !== confirm) {
        this.showError('register', 'Passwords do not match');
        return;
      }
      
      await this.handleRegister(username, displayName, password);
    });

    // Guest form
    const guestForm = document.getElementById('guest-form') as HTMLFormElement;
    guestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const guestName = (document.getElementById('guest-name') as HTMLInputElement).value;
      await this.handleGuest(guestName);
    });
  }

  private attachNavigatorListeners(): void {
    const logoutBtn = document.getElementById('nav-logout');
    logoutBtn?.addEventListener('click', () => this.handleLogout());

    const createBtn = document.getElementById('create-room-btn');
    createBtn?.addEventListener('click', () => this.handleCreateRoom());
  }

  private attachGameListeners(): void {
    // Inventory toggle
    const inventoryToggle = document.getElementById('inventory-toggle');
    const inventoryPanel = document.getElementById('inventory-panel');
    const inventoryClose = document.getElementById('inventory-close');
    
    inventoryToggle?.addEventListener('click', () => {
      inventoryPanel?.classList.toggle('hidden');
    });
    
    inventoryClose?.addEventListener('click', () => {
      inventoryPanel?.classList.add('hidden');
    });

    // Settings toggle
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsClose = document.getElementById('settings-close');
    
    settingsBtn?.addEventListener('click', () => {
      settingsPanel?.classList.toggle('hidden');
    });
    
    settingsClose?.addEventListener('click', () => {
      settingsPanel?.classList.add('hidden');
    });

    // Volume controls
    const masterVolumeSlider = document.getElementById('master-volume') as HTMLInputElement;
    const masterVolumeValue = document.getElementById('master-volume-value');
    const soundEnabledCheckbox = document.getElementById('sound-enabled') as HTMLInputElement;
    
    masterVolumeSlider?.addEventListener('input', (e) => {
      const volume = parseInt((e.target as HTMLInputElement).value) / 100;
      if (masterVolumeValue) {
        masterVolumeValue.textContent = `${Math.round(volume * 100)}%`;
      }
      // Import SoundManager at runtime to avoid circular dependency
      import('../SoundManager.js').then(({ SoundManager }) => {
        SoundManager.setMasterVolume(volume);
      });
    });
    
    soundEnabledCheckbox?.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      import('../SoundManager.js').then(({ SoundManager }) => {
        SoundManager.setEnabled(enabled);
      });
    });

    // Virtual Joystick controls
    const joystickEnabledCheckbox = document.getElementById('joystick-enabled') as HTMLInputElement;
    const joystickPositionSelect = document.getElementById('joystick-position') as HTMLSelectElement;
    
    joystickEnabledCheckbox?.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      if (this.onJoystickEnabledChange) {
        this.onJoystickEnabledChange(enabled);
      }
    });
    
    joystickPositionSelect?.addEventListener('change', (e) => {
      const position = (e.target as HTMLSelectElement).value as 'left' | 'right';
      if (this.onJoystickPositionChange) {
        this.onJoystickPositionChange(position);
      }
    });

    // Panel tabs (Owned / Catalog)
    const panelTabs = document.querySelectorAll('.panel-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const placeFurnitureBtn = document.getElementById('place-furniture');
    const buyFurnitureBtn = document.getElementById('buy-furniture');
    
    panelTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-panel-tab');
        
        panelTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const content = document.getElementById(`${tabName}-furniture`);
        content?.classList.add('active');

        // Toggle buttons based on active tab
        if (tabName === 'owned') {
          placeFurnitureBtn?.classList.remove('hidden');
          buyFurnitureBtn?.classList.add('hidden');
        } else {
          placeFurnitureBtn?.classList.add('hidden');
          buyFurnitureBtn?.classList.remove('hidden');
        }
      });
    });

    // Category filters
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const category = btn.getAttribute('data-category') || 'all';
        this.filterCatalog(category);
      });
    });

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', () => this.handleLogout());

    // Chat
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    const chatSend = document.getElementById('chat-send');
    
    const sendMessage = () => {
      const message = chatInput.value.trim();
      if (message) {
        this.onChatMessage?.(message);
        chatInput.value = '';
      }
    };
    
    chatSend?.addEventListener('click', sendMessage);
    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  // Auth handlers (to be connected to real API)
  private async handleLogin(username: string, password: string): Promise<void> {
    try {
      // TODO: Connect to real auth API
      // For now, simulate successful login
      console.log('[Auth] Login attempt:', username);
      
      // Placeholder: simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.username = username;
      this.token = `demo-token-${Date.now()}`;
      
      this.onAuthSuccess?.(this.username, this.token);
      this.showScreen('navigator');
    } catch (error) {
      this.showError('login', error instanceof Error ? error.message : 'Login failed');
    }
  }

  private async handleRegister(username: string, displayName: string, password: string): Promise<void> {
    try {
      console.log('[Auth] Register attempt:', username, displayName);
      
      // TODO: Connect to real auth API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.username = username;
      this.token = `demo-token-${Date.now()}`;
      
      this.onAuthSuccess?.(this.username, this.token);
      this.showScreen('navigator');
    } catch (error) {
      this.showError('register', error instanceof Error ? error.message : 'Registration failed');
    }
  }

  private async handleGuest(guestName: string): Promise<void> {
    try {
      console.log('[Auth] Guest login:', guestName);
      
      // TODO: Connect to real auth API
      await new Promise(resolve => setTimeout(resolve, 300));
      
      this.username = `Guest-${guestName}`;
      this.token = `guest-token-${Date.now()}`;
      
      this.onAuthSuccess?.(this.username, this.token);
      this.showScreen('navigator');
    } catch (error) {
      this.showError('guest', error instanceof Error ? error.message : 'Guest login failed');
    }
  }

  private handleLogout(): void {
    this.username = '';
    this.token = '';
    this.onLogout?.();
    this.showScreen('login');
  }

  private handleCreateRoom(): void {
    const nameInput = document.getElementById('room-name') as HTMLInputElement;
    const sizeSelect = document.getElementById('room-size') as HTMLSelectElement;
    
    const name = nameInput.value.trim();
    const size = sizeSelect.value;
    
    if (!name) {
      alert('Please enter a room name');
      return;
    }
    
    this.onCreateRoom?.(name, size);
    nameInput.value = '';
  }

  private showError(formType: string, message: string): void {
    const errorEl = document.getElementById(`${formType}-error`);
    if (errorEl) {
      errorEl.textContent = message;
      setTimeout(() => errorEl.textContent = '', 5000);
    }
  }

  public showScreen(screen: Screen): void {
    this.currentScreen = screen;
    
    this.loginScreen.classList.toggle('hidden', screen !== 'login');
    this.navigatorScreen.classList.toggle('hidden', screen !== 'navigator');
    this.gameUI.classList.toggle('hidden', screen !== 'game');

    if (screen === 'navigator') {
      this.updateNavigatorInfo();
    } else if (screen === 'game') {
      this.updateGameHUD();
    }
  }

  private updateNavigatorInfo(): void {
    const usernameDisplay = document.getElementById('nav-username');
    if (usernameDisplay) usernameDisplay.textContent = this.username;
  }

  private updateGameHUD(): void {
    const playerName = document.getElementById('player-name');
    if (playerName) playerName.textContent = this.username;
  }

  // Public API for integration
  public loadRooms(rooms: Array<{ id: string; name: string; occupants: number; maxOccupants: number }>): void {
    const roomList = document.getElementById('room-list');
    if (!roomList) return;

    if (rooms.length === 0) {
      roomList.innerHTML = '<div class="empty-state">No rooms available. Create one!</div>';
      return;
    }

    roomList.innerHTML = rooms.map(room => `
      <div class="room-card">
        <div class="room-header">
          <h4>${room.name}</h4>
          <span class="room-occupancy">${room.occupants}/${room.maxOccupants}</span>
        </div>
        <button class="btn-primary btn-sm join-room-btn" data-room-id="${room.id}">Join</button>
      </div>
    `).join('');

    // Attach join listeners
    roomList.querySelectorAll('.join-room-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-room-id');
        if (roomId) this.onJoinRoom?.(roomId);
      });
    });
  }

  public addChatMessage(username: string, message: string): void {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    msgEl.innerHTML = `<span class="chat-username">${username}:</span> ${message}`;
    
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Keep only last 50 messages
    const messages = chatMessages.querySelectorAll('.chat-message');
    if (messages.length > 50) {
      messages[0].remove();
    }
  }

  public setCurrentRoom(roomName: string): void {
    const roomDisplay = document.getElementById('current-room');
    if (roomDisplay) roomDisplay.textContent = roomName;
  }

  public loadInventory(furniture: Array<{ itemDefId: string; name: string; sprite?: string; count?: number }>): void {
    const grid = document.getElementById('furniture-grid');
    if (!grid) return;

    if (furniture.length === 0) {
      grid.innerHTML = '<div class="empty-state">No furniture yet</div>';
      return;
    }

    grid.innerHTML = furniture.map(item => `
      <div class="furniture-item" data-item-def-id="${item.itemDefId}" draggable="true">
        <div class="furniture-icon">${this.getFurnitureIcon(item.itemDefId)}</div>
        <div class="furniture-name">${item.name}</div>
        ${item.count ? `<div class="furniture-count">×${item.count}</div>` : ''}
      </div>
    `).join('');

    // Selection handling
    grid.querySelectorAll('.furniture-item').forEach(item => {
      item.addEventListener('click', () => {
        grid.querySelectorAll('.furniture-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        const placeBtn = document.getElementById('place-furniture') as HTMLButtonElement;
        if (placeBtn) placeBtn.disabled = false;
      });

      // Drag support for placement mode
      item.addEventListener('dragstart', (e) => {
        const itemDefId = item.getAttribute('data-item-def-id');
        if (itemDefId && e.dataTransfer) {
          e.dataTransfer.setData('itemDefId', itemDefId);
          this.onFurnitureDragStart?.(itemDefId);
        }
      });
    });

    // Place button handler
    const placeBtn = document.getElementById('place-furniture');
    placeBtn?.addEventListener('click', () => {
      const selected = grid.querySelector('.furniture-item.selected');
      if (selected) {
        const itemDefId = selected.getAttribute('data-item-def-id');
        if (itemDefId) {
          this.onPlaceFurniture?.(itemDefId);
        }
      }
    });
  }

  public loadCatalog(catalog: Array<{ itemDefId: string; name: string; category: string; price: number }>): void {
    this.catalogData = catalog; // Store for filtering
    this.renderCatalog(catalog);
  }

  private catalogData: Array<{ itemDefId: string; name: string; category: string; price: number }> = [];

  private renderCatalog(items: Array<{ itemDefId: string; name: string; category: string; price: number }>): void {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;

    if (items.length === 0) {
      grid.innerHTML = '<div class="empty-state">No items in this category</div>';
      return;
    }

    grid.innerHTML = items.map(item => `
      <div class="furniture-item catalog-item" data-item-def-id="${item.itemDefId}">
        <div class="furniture-icon">${this.getFurnitureIcon(item.itemDefId)}</div>
        <div class="furniture-name">${item.name}</div>
        <div class="furniture-price">${item.price} coins</div>
      </div>
    `).join('');

    // Selection handling
    grid.querySelectorAll('.furniture-item').forEach(item => {
      item.addEventListener('click', () => {
        grid.querySelectorAll('.furniture-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        const buyBtn = document.getElementById('buy-furniture') as HTMLButtonElement;
        if (buyBtn) {
          buyBtn.disabled = false;
          const price = items.find(i => i.itemDefId === item.getAttribute('data-item-def-id'))?.price || 0;
          buyBtn.textContent = `Buy (${price} coins)`;
        }
      });
    });

    // Buy button handler
    const buyBtn = document.getElementById('buy-furniture');
    buyBtn?.addEventListener('click', () => {
      const selected = grid.querySelector('.furniture-item.selected');
      if (selected) {
        const itemDefId = selected.getAttribute('data-item-def-id');
        if (itemDefId) {
          this.onBuyFurniture?.(itemDefId);
        }
      }
    });
  }

  private filterCatalog(category: string): void {
    if (category === 'all') {
      this.renderCatalog(this.catalogData);
    } else {
      const filtered = this.catalogData.filter(item => item.category === category);
      this.renderCatalog(filtered);
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

  // Event callbacks (to be set by main.ts)
  public onAuthSuccess?: (username: string, token: string) => void;
  public onLogout?: () => void;
  public onJoinRoom?: (roomId: string) => void;
  public onCreateRoom?: (name: string, size: string) => void;
  public onChatMessage?: (message: string) => void;
  public onPlaceFurniture?: (itemDefId: string) => void;
  public onBuyFurniture?: (itemDefId: string) => void;
  public onFurnitureDragStart?: (itemDefId: string) => void;
  public onJoystickEnabledChange?: (enabled: boolean) => void;
  public onJoystickPositionChange?: (position: 'left' | 'right') => void;

  public getToken(): string { return this.token; }
  public getUsername(): string { return this.username; }
  
  public setJoystickEnabled(enabled: boolean): void {
    const checkbox = document.getElementById('joystick-enabled') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = enabled;
    }
  }
  
  public setJoystickPosition(position: 'left' | 'right'): void {
    const select = document.getElementById('joystick-position') as HTMLSelectElement;
    if (select) {
      select.value = position;
    }
  }
}
