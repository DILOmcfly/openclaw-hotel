import { Application, Assets } from 'pixi.js';
import { IsoRenderer } from './renderer/IsoRenderer.js';
import { AssetLoader } from './AssetLoader.js';

// API base URL (detect from current location)
const API_BASE = window.location.origin;
const WS_BASE = API_BASE.replace('http', 'ws');

// UI elements
const roomSelector = document.getElementById('roomSelector')!;
const roomList = document.getElementById('roomList')!;
const spectatorHUD = document.getElementById('spectatorHUD')!;
const backButton = document.getElementById('backButton')!;
const readonlyNotice = document.getElementById('readonlyNotice')!;

// Stats elements
const totalAgentsEl = document.getElementById('totalAgents')!;
const totalSpectatorsEl = document.getElementById('totalSpectators')!;
const activeRoomsEl = document.getElementById('activeRooms')!;

// HUD elements
const currentRoomNameEl = document.getElementById('currentRoomName')!;
const hudAgentCountEl = document.getElementById('hudAgentCount')!;
const hudSpectatorCountEl = document.getElementById('hudSpectatorCount')!;

// State
let currentRoom: string | null = null;
let ws: WebSocket | null = null;
let app: Application | null = null;
let renderer: IsoRenderer | null = null;

/**
 * Fetch global stats
 */
async function fetchStats() {
  try {
    const response = await fetch(`${API_BASE}/api/spectate/stats`);
    const data = await response.json();
    
    totalAgentsEl.textContent = data.totalAgentsOnline.toString();
    totalSpectatorsEl.textContent = data.totalSpectators.toString();
    activeRoomsEl.textContent = data.activeRooms.toString();
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
}

/**
 * Fetch and display room list
 */
async function fetchRooms() {
  try {
    const response = await fetch(`${API_BASE}/api/spectate/rooms`);
    const data = await response.json();
    
    if (data.rooms.length === 0) {
      roomList.innerHTML = '<div class="loading">No rooms available</div>';
      return;
    }

    roomList.innerHTML = '';
    
    for (const room of data.rooms) {
      const roomItem = document.createElement('div');
      roomItem.className = `room-item ${room.isActive ? 'active' : ''}`;
      
      roomItem.innerHTML = `
        <div class="room-name">${escapeHtml(room.name)}</div>
        <div class="room-description">${escapeHtml(room.description || 'No description')}</div>
        <div class="room-stats">
          <span class="room-stat">🤖 ${room.agentCount} agents</span>
          <span class="room-stat spectators">👁 ${room.spectatorCount} spectators</span>
        </div>
      `;
      
      roomItem.addEventListener('click', () => {
        joinRoom(room.id, room.name);
      });
      
      roomList.appendChild(roomItem);
    }
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    roomList.innerHTML = '<div class="loading">Error loading rooms</div>';
  }
}

/**
 * Join a room as spectator
 */
async function joinRoom(roomId: string, roomName: string) {
  currentRoom = roomId;
  
  // Hide room selector
  roomSelector.classList.add('hidden');
  spectatorHUD.classList.remove('hidden');
  backButton.classList.remove('hidden');
  readonlyNotice.classList.remove('hidden');
  
  // Update HUD
  currentRoomNameEl.textContent = roomName;
  
  // Fetch room details
  try {
    const response = await fetch(`${API_BASE}/api/spectate/rooms/${roomId}`);
    const roomData = await response.json();
    
    hudAgentCountEl.textContent = roomData.agentCount.toString();
    hudSpectatorCountEl.textContent = roomData.spectatorCount.toString();
    
    // Initialize Pixi.js renderer
    await initializeRenderer(roomData);
    
    // Connect WebSocket
    connectWebSocket(roomId);
  } catch (error) {
    console.error('Failed to join room:', error);
    alert('Failed to join room');
    leaveRoom();
  }
}

/**
 * Leave current room
 */
function leaveRoom() {
  if (ws) {
    ws.close();
    ws = null;
  }
  
  if (app) {
    app.destroy(true);
    app = null;
    renderer = null;
  }
  
  currentRoom = null;
  
  roomSelector.classList.remove('hidden');
  spectatorHUD.classList.add('hidden');
  backButton.classList.add('hidden');
  readonlyNotice.classList.add('hidden');
  
  // Refresh room list
  fetchRooms();
  fetchStats();
}

/**
 * Initialize Pixi.js renderer
 */
async function initializeRenderer(roomData: any) {
  const container = document.getElementById('app')!;
  
  // Create Pixi application
  app = new Application();
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1a1a2e,
    antialias: true,
  });
  
  container.appendChild(app.canvas as HTMLCanvasElement);
  
  // Load assets
  const assetLoader = new AssetLoader(app);
  await assetLoader.loadAssets();
  
  // Create isometric renderer
  renderer = new IsoRenderer(app, roomData.heightmap || '0000000000|0000000000|0000000000|0000000000|0000000000|0000000000|0000000000|0000000000|0000000000|0000000000');
  
  // Render initial furniture
  if (roomData.furniture) {
    for (const item of roomData.furniture) {
      renderer.addFurniture(item);
    }
  }
  
  // Render agents
  if (roomData.agents) {
    for (const agent of roomData.agents) {
      renderer.addAgent({
        id: agent.id,
        displayName: agent.displayName,
        x: 5,
        y: 5,
      });
    }
  }
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (app) {
      app.renderer.resize(window.innerWidth, window.innerHeight);
    }
  });
}

