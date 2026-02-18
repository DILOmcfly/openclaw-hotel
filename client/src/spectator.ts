import { Application, Assets } from 'pixi.js';
import { IsoRenderer } from './renderer/IsoRenderer.js';
import { SpriteLoader } from './renderer/SpriteLoader.js';
import { renderAgentDots } from './ui/RoomCardDots.js';
import { BadgeSystem, type BadgeData } from './renderer/BadgeSystem.js';
import { WitnessXPTracker } from '../../src/witnessXP.js';

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
let badgeSystem: BadgeSystem | null = null;
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
      
      const dotsHtml = renderAgentDots(room.previewAgents || []);
      roomItem.innerHTML = `
        <div class="room-name">${escapeHtml(room.name)}</div>
        <div class="room-description">${escapeHtml(room.description || 'No description')}</div>
        ${dotsHtml}
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
  document.body.classList.add('in-room');
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
    
    // Update sidebar room list with HERE badge
    loadSidebarRooms();
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
  
  if (badgeSystem) {
    badgeSystem.destroy();
    badgeSystem = null;
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
  
  document.body.classList.remove('in-room');
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
  
  // Load sprites
  console.log('[Spectator] Loading sprites...');
  const spriteLoader = new SpriteLoader();
  await spriteLoader.loadSprites();
  console.log('[Spectator] Sprites loaded');
  
  // Create isometric renderer
  renderer = new IsoRenderer(app, roomData.heightmap || '0000000000|0000000000|0000000000|0000000000|0000000000|0000000000|0000000000|0000000000|0000000000|0000000000', spriteLoader);

  // Create badge system (HTML overlay — positioned with world offset)
  const worldOffsetX = Math.round(window.innerWidth / 2);
  const worldOffsetY = Math.round(window.innerHeight / 4);
  badgeSystem = new BadgeSystem(worldOffsetX, worldOffsetY);
  
  // Render initial furniture
  if (roomData.furniture) {
    for (const item of roomData.furniture) {
      renderer.addFurniture(item);
    }
  }
  
  // Render agents (and fetch their badges)
  if (roomData.agents) {
    for (const agent of roomData.agents) {
      renderer.addAgent({
        id: agent.id,
        displayName: agent.displayName,
        x: 5,
        y: 5,
      });
      // Fetch initial badges for each agent (non-blocking)
      fetchAndShowAgentBadges(agent.id, 5, 5);
    }
  }
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (app) {
      app.renderer.resize(window.innerWidth, window.innerHeight);
    }
    // Update badge overlay offset on resize
    if (badgeSystem) {
      badgeSystem.updateOffset(
        Math.round(window.innerWidth / 2),
        Math.round(window.innerHeight / 4)
      );
      badgeSystem.updateAllPositions();
    }
  });
}

/**
 * Fetch an agent's earned achievements and show badges in the room view.
 */
async function fetchAndShowAgentBadges(agentId: string, gridX: number, gridY: number): Promise<void> {
  if (!badgeSystem) return;

  // Skip if agentId is not a valid UUID (e.g. demo/bot IDs)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(agentId)) return;

  try {
    const res = await fetch(`${API_BASE}/api/achievements/${agentId}`);
    if (!res.ok) return;
    const allAchievements = await res.json();

    // Filter to only earned ones, sorted most recent first
    const earned: BadgeData[] = allAchievements
      .filter((a: any) => a.earned)
      .sort((a: any, b: any) => new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime())
      .map((a: any) => ({
        achievementId: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        awardedAt: a.awardedAt,
      }));

    badgeSystem.setAgentBadges(agentId, earned, gridX, gridY);
  } catch {
    // Non-critical — badges are best-effort
  }
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
      
    case 'presence.join': {
      const joinX = message.agent.x ?? 5;
      const joinY = message.agent.y ?? 5;
      if (renderer) {
        renderer.addAgent({
          id: message.agent.id,
          displayName: message.agent.name,
          x: joinX,
          y: joinY,
        });
      }
      // Fetch and display badges for newly joined agent
      fetchAndShowAgentBadges(message.agent.id, joinX, joinY);
      updateAgentCount(1);
      break;
    }
      
    case 'presence.leave':
      if (renderer) {
        renderer.removeAgent(message.agentId);
      }
      if (badgeSystem) {
        badgeSystem.removeAgent(message.agentId);
      }
      updateAgentCount(-1);
      break;
      
    case 'agent.moved':
      if (renderer) {
        renderer.moveAgent(message.agentId, message.x, message.y);
      }
      if (badgeSystem) {
        badgeSystem.updatePosition(message.agentId, message.x, message.y);
      }
      break;

    case 'agent.achievement':
      if (badgeSystem && message.agentId && message.achievement) {
        badgeSystem.addBadge(message.agentId, {
          achievementId: message.achievement.achievementId,
          name: message.achievement.name,
          description: message.achievement.description,
          icon: message.achievement.icon,
          awardedAt: message.achievement.awardedAt,
        });
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

// Sidebar room rendering with HERE badge
async function loadSidebarRooms() {
  const sidebarList = document.getElementById('sidebarRoomsList');
  if (!sidebarList) return;
  try {
    const response = await fetch(`${API_BASE}/api/spectate/rooms`);
    const data = await response.json();
    sidebarList.innerHTML = '';
    for (const room of data.rooms) {
      const isHere = room.id === currentRoom;
      const item = document.createElement('div');
      item.className = `sidebar-room-item${isHere ? ' here' : ''}`;
      item.innerHTML = `
        <span class="sidebar-room-icon">${room.icon || '🏨'}</span>
        <div class="sidebar-room-info">
          <span class="sidebar-room-name">${escapeHtml(room.name)}</span>
          <span class="sidebar-room-stats">🤖 <span style="color:var(--accent)">${room.agentCount}</span> 👁 ${room.spectatorCount}</span>
        </div>
        ${isHere ? '<span class="sidebar-room-here">HERE</span>' : ''}
      `;
      if (!isHere) {
        item.addEventListener('click', () => {
          leaveRoom();
          setTimeout(() => joinRoom(room.id, room.name), 100);
        });
        item.style.cursor = 'pointer';
      }
      sidebarList.appendChild(item);
    }
  } catch { sidebarList.innerHTML = '<div>Error loading rooms</div>'; }
}

// Expose to global scope for inline onclick handlers in spectate.html
(window as any).refreshRooms = fetchRooms;
(window as any).loadSidebarRooms = loadSidebarRooms;
(window as any).toggleChat = toggleChat;
(window as any).switchSidebarTab = (tabName: string) => {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  document.getElementById(`pane-${tabName}`)?.classList.add('active');
  if (tabName === 'rooms') loadSidebarRooms();
};
(window as any).filterRooms = () => {
  const input = document.getElementById('roomSearchInput') as HTMLInputElement;
  if (!input) return;
  const q = input.value.toLowerCase();
  document.querySelectorAll('.room-item').forEach((el: any) => {
    const name = el.querySelector('.room-name')?.textContent?.toLowerCase() || '';
    el.style.display = name.includes(q) ? '' : 'none';
  });
};

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

// ── T-349: Social Graph Overlay ───────────────────────────────────────────────

interface SgNode { id: string; displayName: string; color: string; }
interface SgEdge { source: string; target: string; status: 'accepted' | 'pending'; strength: number; }
interface SgGraph { roomId: string; nodes: SgNode[]; edges: SgEdge[]; generatedAt: string; }

// DOM refs
const socialGraphPanel = document.getElementById('socialGraphPanel') as HTMLElement | null;
const socialGraphSvg   = document.getElementById('socialGraphSvg')   as unknown as SVGSVGElement | null;
const sgStatus         = document.getElementById('sgStatus')          as HTMLElement | null;
const sgHeader         = document.getElementById('sgHeader')          as HTMLElement | null;

// State
let sgInterval: ReturnType<typeof setInterval> | null = null;
let sgCollapsed = false;
const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 196, H = 180; // viewBox dimensions

/** Simple force-directed layout — spring/repulsion iterations */
function layoutNodes(nodes: SgNode[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return pos;

  // Initial positions: evenly spaced on a circle
  const cx = W / 2, cy = H / 2;
  const r  = Math.min(cx, cy) * 0.7;
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    pos.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  });

  // For small sets (1 or 2 nodes) no layout needed
  if (nodes.length <= 2) return pos;

  // Very small iteration count — this is a UI widget, not a physics engine
  const ITERS = 30;
  const REPULSE = 1800;
  const SPRING_LEN = 70;
  const SPRING_K = 0.04;

  for (let iter = 0; iter < ITERS; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();
    for (const n of nodes) forces.set(n.id, { fx: 0, fy: 0 });

    // Repulsion between all pairs
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const pa = pos.get(nodes[a].id)!;
        const pb = pos.get(nodes[b].id)!;
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = REPULSE / (dist * dist);
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        forces.get(nodes[a].id)!.fx -= fx;
        forces.get(nodes[a].id)!.fy -= fy;
        forces.get(nodes[b].id)!.fx += fx;
        forces.get(nodes[b].id)!.fy += fy;
      }
    }

    // Spring attraction along accepted edges
    // (We don't have edges here — layout is position-only; edges passed separately)
    // Centre gravity
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      forces.get(n.id)!.fx += (cx - p.x) * 0.01;
      forces.get(n.id)!.fy += (cy - p.y) * 0.01;
    }

    // Apply forces
    for (const n of nodes) {
      const p  = pos.get(n.id)!;
      const f  = forces.get(n.id)!;
      const damping = 0.5;
      pos.set(n.id, {
        x: Math.max(12, Math.min(W - 12, p.x + f.fx * damping)),
        y: Math.max(12, Math.min(H - 12, p.y + f.fy * damping)),
      });
    }
  }

  return pos;
}

/** Render a social graph into the SVG element */
function renderSocialGraph(graph: SgGraph): void {
  if (!socialGraphSvg) return;

  // Clear
  while (socialGraphSvg.firstChild) socialGraphSvg.removeChild(socialGraphSvg.firstChild);

  if (graph.nodes.length === 0) {
    const txt = document.createElementNS(SVG_NS, 'text');
    txt.setAttribute('x', String(W / 2));
    txt.setAttribute('y', String(H / 2));
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '11');
    txt.setAttribute('fill', 'rgba(255,255,255,0.25)');
    txt.textContent = 'No agents in room';
    socialGraphSvg.appendChild(txt);
    return;
  }

  const pos = layoutNodes(graph.nodes);

  // Draw edges first (behind nodes)
  for (const edge of graph.edges) {
    const pa = pos.get(edge.source);
    const pb = pos.get(edge.target);
    if (!pa || !pb) continue;

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(pa.x));
    line.setAttribute('y1', String(pa.y));
    line.setAttribute('x2', String(pb.x));
    line.setAttribute('y2', String(pb.y));

    if (edge.status === 'accepted') {
      line.setAttribute('stroke', 'rgba(97,218,251,0.7)');
      line.setAttribute('stroke-width', String(1 + edge.strength));
    } else {
      line.setAttribute('stroke', 'rgba(255,180,50,0.4)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4 3');
    }
    socialGraphSvg.appendChild(line);
  }

  // Draw nodes on top
  for (const node of graph.nodes) {
    const p = pos.get(node.id);
    if (!p) continue;

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'sg-node');

    // Outer glow ring
    const glow = document.createElementNS(SVG_NS, 'circle');
    glow.setAttribute('cx', String(p.x));
    glow.setAttribute('cy', String(p.y));
    glow.setAttribute('r', '10');
    glow.setAttribute('fill', node.color);
    glow.setAttribute('opacity', '0.2');
    g.appendChild(glow);

    // Main circle
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(p.x));
    circle.setAttribute('cy', String(p.y));
    circle.setAttribute('r', '7');
    circle.setAttribute('fill', node.color);
    circle.setAttribute('stroke', 'rgba(255,255,255,0.6)');
    circle.setAttribute('stroke-width', '1');
    g.appendChild(circle);

    // Name label (truncated)
    const maxChars = 7;
    const label = node.displayName.length > maxChars
      ? node.displayName.slice(0, maxChars) + '…'
      : node.displayName;

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', String(p.x));
    text.setAttribute('y', String(p.y + 18));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '8');
    text.setAttribute('fill', 'rgba(255,255,255,0.7)');
    text.textContent = label;
    g.appendChild(text);

    socialGraphSvg.appendChild(g);
  }
}

/** Fetch social graph from server and render */
async function fetchAndRenderSocialGraph(roomId: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/spectate/social-graph/${roomId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const graph: SgGraph = await res.json();

    renderSocialGraph(graph);

    const friendCount = graph.edges.filter(e => e.status === 'accepted').length;
    const pendingCount = graph.edges.filter(e => e.status === 'pending').length;
    if (sgStatus) {
      sgStatus.textContent = `${graph.nodes.length} agents · ${friendCount} bonds${pendingCount ? ` · ${pendingCount} pending` : ''}`;
    }
  } catch (err) {
    console.warn('[SocialGraph] Fetch failed:', err);
    if (sgStatus) sgStatus.textContent = 'Graph unavailable';
  }
}

/** Show the social graph panel for a given room */
function showSocialGraph(roomId: string): void {
  if (!socialGraphPanel) return;
  socialGraphPanel.classList.remove('hidden');
  fetchAndRenderSocialGraph(roomId);
  // Refresh every 30 seconds (agents enter/leave, friendships form)
  if (sgInterval) clearInterval(sgInterval);
  sgInterval = setInterval(() => {
    if (currentRoom) fetchAndRenderSocialGraph(currentRoom);
  }, 30_000);
}

/** Hide the social graph panel */
function hideSocialGraph(): void {
  if (!socialGraphPanel) return;
  socialGraphPanel.classList.add('hidden');
  if (sgInterval) { clearInterval(sgInterval); sgInterval = null; }
}

// Toggle collapse on header click
sgHeader?.addEventListener('click', () => {
  sgCollapsed = !sgCollapsed;
  if (sgCollapsed) {
    socialGraphPanel?.classList.add('collapsed');
  } else {
    socialGraphPanel?.classList.remove('collapsed');
  }
});

// Hook into joinRoom/leaveRoom
const _origJoinRoom = (window as any).__sgOrigJoinRoom;

// Patch: watch currentRoom changes by observing the HUD
// We use a MutationObserver on spectatorHUD visibility instead of patching joinRoom
// (to avoid double-patching if this code runs after joinRoom is defined)
const hudObserver = new MutationObserver(() => {
  const hudVisible = spectatorHUD && !spectatorHUD.classList.contains('hidden');
  if (hudVisible && currentRoom) {
    showSocialGraph(currentRoom);
  } else {
    hideSocialGraph();
  }
});
if (spectatorHUD) {
  hudObserver.observe(spectatorHUD, { attributes: true, attributeFilter: ['class'] });
}

// Export for tests
(window as any).socialGraph = {
  layoutNodes,
  renderSocialGraph,
  fetchAndRenderSocialGraph,
  showSocialGraph,
  hideSocialGraph,
};

// ── T-356: Live Event Ticker ─────────────────────────────────────────────────

const tickerEl     = document.getElementById('eventTicker')  as HTMLElement | null;
const tickerInner  = document.getElementById('tickerInner')   as HTMLElement | null;

let _tickerInterval: ReturnType<typeof setInterval> | null = null;
const TICKER_REFRESH_MS = 8_000;
const TICKER_MAX_EVENTS = 15;

/**
 * Format a Unix-ms timestamp as "Xs / Xm / Xh ago"
 */
export function formatTickerTime(ms: number): string {
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60)   return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  return `${Math.floor(diffSec / 3600)}h`;
}

interface TickerEvent { icon: string; message: string; timestamp: number; }

/**
 * Build the inner HTML for the ticker track.
 * Items are duplicated so the CSS animation loops seamlessly.
 */
export function buildTickerHtml(events: TickerEvent[]): string {
  if (events.length === 0) {
    return '<span class="ticker-empty">No recent events — agents are warming up…</span>';
  }

  const items = events
    .map(ev => {
      const t = formatTickerTime(ev.timestamp);
      const msg = ev.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<span class="ticker-item">` +
               `<span class="t-icon">${ev.icon}</span>` +
               `<span>${msg}</span>` +
               `<span class="t-time">${t}</span>` +
             `</span>` +
             `<span class="ticker-sep" aria-hidden="true">·</span>`;
    })
    .join('');

  // Duplicate for seamless loop — CSS animation is -50%
  return items + items;
}

