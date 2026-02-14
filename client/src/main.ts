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

  // WebSocket connection
  const ws = new HotelWSClient();
  let currentRoom = 'lobby';
  let isConnected = false;

  // UI Event Handlers
  ui.onAuthSuccess = async (username: string, token: string) => {
    console.log('[Auth] Success:', username);
    MY_ID = username; // Use username as agent ID
    
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

    // Load demo rooms
    loadRooms();
  };

  ui.onJoinRoom = async (roomId: string) => {
    console.log('[Room] Joining:', roomId);
    SoundManager.play('door_open');
    
    // Cleanup previous room if changing rooms
    if (currentRoom !== roomId) {
      console.log('[Room] Cleaning up previous room');
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

  ui.onCreateRoom = (name: string, size: string) => {
    console.log('[Room] Creating:', name, size);
    // TODO: Implement room creation API call
    // For now, just reload rooms with the new one
    setTimeout(() => {
      loadRooms();
      ui.addChatMessage('System', `Room "${name}" created!`);
    }, 500);
  };

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
  ws.on('connected', () => {
    console.log('[Hotel] Connected to server');
    isConnected = true;
    ws.joinRoom(currentRoom);
    
    // Show success toast on reconnection (not on first connect)
    if (ws['reconnectAttempts'] > 0) {
      toastManager.success('Reconnected to server!');
    }
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
      
      // Reload inventory after trade
      setTimeout(() => loadInventory(), 1000);
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
