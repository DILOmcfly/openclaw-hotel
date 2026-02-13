import { Container, Graphics } from 'pixi.js';
import { gridToScreen, TILE_HEIGHT, TILE_WIDTH, screenToGrid } from './IsoRenderer.js';

export function parseHeightmap(map: string): number[][] {
  return map.trim().split('\n').map((line) =>
    line.trim().split('').map((c) => {
      if (c === 'x' || c === 'X') return -1;
      return Number.parseInt(c, 10);
    })
  );
}

const HEIGHT_COLORS: Record<number, number> = {
  0: 0x4caf50,
  1: 0xbdbdbd,
  2: 0x757575,
  3: 0x546e7a,
};

export class TileMap {
  private readonly heightmap: number[][];
  private readonly container: Container;

  constructor(heightmap: number[][], container: Container) {
    this.heightmap = heightmap;
    this.container = container;
  }

  render(): void {
    for (let gy = 0; gy < this.heightmap.length; gy++) {
      const row = this.heightmap[gy];
      for (let gx = 0; gx < row.length; gx++) {
        const h = row[gx];
        if (h < 0) continue;

        const { x, y } = gridToScreen(gx, gy, h);
        const color = HEIGHT_COLORS[h] ?? 0x4caf50;

        const tile = new Graphics();
        tile.poly([0, -TILE_HEIGHT / 2, TILE_WIDTH / 2, 0, 0, TILE_HEIGHT / 2, -TILE_WIDTH / 2, 0]);
        tile.fill(color);
        tile.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
        tile.position.set(x, y);
        this.container.addChild(tile);
      }
    }
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
