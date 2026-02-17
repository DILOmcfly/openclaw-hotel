import { Application, Container, Sprite, Texture, Graphics, Text, TextStyle } from 'pixi.js';
import { SpriteLoader } from './SpriteLoader.js';

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/** Smooth movement duration per tile (ms) */
const MOVE_DURATION_MS = 280;

/** Emote bubble display duration (ms) */
const EMOTE_DURATION_MS = 1800;

/** Chat bubble max chars per page */
const BUBBLE_CHUNK_SIZE = 90;
/** How long each bubble page shows (ms) */
const BUBBLE_PAGE_MS = 3200;
/** Short message display duration (ms) */
const BUBBLE_SHORT_MS = 4000;

export function gridToScreen(gridX: number, gridY: number, gridZ: number = 0): { x: number; y: number } {
  const x = (gridX - gridY) * (TILE_WIDTH / 2);
  const y = (gridX + gridY) * (TILE_HEIGHT / 2) - gridZ * TILE_HEIGHT;
  return { x, y };
}

export function screenToGrid(screenX: number, screenY: number): { gridX: number; gridY: number } {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const gridX = (screenX / halfW + screenY / halfH) / 2;
  const gridY = (screenY / halfH - screenX / halfW) / 2;
  return { gridX, gridY };
}

export function depthSort(gridX: number, gridY: number, gridZ: number = 0): number {
  return gridX + gridY + gridZ * 0.01;
}

// ─── Smooth movement state ────────────────────────────────────────────────────

interface MoveState {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startMs: number;
  durationMs: number;
}

// ─── Chat bubble state ────────────────────────────────────────────────────────

interface BubbleState {
  element: HTMLDivElement;
  expiresAt: number;
  pendingChunks: string[];
  pageTimer?: ReturnType<typeof setTimeout>;
}

// ─── Agent & furniture records ────────────────────────────────────────────────

interface AgentInfo {
  sprite: Container;
  nameText: Text;
  gridX: number;
  gridY: number;
  /** Visual grid position during tween (fractional) */
  visualGridX: number;
  visualGridY: number;
  /** Current screen position (updated by smooth movement) */
  screenX: number;
  screenY: number;
  /** Active smooth movement, if any */
  move?: MoveState;
}

interface FurnitureInfo {
  sprite: Container;
  gridX: number;
  gridY: number;
}

export class IsoRenderer {
  private app: Application;
  private world: Container;
  private floorLayer: Container;
  private objectLayer: Container;
  private agents: Map<string, AgentInfo> = new Map();
  private furniture: Map<string, FurnitureInfo> = new Map();
  private grid: boolean[][] = [];
  private gridWidth: number = 0;
  private gridHeight: number = 0;
  private floorTexture: Texture | null = null;
  private spriteLoader: SpriteLoader;
  private spritesLoaded: boolean = false;

  // ── Chat bubbles (HTML overlay) ───────────────────────────────────────────
  private bubbleOverlay: HTMLDivElement;
  private activeBubbles: Map<string, BubbleState> = new Map();

  // ── Emotes (HTML overlay) ────────────────────────────────────────────────
  private emoteOverlay: HTMLDivElement;

  // ── Ticker for smooth movement + bubble cleanup ───────────────────────────
  private tickerBound: () => void;

  constructor(app: Application, heightmap: string, spriteLoader: SpriteLoader) {
    this.app = app;
    this.spriteLoader = spriteLoader;

    // Create world container
    this.world = new Container();
    this.floorLayer = new Container();
    this.objectLayer = new Container();

    this.world.addChild(this.floorLayer);
    this.world.addChild(this.objectLayer);
    this.app.stage.addChild(this.world);

    // Parse heightmap
    this.parseHeightmap(heightmap);

    // Center the world
    this.centerWorld();

    // Draw floor
    this.drawFloor();

    // Create HTML overlays for bubbles / emotes (above canvas, pointer-events: none)
    this.bubbleOverlay = this.createOverlay('iso-bubble-overlay');
    this.emoteOverlay = this.createOverlay('iso-emote-overlay');

    // Start animation ticker
    this.tickerBound = () => { this.onTick(); };
    (this.app.ticker as any).add(this.tickerBound);
  }

