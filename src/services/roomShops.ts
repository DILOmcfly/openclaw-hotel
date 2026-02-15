/**
 * Room Shops Service - Manages in-room furniture stores
 */

export type RoomShop = {
  roomId: number;
  shopName: string;
  description: string;
  isOpen: boolean;
  totalSales: number;
  totalRevenue: number;
  createdAt: Date;
};

export type ShopItem = {
  id: number;
  roomId: number;
  itemName: string;
  price: number;
  stock: number;
  sold: number;
  listedAt: Date;
};

const MAX_ITEMS_PER_SHOP = 50;

export async function createShop(roomId: number, shopName: string, description: string, sql: any): Promise<RoomShop> {
  const result = await sql`
    INSERT INTO room_shops (room_id, shop_name, description)
    VALUES (${roomId}, ${shopName}, ${description})
    RETURNING room_id AS "roomId", shop_name AS "shopName", description,
              is_open AS "isOpen", total_sales AS "totalSales",
              total_revenue AS "totalRevenue", created_at AS "createdAt"
  `;
  return result[0];
}

export async function updateShop(
  roomId: number,
  updates: { shopName?: string; description?: string; isOpen?: boolean },
  sql: any
): Promise<RoomShop> {
  const setClauses = [];
  const values: any = {};
  if (updates.shopName !== undefined) {
    setClauses.push('shop_name = ${shopName}');
    values.shopName = updates.shopName;
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ${description}');
    values.description = updates.description;
  }
  if (updates.isOpen !== undefined) {
    setClauses.push('is_open = ${isOpen}');
    values.isOpen = updates.isOpen;
  }
  const result = await sql`
    UPDATE room_shops
    SET ${sql(Object.keys(values).map(k => sql`${sql(k)} = ${values[k]}`))}
    WHERE room_id = ${roomId}
    RETURNING room_id AS "roomId", shop_name AS "shopName", description,
              is_open AS "isOpen", total_sales AS "totalSales",
              total_revenue AS "totalRevenue", created_at AS "createdAt"
  `;
  return result[0];
}

export async function listItem(roomId: number, itemName: string, price: number, stock: number, sql: any): Promise<ShopItem> {
  const itemCount = await sql`SELECT COUNT(*) as count FROM shop_items WHERE room_id = ${roomId}`;
  if (itemCount[0].count >= MAX_ITEMS_PER_SHOP) {
    throw new Error(`Maximum ${MAX_ITEMS_PER_SHOP} items per shop`);
  }
  const result = await sql`
    INSERT INTO shop_items (room_id, item_name, price, stock)
    VALUES (${roomId}, ${itemName}, ${price}, ${stock})
    RETURNING id, room_id AS "roomId", item_name AS "itemName",
              price, stock, sold, listed_at AS "listedAt"
  `;
  return result[0];
}

export async function unlistItem(itemId: number, roomId: number, sql: any): Promise<void> {
  await sql`DELETE FROM shop_items WHERE id = ${itemId} AND room_id = ${roomId}`;
}

export async function getShopItems(roomId: number, sql: any): Promise<ShopItem[]> {
  const result = await sql`
    SELECT id, room_id AS "roomId", item_name AS "itemName",
           price, stock, sold, listed_at AS "listedAt"
    FROM shop_items
    WHERE room_id = ${roomId}
    ORDER BY listed_at DESC
  `;
  return result;
}

export async function purchaseItem(itemId: number, buyerAgentId: string, sql: any): Promise<{ success: boolean; message: string; price?: number }> {
  const item = await sql`SELECT * FROM shop_items WHERE id = ${itemId}`;
  if (item.length === 0) return { success: false, message: 'Item not found' };
  
  const stockValue = item[0].stock;
  if (stockValue !== -1 && stockValue <= 0) {
    return { success: false, message: 'Out of stock' };
  }

  const price = item[0].price;
  const roomId = item[0].room_id;
  const balance = await sql`SELECT coins FROM agent_balances WHERE agent_id = ${buyerAgentId}`;
  if (balance.length === 0 || balance[0].coins < price) {
    return { success: false, message: 'Insufficient coins' };
  }

  await sql`UPDATE agent_balances SET coins = coins - ${price} WHERE agent_id = ${buyerAgentId}`;
  if (stockValue !== -1) {
    await sql`UPDATE shop_items SET stock = stock - 1, sold = sold + 1 WHERE id = ${itemId}`;
  } else {
    await sql`UPDATE shop_items SET sold = sold + 1 WHERE id = ${itemId}`;
  }
  await sql`UPDATE room_shops SET total_sales = total_sales + 1, total_revenue = total_revenue + ${price} WHERE room_id = ${roomId}`;
  return { success: true, message: 'Purchase successful', price };
}

export async function getShopStats(roomId: number, sql: any): Promise<any> {
  const items = await sql`SELECT * FROM shop_items WHERE room_id = ${roomId}`;
  const shop = await sql`SELECT * FROM room_shops WHERE room_id = ${roomId}`;
  if (shop.length === 0) return null;
  
  const bestSeller = items.length > 0 ? items.reduce((max: any, item: any) => (item.sold > max.sold ? item : max)) : null;
  return {
    totalItems: items.length,
    totalRevenue: shop[0].total_revenue,
    totalSales: shop[0].total_sales,
    bestSeller: bestSeller ? bestSeller.item_name : null,
  };
}

export async function getPopularShops(limit: number, sql: any): Promise<RoomShop[]> {
  const result = await sql`
    SELECT room_id AS "roomId", shop_name AS "shopName", description,
           is_open AS "isOpen", total_sales AS "totalSales",
           total_revenue AS "totalRevenue", created_at AS "createdAt"
    FROM room_shops
    WHERE is_open = true
    ORDER BY total_revenue DESC
    LIMIT ${limit}
  `;
  return result;
}
