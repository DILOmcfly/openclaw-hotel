import { Application, Assets } from 'pixi.js';
import { IsoRenderer } from './renderer/IsoRenderer.js';

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

// Chat elements
const chatSidebar = document.getElementById('chatSidebar')!;
const chatToggleBtn = document.getElementById('chatToggleBtn')!;
const chatToggleFloat = document.getElementById('chatToggleFloat')!;
const chatUsername = document.getElementById('chatUsername') as HTMLInputElement;
const chatMessages = document.getElementById('chatMessages')!;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const chatSendBtn = document.getElementById('chatSendBtn')!;
const chatRateLimitNotice = document.getElementById('chatRateLimitNotice')!;

// State
let currentRoom: string | null = null;
let ws: WebSocket | null = null;
let app: Application | null = null;
let renderer: IsoRenderer | null = null;
let chatMessagesArray: Array<{ username: string; message: string; timestamp: string; isOwn: boolean }> = [];
const MAX_CHAT_MESSAGES = 100;

// TTS audio queue and settings
let ttsEnabled = localStorage.getItem('tts_enabled') !== 'false'; // Default: enabled
let ttsVolume = parseFloat(localStorage.getItem('tts_volume') || '0.7'); // Default: 70%
const audioQueue: Array<{ url: string; agentId: string }> = [];
let isPlayingAudio = false;

/**
 * Play TTS audio for agent message
 */
function playTTSAudio(audioUrl: string, agentId: string) {
  if (!ttsEnabled) {
    return; // TTS disabled
  }
  
  // Add to queue
  audioQueue.push({ url: `${API_BASE}${audioUrl}`, agentId });
  
  // Start playing if not already playing
  if (!isPlayingAudio) {
    processAudioQueue();
  }
  
  // Show visual indicator (🔊 icon)
  showSpeakingIndicator(agentId);
}

/**
 * Process audio queue (play one at a time)
 */
async function processAudioQueue() {
  if (audioQueue.length === 0) {
    isPlayingAudio = false;
    return;
  }
  
  isPlayingAudio = true;
  const { url, agentId } = audioQueue.shift()!;
  
  try {
    const audio = new Audio(url);
    audio.volume = ttsVolume;
    
    audio.onended = () => {
      hideSpeakingIndicator(agentId);
      processAudioQueue(); // Play next in queue
    };
    
    audio.onerror = (error) => {
      console.error('[TTS] Audio playback error:', error);
      hideSpeakingIndicator(agentId);
      processAudioQueue(); // Skip to next
    };
    
    await audio.play();
  } catch (error) {
    console.error('[TTS] Audio play failed:', error);
    hideSpeakingIndicator(agentId);
    processAudioQueue(); // Skip to next
  }
}

/**
 * Show speaking indicator for agent
 */
function showSpeakingIndicator(agentId: string) {
  if (renderer) {
    // Show 🔊 emote for 2 seconds
    renderer.showEmote(agentId, '🔊');
  }
}

/**
 * Hide speaking indicator for agent
 */
function hideSpeakingIndicator(agentId: string) {
  // Indicator auto-hides after emote duration in renderer
}

/**
 * Toggle TTS on/off
 */
function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  localStorage.setItem('tts_enabled', ttsEnabled.toString());
  console.log('[TTS] Enabled:', ttsEnabled);
}

/**
 * Set TTS volume
 */
function setTTSVolume(volume: number) {
  ttsVolume = Math.max(0, Math.min(1, volume)); // Clamp 0-1
  localStorage.setItem('tts_volume', ttsVolume.toString());
  console.log('[TTS] Volume:', ttsVolume);
}

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
  
  // Hide room selector, show spectator UI
  roomSelector.classList.add('hidden');
  spectatorHUD.classList.remove('hidden');
  backButton.classList.remove('hidden');
  readonlyNotice.classList.remove('hidden');
  chatSidebar.classList.remove('hidden');
  chatToggleFloat.classList.remove('visible');
  
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
  
  // Clear chat messages
  chatMessagesArray = [];
  renderChatMessages();
  
  roomSelector.classList.remove('hidden');
  spectatorHUD.classList.add('hidden');
  backButton.classList.add('hidden');
  readonlyNotice.classList.add('hidden');
  chatSidebar.classList.add('hidden');
  chatToggleFloat.classList.remove('visible');
  
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
  // const assetLoader = new AssetLoader(app);
  // await assetLoader.loadAssets();
  
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
      // Send username if available
      if (chatUsername.value) {
        saveUsername();
      }
      break;
      
    case 'spectator.usernameSet':
      console.log('[Spectator] Username set:', message.username);
      break;
      
    case 'spectator.chatMessage':
      addChatMessage(
        message.username,
        message.message,
        message.timestamp,
        message.isOwnMessage
      );
      break;
      
    case 'spectator.rateLimited':
      showRateLimitNotice();
      console.warn('[Spectator] Rate limited:', message.message);
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
      
    case 'message.audio':
      // Play TTS audio if enabled
      playTTSAudio(message.audioUrl, message.agentId);
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

