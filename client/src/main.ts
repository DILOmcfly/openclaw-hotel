import { Application, Container } from 'pixi.js';
import { parseHeightmap, TileMap } from './renderer/TileMap.js';
import { AgentRenderer } from './renderer/AgentSprite.js';
import { BubbleSystem } from './renderer/BubbleSystem.js';
import { FurnitureRenderer } from './renderer/FurnitureRenderer.js';
import { HotelWSClient } from './ws/client.js';

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
const MY_ID = `agent-${Math.random().toString(36).slice(2, 8)}`;

async function init() {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#1a1a2e',
    antialias: true,
  });

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
  const bubbleSystem = new BubbleSystem(world);
  const furnitureRenderer = new FurnitureRenderer(world);

  // Add self as initial agent
  agentRenderer.addOrUpdate({ agentId: MY_ID, x: 4, y: 4, color: MY_COLOR });

  // WebSocket connection (if server running)
  const ws = new HotelWSClient();
  let currentRoom = 'lobby';

  // Try to connect
  try {
    ws.on('connected', () => {
      console.log('[Hotel] Connected, joining room...');
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
    });

    ws.on('agent.left', (msg) => {
      const agentId = msg.agentId as string;
      agentRenderer.remove(agentId);
    });

    ws.on('chat.message', (msg) => {
      const agentId = msg.agentId as string;
      const content = msg.content as string;
      const agents = agentRenderer.getAll();
      const agent = agents.find((a) => a.agentId === agentId);
      if (agent) {
        bubbleSystem.show(agentId, content, agent.x, agent.y);
      }
    });

    // Connect with placeholder token (real auth requires server)
    // ws.connect('demo-token');
    console.log('[Hotel] Client ready (offline mode — start server and uncomment ws.connect)');
  } catch {
    console.log('[Hotel] Running in offline mode');
  }

  // Click to move
  app.canvas.addEventListener('click', (e: MouseEvent) => {
    const localX = e.clientX - world.position.x;
    const localY = e.clientY - world.position.y;
    const tile = tileMap.getTileAt(localX, localY);
    if (tile) {
      console.log(`Moving to (${tile.gridX}, ${tile.gridY})`);
      agentRenderer.addOrUpdate({ agentId: MY_ID, x: tile.gridX, y: tile.gridY, color: MY_COLOR });
      ws.move(currentRoom, tile.gridX, tile.gridY);
    }
  });

  // Chat input
  const chatDiv = document.createElement('div');
  chatDiv.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:100';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type a message...';
  input.style.cssText = 'padding:8px 16px;border-radius:20px;border:2px solid #444;background:#222;color:#fff;width:300px;font-size:14px;outline:none';
  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.style.cssText = 'padding:8px 16px;border-radius:20px;border:none;background:#7E57C2;color:#fff;cursor:pointer;font-size:14px';
  chatDiv.appendChild(input);
  chatDiv.appendChild(sendBtn);
  document.body.appendChild(chatDiv);

  // Room info overlay
  const info = document.createElement('div');
  info.style.cssText = 'position:fixed;top:16px;left:16px;color:#fff;font-family:monospace;font-size:14px;z-index:100';
  info.innerHTML = `<strong>OpenClaw Hotel</strong><br>Room: ${currentRoom}<br>Agent: ${MY_ID}`;
  document.body.appendChild(info);

  const sendChat = () => {
    const text = input.value.trim();
    if (!text) return;
    // Show own bubble
    const me = agentRenderer.getAll().find((a) => a.agentId === MY_ID);
    if (me) bubbleSystem.show(MY_ID, text, me.x, me.y);
    ws.chat(currentRoom, text);
    input.value = '';
  };

  sendBtn.addEventListener('click', sendChat);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });

  // Game loop for bubble cleanup
  app.ticker.add(() => {
    bubbleSystem.update();
  });

  console.log('OpenClaw Hotel client ready');
}

init().catch(console.error);
