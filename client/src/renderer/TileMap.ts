import { Container, Graphics, Sprite, ParticleContainer } from 'pixi.js';
import { gridToScreen, TILE_HEIGHT, TILE_WIDTH, screenToGrid } from './IsoRenderer.js';
import { AssetLoader } from '../AssetLoader.js';
import { memoryProfiler } from './MemoryProfiler.js';

export function parseHeightmap(map: string): number[][] {
  return map.trim().split('\n').map((line) =>
    line.trim().split('').map((c) => {
      if (c === 'x' || c === 'X') return -1;
      return Number.parseInt(c, 10);
    })
  );
}

const HEIGHT_TILE_TYPES: Record<number, 'plain' | 'carpet' | 'checker'> = {
  0: 'plain',
  1: 'carpet',
  2: 'checker',
  3: 'plain',
};

const FALLBACK_COLORS: Record<number, number> = {
  0: 0x4caf50,
  1: 0xbdbdbd,
  2: 0x757575,
  3: 0x546e7a,
};

export class TileMap {
  private readonly heightmap: number[][];
  private readonly container: Container;
  private batchContainers: Map<string, ParticleContainer> = new Map();

  constructor(heightmap: number[][], container: Container) {
    this.heightmap = heightmap;
    this.container = container;
  }

  /**
   * Render tiles using batched sprite rendering for performance
   * Groups tiles by texture type into ParticleContainers
   */
  render(): void {
    console.time('[TileMap] Render');
    
    // Group tiles by type for batching
    const tilesByType: Map<string, Array<{ x: number; y: number }>> = new Map();
    
    for (let gy = 0; gy < this.heightmap.length; gy++) {
      const row = this.heightmap[gy];
      for (let gx = 0; gx < row.length; gx++) {
        const h = row[gx];
        if (h < 0) continue;

        const { x, y } = gridToScreen(gx, gy, h);
        const tileType = HEIGHT_TILE_TYPES[h] ?? 'plain';
        
        if (!tilesByType.has(tileType)) {
          tilesByType.set(tileType, []);
        }
        tilesByType.get(tileType)!.push({ x, y });
      }
    }
    
    // Create batched containers for each tile type
    for (const [tileType, positions] of tilesByType.entries()) {
      const texture = AssetLoader.getFloorTexture(tileType as 'plain' | 'carpet' | 'checker');
      
      if (texture) {
        // Use ParticleContainer for efficient batch rendering
        const particleContainer = new ParticleContainer(
          positions.length,
          {
            position: true,
            rotation: false,
            uvs: false,
            tint: false,
          }
        );
        
        for (const pos of positions) {
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5, 0.5);
          sprite.position.set(pos.x, pos.y);
          particleContainer.addChild(sprite);
          memoryProfiler.trackSpriteCreate();
        }
        
        this.container.addChild(particleContainer);
        this.batchContainers.set(tileType, particleContainer);
        memoryProfiler.trackContainerCreate();
      } else {
        // Fallback to graphics for missing textures
        for (const pos of positions) {
          const h = this.heightmap.findIndex(row => 
            row.some((_, gx) => {
              const screen = gridToScreen(gx, this.heightmap.indexOf(row), row[gx]);
              return Math.abs(screen.x - pos.x) < 1 && Math.abs(screen.y - pos.y) < 1;
            })
          );
          const color = FALLBACK_COLORS[h] ?? 0x4caf50;
          const tile = new Graphics();
          tile.poly([0, -TILE_HEIGHT / 2, TILE_WIDTH / 2, 0, 0, TILE_HEIGHT / 2, -TILE_WIDTH / 2, 0]);
          tile.fill(color);
          tile.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
          tile.position.set(pos.x, pos.y);
          this.container.addChild(tile);
        }
      }
    }
    
    console.timeEnd('[TileMap] Render');
    console.log(`[TileMap] Rendered ${this.batchContainers.size} batched tile layers`);
  }

  /**
   * Cleanup tile map resources
   */
  public cleanup(): void {
    for (const container of this.batchContainers.values()) {
      const spriteCount = container.children.length;
      for (let i = 0; i < spriteCount; i++) {
        memoryProfiler.trackSpriteDestroy();
      }
      container.destroy({ children: true });
      memoryProfiler.trackContainerDestroy();
    }
    this.batchContainers.clear();
  }

  getTileAt(screenX: number, screenY: number): { gridX: number; gridY: number } | null {
    const { gridX, gridY } = screenToGrid(screenX, screenY);
    const tx = Math.floor(gridX);
    const ty = Math.floor(gridY);
    if (ty < 0 || ty >= this.heightmap.length) return null;
    if (tx < 0 || tx >= this.heightmap[ty].length) return null;
    if (this.heightmap[ty][tx] < 0) return null;
    return { gridX: tx, gridY: ty };
  }
}
