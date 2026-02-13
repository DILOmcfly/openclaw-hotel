import { randomUUID } from 'node:crypto';
import { getTileHeight, isValidTile, type ParsedGrid } from './grid.js';

export interface Position {
  x: number;
  y: number;
  z?: number;
}

export interface ItemDefinition {
  width: number;
  depth: number;
  height: number;
  canSit?: boolean;
  walkable?: boolean;
  sprite: string;
}

export interface FurnitureItem {
  id: string;
  roomId: string;
  itemDefId: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  state: string;
  placedBy: string;
  placedAt: string;
  itemDef: ItemDefinition;
}

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  chair_wood: { width: 1, depth: 1, height: 1, canSit: true, walkable: false, sprite: 'chair_wood_01' },
  table_round: { width: 2, depth: 2, height: 1, walkable: false, sprite: 'table_round_01' },
  lamp_floor: { width: 1, depth: 1, height: 2, walkable: false, sprite: 'lamp_floor_01' },
  plant_small: { width: 1, depth: 1, height: 1, walkable: false, sprite: 'plant_small_01' },
  bookshelf: { width: 1, depth: 2, height: 2, walkable: false, sprite: 'bookshelf_01' },
  sofa: { width: 2, depth: 1, height: 1, canSit: true, walkable: false, sprite: 'sofa_01' },
  rug: { width: 2, depth: 2, height: 0, walkable: true, sprite: 'rug_01' },
  tv_screen: { width: 2, depth: 1, height: 1, walkable: false, sprite: 'tv_screen_01' },
  desk: { width: 2, depth: 1, height: 1, walkable: false, sprite: 'desk_01' },
  bed: { width: 2, depth: 3, height: 1, canSit: true, walkable: false, sprite: 'bed_01' },
};

const roomItems = new Map<string, FurnitureItem[]>();
const roomGrids = new Map<string, ParsedGrid>();

export function setRoomGrid(roomId: string, grid: ParsedGrid): void {
  roomGrids.set(roomId, grid);
}

export function clearFurnitureState(): void {
  roomItems.clear();
  roomGrids.clear();
}

export function getAffectedTiles(
  itemDef: ItemDefinition,
  x: number,
  y: number,
  rotation: number,
): Position[] {
  const normalizedRotation = normalizeRotation(rotation);
  const isSwapped = normalizedRotation === 2 || normalizedRotation === 6;
  const width = isSwapped ? itemDef.depth : itemDef.width;
  const depth = isSwapped ? itemDef.width : itemDef.depth;

  const tiles: Position[] = [];
  for (let dx = 0; dx < width; dx += 1) {
    for (let dy = 0; dy < depth; dy += 1) {
      tiles.push({ x: x + dx, y: y + dy });
    }
  }

  return tiles;
}

export function placeFurniture(
  roomId: string,
  itemDefId: string,
  x: number,
  y: number,
  rotation: number,
  agentId: string,
): FurnitureItem {
  const itemDef = ITEM_DEFINITIONS[itemDefId];
  if (!itemDef) {
    throw new Error(`Unknown furniture item definition: ${itemDefId}`);
  }

  normalizeRotation(rotation);

  const items = roomItems.get(roomId) ?? [];
  const affectedTiles = getAffectedTiles(itemDef, x, y, rotation);
  const grid = roomGrids.get(roomId);

  for (const tile of affectedTiles) {
    if (grid && !isValidTile(grid, tile.x, tile.y)) {
      throw new Error('Cannot place item on invalid tile');
    }

    for (const existing of items) {
      const existingTiles = getAffectedTiles(existing.itemDef, existing.x, existing.y, existing.rotation);
      if (existingTiles.some((existingTile) => existingTile.x === tile.x && existingTile.y === tile.y)) {
        throw new Error('Furniture collision detected');
      }
    }
  }

  const baseZ = grid ? Math.max(...affectedTiles.map((tile) => getTileHeight(grid, tile.x, tile.y))) : 0;

  const placed: FurnitureItem = {
    id: randomUUID(),
    roomId,
    itemDefId,
    x,
    y,
    z: baseZ,
    rotation,
    state: 'default',
    placedBy: agentId,
    placedAt: new Date().toISOString(),
    itemDef,
  };

  roomItems.set(roomId, [...items, placed]);
  return placed;
}

export function removeFurniture(roomId: string, itemId: string): boolean {
  const items = roomItems.get(roomId);
  if (!items) {
    return false;
  }

  const next = items.filter((item) => item.id !== itemId);
  if (next.length === items.length) {
    return false;
  }

  roomItems.set(roomId, next);
  return true;
}

export function getRoomFurniture(roomId: string): FurnitureItem[] {
  return [...(roomItems.get(roomId) ?? [])];
}

function normalizeRotation(rotation: number): number {
  const normalized = ((rotation % 8) + 8) % 8;
  if (normalized === 0 || normalized === 2 || normalized === 4 || normalized === 6) {
    return normalized;
  }

  throw new Error('Invalid rotation; expected 0, 2, 4, or 6');
}
