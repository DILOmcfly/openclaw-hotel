/**
 * Inventory Service - Manage agent-owned furniture
 */

export type InventoryItem = {
  id: string;
  agentId: string;
  itemDefId: string;
  category: string;
  x: number | null;
  y: number | null;
  roomId: string | null;
  acquiredAt: string;
};

export type InventoryFilter = {
  category?: string;
  search?: string;
  inRoom?: boolean; // true = placed in room, false = in storage
};

/**
 * Get agent's inventory with optional filters
 */
export async function getInventory(
  agentId: string,
  filter: InventoryFilter,
  sql: any
): Promise<InventoryItem[]> {
  let conditions = [`agent_id = ${sql.typed.uuid(agentId)}`];

  if (filter.category) {
    conditions.push(`category = ${sql.typed.text(filter.category)}`);
  }

  if (filter.search) {
    const searchPattern = `%${filter.search.toLowerCase()}%`;
    conditions.push(`LOWER(item_def_id) LIKE ${sql.typed.text(searchPattern)}`);
  }

  if (filter.inRoom !== undefined) {
    if (filter.inRoom) {
      conditions.push(`room_id IS NOT NULL`);
    } else {
      conditions.push(`room_id IS NULL`);
    }
  }

  const whereClause = conditions.join(' AND ');

  const query = sql`
    SELECT 
      id,
      agent_id AS "agentId",
      item_def_id AS "itemDefId",
      category,
      x,
      y,
      room_id AS "roomId",
      acquired_at AS "acquiredAt"
    FROM furniture
    WHERE ${sql.raw(whereClause)}
    ORDER BY acquired_at DESC
  `;

  const results = await query;
  
  return results.map((row: any) => ({
    id: row.id,
    agentId: row.agentId,
    itemDefId: row.itemDefId,
    category: row.category,
    x: row.x,
    y: row.y,
    roomId: row.roomId,
    acquiredAt: row.acquiredAt,
  }));
}

/**
 * Sell an item from inventory (50% refund)
 */
export async function sellItem(
  agentId: string,
  itemId: string,
  sql: any
): Promise<{ success: boolean; coinsRefunded: number }> {
  // 1. Verify ownership
  const furnitureQuery = sql`
    SELECT item_def_id AS "itemDefId", agent_id AS "agentId", room_id AS "roomId"
    FROM furniture
    WHERE id = ${sql.typed.uuid(itemId)}
  `;

  const furnitureResults = await furnitureQuery;

  if (furnitureResults.length === 0) {
    throw new Error('Item not found');
  }

  const item = furnitureResults[0];

  if (item.agentId !== agentId) {
    throw new Error('Unauthorized: you do not own this item');
  }

  if (item.roomId !== null) {
    throw new Error('Cannot sell item while it is placed in a room. Remove it first.');
  }

  // 2. Calculate refund (50% of original price)
  const itemPrices: Record<string, number> = {
    chair: 50,
    table: 75,
    lamp: 30,
    plant: 40,
    rug: 60,
    bookshelf: 100,
    desk: 90,
    sofa: 120,
    bed: 150,
    cabinet: 80,
  };

  const originalPrice = itemPrices[item.itemDefId] || 50; // default 50 if unknown
  const refundAmount = Math.floor(originalPrice * 0.5);

  // 3. Delete furniture
  const deleteQuery = sql`
    DELETE FROM furniture
    WHERE id = ${sql.typed.uuid(itemId)}
  `;

  await deleteQuery;

  // 4. Add coins to balance
  const balanceQuery = sql`
    UPDATE agent_balances
    SET coins = coins + ${sql.typed.int4(refundAmount)}
    WHERE agent_id = ${sql.typed.text(agentId)}
  `;

  await balanceQuery;

  return {
    success: true,
    coinsRefunded: refundAmount,
  };
}

/**
 * Get count of items in inventory
 */
export async function getInventoryCount(
  agentId: string,
  inRoom: boolean | null,
  sql: any
): Promise<number> {
  let whereClause = `agent_id = ${sql.typed.uuid(agentId)}`;

  if (inRoom === true) {
    whereClause += ' AND room_id IS NOT NULL';
  } else if (inRoom === false) {
    whereClause += ' AND room_id IS NULL';
  }

  const query = sql`
    SELECT COUNT(*) AS count
    FROM furniture
    WHERE ${sql.raw(whereClause)}
  `;

  const results = await query;
  return Number(results[0]?.count || 0);
}
