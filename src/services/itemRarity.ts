/**
 * Item Rarity Service - Manages furniture rarity, collectibility, and trading rules
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type FurnitureItem = {
  id: string;
  name: string;
  rarity: Rarity;
  tradeable: boolean;
  maxPerAgent: number;
  releaseDate: Date;
  retired: boolean;
};

export type RarityDistribution = {
  [key in Rarity]: number;
};

export type CollectionProgress = {
  totalItems: number;
  ownedItems: number;
  percentage: number;
  byRarity: {
    [key in Rarity]: { total: number; owned: number };
  };
};

/**
 * Get all items of a specific rarity
 */
export async function getItemsByRarity(rarity: Rarity, sql: any): Promise<FurnitureItem[]> {
  const items = await sql`
    SELECT id, name, rarity, tradeable, max_per_agent AS "maxPerAgent", 
           release_date AS "releaseDate", retired
    FROM furniture
    WHERE rarity = ${rarity}
    ORDER BY release_date DESC
  `;
  return items;
}

/**
 * Get count of items per rarity for a specific agent
 */
export async function getRarityDistribution(agentId: string, sql: any): Promise<RarityDistribution> {
  const result = await sql`
    SELECT f.rarity, COUNT(ui.item_def_id) as count
    FROM furniture f
    LEFT JOIN user_inventory ui ON f.id = ui.item_def_id AND ui.agent_id = ${agentId}
    WHERE ui.item_def_id IS NOT NULL
    GROUP BY f.rarity
  `;

  const distribution: RarityDistribution = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
  };

  for (const row of result) {
    distribution[row.rarity as Rarity] = parseInt(row.count, 10);
  }

  return distribution;
}

/**
 * Check if an item is retired (no longer obtainable)
 */
export async function isRetired(itemId: string, sql: any): Promise<boolean> {
  const result = await sql`
    SELECT retired
    FROM furniture
    WHERE id = ${itemId}
  `;

  if (result.length === 0) {
    throw new Error(`Item not found: ${itemId}`);
  }

  return result[0].retired;
}

/**
 * Check if an item can be traded
 */
export async function isTradeable(itemId: string, sql: any): Promise<boolean> {
  const result = await sql`
    SELECT tradeable
    FROM furniture
    WHERE id = ${itemId}
  `;

  if (result.length === 0) {
    throw new Error(`Item not found: ${itemId}`);
  }

  return result[0].tradeable;
}

/**
 * Check if agent can own more of a specific item (based on max_per_agent)
 */
export async function canOwnMore(agentId: string, itemId: string, sql: any): Promise<boolean> {
  const furnitureResult = await sql`
    SELECT max_per_agent AS "maxPerAgent"
    FROM furniture
    WHERE id = ${itemId}
  `;

  if (furnitureResult.length === 0) {
    throw new Error(`Item not found: ${itemId}`);
  }

  const maxPerAgent = furnitureResult[0].maxPerAgent;

  const inventoryResult = await sql`
    SELECT COALESCE(quantity, 0) as quantity
    FROM user_inventory
    WHERE agent_id = ${agentId} AND item_def_id = ${itemId}
  `;

  const currentQuantity = inventoryResult.length > 0 ? inventoryResult[0].quantity : 0;

  return currentQuantity < maxPerAgent;
}

/**
 * Get collection progress for an agent (% of all items owned)
 */
export async function getCollectionProgress(agentId: string, sql: any): Promise<CollectionProgress> {
  // Get total items per rarity
  const totalByRarity = await sql`
    SELECT rarity, COUNT(*) as count
    FROM furniture
    WHERE retired = false
    GROUP BY rarity
  `;

  // Get owned items per rarity
  const ownedByRarity = await sql`
    SELECT f.rarity, COUNT(DISTINCT ui.item_def_id) as count
    FROM furniture f
    INNER JOIN user_inventory ui ON f.id = ui.item_def_id
    WHERE ui.agent_id = ${agentId} AND f.retired = false
    GROUP BY f.rarity
  `;

  const byRarity: CollectionProgress['byRarity'] = {
    common: { total: 0, owned: 0 },
    uncommon: { total: 0, owned: 0 },
    rare: { total: 0, owned: 0 },
    epic: { total: 0, owned: 0 },
    legendary: { total: 0, owned: 0 },
    mythic: { total: 0, owned: 0 },
  };

  let totalItems = 0;
  for (const row of totalByRarity) {
    const count = parseInt(row.count, 10);
    byRarity[row.rarity as Rarity].total = count;
    totalItems += count;
  }

  let ownedItems = 0;
  for (const row of ownedByRarity) {
    const count = parseInt(row.count, 10);
    byRarity[row.rarity as Rarity].owned = count;
    ownedItems += count;
  }

  const percentage = totalItems > 0 ? Math.round((ownedItems / totalItems) * 100) : 0;

  return {
    totalItems,
    ownedItems,
    percentage,
    byRarity,
  };
}