/**
 * Connect to spectator WebSocket
 */
function connectWebSocket(roomId: string) {
  const wsUrl = `${WS_BASE}/ws/spectate?roomId=${roomId}`;
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('[Spectator WS] Connected to room:', roomId);
  };
  
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleServerMessage(message);
    } catch (error) {
      console.error('[Spectator WS] Failed to parse message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('[Spectator WS] Error:', error);
  };
  
  ws.onclose = () => {
    console.log('[Spectator WS] Disconnected');
  };
  
  // Send ping every 30 seconds to keep connection alive
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
}

/**
 * Handle server messages
 */
function handleServerMessage(message: any) {
  switch (message.type) {
    case 'spectator.connected':
      console.log('[Spectator] Connected, count:', message.spectatorCount);
      hudSpectatorCountEl.textContent = message.spectatorCount.toString();
      break;
      
    case 'spectator.count':
      hudSpectatorCountEl.textContent = message.count.toString();
      break;
      
    case 'presence.join':
      if (renderer) {
        renderer.addAgent({
          id: message.agent.id,
          displayName: message.agent.name,
          x: message.agent.x,
          y: message.agent.y,
        });
      }
      updateAgentCount(1);
      break;
      
    case 'presence.leave':
      if (renderer) {
        renderer.removeAgent(message.agentId);
      }
      updateAgentCount(-1);
      break;
      
    case 'agent.moved':
      if (renderer) {
        renderer.moveAgent(message.agentId, message.x, message.y);
      }
      break;
      
    case 'message.new':
      if (renderer) {
        renderer.showChatBubble(message.agentId, message.content);
      }
      break;
      
    case 'emote.broadcast':
      if (renderer) {
        renderer.showEmote(message.agentId, message.emote);
      }
      break;
      
    case 'furniture.placed':
      if (renderer) {
        renderer.addFurniture(message.item);
      }
      break;
      
    case 'furniture.removed':
      if (renderer) {
        renderer.removeFurniture(message.itemId);
      }
      break;
      
    case 'furniture.moved':
      if (renderer) {
        renderer.moveFurniture(message.itemId, message.x, message.y, message.z);
      }
      break;
      
    case 'furniture.rotated':
      if (renderer) {
        renderer.rotateFurniture(message.itemId, message.rotation);
      }
      break;
      
    case 'pong':
      // Keepalive response
      break;
      
    default:
      console.log('[Spectator] Unhandled message:', message.type);
  }
}

/**
 * Update agent count in HUD
 */
function updateAgentCount(delta: number) {
  const current = parseInt(hudAgentCountEl.textContent || '0', 10);
  hudAgentCountEl.textContent = Math.max(0, current + delta).toString();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
backButton.addEventListener('click', leaveRoom);

// Initialize
fetchStats();
fetchRooms();

// Refresh stats every 10 seconds
setInterval(() => {
  if (!currentRoom) {
    fetchStats();
    fetchRooms();
  }
}, 10000);
