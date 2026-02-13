import type { Position } from './grid.js';
import { CATALOG, type ItemDef } from '../data/furniture-catalog.js';

type ExistingItem = {
  x: number;
  y: number;
  z: number;
  itemDefId: string;
  rotation: number;
};

export function getAffectedTiles(itemDefId: string, x: number, y: number, rotation: number): Position[] {
  const itemDef = CATALOG[itemDefId];
  if (!itemDef) {
    return [];
  }

  const isSwapped = rotation === 4 || rotation === 6;
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

export function checkCollision(affectedTiles: Position[], existingItems: ExistingItem[]): boolean {
  for (const tile of affectedTiles) {
    for (const item of existingItems) {
      const itemDef = CATALOG[item.itemDefId];
      if (!itemDef || itemDef.walkable) {
        continue;
      }

      const occupiedTiles = getAffectedTiles(item.itemDefId, item.x, item.y, item.rotation);
      if (occupiedTiles.some((occupiedTile) => occupiedTile.x === tile.x && occupiedTile.y === tile.y)) {
        return true;
      }
    }
  }

  return false;
}

export function getStackHeight(x: number, y: number, existingItems: ExistingItem[]): number {
  let maxHeight = 0;

  for (const item of existingItems) {
    const itemDef: ItemDef | undefined = CATALOG[item.itemDefId];
    if (!itemDef) {
      continue;
    }

    const occupiedTiles = getAffectedTiles(item.itemDefId, item.x, item.y, item.rotation);
    const coversTile = occupiedTiles.some((tile) => tile.x === x && tile.y === y);
    if (!coversTile) {
      continue;
    }

    const topHeight = item.z + itemDef.height;
    if (topHeight > maxHeight) {
      maxHeight = topHeight;
    }
  }

  return maxHeight;
}

export async function placeFurniture(
  roomId: string,
  itemDefId: string,
  x: number,
  y: number,
  rotation: number,
  placedBy: string,
  sql: any
) {
  const itemDef = CATALOG[itemDefId];
  if (!itemDef) {
    throw new Error(`Invalid furniture itemDefId: ${itemDefId}`);
  }

  const affectedTiles = getAffectedTiles(itemDefId, x, y, rotation);
  const existingItems = await sql`
    SELECT id, room_id, item_def_id AS "itemDefId", x, y, z, rotation, placed_by AS "placedBy", created_at AS "createdAt"
    FROM room_items
    WHERE room_id = ${roomId}
  `;

  if (checkCollision(affectedTiles, existingItems)) {
    throw new Error('Collision detected: cannot place furniture on occupied tile');
  }

  const z = getStackHeight(x, y, existingItems);
  const inserted = await sql`
    INSERT INTO room_items (room_id, item_def_id, x, y, z, rotation, placed_by)
    VALUES (${roomId}, ${itemDefId}, ${x}, ${y}, ${z}, ${rotation}, ${placedBy})
    RETURNING id, room_id AS "roomId", item_def_id AS "itemDefId", x, y, z, rotation, placed_by AS "placedBy", created_at AS "createdAt"
  `;

  return inserted[0];
}

export async function removeFurniture(roomId: string, itemId: string, sql: any): Promise<boolean> {
  const deleted = await sql`
    DELETE FROM room_items
    WHERE room_id = ${roomId} AND id = ${itemId}
    RETURNING id
  `;

  return deleted.length > 0;
}

export async function getItemsInRoom(roomId: string, sql: any) {
  const items = await sql`
    SELECT id, room_id AS "roomId", item_def_id AS "itemDefId", x, y, z, rotation, placed_by AS "placedBy", created_at AS "createdAt"
    FROM room_items
    WHERE room_id = ${roomId}
    ORDER BY created_at ASC
  `;

  return items;
}
