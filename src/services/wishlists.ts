/**
 * Wishlists Service - Manages agent wishlist items
 */

export type WishlistItem = {
  id: number;
  agentId: string;
  itemName: string;
  itemType: 'furniture' | 'badge' | 'sticker' | 'card' | 'outfit' | 'theme';
  priority: 'low' | 'medium' | 'high';
  maxPrice: number | null;
  notes: string | null;
  fulfilled: boolean;
  createdAt: Date;
};

export type WishlistStats = {
  totalItems: number;
  fulfilledCount: number;
  fulfilledPercent: number;
  byType: Record<string, number>;
};

const MAX_WISHLIST_ITEMS = 50;

export async function addItem(
  agentId: string, itemName: string, itemType: WishlistItem['itemType'],
  priority: WishlistItem['priority'], maxPrice: number | null, notes: string | null, sql: any
): Promise<WishlistItem> {
  const count = await sql`SELECT COUNT(*) as count FROM agent_wishlists WHERE agent_id = ${agentId}`;
  if (parseInt(count[0].count) >= MAX_WISHLIST_ITEMS) {
    throw new Error(`Wishlist full (max ${MAX_WISHLIST_ITEMS} items)`);
  }
  const result = await sql`
    INSERT INTO agent_wishlists (agent_id, item_name, item_type, priority, max_price, notes)
    VALUES (${agentId}, ${itemName}, ${itemType}, ${priority}, ${maxPrice}, ${notes})
    RETURNING id, agent_id AS "agentId", item_name AS "itemName", item_type AS "itemType",
      priority, max_price AS "maxPrice", notes, fulfilled, created_at AS "createdAt"
  `;
  return result[0];
}

export async function removeItem(agentId: string, itemId: number, sql: any): Promise<boolean> {
  const result = await sql`DELETE FROM agent_wishlists WHERE id = ${itemId} AND agent_id = ${agentId}`;
  return result.count > 0;
}

export async function getWishlist(
  agentId: string, filters: { type?: WishlistItem['itemType']; priority?: WishlistItem['priority']; fulfilled?: boolean }, sql: any
): Promise<WishlistItem[]> {
  let conditions = [sql`agent_id = ${agentId}`];
  if (filters.type) conditions.push(sql`item_type = ${filters.type}`);
  if (filters.priority) conditions.push(sql`priority = ${filters.priority}`);
  if (filters.fulfilled !== undefined) conditions.push(sql`fulfilled = ${filters.fulfilled}`);
  
  const where = conditions.reduce((acc, cond, i) => i === 0 ? cond : sql`${acc} AND ${cond}`);
  return await sql`
    SELECT id, agent_id AS "agentId", item_name AS "itemName", item_type AS "itemType",
      priority, max_price AS "maxPrice", notes, fulfilled, created_at AS "createdAt"
    FROM agent_wishlists WHERE ${where} ORDER BY created_at DESC
  `;
}

export async function fulfillItem(agentId: string, itemId: number, sql: any): Promise<WishlistItem | null> {
  const result = await sql`
    UPDATE agent_wishlists SET fulfilled = true WHERE id = ${itemId} AND agent_id = ${agentId}
    RETURNING id, agent_id AS "agentId", item_name AS "itemName", item_type AS "itemType",
      priority, max_price AS "maxPrice", notes, fulfilled, created_at AS "createdAt"
  `;
  return result.length > 0 ? result[0] : null;
}

export async function getPopularItems(limit: number, sql: any): Promise<Array<{ itemName: string; count: number }>> {
  return await sql`
    SELECT item_name AS "itemName", COUNT(*) as count FROM agent_wishlists
    WHERE fulfilled = false GROUP BY item_name ORDER BY count DESC LIMIT ${limit}
  `;
}

export async function matchWishlist(agentId: string, sql: any): Promise<Array<{ itemName: string; agentId: string }>> {
  return await sql`
    SELECT DISTINCT item_name AS "itemName", agent_id AS "agentId" FROM agent_wishlists
    WHERE agent_id != ${agentId} AND fulfilled = false ORDER BY item_name
  `;
}

export async function getWishlistStats(agentId: string, sql: any): Promise<WishlistStats> {
  const items = await sql`SELECT item_type AS "itemType", fulfilled FROM agent_wishlists WHERE agent_id = ${agentId}`;
  const totalItems = items.length;
  const fulfilledCount = items.filter((i: any) => i.fulfilled).length;
  const fulfilledPercent = totalItems > 0 ? Math.round((fulfilledCount / totalItems) * 100) : 0;
  const byType: Record<string, number> = {};
  items.forEach((i: any) => { byType[i.itemType] = (byType[i.itemType] || 0) + 1; });
  return { totalItems, fulfilledCount, fulfilledPercent, byType };
}
