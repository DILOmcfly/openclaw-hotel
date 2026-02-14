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
          <div class="inventory-content">
            <div class="furniture-grid" id="furniture-grid">
              <div class="empty-state">No furniture yet</div>
            </div>
          </div>
          <div class="panel-footer">
            <button class="btn-secondary" id="place-furniture" disabled>Place Selected</button>
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

  public loadInventory(furniture: Array<{ id: string; name: string; icon: string }>): void {
    const grid = document.getElementById('furniture-grid');
    if (!grid) return;

    if (furniture.length === 0) {
      grid.innerHTML = '<div class="empty-state">No furniture yet</div>';
      return;
    }

    grid.innerHTML = furniture.map(item => `
      <div class="furniture-item" data-id="${item.id}">
        <div class="furniture-icon">${item.icon}</div>
        <div class="furniture-name">${item.name}</div>
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
    });
  }

  // Event callbacks (to be set by main.ts)
  public onAuthSuccess?: (username: string, token: string) => void;
  public onLogout?: () => void;
  public onJoinRoom?: (roomId: string) => void;
  public onCreateRoom?: (name: string, size: string) => void;
  public onChatMessage?: (message: string) => void;

  public getToken(): string { return this.token; }
  public getUsername(): string { return this.username; }
}
