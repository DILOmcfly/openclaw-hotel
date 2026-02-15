import { Application, Container } from 'pixi.js';
import { parseHeightmap, TileMap } from './renderer/TileMap.js';
import { AgentRenderer } from './renderer/AgentSprite.js';
import { BubbleSystem } from './renderer/BubbleSystem.js';
import { FurnitureManager } from './renderer/FurnitureManager.js';
import { HotelWSClient } from './ws/client.js';
import { AssetLoader } from './AssetLoader.js';
import { UIManager } from './ui/UIManager.js';
import { SoundManager } from './SoundManager.js';
import { EmoteManager, type EmoteName } from './EmoteManager.js';
import { LoadingScreen } from './LoadingScreen.js';
import { toastManager } from './ToastManager.js';
import { VirtualJoystick, type Direction } from './VirtualJoystick.js';
import { memoryProfiler } from './renderer/MemoryProfiler.js';
import { RoomEditor } from './RoomEditor.js';
import { TradeWindow } from './ui/TradeWindow.js';
import { WhisperWindow } from './ui/WhisperWindow.js';
import { FriendsPanel } from './ui/FriendsPanel.js';
import { ProfilePanel } from './ui/ProfilePanel.js';
import { AvatarCustomizer } from './ui/AvatarCustomizer.js';
import { NotificationCenter } from './ui/NotificationCenter.js';
import { Navigator } from './ui/Navigator.js';
import { GamePanel } from './ui/GamePanel.js';
import { LeaderboardPanel } from './ui/LeaderboardPanel.js';
import { ShopPanel } from './ui/ShopPanel.js';
import { TemplatesBrowser } from './ui/TemplatesBrowser.js';
import { InventoryPanel } from './ui/InventoryPanel.js';
import { eventBus, Events } from './utils/EventBus.js';

const DEMO_MAP = `
xxxx00000
xxxx00000
xxx000000
xx0000000
x00000000
000000000
000000000
000000000
000000000
`.trim();

// Random color for this agent
const MY_COLOR = Math.floor(Math.random() * 0xffffff);
let MY_ID = `agent-${Math.random().toString(36).slice(2, 8)}`;

// Simplified - context menu will be created inside init() with closure access