/**
 * Calculate a CSS animation duration proportional to content length
 * so each character takes the same time to scroll past.
 * Base: 40 s for 15 events; min 20 s, max 90 s.
 */
export function calcTickerDuration(eventCount: number): number {
  const base = Math.max(1, eventCount);
  return Math.min(90, Math.max(20, base * 3));
}

/**
 * Fetch events from /api/spectate/live-events and refresh the ticker DOM.
 */
async function refreshTicker(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/spectate/live-events?limit=${TICKER_MAX_EVENTS}`);
    if (!res.ok) return;
    const data = await res.json();
    const events: TickerEvent[] = (data.events ?? []).map((e: any) => ({
      icon:      e.icon      ?? '📡',
      message:   e.message   ?? '',
      timestamp: e.timestamp ?? Date.now(),
    }));

    if (!tickerInner) return;

    const html = buildTickerHtml(events);
    tickerInner.innerHTML = html;

    // Reset + restart animation
    const shouldScroll = events.length > 0;
    const dur = calcTickerDuration(events.length);
    tickerInner.style.setProperty('--ticker-duration', `${dur}s`);
    tickerInner.classList.toggle('scrolling', shouldScroll);
  } catch (_) {
    // Silently ignore — ticker is cosmetic
  }
}

/**
 * Start the live event ticker (call on room enter).
 */
export function showTicker(): void {
  tickerEl?.classList.remove('hidden');
  void refreshTicker();
  if (!_tickerInterval) {
    _tickerInterval = setInterval(() => void refreshTicker(), TICKER_REFRESH_MS);
  }
}

/**
 * Stop the live event ticker (call on room leave).
 */
export function hideTicker(): void {
  tickerEl?.classList.add('hidden');
  if (_tickerInterval) {
    clearInterval(_tickerInterval);
    _tickerInterval = null;
  }
}

// Hook ticker into room lifecycle via HUD observer (reuse hudObserver pattern)
const tickerHudObserver = new MutationObserver(() => {
  const inRoom = spectatorHUD && !spectatorHUD.classList.contains('hidden');
  if (inRoom) showTicker(); else hideTicker();
});
if (spectatorHUD) {
  tickerHudObserver.observe(spectatorHUD, { attributes: true, attributeFilter: ['class'] });
}

// Export for tests
(window as any).ticker = {
  formatTickerTime,
  buildTickerHtml,
  calcTickerDuration,
  showTicker,
  hideTicker,
};


// ── T-357: TV Mode / Auto-Discovery ─────────────────────────────────────────

const TV_MODE_SECONDS = 30;          // Seconds between auto-switches
const TV_MODE_SKIP_EMPTY = true;     // Skip rooms with 0 agents

const tvModeBtn       = document.getElementById('tvModeBtn')    as HTMLButtonElement | null;
const tvCountdownEl   = document.getElementById('tvCountdown')  as HTMLElement | null;

let _tvActive              = false;
let _tvTickInterval: ReturnType<typeof setInterval> | null = null;
let _tvSecondsLeft         = TV_MODE_SECONDS;
let _tvRooms: Array<{ id: string; name: string; agentCount: number }> = [];

/**
 * Format countdown seconds as "0:SS"
 */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `0:${s.toString().padStart(2, '0')}`;
}

/**
 * Select next room to switch to.
 * Strategy: pick the room with the most agents that isn't the current room.
 * Falls back to any room if all except current have 0 agents.
 */
export function selectNextTvRoom(
  rooms: Array<{ id: string; name: string; agentCount: number }>,
  currentRoomId: string | null,
): { id: string; name: string } | null {
  const candidates = rooms.filter(r => r.id !== currentRoomId);
  if (candidates.length === 0) return null;

  // Sort by agent count desc
  const sorted = [...candidates].sort((a, b) => b.agentCount - a.agentCount);

  if (TV_MODE_SKIP_EMPTY) {
    const withAgents = sorted.filter(r => r.agentCount > 0);
    if (withAgents.length > 0) return withAgents[0];
  }
  return sorted[0] ?? null;
}

/**
 * Fetch rooms for TV mode (reuse spectate/rooms endpoint).
 */
async function fetchTvRooms(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/spectate/rooms`);
    if (!res.ok) return;
    const data = await res.json();
    _tvRooms = (data.rooms ?? []).map((r: any) => ({
      id:         r.id,
      name:       r.name ?? 'Room',
      agentCount: r.agentCount ?? 0,
    }));
  } catch (_) {}
}

