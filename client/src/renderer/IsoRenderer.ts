import { Application, Container, Sprite, Texture, Graphics, Text, TextStyle } from 'pixi.js';
import { SpriteLoader } from './SpriteLoader.js';

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

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

interface AgentInfo {
  sprite: Container;
  nameText: Text;
  gridX: number;
  gridY: number;
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
  }

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
    
    // Center of the isometric grid
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
          // Use real sprite
          tile = new Sprite(floorTexture);
          tile.anchor.set(0.5, 0.5);
        } else {
          // Fallback to Graphics primitive
          tile = new Graphics();
          
          // Tile color with slight variation for checker pattern
          const isEven = (gx + gy) % 2 === 0;
          const baseColor = isEven ? 0x2d5a3d : 0x346b47;
          
          tile.fill({ color: baseColor, alpha: 1 });
          tile.moveTo(0, -TILE_HEIGHT / 2);          // top
          tile.lineTo(TILE_WIDTH / 2, 0);             // right
          tile.lineTo(0, TILE_HEIGHT / 2);             // bottom
          tile.lineTo(-TILE_WIDTH / 2, 0);             // left
          tile.closePath();
          tile.fill();
          
          // Add subtle border
          tile.stroke({ color: 0x1a3a25, width: 1, alpha: 0.5 });
          tile.moveTo(0, -TILE_HEIGHT / 2);
          tile.lineTo(TILE_WIDTH / 2, 0);
          tile.lineTo(0, TILE_HEIGHT / 2);
          tile.lineTo(-TILE_WIDTH / 2, 0);
          tile.closePath();
          tile.stroke();
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
    
    // Try to load agent sprite (use agent_idle_se as default)
    const agentTexture = this.spriteLoader.getTexture('agent_idle_se');
    
    if (agentTexture) {
      // Use real pixel art sprite
      const agentSprite = new Sprite(agentTexture);
      agentSprite.anchor.set(0.5, 1); // Bottom-center anchor for isometric
      container.addChild(agentSprite);
    } else {
      // Fallback to Graphics primitive
      const body = new Graphics();
      const colors = [0x00ffcc, 0xff6b6b, 0x6b9bff, 0xffcc00, 0xff69b4, 0x88ff88];
      const color = colors[Math.abs(hashCode(id)) % colors.length];
      
      // Draw a simple agent shape (isometric character placeholder)
      body.fill({ color: color, alpha: 0.9 });
      body.roundRect(-10, -30, 20, 30, 4);
      body.fill();
      
      // Head
      body.fill({ color: color, alpha: 1 });
      body.circle(0, -36, 8);
      body.fill();
      
      // Shadow
      body.fill({ color: 0x000000, alpha: 0.3 });
      body.ellipse(0, 2, 12, 4);
      body.fill();
      
      container.addChild(body);
    }
    
    // Name label
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
    this.agents.set(id, { sprite: container, nameText, gridX, gridY });
  }

  removeAgent(id: string) {
    const agent = this.agents.get(id);
    if (agent) {
      this.objectLayer.removeChild(agent.sprite);
      agent.sprite.destroy();
      this.agents.delete(id);
    }
  }

  moveAgent(id: string, gridX: number, gridY: number) {
    const agent = this.agents.get(id);
    if (!agent) return;
    
    const { x, y } = gridToScreen(gridX, gridY);
    agent.sprite.x = x;
    agent.sprite.y = y;
    agent.sprite.zIndex = depthSort(gridX, gridY, 1);
    agent.gridX = gridX;
    agent.gridY = gridY;
  }

  placeFurniture(id: string, type: string, gridX: number, gridY: number) {
    if (this.furniture.has(id)) return;

    const { x, y } = gridToScreen(gridX, gridY);
    
    const container = new Container();
    
    // Try to load furniture sprite (e.g., 'sofa' → 'furniture_sofa')
    const furnitureTexture = this.spriteLoader.getTexture(`furniture_${type}`) || this.spriteLoader.getTexture(type);
    
    if (furnitureTexture) {
      // Use real pixel art sprite
      const furnitureSprite = new Sprite(furnitureTexture);
      furnitureSprite.anchor.set(0.5, 1); // Bottom-center anchor for isometric
      container.addChild(furnitureSprite);
    } else {
      // Fallback to Graphics primitive
      const box = new Graphics();
      const furnitureColors: Record<string, number> = {
        sofa: 0x4488cc,
        table: 0x8B4513,
        chair: 0xA0522D,
        lamp: 0xFFD700,
        bed: 0x6B4226,
        bookshelf: 0x654321,
        tv: 0x333333,
        computer: 0x555555,
        plant: 0x228B22,
        fridge: 0xCCCCCC,
      };
      const color = furnitureColors[type] || 0x888888;
      
      // Isometric box
      box.fill({ color, alpha: 0.8 });
      box.roundRect(-12, -20, 24, 20, 2);
      box.fill();
      
      // Shadow
      box.fill({ color: 0x000000, alpha: 0.2 });
      box.ellipse(0, 2, 14, 5);
      box.fill();
      
      container.addChild(box);
      
      // Label
      const labelStyle = new TextStyle({
        fontSize: 9,
        fill: 0xaaaaaa,
        fontFamily: 'monospace',
      });
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