async function init() {
  // Show loading screen
  const loadingScreen = new LoadingScreen();
  loadingScreen.show();

  // Initialize UI Manager first
  const ui = new UIManager();

  // Pixi.js Application
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#1a1a2e',
    antialias: true,
  });

  // Load pixel art assets with progress
  console.log('Loading pixel art assets...');
  await AssetLoader.load((percent) => {
    loadingScreen.setProgress(percent);
  });
  console.log('Assets loaded!');
  
  // Hide loading screen with fade-out
  loadingScreen.hide();

  const appEl = document.getElementById('app');
  if (!appEl) throw new Error('Missing #app element');
  appEl.appendChild(app.canvas);

  // World container centered on screen
  const world = new Container();
  world.sortableChildren = true;
  world.position.set(app.screen.width / 2, app.screen.height / 3);
  app.stage.addChild(world);

  // Parse and render tilemap
  const heightmap = parseHeightmap(DEMO_MAP);
  let tileMap = new TileMap(heightmap, world);
  tileMap.render();

  // Renderers
  const agentRenderer = new AgentRenderer(world);
  const bubbleSystem = new BubbleSystem(world, app.screen.width / 2, app.screen.height / 3);
  const furnitureManager = new FurnitureManager(world);
  const emoteManager = new EmoteManager();

  // Virtual Joystick for mobile
  const joystick = new VirtualJoystick();
  let joystickMoveThrottle = 0;
  const JOYSTICK_THROTTLE_MS = 300; // Match walk animation duration
  
  // Initialize joystick UI state
  ui.setJoystickEnabled(joystick.isEnabled());
  ui.setJoystickPosition(joystick.getPosition().side);

  // Room Editor
  const roomEditor = new RoomEditor();
  let currentRoomOwnerId: string | null = null; // Track if current user owns the room

  // Trade Window
  const tradeWindow = new TradeWindow();
  
  // Whisper, Friends, Profile, and Navigator panels
  const whisperWindow = new WhisperWindow(MY_ID);
  const friendsPanel = new FriendsPanel();
  const profilePanel = new ProfilePanel();
  const navigator = new Navigator();
  
  // Game Panel
  const gamePanel = new GamePanel();
  
  // Leaderboard Panel
  const leaderboardPanel = new LeaderboardPanel();
  
  // Shop Panel
  const shopPanel = new ShopPanel({
    onPurchase: (itemDefId, quantity) => {
      console.log('[ShopPanel] Purchased:', itemDefId, 'x', quantity);
      toastManager.show(`Purchased ${quantity}× ${itemDefId}!`, 'success');
      // Emit inventory update event
      eventBus.emit(Events.INVENTORY_UPDATE);
    },
    onClose: () => {
      shopPanel.hide();
    },
  });

  // Inventory Panel
  const inventoryPanel = new InventoryPanel();
  inventoryPanel.onPlace = async (itemId) => {
    console.log('[Inventory] Place item:', itemId);
    
    if (!isConnected) {
      toastManager.error('You must be in a room to place furniture');
      return;
    }

    // Auto-place in center of room (simple MVP - no manual placement UI yet)
    const x = 5;
    const y = 5;
    const rotation = 0;

    try {
      ws.send({
        type: 'furniture.place',
        roomId: currentRoom,
        itemDefId: itemId,
        x,
        y,
        rotation,
      });

      toastManager.success(`Furniture placed at (${x}, ${y})`);
      inventoryPanel.hide();
      
      // Emit inventory update event for reactive refresh
      setTimeout(() => {
        eventBus.emit(Events.INVENTORY_UPDATE);
      }, 500);
    } catch (error: any) {
      console.error('[Inventory] Place error:', error);
      toastManager.error(error.message || 'Failed to place furniture');
    }
  };

  inventoryPanel.onSell = async (itemId) => {
    try {
      const token = ui.getToken();
      if (!token) {
        toastManager.show('You must be logged in to sell items', 'error');
        return;
      }

      const response = await fetch(`/api/inventory/sell/${itemId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sell item');
      }

      const result = await response.json();
      toastManager.show(`Sold for ${result.coinsRefunded} coins!`, 'success');
      
      // Emit events for reactive updates
      eventBus.emit(Events.INVENTORY_UPDATE);
      eventBus.emit(Events.BALANCE_UPDATE, result.coinsRefunded);
    } catch (error: any) {
      console.error('[Inventory] Error selling item:', error);
      toastManager.show(error.message || 'Failed to sell item', 'error');
    }
  };

  inventoryPanel.onRefresh = () => {
    loadInventory();
  };

  // Subscribe inventory panel to auto-refresh on updates
  eventBus.on(Events.INVENTORY_UPDATE, () => {
    loadInventory();
  });

  // Helper function to load inventory
  async function loadInventory() {
    try {
      inventoryPanel.showLoading();

      const token = ui.getToken();
      if (!token) {
        console.error('[Inventory] No token available');
        inventoryPanel.showEmpty();
        return;
      }

      const response = await fetch('/api/inventory?inRoom=false', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch inventory');
      }

      const data = await response.json();
      inventoryPanel.setItems(data.items);
    } catch (error: any) {
      console.error('[Inventory] Error loading:', error);
      inventoryPanel.showEmpty();
    }
  }
  
  // Templates Browser
  const templatesBrowser = new TemplatesBrowser();
  templatesBrowser.onCreateRoom = (roomId, roomName) => {
    toastManager.show(`Room "${roomName}" created from template!`, 'success');
    // Optionally auto-join the new room
    ui.onJoinRoom?.(roomId);
  };
  
  // Navigator event handlers
  navigator.onJoinRoom = (roomId) => {
    console.log('[Navigator] Joining room:', roomId);
    ui.onJoinRoom?.(roomId);
    
    // Track visit
    const token = ui.getToken();
    if (token) {
      fetch(`/api/navigator/visit/${roomId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }).catch(err => console.error('[Navigator] Failed to track visit:', err));
    }
    
    // Hide navigator panel after joining
    navigator.hide();
  };
  
  // Notification Center (pass HUD element as parent)
  let notificationCenter: NotificationCenter | null = null;
  // Will be initialized after HUD is created
  
  // Trade event handlers
  tradeWindow.setOnAccept((tradeId) => {
    console.log('[Trade] Accepting trade:', tradeId);
    if (isConnected) {
      ws.send({ type: 'trade.accept', tradeId });
    }
  });
  
  tradeWindow.setOnReject((tradeId) => {
    console.log('[Trade] Rejecting trade:', tradeId);
    if (isConnected) {
      ws.send({ type: 'trade.reject', tradeId });
    }
  });
  
  tradeWindow.setOnCancel((tradeId) => {
    console.log('[Trade] Cancelling trade:', tradeId);
    if (isConnected) {
      ws.send({ type: 'trade.cancel', tradeId });
    }
  });
  
  tradeWindow.setOnUpdateItems((tradeId, items) => {
    console.log('[Trade] Updating items:', tradeId, items);
    if (isConnected) {
      ws.send({ type: 'trade.update', tradeId, items });
    }
  });
  
  // Whisper Window event handlers
  whisperWindow.onSendMessage = (recipientId, content) => {
    console.log('[Whisper] Sending message to:', recipientId);
    if (isConnected) {
      ws.send({
        type: 'whisper.send',
        recipientId,
        content,
      });
    }
  };

  whisperWindow.onTyping = (recipientId) => {
    if (isConnected) {
      ws.send({
        type: 'whisper.typing',
        recipientId,
      });
    }
  };
  
  // Friends Panel event handlers
  friendsPanel.onWhisper = async (agentId) => {
    console.log('[Friends] Opening whisper window for:', agentId);
    const friend = friendsPanel['friends'].find((f: any) => f.agentId === agentId);
    if (!friend) return;
    
    // Load conversation history
    await whisperWindow.loadHistory(agentId);
    
    // Open window
    whisperWindow.open(agentId, friend.displayName);
    
    // Mark messages as read
    whisperWindow.markAsRead(agentId);
  };
  
  // Game Panel event handlers
  gamePanel.setOnCreateGame((gameType) => {
    console.log('[Game] Creating game:', gameType);
    if (isConnected && currentRoom) {
      ws.send({
        type: 'game.create',
        roomId: currentRoom,
        gameType,
      });
    }
  });
  
  gamePanel.setOnMakeMove((gameId, move) => {
    console.log('[Game] Making move:', gameId, move);
    if (isConnected) {
      ws.send({
        type: 'game.move',
        gameId,
        move,
      });
    }
  });

  friendsPanel.onAcceptRequest = (friendshipId) => {
    console.log('[Friends] Accepting friend request:', friendshipId);
    if (isConnected) {
      ws.send({ type: 'friend.accept', friendshipId });
      eventBus.emit(Events.FRIENDS_UPDATE);
    }
  };

  friendsPanel.onRejectRequest = async (friendshipId) => {
    console.log('[Friends] Rejecting friend request:', friendshipId);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/friends/${friendshipId}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject friend request');
      }

      toastManager.success('Friend request rejected');
      // Emit event for reactive update
      eventBus.emit(Events.FRIENDS_UPDATE);
    } catch (error: any) {
      console.error('[Friends] Reject error:', error);
      toastManager.error(error.message || 'Failed to reject friend request');
    }
  };

  friendsPanel.onRemoveFriend = async (friendshipId) => {
    console.log('[Friends] Removing friend:', friendshipId);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove friend');
      }

      toastManager.success('Friend removed');
      // Emit event for reactive update
      eventBus.emit(Events.FRIENDS_UPDATE);
    } catch (error: any) {
      console.error('[Friends] Remove error:', error);
      toastManager.error(error.message || 'Failed to remove friend');
    }
  };

  // Helper function to load friends list
  async function loadFriends() {
    try {
      const token = ui.getToken();
      if (!token) return;

      const response = await fetch('/api/friends', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        friendsPanel.setFriends(data.friends || []);
      }

      const pendingResponse = await fetch('/api/friends/pending', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (pendingResponse.ok) {
        const { requests } = await pendingResponse.json();
        friendsPanel.setPendingRequests(requests);
      }
    } catch (error) {
      console.error('[Friends] Failed to load friends:', error);
    }
  }

  // Subscribe friends panel to auto-refresh on updates
  eventBus.on(Events.FRIENDS_UPDATE, () => {
    loadFriends();
  });

  // WebSocket connection
  const ws = new HotelWSClient();
  let currentRoom = 'lobby';
  let isConnected = false;

  // UI Event Handlers
  ui.onAuthSuccess = async (username: string, token: string) => {
    console.log('[Auth] Success:', username);
    MY_ID = username; // Use username as agent ID
    
    // Update whisper window with correct agent ID
    whisperWindow['myAgentId'] = MY_ID;
    
    // Initialize audio system (requires user interaction)
    if (!SoundManager.isInitialized()) {
      await SoundManager.initialize();
    }
    
    // Try to connect to WebSocket
    try {
      ws.connect(token);
    } catch (error) {
      console.log('[WS] Connection failed, running in offline mode');
    }

    // Show navigator after login
    ui.showScreen('navigator');
    navigator.show();
    navigator.search(); // Load initial room list
  };

  ui.onJoinRoom = async (roomId: string) => {
    console.log('[Room] Joining:', roomId);
    SoundManager.play('door_open');
    
    // Cleanup previous room if changing rooms
    if (currentRoom !== roomId) {
      console.log('[Room] Cleaning up previous room');
      // Emit room left event for previous room
      eventBus.emit(Events.ROOM_LEFT, currentRoom);
      agentRenderer.cleanup();
      furnitureManager.cleanup();
      // Note: TileMap doesn't change between rooms in current implementation
    }
    
    currentRoom = roomId;
    
    if (isConnected) {
      ws.joinRoom(roomId);
      furnitureManager.connectWS(ws, roomId);
    }
    
    // Add self to room
    agentRenderer.addOrUpdate({ agentId: MY_ID, x: 4, y: 4, color: MY_COLOR });
    
    // Switch to game screen
    ui.showScreen('game');
    ui.setCurrentRoom(roomId);
    
    // Emit room joined event
    eventBus.emit(Events.ROOM_JOINED, roomId);
    
    // Initialize Notification Center (once)
    if (!notificationCenter) {
      const hudControls = document.querySelector('.hud-controls');
      if (hudControls) {
        notificationCenter = new NotificationCenter(hudControls as HTMLElement);
      }
    }
    
    // Load demo inventory and catalog
    loadInventory();
    loadCatalog();

    // Check if current user owns this room
    try {
      const token = ui.getToken();
      if (token) {
        const response = await fetch(`/api/rooms/${roomId}/layout`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const roomData = await response.json();
          currentRoomOwnerId = roomData.createdBy;
          
          // Show editor button if user is owner
          if (currentRoomOwnerId === MY_ID) {
            ui.showRoomEditorButton();
          } else {
            ui.hideRoomEditorButton();
          }
        }
      }
    } catch (error) {
      console.error('[Room] Failed to fetch room details:', error);
      ui.hideRoomEditorButton(); // Hide on error
    }
  };

  ui.onCreateRoom = async (name: string, category: string) => {
    console.log('[Room] Creating:', name, category);
    
    try {
      const token = ui.getToken();
      if (!token) {
        toastManager.error('You must be logged in to create rooms');
        return;
      }

      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          category: category || 'public',
          visibility: 'public',
          maxOccupants: 50,
          description: `${name} - A new room`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create room');
      }

      const { room } = await response.json();
      
      toastManager.success(`Room "${room.name}" created successfully!`);
      ui.addChatMessage('System', `Room "${room.name}" created!`);
      
      // Reload rooms list
      await loadRooms();
      
      // Auto-join the new room
      if (isConnected) {
        ws.send({ type: 'room.join', roomId: room.id });
      }
    } catch (error: any) {
      console.error('[Room] Create error:', error);
      toastManager.error(error.message || 'Failed to create room');
    }
  };

  ui.onGamesToggle = () => {
    console.log('[UI] Toggling games panel');
    gamePanel.show();
  };

  ui.onLeaderboardToggle = async () => {
    console.log('[UI] Toggling leaderboard panel');
    leaderboardPanel.show();
    leaderboardPanel.setCurrentAgent(MY_ID);
    
    // Load initial category (coins)
    await loadLeaderboard(leaderboardPanel.getCurrentCategory());
  };

  ui.onShopToggle = () => {
    console.log('[UI] Toggling shop panel');
    shopPanel.show();
  };

  ui.onTemplatesToggle = () => {
    console.log('[UI] Toggling templates browser');
    templatesBrowser.show();
  };

  ui.onInventoryToggle = () => {
    console.log('[UI] Toggling inventory panel');
    inventoryPanel.show();
    loadInventory();
  };

  // Avatar Customizer (initialized after login)
  let avatarCustomizer: AvatarCustomizer | null = null;

  ui.onAvatarCustomizerToggle = () => {
    console.log('[UI] Toggling avatar customizer');
    if (!avatarCustomizer) {
      avatarCustomizer = new AvatarCustomizer(ui.getToken());
      avatarCustomizer.onSave = (appearance) => {
        console.log('[AvatarCustomizer] Saved:', appearance);
        toastManager.show('Avatar customized!', 'success');
        // Emit avatar update event
        eventBus.emit(Events.AVATAR_UPDATE, appearance);
      };
    }
    avatarCustomizer.show();
  };

  // Leaderboard Panel event handlers
  leaderboardPanel.onCategoryChange = async (category) => {
    console.log('[Leaderboard] Category changed:', category);
    await loadLeaderboard(category);
  };

  leaderboardPanel.onJoinRoom = (roomId) => {
    console.log('[Leaderboard] Joining room:', roomId);
    ui.onJoinRoom?.(roomId);
    leaderboardPanel.hide();
  };

  // Helper function to load leaderboard data
  async function loadLeaderboard(category: string) {
    try {
      leaderboardPanel.showLoading();
      
      const token = ui.getToken();
      if (!token) {
        console.error('[Leaderboard] No token available');
        leaderboardPanel.showEmpty();
        return;
      }

      const response = await fetch(`/api/leaderboard/${category}?limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
      }

      const data = await response.json();
      leaderboardPanel.setEntries(data.entries || []);
      
      console.log(`[Leaderboard] Loaded ${data.entries.length} entries for ${category}`);
    } catch (error) {
      console.error('[Leaderboard] Error loading leaderboard:', error);
      toastManager.error('Failed to load leaderboard', 3000);
      leaderboardPanel.showEmpty();
    }
  }

  ui.onChatMessage = (message: string) => {
    // Check if message is a trade command: /trade @agentId
    if (message.startsWith('/trade ')) {
      const targetId = message.slice(7).trim();
      if (!targetId) {
        ui.addChatMessage('System', 'Usage: /trade @agentId');
        return;
      }
      
      if (!isConnected) {
        ui.addChatMessage('System', 'Not connected to server');
        return;
      }
      
      // Send trade request
      console.log('[Trade] Requesting trade with:', targetId);
      ws.send({
        type: 'trade.request',
        roomId: currentRoom,
        targetAgentId: targetId,
      });
      
      ui.addChatMessage('System', `Trade request sent to ${targetId}`);
      return;
    }
    
    // Check if message is an emote command
    const emoteName = EmoteManager.parseEmoteCommand(message);
    
    if (emoteName) {
      // Trigger emote locally
      const container = agentRenderer.getContainer(MY_ID);
      const sprite = agentRenderer.getSprite(MY_ID);
      
      if (container) {
        emoteManager.play(MY_ID, emoteName, container, sprite);
        
        // Handle sit/stand state
        if (emoteName === 'sit') {
          agentRenderer.setSitting(MY_ID, true);
        } else if (emoteName === 'stand') {
          agentRenderer.setSitting(MY_ID, false);
        }
      }
      
      // Send to server for broadcast
      if (isConnected) {
        ws.emote(currentRoom, emoteName);
      }
      
      // Show in chat
      ui.addChatMessage(ui.getUsername(), `*${emoteName}*`);
    } else {
      // Regular chat message
      SoundManager.play('chat_message');
      
      // Show own bubble
      const me = agentRenderer.getAll().find((a) => a.agentId === MY_ID);
      if (me) {
        bubbleSystem.show(MY_ID, message, me.x, me.y);
      }
      
      // Add to chat history
      ui.addChatMessage(ui.getUsername(), message);
      
      // Send to server
      if (isConnected) {
        ws.chat(currentRoom, message);
      }
    }
  };

  ui.onLogout = () => {
    console.log('[Auth] Logout');
    
    // Emit room left event
    eventBus.emit(Events.ROOM_LEFT, currentRoom);
    
    if (isConnected) {
      ws.disconnect();
      isConnected = false;
    }
    
    // Cleanup all resources
    agentRenderer.cleanup();
    furnitureManager.cleanup();
    tileMap.cleanup();
    
    // Log final memory stats
    memoryProfiler.logStats();
  };

  ui.onPlaceFurniture = (itemDefId: string) => {
    console.log('[Furniture] Starting placement mode:', itemDefId);
    furnitureManager.startPlacementMode(itemDefId);
    
    // Hide inventory panel during placement
    const inventoryPanel = document.getElementById('inventory-panel');
    inventoryPanel?.classList.add('hidden');
  };

  ui.onBuyFurniture = async (itemDefId: string) => {
    console.log('[Furniture] Buying:', itemDefId);

    try {
      const token = localStorage.getItem('hotel_token');
      if (!token) {
        ui.addChatMessage('System', 'You must be logged in to purchase furniture');
        return;
      }

      const res = await fetch('/api/furniture/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ itemDefId, quantity: 1 }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Purchase failed');
      }

      const data = await res.json();
      ui.addChatMessage('System', `Purchased ${humanizeName(itemDefId)}! Check your inventory.`);

      // Reload inventory to show new item
      setTimeout(() => loadInventory(), 500);
    } catch (error: any) {
      console.error('[Furniture] Purchase error:', error);
      ui.addChatMessage('System', `Failed to purchase: ${error.message}`);
    }
  };

  ui.onFurnitureDragStart = (itemDefId: string) => {
    console.log('[Furniture] Drag started:', itemDefId);
    furnitureManager.startPlacementMode(itemDefId);
  };

  // Furniture manager callbacks
  furnitureManager.onPlacementSuccess = () => {
    console.log('[Furniture] Placement successful');
    SoundManager.play('furniture_place');
    ui.addChatMessage('System', 'Furniture placed!');
  };

  furnitureManager.onPlacementFailed = (reason: string) => {
    console.log('[Furniture] Placement failed:', reason);
    ui.addChatMessage('System', reason);
  };

  furnitureManager.onItemSelected = (itemId: string) => {
    console.log('[Furniture] Item selected:', itemId);
  };

  let contextMenu: HTMLDivElement | null = null;
  
  furnitureManager.onContextMenu = (itemId: string, screenX: number, screenY: number) => {
    // Remove existing menu
    if (contextMenu) {
      contextMenu.remove();
    }

    contextMenu = document.createElement('div');
    contextMenu.className = 'furniture-context-menu';
    contextMenu.style.left = `${screenX}px`;
    contextMenu.style.top = `${screenY}px`;

    const options = [
      { label: 'ROTATE', emoji: '🔄', action: () => {
        SoundManager.play('furniture_rotate');
        furnitureManager.rotateSelectedFurniture();
      }},
      { label: 'MOVE', emoji: '↔️', action: () => {
        SoundManager.play('furniture_move');
        furnitureManager.startDragMode(itemId);
      }},
      { label: 'PICK UP', emoji: '🗑️', action: () => {
        SoundManager.play('ui_click');
        furnitureManager.removeSelectedFurniture();
      }},
    ];

    options.forEach((opt) => {
      const btn = document.createElement('div');
      btn.className = 'furniture-context-menu-option';
      btn.innerHTML = `<span>${opt.emoji}</span><span>${opt.label}</span>`;
      btn.onclick = () => {
        opt.action();
        contextMenu?.remove();
        contextMenu = null;
      };
      contextMenu.appendChild(btn);
    });

    document.body.appendChild(contextMenu);

    // Close on click outside
    setTimeout(() => {
      document.addEventListener(
        'click',
        () => {
          contextMenu?.remove();
          contextMenu = null;
        },
        { once: true }
      );
    }, 100);
  };

  // Agent context menu handler (for right-click on avatars)
  agentRenderer.onAgentContextMenu = (agentId: string, screenX: number, screenY: number) => {
    // Don't show context menu for self
    if (agentId === MY_ID) return;

    // Remove existing menu
    if (contextMenu) {
      contextMenu.remove();
    }

    contextMenu = document.createElement('div');
    contextMenu.className = 'furniture-context-menu'; // Reuse same styling
    contextMenu.style.left = `${screenX}px`;
    contextMenu.style.top = `${screenY}px`;

    const options = [
      { 
        label: 'TRADE', 
        emoji: '🤝', 
        action: () => {
          if (!isConnected) {
            toastManager.warning('Not connected to server', 2000);
            return;
          }

          SoundManager.play('ui_click');
          
          // Send trade request via WebSocket
          ws.send({
            type: 'trade.request',
            roomId: currentRoom,
            targetAgentId: agentId,
          });
          
          toastManager.info(`Trade request sent!`, 3000);
        }
      },
    ];

    options.forEach((opt) => {
      const btn = document.createElement('div');
      btn.className = 'furniture-context-menu-option';
      btn.innerHTML = `<span>${opt.emoji}</span><span>${opt.label}</span>`;
      btn.onclick = () => {
        opt.action();
        contextMenu?.remove();
        contextMenu = null;
      };
      contextMenu.appendChild(btn);
    });

    document.body.appendChild(contextMenu);

    // Close on click outside
    setTimeout(() => {
      document.addEventListener(
        'click',
        () => {
          contextMenu?.remove();
          contextMenu = null;
        },
        { once: true }
      );
    }, 100);
  };

  // Virtual Joystick Event Handlers
  const directionToTileOffset = (direction: Direction): { dx: number; dy: number } => {
    switch (direction) {
      case 'up': return { dx: 0, dy: -1 };
      case 'down': return { dx: 0, dy: 1 };
      case 'left': return { dx: -1, dy: 0 };
      case 'right': return { dx: 1, dy: 0 };
      case 'up-left': return { dx: -1, dy: -1 };
      case 'up-right': return { dx: 1, dy: -1 };
      case 'down-left': return { dx: -1, dy: 1 };
      case 'down-right': return { dx: 1, dy: 1 };
      default: return { dx: 0, dy: 0 };
    }
  };

  joystick.onDirection((direction: Direction) => {
    // Only allow joystick movement when in game screen
    if (ui['currentScreen'] !== 'game') return;
    
    // Throttle movement updates
    const now = Date.now();
    if (now - joystickMoveThrottle < JOYSTICK_THROTTLE_MS) return;
    joystickMoveThrottle = now;
    
    if (direction) {
      const offset = directionToTileOffset(direction);
      
      // Get current position
      const me = agentRenderer.getAll().find((a) => a.agentId === MY_ID);
      if (!me) return;
      
      // Calculate new position
      const newX = me.x + offset.dx;
      const newY = me.y + offset.dy;
      
      // Validate tile exists (bounds check)
      if (newX < 0 || newY < 0) return;
      
      // Update position locally
      agentRenderer.addOrUpdate({ agentId: MY_ID, x: newX, y: newY, color: MY_COLOR });
      
      // Send to server
      if (isConnected) {
        ws.move(currentRoom, newX, newY);
      }
    }
  });

  joystick.onRelease(() => {
    // Optional: Could send a "stop movement" message if needed
    console.log('[Joystick] Released');
  });

  ui.onJoystickEnabledChange = (enabled: boolean) => {
    joystick.setEnabled(enabled);
    console.log('[Joystick] Enabled:', enabled);
  };

  ui.onJoystickPositionChange = (position: 'left' | 'right') => {
    joystick.setPosition(position);
    console.log('[Joystick] Position:', position);
  };

  // Room Editor Event Handlers
  ui.onRoomEditorToggle = () => {
    const token = ui.getToken();
    if (currentRoom && token) {
      // Load current room layout
      roomEditor.loadLayout(currentRoom, token);
      ui.showRoomEditorPanel();
    }
  };

  roomEditor.onSave = async (heightmap: string) => {
    const token = ui.getToken();
    if (!currentRoom || !token) {
      toastManager.error('Not connected');
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${currentRoom}/layout`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ heightmap }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save layout');
      }

      toastManager.success('Room layout saved!');
      ui.hideRoomEditorPanel();

      // Reload room to see changes
      const data = await response.json();
      if (data.room?.heightmap) {
        const newHeightmap = parseHeightmap(data.room.heightmap);
        tileMap = new TileMap(newHeightmap, world);
        tileMap.render();
      }
    } catch (error) {
      console.error('[RoomEditor] Save failed:', error);
      toastManager.error(error instanceof Error ? error.message : 'Failed to save layout');
    }
  };

  roomEditor.onCancel = () => {
    ui.hideRoomEditorPanel();
  };

  // WebSocket Event Handlers
  ws.on('connected', async () => {
    console.log('[Hotel] Connected to server');
    isConnected = true;
    ws.joinRoom(currentRoom);
    
    // Show success toast on reconnection (not on first connect)
    if (ws['reconnectAttempts'] > 0) {
      toastManager.success('Reconnected to server!');
    }
    
    // Load friends list on connection
    await loadFriends();
  });

  ws.on('disconnected', () => {
    isConnected = false;
    toastManager.warning('Connection lost. Reconnecting...');
  });

  ws.on('reconnecting', (msg) => {
    const attempt = msg.attempt as number;
    console.log(`[Hotel] Reconnection attempt ${attempt}`);
  });

  ws.on('error', (msg) => {
    console.error('[Hotel] WebSocket error:', msg.error);
  });

  ws.on('room.state', (msg) => {
    const agents = msg.agents as Array<{ agentId: string; x: number; y: number }>;
    if (agents) {
      for (const a of agents) {
        if (a.agentId !== MY_ID) {
          agentRenderer.addOrUpdate({
            agentId: a.agentId,
            x: a.x,
            y: a.y,
            color: 0x666666,
          });
        }
      }
    }
  });

  // Handle spectator count updates
  ws.on('spectator.count', (msg) => {
    const count = msg.count as number;
    ui.updateSpectatorCount(count);
  });

  // Throttle agent position updates (max 10/s per agent)
  const positionUpdateThrottles = new Map<string, { lastUpdate: number; pending: any }>();
  const THROTTLE_MS = 100; // 10 updates per second max

  ws.on('agent.moved', (msg) => {
    const agentId = msg.agentId as string;
    const x = msg.x as number;
    const y = msg.y as number;
    
    if (agentId === MY_ID) return;

    const now = Date.now();
    const throttle = positionUpdateThrottles.get(agentId);

    if (!throttle || now - throttle.lastUpdate >= THROTTLE_MS) {
      // Update immediately
      agentRenderer.addOrUpdate({ agentId, x, y, color: 0x666666 });
      positionUpdateThrottles.set(agentId, { lastUpdate: now, pending: null });
    } else {
      // Queue update for later
      throttle.pending = { agentId, x, y, color: 0x666666 };
    }
  });

  // Process pending position updates every frame
  app.ticker.add(() => {
    const now = Date.now();
    for (const [agentId, throttle] of positionUpdateThrottles.entries()) {
      if (throttle.pending && now - throttle.lastUpdate >= THROTTLE_MS) {
        agentRenderer.addOrUpdate(throttle.pending);
        throttle.lastUpdate = now;
        throttle.pending = null;
      }
    }
  });

  ws.on('agent.joined', (msg) => {
    const agentId = msg.agentId as string;
    SoundManager.play('agent_join');
    agentRenderer.addOrUpdate({ agentId, x: 4, y: 4, color: 0x666666 });
    ui.addChatMessage('System', `${agentId} joined the room`);
  });

  ws.on('agent.left', (msg) => {
    const agentId = msg.agentId as string;
    SoundManager.play('agent_leave');
    agentRenderer.remove(agentId);
    ui.addChatMessage('System', `${agentId} left the room`);
  });

  ws.on('chat.message', (msg) => {
    const agentId = msg.agentId as string;
    const content = msg.content as string;
    
    // Show bubble
    const agents = agentRenderer.getAll();
    const agent = agents.find((a) => a.agentId === agentId);
    if (agent) {
      bubbleSystem.show(agentId, content, agent.x, agent.y);
    }
    
    // Add to chat
    ui.addChatMessage(agentId, content);
  });

  ws.on('furniture.moved', (msg) => {
    const itemId = msg.itemId as string;
    const x = msg.x as number;
    const y = msg.y as number;
    const z = msg.z as number;
    furnitureManager.onFurnitureMoved(itemId, x, y, z);
  });

  ws.on('furniture.rotated', (msg) => {
    const itemId = msg.itemId as string;
    const rotation = msg.rotation as number;
    furnitureManager.onFurnitureRotated(itemId, rotation);
  });

  ws.on('emote.broadcast', (msg) => {
    const agentId = msg.agentId as string;
    const emote = msg.emote as EmoteName;
    
    // Don't play emote for self (already played locally)
    if (agentId === MY_ID) return;
    
    const container = agentRenderer.getContainer(agentId);
    const sprite = agentRenderer.getSprite(agentId);
    
    if (container) {
      emoteManager.play(agentId, emote, container, sprite);
      
      // Handle sit/stand state
      if (emote === 'sit') {
        agentRenderer.setSitting(agentId, true);
      } else if (emote === 'stand') {
        agentRenderer.setSitting(agentId, false);
      }
    }
    
    // Show in chat
    ui.addChatMessage(agentId, `*${emote}*`);
    
    // Show toast notification for interesting emotes
    if (['dance', 'wave', 'laugh'].includes(emote)) {
      toastManager.info(`${agentId} ${emote}s!`, 2000);
    }
  });

  // Trading WebSocket handlers
  ws.on('trade.requested', (msg) => {
    const tradeId = msg.tradeId as string;
    const initiatorId = msg.initiatorId as string;
    const initiatorName = msg.initiatorName as string;
    
    SoundManager.play('furniture_place'); // Reuse existing sound for notification
    
    if (initiatorId === MY_ID) {
      // I initiated the trade
      toastManager.info(`Trade request sent!`, 3000);
    } else {
      // Someone wants to trade with me
      toastManager.info(`${initiatorName} wants to trade with you!`, 5000);
      
      // Open trade window
      tradeWindow.open(tradeId, initiatorId, initiatorName);
    }
  });

  ws.on('trade.updated', (msg) => {
    const tradeId = msg.tradeId as string;
    const agentId = msg.agentId as string;
    const items = msg.items as Array<{ itemDefId: string; quantity: number }>;
    
    // Only update if this is the active trade
    if (tradeWindow.getTradeId() === tradeId) {
      tradeWindow.updateTheirOffer(items);
    }
  });

  ws.on('trade.completed', (msg) => {
    const tradeId = msg.tradeId as string;
    
    if (tradeWindow.getTradeId() === tradeId) {
      SoundManager.play('furniture_purchase'); // Reuse purchase sound for success
      toastManager.success('Trade completed!', 3000);
      tradeWindow.showCompleted();
      
      // Emit events for reactive updates
      eventBus.emit(Events.TRADE_COMPLETE, tradeId);
      eventBus.emit(Events.INVENTORY_UPDATE);
    }
  });

  ws.on('trade.cancelled', (msg) => {
    const tradeId = msg.tradeId as string;
    const reason = msg.reason as string;
    
    if (tradeWindow.getTradeId() === tradeId) {
      toastManager.warning(`Trade ${reason}`, 3000);
      tradeWindow.showCancelled(reason);
    }
  });

  // Game WebSocket handlers
  ws.on('game.created', (msg) => {
    const gameId = msg.gameId as string;
    const gameType = msg.gameType as string;
    const hostId = msg.hostId as string;
    
    console.log('[Game] Game created:', gameId, gameType);
    
    // If I created the game, show the game panel
    if (hostId === MY_ID) {
      gamePanel.gameCreated(gameId, gameType as any);
      toastManager.info(`${gameType} game created!`, 3000);
    } else {
      toastManager.info(`New ${gameType} game available!`, 3000);
    }
  });
  
  ws.on('game.state', (msg) => {
    const gameId = msg.gameId as string;
    const status = msg.status as string;
    const participants = msg.participants as string[];
    const result = msg.result as any;
    
    console.log('[Game] Game state updated:', gameId, status);
    
    // If game completed, show result
    if (status === 'completed' && result) {
      gamePanel.showResult(result.details);
    }
  });
  
  ws.on('game.completed', (msg) => {
    const gameId = msg.gameId as string;
    const winnerId = msg.winnerId as string | null;
    const result = msg.result as any;
    
    console.log('[Game] Game completed:', gameId, winnerId);
    
    SoundManager.play('furniture_purchase'); // Reuse sound
    
    if (winnerId === MY_ID) {
      toastManager.success('You won!', 3000);
    } else if (winnerId === null) {
      toastManager.info('Draw!', 3000);
    } else {
      toastManager.warning('You lost!', 3000);
    }
    
    // Show result in panel
    gamePanel.showResult(result);
  });

  ws.on('game.joined', (msg) => {
    const gameId = msg.gameId as string;
    const agentId = msg.agentId as string;
    const agentName = msg.agentName as string;
    
    console.log('[Game] Player joined:', agentId);
    
    if (agentId !== MY_ID) {
      toastManager.info(`${agentName} joined the game!`, 2000);
    }
  });

  ws.on('game.started', (msg) => {
    const gameId = msg.gameId as string;
    
    console.log('[Game] Game started:', gameId);
    toastManager.success('Game started!', 2000);
  });

  ws.on('game.updated', (msg) => {
    const gameId = msg.gameId as string;
    const agentId = msg.agentId as string;
    
    console.log('[Game] Game updated:', gameId);
    
    if (agentId !== MY_ID) {
      toastManager.info('Opponent made a move!', 2000);
    }
  });

  ws.on('game.ended', (msg) => {
    const gameId = msg.gameId as string;
    const reason = msg.reason as string;
    
    console.log('[Game] Game ended:', gameId, reason);
    toastManager.warning(`Game ${reason}`, 2000);
    
    // Reset panel
    gamePanel.hide();
  });

  // Whisper WebSocket handlers
  ws.on('whisper.received', (msg) => {
    const messageId = msg.messageId as string;
    const senderId = msg.senderId as string;
    const senderName = msg.senderName as string;
    const content = msg.content as string;
    const createdAt = msg.createdAt as string;
    
    console.log('[Whisper] Received message from:', senderId);
    SoundManager.play('chat_message');
    
    // Add message to open window if active
    if (whisperWindow.isOpenFor(senderId)) {
      whisperWindow.addMessage({
        id: messageId,
        senderId,
        senderName,
        content,
        createdAt,
        isMine: false,
      });
      whisperWindow.markAsRead(senderId);
    } else {
      // Show toast notification
      toastManager.info(`New message from ${senderName}`, 3000);
    }
  });

  ws.on('whisper.sent', (msg) => {
    const messageId = msg.messageId as string;
    const recipientId = msg.recipientId as string;
    const content = msg.content as string;
    const createdAt = msg.createdAt as string;
    
    console.log('[Whisper] Message sent confirmation');
    
    // Add to window if it's open for this recipient
    if (whisperWindow.isOpenFor(recipientId)) {
      whisperWindow.addMessage({
        id: messageId,
        senderId: MY_ID,
        senderName: 'You',
        content,
        createdAt,
        isMine: true,
      });
    }
  });

  ws.on('whisper.typing', (msg) => {
    const senderId = msg.senderId as string;
    const senderName = msg.senderName as string;
    
    if (whisperWindow.isOpenFor(senderId)) {
      whisperWindow.showTypingIndicator(senderName);
    }
  });

  ws.on('friend.request.received', (msg) => {
    const friendshipId = msg.friendshipId as string;
    const requesterId = msg.requesterId as string;
    const requesterName = msg.requesterName as string;
    
    toastManager.info(`Friend request from ${requesterName}`, 5000);
    // Emit event for reactive update
    eventBus.emit(Events.FRIENDS_UPDATE);
  });

  ws.on('friend.accepted', (msg) => {
    const friendshipId = msg.friendshipId as string;
    const agentId = msg.agentId as string;
    const agentName = msg.agentName as string;
    
    toastManager.success(`${agentName} accepted your friend request!`, 5000);
    // Emit event for reactive update
    eventBus.emit(Events.FRIENDS_UPDATE);
  });

  ws.on('notification.new', (msg: any) => {
    const notification = msg.notification;
    const unreadCount = msg.unreadCount;
    
    console.log('[Notification] New notification:', notification);
    
    if (notificationCenter) {
      notificationCenter.addNotification(notification, unreadCount);
    }
    
    // Emit notification event
    eventBus.emit(Events.NOTIFICATIONS_NEW, notification, unreadCount);
    
    // Also show toast for important notifications
    if (notification.type === 'friend_request' || notification.type === 'trade_offer') {
      toastManager.info(notification.title, 4000);
    }
  });

  // Canvas interaction handlers
  const handlePointerDown = (clientX: number, clientY: number) => {
    // Only allow interaction when in game screen
    if (ui['currentScreen'] !== 'game') return;
    
    // If in placement mode, confirm placement
    if (furnitureManager.isInPlacementMode()) {
      furnitureManager.confirmPlacement();
      return;
    }
    
    // If in drag mode, confirm drag
    if (furnitureManager.isInDragMode()) {
      furnitureManager.confirmDrag();
      return;
    }
    
    const localX = clientX - world.position.x;
    const localY = clientY - world.position.y;
    const tile = tileMap.getTileAt(localX, localY);
    
    if (tile) {
      console.log(`Moving to (${tile.gridX}, ${tile.gridY})`);
      agentRenderer.addOrUpdate({ agentId: MY_ID, x: tile.gridX, y: tile.gridY, color: MY_COLOR });
      
      if (isConnected) {
        ws.move(currentRoom, tile.gridX, tile.gridY);
      }
    }
  };

  // Mouse click handler
  app.canvas.addEventListener('click', (e: MouseEvent) => {
    handlePointerDown(e.clientX, e.clientY);
  });

  // Touch handler (tap to walk)
  app.canvas.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault(); // Prevent default touch behavior
      const touch = e.touches[0];
      handlePointerDown(touch.clientX, touch.clientY);
    }
  });

  // Pinch-to-zoom support
  let lastPinchDistance = 0;
  let currentScale = 1;

  app.canvas.addEventListener('touchmove', (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault(); // Prevent default zoom
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      if (lastPinchDistance > 0) {
        const delta = distance - lastPinchDistance;
        const scaleChange = delta * 0.01;
        currentScale = Math.max(0.5, Math.min(2, currentScale + scaleChange));
        
        world.scale.set(currentScale, currentScale);
      }

      lastPinchDistance = distance;
    }
  });

  app.canvas.addEventListener('touchend', (e: TouchEvent) => {
    if (e.touches.length < 2) {
      lastPinchDistance = 0;
    }
  });

  app.canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (furnitureManager.isInPlacementMode()) {
      furnitureManager.updatePlacementPreview(e.clientX, e.clientY);
    } else if (furnitureManager.isInDragMode()) {
      furnitureManager.updateDragPreview(e.clientX, e.clientY);
    }
  });

  app.canvas.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    if (furnitureManager.isInPlacementMode()) {
      furnitureManager.cancelPlacementMode();
    } else if (furnitureManager.isInDragMode()) {
      furnitureManager.cancelDrag();
    }
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (furnitureManager.isInPlacementMode()) {
        furnitureManager.cancelPlacementMode();
        ui.addChatMessage('System', 'Placement cancelled');
      } else if (furnitureManager.isInDragMode()) {
        furnitureManager.cancelDrag();
        ui.addChatMessage('System', 'Move cancelled');
      }
    }
    
    if (e.key === 'r' && furnitureManager.isInPlacementMode()) {
      furnitureManager.rotatePlacementPreview();
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      furnitureManager.removeSelectedFurniture();
    }
  });

  // Update viewport on window resize
  const updateViewport = () => {
    const scale = world.scale.x; // Use current zoom scale
    agentRenderer.updateViewport(app.screen.width, app.screen.height, scale);
    furnitureManager.updateViewport(app.screen.width, app.screen.height, scale);
  };
  
  // Initial viewport setup
  updateViewport();
  
  // Update viewport on resize
  window.addEventListener('resize', updateViewport);
  
  // Update viewport when zoom changes
  let lastScale = world.scale.x;
  
  // Game loop for animations, bubble cleanup, and viewport culling
  let frameCount = 0;
  app.ticker.add((ticker) => {
    const deltaMs = ticker.deltaMS;
    
    // Update animations
    agentRenderer.updateAnimations(deltaMs);
    bubbleSystem.update();
    emoteManager.update(deltaMs);
    
    // Perform viewport culling every frame
    // (only render sprites within visible area)
    const culledAgents = agentRenderer.cullAgents();
    const culledFurniture = furnitureManager.cullFurniture();
    
    // Check if zoom changed
    if (Math.abs(world.scale.x - lastScale) > 0.01) {
      lastScale = world.scale.x;
      updateViewport();
    }
    
    // Memory leak detection (every 30 seconds)
    frameCount++;
    if (frameCount % (60 * 30) === 0) {
      memoryProfiler.checkLeaks();
    }
  });

  // Helper functions
  function loadRooms() {
    // Demo rooms data
    const demoRooms = [
      { id: 'lobby', name: 'Main Lobby', occupants: 12, maxOccupants: 50 },
      { id: 'pool', name: 'Pool Party', occupants: 5, maxOccupants: 20 },
      { id: 'rooftop', name: 'Rooftop Lounge', occupants: 8, maxOccupants: 30 },
      { id: 'cafe', name: 'Hotel Cafe', occupants: 3, maxOccupants: 15 },
      { id: 'arcade', name: 'Pixel Arcade', occupants: 15, maxOccupants: 25 },
    ];
    
    ui.loadRooms(demoRooms);
  }

  async function loadInventory() {
    try {
      const token = localStorage.getItem('hotel_token');
      if (!token) {
        // Fallback to demo data if not logged in
        const demoFurniture = [
          { itemDefId: 'chair_wood', name: 'Wooden Chair', count: 3 },
          { itemDefId: 'table_round', name: 'Round Table', count: 1 },
          { itemDefId: 'lamp_floor', name: 'Floor Lamp', count: 1 },
        ];
        ui.loadInventory(demoFurniture);
        return;
      }

      const res = await fetch('/api/furniture/inventory', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch inventory');

      const data = await res.json();
      const inventory = data.items.map((item: any) => ({
        itemDefId: item.itemDefId,
        name: humanizeName(item.itemDefId),
        count: item.quantity,
      }));

      ui.loadInventory(inventory);
    } catch (error) {
      console.error('[Inventory] Error loading:', error);
      // Fallback to demo data
      const demoFurniture = [
        { itemDefId: 'chair_wood', name: 'Wooden Chair', count: 3 },
        { itemDefId: 'table_round', name: 'Round Table', count: 1 },
        { itemDefId: 'lamp_floor', name: 'Floor Lamp', count: 1 },
      ];
      ui.loadInventory(demoFurniture);
    }
  }

  async function loadCatalog() {
    try {
      const res = await fetch('/api/furniture/catalog');
      if (!res.ok) throw new Error('Failed to fetch catalog');

      const data = await res.json();
      const catalog = data.items.map((item: any) => ({
        itemDefId: item.itemDefId,
        name: humanizeName(item.itemDefId),
        category: determineCategory(item),
        price: item.price,
      }));

      ui.loadCatalog(catalog);
    } catch (error) {
      console.error('[Catalog] Error loading:', error);
      // Fallback to demo data
      const demoCatalog = [
        { itemDefId: 'chair_wood', name: 'Wooden Chair', category: 'seating', price: 150 },
        { itemDefId: 'table_round', name: 'Round Table', category: 'tables', price: 280 },
        { itemDefId: 'lamp_floor', name: 'Floor Lamp', category: 'decoration', price: 195 },
        { itemDefId: 'sofa_2seat', name: '2-Seat Sofa', category: 'seating', price: 330 },
      ];
      ui.loadCatalog(demoCatalog);
    }
  }

  function humanizeName(itemDefId: string): string {
    return itemDefId
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function determineCategory(item: any): string {
    if (item.canSit) return 'seating';
    if (item.width >= 2 || item.depth >= 2) return 'tables';
    return 'decoration';
  }

  console.log('OpenClaw Hotel client ready');
}

init().catch(console.error);