/**
 * Update the countdown display in the HUD button.
 */
function _updateTvCountdown(): void {
  if (!tvCountdownEl) return;
  tvCountdownEl.textContent = formatCountdown(_tvSecondsLeft);
}

/**
 * Perform one TV tick (called every second while TV mode is active).
 */
async function _tvTick(): Promise<void> {
  _tvSecondsLeft--;
  _updateTvCountdown();

  if (_tvSecondsLeft <= 0) {
    _tvSecondsLeft = TV_MODE_SECONDS;
    // Refresh room list before switching
    await fetchTvRooms();
    const next = selectNextTvRoom(_tvRooms, currentRoom);
    if (next) {
      console.log(`[TV Mode] Auto-switching to: ${next.name}`);
      // Show brief toast (reuse event-toast style if available)
      _showTvSwitchToast(next.name);
      // Small delay for toast visibility
      setTimeout(() => {
        if (_tvActive) {
          // Leave current room gracefully and join next
          if (currentRoom) {
            // We only destroy the canvas & WS; don't reset TV state
            _softLeaveRoom();
          }
          joinRoom(next.id, next.name);
        }
      }, 800);
    }
  }
}

/**
 * Leave current room without disabling TV mode (internal helper).
 */
function _softLeaveRoom(): void {
  if (ws) { ws.close(); ws = null; }
  if (app) { app.destroy(true); app = null; renderer = null; }
  currentRoom = null;
}