/**
 * Format timestamp to HH:MM
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Load username from localStorage
 */
function loadUsername(): void {
  const saved = localStorage.getItem('spectator-username');
  if (saved) {
    chatUsername.value = saved;
  }
}

/**
 * Save username to localStorage and send to server
 */
function saveUsername(): void {
  const username = chatUsername.value.trim();
  localStorage.setItem('spectator-username', username);
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'spectator.setUsername',
      username,
    }));
  }
}

/**
 * Toggle chat sidebar visibility
 */
function toggleChat(): void {
  const isHidden = chatSidebar.classList.contains('hidden');
  
  if (isHidden) {
    chatSidebar.classList.remove('hidden');
    chatToggleFloat.classList.remove('visible');
  } else {
    chatSidebar.classList.add('hidden');
    chatToggleFloat.classList.add('visible');
  }
}

/**
 * Add chat message to UI
 */
function addChatMessage(username: string, message: string, timestamp: string, isOwn: boolean): void {
  // Add to array
  chatMessagesArray.push({ username, message, timestamp, isOwn });
  
  // Keep only last 100 messages
  if (chatMessagesArray.length > MAX_CHAT_MESSAGES) {
    chatMessagesArray.shift();
  }
  
  // Render messages
  renderChatMessages();
}

/**
 * Render all chat messages
 */
function renderChatMessages(): void {
  chatMessages.innerHTML = '';
  
  if (chatMessagesArray.length === 0) {
    chatMessages.innerHTML = `
      <div style="text-align: center; color: #666; font-size: 13px; padding: 20px;">
        👋 Chat with other spectators!<br>
        (Agents cannot see this chat)
      </div>
    `;
    return;
  }
  
  for (const msg of chatMessagesArray) {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${msg.isOwn ? 'own' : ''}`;
    
    messageEl.innerHTML = `
      <div class="chat-message-header">
        <span class="chat-message-username">${escapeHtml(msg.username)}</span>
        <span class="chat-message-time">${formatTimestamp(msg.timestamp)}</span>
      </div>
      <div class="chat-message-text">${escapeHtml(msg.message)}</div>
    `;
    
    chatMessages.appendChild(messageEl);
  }
  
  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Send chat message
 */
function sendChatMessage(): void {
  const message = chatInput.value.trim();
  
  if (!message) {
    return;
  }
  
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert('Not connected to server');
    return;
  }
  
  // Send to server
  ws.send(JSON.stringify({
    type: 'spectator.chat',
    message,
  }));
  
  // Clear input
  chatInput.value = '';
}

/**
 * Show rate limit notice
 */
function showRateLimitNotice(): void {
  chatRateLimitNotice.classList.add('visible');
  setTimeout(() => {
    chatRateLimitNotice.classList.remove('visible');
  }, 5000);
}

// Event listeners
backButton.addEventListener('click', leaveRoom);

chatToggleBtn.addEventListener('click', toggleChat);
chatToggleFloat.addEventListener('click', toggleChat);

chatUsername.addEventListener('blur', saveUsername);
chatUsername.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveUsername();
    chatUsername.blur();
  }
});

chatSendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
});

// Initialize
loadUsername();
fetchStats();
fetchRooms();

// Refresh stats every 10 seconds
setInterval(() => {
  if (!currentRoom) {
    fetchStats();
    fetchRooms();
  }
}, 10000);
