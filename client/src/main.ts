import { Application, Container } from 'pixi.js';
import { parseHeightmap, TileMap } from './renderer/TileMap.js';
import { AgentRenderer } from './renderer/AgentSprite.js';
import { BubbleSystem } from './renderer/BubbleSystem.js';
import { FurnitureManager } from './renderer/FurnitureManager.js';
import { HotelWSClient } from './ws/client.js';
import { AssetLoader } from './AssetLoader.js';
import { UIManager } from './ui/UIManager.js';

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

async function init() {
  // Initialize UI Manager first
  const ui = new UIManager();

  // Pixi.js Application
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#1a1a2e',
    antialias: true,
  });

  // Load pixel art assets
  console.log('Loading pixel art assets...');
  await AssetLoader.load();
  console.log('Assets loaded!');

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
  const tileMap = new TileMap(heightmap, world);
  tileMap.render();

  // Renderers
  const agentRenderer = new AgentRenderer(world);
  const bubbleSystem = new BubbleSystem(world, app.screen.width / 2, app.screen.height / 3);
  const furnitureManager = new FurnitureManager(world);

  // WebSocket connection
  const ws = new HotelWSClient();
  let currentRoom = 'lobby';
  let isConnected = false;

  // UI Event Handlers
  ui.onAuthSuccess = (username: string, token: string) => {
    console.log('[Auth] Success:', username);
    MY_ID = username; // Use username as agent ID
    
    // Try to connect to WebSocket
    try {
      ws.connect(token);
    } catch (error) {
      console.log('[WS] Connection failed, running in offline mode');
    }

    // Load demo rooms
    loadRooms();
  };

  ui.onJoinRoom = (roomId: string) => {
    console.log('[Room] Joining:', roomId);
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
  };

  ui.onLogout = () => {
    console.log('[Auth] Logout');
    
    if (isConnected) {
      ws.disconnect();
      isConnected = false;
    }
    
    // Clear agents and furniture
    agentRenderer.getAll().forEach(agent => {
      agentRenderer.remove(agent.agentId);
    });
    furnitureManager.clear();
  };

  ui.onPlaceFurniture = (itemDefId: string) => {
    console.log('[Furniture] Starting placement mode:', itemDefId);
    furnitureManager.startPlacementMode(itemDefId);
    
    // Hide inventory panel during placement
    const inventoryPanel = document.getElementById('inventory-panel');
    inventoryPanel?.classList.add('hidden');
  };

  ui.onBuyFurniture = (itemDefId: string) => {
    console.log('[Furniture] Buying:', itemDefId);
    // TODO: Implement actual purchase API
    ui.addChatMessage('System', `Purchased ${itemDefId}! Check your inventory.`);
    
    // Reload inventory to show new item
    setTimeout(() => loadInventory(), 500);
  };

  ui.onFurnitureDragStart = (itemDefId: string) => {
    console.log('[Furniture] Drag started:', itemDefId);
    furnitureManager.startPlacementMode(itemDefId);
  };

  // Furniture manager callbacks
  furnitureManager.onPlacementSuccess = () => {
    console.log('[Furniture] Placement successful');
    ui.addChatMessage('System', 'Furniture placed!');
  };

  furnitureManager.onPlacementFailed = (reason: string) => {
    console.log('[Furniture] Placement failed:', reason);
    ui.addChatMessage('System', reason);
  };

  furnitureManager.onItemSelected = (itemId: string) => {
    console.log('[Furniture] Item selected:', itemId);
    // TODO: Show context menu for move/rotate/remove
  };

  // WebSocket Event Handlers
  ws.on('connected', () => {
    console.log('[Hotel] Connected to server');
    isConnected = true;
    ws.joinRoom(currentRoom);
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

  ws.on('agent.moved', (msg) => {
    const agentId = msg.agentId as string;
    const x = msg.x as number;
    const y = msg.y as number;
    if (agentId !== MY_ID) {
      agentRenderer.addOrUpdate({ agentId, x, y, color: 0x666666 });
    }
  });

  ws.on('agent.joined', (msg) => {
    const agentId = msg.agentId as string;
    agentRenderer.addOrUpdate({ agentId, x: 4, y: 4, color: 0x666666 });
    ui.addChatMessage('System', `${agentId} joined the room`);
  });

  ws.on('agent.left', (msg) => {
    const agentId = msg.agentId as string;
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

  // Canvas interaction handlers
  app.canvas.addEventListener('click', (e: MouseEvent) => {
    // Only allow interaction when in game screen
    if (ui['currentScreen'] !== 'game') return;
    
    // If in placement mode, confirm placement
    if (furnitureManager.isInPlacementMode()) {
      furnitureManager.confirmPlacement();
      return;
    }
    
    const localX = e.clientX - world.position.x;
    const localY = e.clientY - world.position.y;
    const tile = tileMap.getTileAt(localX, localY);
    
    if (tile) {
      console.log(`Moving to (${tile.gridX}, ${tile.gridY})`);
      agentRenderer.addOrUpdate({ agentId: MY_ID, x: tile.gridX, y: tile.gridY, color: MY_COLOR });
      
      if (isConnected) {
        ws.move(currentRoom, tile.gridX, tile.gridY);
      }
    }
  });

  app.canvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (furnitureManager.isInPlacementMode()) {
      furnitureManager.updatePlacementPreview(e.clientX, e.clientY);
    }
  });

  app.canvas.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    if (furnitureManager.isInPlacementMode()) {
      furnitureManager.cancelPlacementMode();
    }
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && furnitureManager.isInPlacementMode()) {
      furnitureManager.cancelPlacementMode();
      ui.addChatMessage('System', 'Placement cancelled');
    }
    
    if (e.key === 'r' && furnitureManager.isInPlacementMode()) {
      furnitureManager.rotatePlacementPreview();
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      furnitureManager.removeSelectedFurniture();
    }
  });

  // Game loop for bubble cleanup
  app.ticker.add(() => {
    bubbleSystem.update();
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

  function loadInventory() {
    // Demo furniture data (user's owned furniture)
    const demoFurniture = [
      { itemDefId: 'chair_wood', name: 'Wooden Chair', count: 3 },
      { itemDefId: 'table_round', name: 'Round Table', count: 1 },
      { itemDefId: 'plant_pot', name: 'Potted Plant', count: 2 },
      { itemDefId: 'lamp_floor', name: 'Floor Lamp', count: 1 },
      { itemDefId: 'sofa_2seat', name: '2-Seat Sofa', count: 1 },
      { itemDefId: 'bed_single', name: 'Single Bed', count: 1 },
    ];
    
    ui.loadInventory(demoFurniture);
  }

  function loadCatalog() {
    // Demo catalog data (available for purchase)
    const demoCatalog = [
      { itemDefId: 'chair_wood', name: 'Wooden Chair', category: 'seating', price: 50 },
      { itemDefId: 'sofa_2seat', name: '2-Seat Sofa', category: 'seating', price: 150 },
      { itemDefId: 'table_round', name: 'Round Table', category: 'tables', price: 100 },
      { itemDefId: 'desk_office', name: 'Office Desk', category: 'tables', price: 120 },
      { itemDefId: 'lamp_floor', name: 'Floor Lamp', category: 'decoration', price: 60 },
      { itemDefId: 'plant_pot', name: 'Potted Plant', category: 'decoration', price: 30 },
      { itemDefId: 'bookshelf', name: 'Bookshelf', category: 'storage', price: 200 },
      { itemDefId: 'bed_single', name: 'Single Bed', category: 'seating', price: 250 },
    ];
    
    ui.loadCatalog(demoCatalog);
  }

  console.log('OpenClaw Hotel client ready');
}

init().catch(console.error);
