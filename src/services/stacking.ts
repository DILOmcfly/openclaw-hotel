/**
 * Stacking Service - Handle furniture height/z-level placement
 */

import type { Sql } from 'postgres';

export type StackedItem = {
  id: string;
  itemDefId: string;
  x: number;
  y: number;
  zLevel: number;
  stackable: boolean;
  stackHeight: number;
};

const MAX_STACK_HEIGHT = 10.0;

/**
 * Get total height of items stacked at a position
 */
export async function getStackHeight(
  roomId: string,
  x: number,
  y: number,
  sql: Sql
): Promise<number> {
  const query = sql`
    SELECT COALESCE(MAX(z_level + stack_height), 0) AS "maxHeight"
    FROM furniture
    WHERE room_id = ${roomId}
      AND x = ${x}
      AND y = ${y}
  `;

  const results = await query;
  return Number(results[0]?.maxHeight || 0);
}

/**
 * Check if an item can be placed at a position
 */
export async function canPlaceAt(
  roomId: string,
  x: number,
  y: number,
  itemHeight: number,
  sql: Sql
): Promise<boolean> {
  const currentHeight = await getStackHeight(roomId, x, y, sql);
  return (currentHeight + itemHeight) <= MAX_STACK_HEIGHT;
}

/**
 * Place an item on top of existing stack
 */
export async function placeOnTop(
  roomId: string,
  itemId: string,
  x: number,
  y: number,
  sql: Sql
): Promise<{ success: boolean; zLevel: number }> {
  // Get item details
  const [item] = await sql`
    SELECT stack_height AS "stackHeight", stackable
    FROM furniture
    WHERE id = ${itemId}
  `;

  if (!item) {
    throw new Error('Item not found');
  }

  const itemHeight = Number(item.stackHeight || 1.0);
  const currentStackHeight = await getStackHeight(roomId, x, y, sql);

  // Check if placement is allowed
  if ((currentStackHeight + itemHeight) > MAX_STACK_HEIGHT) {
    throw new Error(`Cannot stack: would exceed max height of ${MAX_STACK_HEIGHT}`);
  }

  // Check if base items are stackable
  const baseItems = await sql`
    SELECT stackable
    FROM furniture
    WHERE room_id = ${roomId}
      AND x = ${x}
      AND y = ${y}
      AND z_level < ${currentStackHeight}
  `;

  const hasNonStackable = baseItems.some((item: any) => !item.stackable);
  if (hasNonStackable) {
    throw new Error('Cannot stack on non-stackable items');
  }

  // Place item at current stack height
  await sql`
    UPDATE furniture
    SET room_id = ${roomId},
        x = ${x},
        y = ${y},
        z_level = ${currentStackHeight}
    WHERE id = ${itemId}
  `;

  return {
    success: true,
    zLevel: currentStackHeight,
  };
}

/**
 * Get all items at a position, sorted by z_level
 */
export async function getItemsAtPosition(
  roomId: string,
  x: number,
  y: number,
  sql: Sql
): Promise<StackedItem[]> {
  const results = await sql`
    SELECT 
      id,
      item_def_id AS "itemDefId",
      x,
      y,
      z_level AS "zLevel",
      stackable,
      stack_height AS "stackHeight"
    FROM furniture
    WHERE room_id = ${roomId}
      AND x = ${x}
      AND y = ${y}
    ORDER BY z_level ASC
  `;

  return results.map((row: any) => ({
    id: row.id,
    itemDefId: row.itemDefId,
    x: row.x,
    y: row.y,
    zLevel: Number(row.zLevel),
    stackable: row.stackable,
    stackHeight: Number(row.stackHeight),
  }));
}

/**
 * Remove an item from stack and adjust z_levels above it
 */
export async function removeFromStack(
  roomId: string,
  itemId: string,
  sql: Sql
): Promise<{ success: boolean; adjustedCount: number }> {
  // Get item being removed
  const [item] = await sql`
    SELECT x, y, z_level AS "zLevel", stack_height AS "stackHeight"
    FROM furniture
    WHERE id = ${itemId} AND room_id = ${roomId}
  `;

  if (!item) {
    throw new Error('Item not found in room');
  }

  const { x, y, zLevel, stackHeight } = item;
  const heightToSubtract = Number(zLevel) + Number(stackHeight);

  // Remove item (move to inventory)
  await sql`
    UPDATE furniture
    SET room_id = NULL, x = NULL, y = NULL, z_level = 0
    WHERE id = ${itemId}
  `;

  // Adjust items above
  const adjusted = await sql`
    UPDATE furniture
    SET z_level = z_level - ${heightToSubtract}
    WHERE room_id = ${roomId}
      AND x = ${x}
      AND y = ${y}
      AND z_level > ${zLevel}
  `;

  return {
    success: true,
    adjustedCount: adjusted.count || 0,
  };
}