/**
 * Show a brief "TV Mode switching" toast notification.
 */
function _showTvSwitchToast(roomName: string): void {
  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:fixed', 'top:50%', 'left:50%',
    'transform:translate(-50%,-50%)',
    'background:rgba(10,12,26,0.92)',
    'border:1px solid rgba(97,218,251,0.5)',
    'border-radius:12px',
    'padding:16px 28px',
    'font-size:16px',
    'font-weight:700',
    'color:#61dafb',
    'z-index:9999',
    'text-align:center',
    'backdrop-filter:blur(10px)',
    'transition:opacity 0.4s',
    'pointer-events:none',
  ].join(';');
  toast.textContent = `📺 Next up: ${roomName}`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; }, 1200);
  setTimeout(() => { toast.remove(); }, 1700);
}

/**
 * Start TV mode.
 */
export function startTvMode(): void {
  if (_tvActive) return;
  _tvActive = true;
  _tvSecondsLeft = TV_MODE_SECONDS;
  tvModeBtn?.classList.add('active');
  if (tvCountdownEl) { tvCountdownEl.style.display = ''; }
  _updateTvCountdown();
  // Prefetch rooms immediately
  void fetchTvRooms();
  // Tick every second
  _tvTickInterval = setInterval(() => void _tvTick(), 1000);
  console.log('[TV Mode] Started');
}

/**
 * Stop TV mode.
 */
export function stopTvMode(): void {
  if (!_tvActive) return;
  _tvActive = false;
  tvModeBtn?.classList.remove('active');
  if (tvCountdownEl) { tvCountdownEl.style.display = 'none'; }
  if (_tvTickInterval) { clearInterval(_tvTickInterval); _tvTickInterval = null; }
  console.log('[TV Mode] Stopped');
}

/**
 * Toggle TV mode on / off.
 */
export function toggleTvMode(): void {
  if (_tvActive) stopTvMode(); else startTvMode();
}

tvModeBtn?.addEventListener('click', toggleTvMode);

// TV mode state getters (for tests)
export function isTvModeActive(): boolean { return _tvActive; }
export function getTvSecondsLeft(): number { return _tvSecondsLeft; }
export function getTvRooms(): typeof _tvRooms { return _tvRooms; }

// Export for tests
(window as any).tvMode = {
  formatCountdown,
  selectNextTvRoom,
  startTvMode,
  stopTvMode,
  toggleTvMode,
  isTvModeActive,
  getTvSecondsLeft,
  getTvRooms,
};