  // ─── Overlay helpers ────────────────────────────────────────────────────────

  private createOverlay(id: string): HTMLDivElement {
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;overflow:hidden;';
    document.body.appendChild(el);
    return el;
  }

  // ─── Ticker ─────────────────────────────────────────────────────────────────

  private onTick() {
    const nowMs = performance.now();

    // 1. Smooth agent movement
    for (const [, agent] of this.agents) {
      if (!agent.move) continue;
      const { fromX, fromY, toX, toY, startMs, durationMs } = agent.move;
      const elapsed = nowMs - startMs;
      const rawT = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic
      const t = 1 - Math.pow(1 - rawT, 3);
      const currentGridX = fromX + (toX - fromX) * t;
      const currentGridY = fromY + (toY - fromY) * t;
      const { x, y } = gridToScreen(currentGridX, currentGridY);
      agent.sprite.x = x;
      agent.sprite.y = y;
      agent.sprite.zIndex = depthSort(currentGridX, currentGridY, 1);
      agent.screenX = x;
      agent.screenY = y;
      agent.visualGridX = currentGridX;
      agent.visualGridY = currentGridY;
      if (rawT >= 1) {
        agent.move = undefined;
        agent.gridX = toX;
        agent.gridY = toY;
        agent.visualGridX = toX;
        agent.visualGridY = toY;
      }
    }

    // 2. Expire chat bubbles
    for (const [agentId, bubble] of this.activeBubbles) {
      if (bubble.expiresAt > 0 && nowMs >= bubble.expiresAt) {
        this.removeBubble(agentId);
      }
    }
  }

  // ─── Public: show chat bubble above an agent ────────────────────────────────

  showChatBubble(agentId: string, content: string): void {
    this.removeBubble(agentId);

    const agent = this.agents.get(agentId);
    if (!agent) return;

    const chunks = this.splitChunks(content, BUBBLE_CHUNK_SIZE);
    const firstChunk = chunks.shift() ?? '';
    const hasMore = chunks.length > 0;

    const el = this.createBubbleElement(firstChunk, hasMore);
    this.positionBubbleEl(el, agent.sprite.x + this.world.x, agent.sprite.y + this.world.y);
    this.bubbleOverlay.appendChild(el);

    const state: BubbleState = {
      element: el,
      expiresAt: hasMore ? 0 : performance.now() + BUBBLE_SHORT_MS,
      pendingChunks: chunks,
    };
    this.activeBubbles.set(agentId, state);

    if (hasMore) {
      this.scheduleNextPage(agentId, state);
    }
  }

