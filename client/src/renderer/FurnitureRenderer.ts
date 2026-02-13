import { Container, Graphics } from 'pixi.js';
import { gridToScreen, depthSort, TILE_WIDTH, TILE_HEIGHT } from './IsoRenderer.js';

export interface FurnitureItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  z: number;
  color: number;
}

// Simple colored box placeholder for each furniture type
const ITEM_COLORS: Record<string, number> = {
  chair_basic: 0x8d6e63,
  table_round: 0x5d4037,
  lamp_floor: 0xffb74d,
  sofa_2seat: 0x1565c0,
  plant_small: 0x4caf50,
  bookshelf_tall: 0x6d4c41,
  computer_desk: 0x37474f,
  bed_single: 0xe91e63,
  fridge_mini: 0xeceff1,
  tv_flatscreen: 0x212121,
};

export class FurnitureRenderer {
  private items: Map<string, { item: FurnitureItem; container: Container }> = new Map();
  private world: Container;

  constructor(world: Container) {
    this.world = world;
  }

  add(item: FurnitureItem): void {
    if (this.items.has(item.id)) return;

    const container = new Container();
    const color = ITEM_COLORS[item.itemId] ?? item.color;

    // Draw as small isometric box
    const g = new Graphics();
    const hw = TILE_WIDTH / 4;
    const hh = TILE_HEIGHT / 4;
    // Top face
    g.poly([0, -hh - 8, hw, -8, 0, hh - 8, -hw, -8]);
    g.fill(color);
    g.stroke({ width: 1, color: 0x000000 });
    container.addChild(g);

    const { x, y } = gridToScreen(item.x, item.y, item.z);
    container.position.set(x, y - 4);
    container.zIndex = depthSort(item.x, item.y, item.z);

    this.world.addChild(container);
    this.items.set(item.id, { item, container });
  }

  remove(id: string): void {
    const entry = this.items.get(id);
    if (entry) {
      this.world.removeChild(entry.container);
      this.items.delete(id);
    }
  }

  clear(): void {
    for (const [id] of this.items) {
      this.remove(id);
    }
  }
}