  private createBubbleElement(text: string, hasMore: boolean): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute;
      transform:translateX(-50%);
      background:#fff;
      color:#111;
      border:2px solid #000;
      border-radius:12px;
      padding:5px 12px;
      font-family:Arial,sans-serif;
      font-size:12px;
      font-weight:bold;
      white-space:normal;
      word-wrap:break-word;
      max-width:200px;
      box-shadow:2px 2px 0 rgba(0,0,0,.2);
      animation:isobubbleIn .15s ease-out;
      transition:opacity .3s ease-out;
    `;

    // Inject @keyframes once
    if (!document.getElementById('iso-bubble-style')) {
      const style = document.createElement('style');
      style.id = 'iso-bubble-style';
      style.textContent = `
        @keyframes isobubbleIn {
          from { opacity:0; transform:translateX(-50%) scale(.8); }
          to   { opacity:1; transform:translateX(-50%) scale(1); }
        }
        @keyframes isoEmoteRise {
          0%   { opacity:1; transform:translateX(-50%) translateY(0)   scale(1); }
          80%  { opacity:.8;transform:translateX(-50%) translateY(-36px) scale(1.1); }
          100% { opacity:0; transform:translateX(-50%) translateY(-45px) scale(.9); }
        }
      `;
      document.head.appendChild(style);
    }

    el.textContent = text + (hasMore ? ' ▸' : '');

    // Tail
    const tail = document.createElement('div');
    tail.style.cssText =
      'position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #000;';
    el.appendChild(tail);
    const tailInner = document.createElement('div');
    tailInner.style.cssText =
      'position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #fff;';
    el.appendChild(tailInner);

    return el;
  }

  private positionBubbleEl(el: HTMLDivElement, screenX: number, screenY: number): void {
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY - 80}px`;
  }

  private scheduleNextPage(agentId: string, state: BubbleState): void {
    state.pageTimer = setTimeout(() => {
      if (!this.activeBubbles.has(agentId)) return;
      if (state.pendingChunks.length === 0) {
        state.expiresAt = performance.now() + BUBBLE_PAGE_MS;
        return;
      }
      const next = state.pendingChunks.shift() ?? '';
      const hasMore = state.pendingChunks.length > 0;
      state.element.childNodes[0].textContent = next + (hasMore ? ' ▸' : '');
      if (hasMore) {
        this.scheduleNextPage(agentId, state);
      } else {
        state.expiresAt = performance.now() + BUBBLE_PAGE_MS;
      }
    }, BUBBLE_PAGE_MS);
  }

  private removeBubble(agentId: string): void {
    const state = this.activeBubbles.get(agentId);
    if (!state) return;
    if (state.pageTimer) clearTimeout(state.pageTimer);
    state.element.style.opacity = '0';
    setTimeout(() => state.element.remove(), 300);
    this.activeBubbles.delete(agentId);
  }

  private splitChunks(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) { chunks.push(remaining); break; }
      let at = remaining.lastIndexOf(' ', maxLen);
      if (at <= 0) at = maxLen;
      chunks.push(remaining.slice(0, at).trim());
      remaining = remaining.slice(at).trim();
    }
    return chunks;
  }

  // ─── Public: show floating emote emoji above an agent ──────────────────────

  showEmote(agentId: string, emote: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const emoji = this.emoteToEmoji(emote);
    const screenX = agent.sprite.x + this.world.x;
    const screenY = agent.sprite.y + this.world.y;

    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute;
      left:${screenX}px;
      top:${screenY - 70}px;
      transform:translateX(-50%);
      font-size:22px;
      line-height:1;
      pointer-events:none;
      animation:isoEmoteRise ${EMOTE_DURATION_MS}ms ease-out forwards;
    `;
    el.textContent = emoji;
    this.emoteOverlay.appendChild(el);

    // Auto-remove after animation
    setTimeout(() => el.remove(), EMOTE_DURATION_MS + 100);
  }

  private emoteToEmoji(emote: string): string {
    const map: Record<string, string> = {
      dance: '💃', wave: '👋', laugh: '😂', clap: '👏',
      sad: '😢', angry: '😠', love: '❤️', cool: '😎',
      happy: '😊', wink: '😉', surprised: '😲', think: '🤔',
      sit: '🪑', stand: '🧍', cheer: '🎉',
    };
    return map[String(emote).toLowerCase()] ?? '✨';
  }

  // ─── Heightmap / floor ──────────────────────────────────────────────────────

  private parseHeightmap(heightmap: string) {
    const rows = heightmap.split(/[\n|]/);
    this.gridHeight = rows.length;
    this.gridWidth = 0;
    this.grid = [];

    for (const row of rows) {
      const cells: boolean[] = [];
      for (const ch of row) {
        cells.push(ch === 'x' || ch === '0' || (ch >= '1' && ch <= '9'));
      }
      if (cells.length > this.gridWidth) this.gridWidth = cells.length;
      this.grid.push(cells);
    }
  }

  private centerWorld() {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const centerGrid = gridToScreen(this.gridWidth / 2, this.gridHeight / 2);
    this.world.x = screenW / 2 - centerGrid.x;
    this.world.y = screenH / 3 - centerGrid.y;
  }

  private drawFloor() {
    const floorTexture = this.spriteLoader.getTexture('floor_stone');

    for (let gy = 0; gy < this.gridHeight; gy++) {
      for (let gx = 0; gx < this.gridWidth; gx++) {
        if (!this.grid[gy]?.[gx]) continue;

        const { x, y } = gridToScreen(gx, gy);
        let tile: Sprite | Graphics;

        if (floorTexture) {
          tile = new Sprite(floorTexture);
          (tile as Sprite).anchor.set(0.5, 0.5);
        } else {
          tile = new Graphics();
          const isEven = (gx + gy) % 2 === 0;
          const baseColor = isEven ? 0x2d5a3d : 0x346b47;

          (tile as Graphics).fill({ color: baseColor, alpha: 1 });
          (tile as Graphics).moveTo(0, -TILE_HEIGHT / 2);
          (tile as Graphics).lineTo(TILE_WIDTH / 2, 0);
          (tile as Graphics).lineTo(0, TILE_HEIGHT / 2);
          (tile as Graphics).lineTo(-TILE_WIDTH / 2, 0);
          (tile as Graphics).closePath();
          (tile as Graphics).fill();
          (tile as Graphics).stroke({ color: 0x1a3a25, width: 1, alpha: 0.5 });
          (tile as Graphics).moveTo(0, -TILE_HEIGHT / 2);
          (tile as Graphics).lineTo(TILE_WIDTH / 2, 0);
          (tile as Graphics).lineTo(0, TILE_HEIGHT / 2);
          (tile as Graphics).lineTo(-TILE_WIDTH / 2, 0);
          (tile as Graphics).closePath();
          (tile as Graphics).stroke();
        }

        tile.x = x;
        tile.y = y;
        tile.zIndex = depthSort(gx, gy);
        this.floorLayer.addChild(tile);
      }
    }

    this.floorLayer.sortableChildren = true;
    this.objectLayer.sortableChildren = true;
  }

  // ─── Agent management ───────────────────────────────────────────────────────

  addAgent(agent: { id: string; displayName: string; x: number; y: number }) {
    this.placeAgent(agent.id, agent.x, agent.y, agent.displayName);
  }

  addFurniture(item: { id: string; type?: string; furnitureType?: string; x: number; y: number }) {
    this.placeFurniture(item.id, item.type || item.furnitureType || 'unknown', item.x, item.y);
  }

  moveFurniture(id: string, gridX: number, gridY: number, _gridZ?: number) {
    const item = this.furniture.get(id);
    if (!item) return;
    const { x, y } = gridToScreen(gridX, gridY);
    item.sprite.x = x;
    item.sprite.y = y;
    item.sprite.zIndex = depthSort(gridX, gridY, 0.5);
  }

  removeFurniture(id: string) {
    const item = this.furniture.get(id);
    if (item) {
      this.objectLayer.removeChild(item.sprite);
      item.sprite.destroy();
      this.furniture.delete(id);
    }
  }

  placeAgent(id: string, gridX: number, gridY: number, name: string) {
    if (this.agents.has(id)) {
      this.moveAgent(id, gridX, gridY);
      return;
    }

    const { x, y } = gridToScreen(gridX, gridY);
    const container = new Container();
    const agentTexture = this.spriteLoader.getTexture('agent_idle_se');

    if (agentTexture) {
      const agentSprite = new Sprite(agentTexture);
      agentSprite.anchor.set(0.5, 1);
      container.addChild(agentSprite);
    } else {
      const body = new Graphics();
      const colors = [0x00ffcc, 0xff6b6b, 0x6b9bff, 0xffcc00, 0xff69b4, 0x88ff88];
      const color = colors[Math.abs(hashCode(id)) % colors.length];
      body.fill({ color, alpha: 0.9 });
      body.roundRect(-10, -30, 20, 30, 4);
      body.fill();
      body.fill({ color, alpha: 1 });
      body.circle(0, -36, 8);
      body.fill();
      body.fill({ color: 0x000000, alpha: 0.3 });
      body.ellipse(0, 2, 12, 4);
      body.fill();
      container.addChild(body);
    }

    const nameStyle = new TextStyle({
      fontSize: 11,
      fill: 0xffffff,
      fontFamily: 'monospace',
      stroke: { color: 0x000000, width: 2 },
      align: 'center',
    });
    const nameText = new Text({ text: name, style: nameStyle });
    nameText.anchor.set(0.5, 1);
    nameText.y = agentTexture ? -agentTexture.height : -48;
    container.addChild(nameText);

    container.x = x;
    container.y = y;
    container.zIndex = depthSort(gridX, gridY, 1);

    this.objectLayer.addChild(container);
    this.agents.set(id, { sprite: container, nameText, gridX, gridY, visualGridX: gridX, visualGridY: gridY, screenX: x, screenY: y });
  }

  removeAgent(id: string) {
    const agent = this.agents.get(id);
    if (agent) {
      this.objectLayer.removeChild(agent.sprite);
      agent.sprite.destroy();
      this.removeBubble(id);
      this.agents.delete(id);
    }
  }

  /**
   * Smoothly move an agent to a new grid position using eased interpolation.
   * The movement animates over MOVE_DURATION_MS milliseconds.
   */
  /**
   * Smoothly move an agent to a new grid position (ease-out cubic over MOVE_DURATION_MS).
   * If already mid-tween, starts new tween from current visual position.
   */
  moveAgent(id: string, gridX: number, gridY: number) {
    const agent = this.agents.get(id);
    if (!agent) return;

    // Already at destination — no-op
    if (agent.gridX === gridX && agent.gridY === gridY && !agent.move) return;

    // Start from current visual position (may be mid-tween)
    const fromX = agent.visualGridX;
    const fromY = agent.visualGridY;

    agent.move = {
      fromX,
      fromY,
      toX: gridX,
      toY: gridY,
      startMs: performance.now(),
      durationMs: MOVE_DURATION_MS,
    };

    // Update logical grid position immediately
    agent.gridX = gridX;
    agent.gridY = gridY;
  }

  placeFurniture(id: string, type: string, gridX: number, gridY: number) {
    if (this.furniture.has(id)) return;

    const { x, y } = gridToScreen(gridX, gridY);
    const container = new Container();
    const furnitureTexture =
      this.spriteLoader.getTexture(`furniture_${type}`) || this.spriteLoader.getTexture(type);

    if (furnitureTexture) {
      const furnitureSprite = new Sprite(furnitureTexture);
      furnitureSprite.anchor.set(0.5, 1);
      container.addChild(furnitureSprite);
    } else {
      const box = new Graphics();
      const furnitureColors: Record<string, number> = {
        sofa: 0x4488cc, table: 0x8B4513, chair: 0xA0522D, lamp: 0xFFD700,
        bed: 0x6B4226, bookshelf: 0x654321, tv: 0x333333, computer: 0x555555,
        plant: 0x228B22, fridge: 0xCCCCCC,
      };
      const color = furnitureColors[type] || 0x888888;
      box.fill({ color, alpha: 0.8 });
      box.roundRect(-12, -20, 24, 20, 2);
      box.fill();
      box.fill({ color: 0x000000, alpha: 0.2 });
      box.ellipse(0, 2, 14, 5);
      box.fill();
      container.addChild(box);

      const labelStyle = new TextStyle({ fontSize: 9, fill: 0xaaaaaa, fontFamily: 'monospace' });
      const label = new Text({ text: type, style: labelStyle });
      label.anchor.set(0.5, 1);
      label.y = -22;
      container.addChild(label);
    }

    container.x = x;
    container.y = y;
    container.zIndex = depthSort(gridX, gridY, 0.5);
    this.objectLayer.addChild(container);
    this.furniture.set(id, { sprite: container, gridX, gridY });
  }

  destroy() {
    (this.app.ticker as any).remove(this.tickerBound);
    for (const agentId of this.agents.keys()) {
      this.removeBubble(agentId);
    }
    this.bubbleOverlay.remove();
    this.emoteOverlay.remove();
    this.agents.clear();
    this.furniture.clear();
    this.world.destroy({ children: true });
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}
