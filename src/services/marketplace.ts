/**
 * Marketplace Service - Agent-to-agent furniture trading
 */

import type { Sql } from 'postgres';
import { createId } from '@paralleldrive/cuid2';

export type MarketplaceListing = {
  id: string;
  itemId: string;
  sellerId: string;
  itemType: string;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  buyerId: string | null;
  createdAt: Date;
  soldAt: Date | null;
};

export type ListingFilters = {
  status?: 'active' | 'sold' | 'cancelled';
  itemType?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
};

/**
 * Create a new marketplace listing
 */
export async function createListing(
  itemId: string,
  sellerId: string,
  itemType: string,
  price: number,
  sql: Sql
): Promise<MarketplaceListing> {
  // Validate price
  if (price <= 0 || price > 100000) {
    throw new Error('Price must be between 1 and 100,000 coins');
  }

  // Verify ownership and that item is not placed in a room
  const [item] = await sql`
    SELECT agent_id AS "agentId", room_id AS "roomId"
    FROM furniture
    WHERE id = ${itemId}
  `;

  if (!item) {
    throw new Error('Item not found');
  }

  if (item.agentId !== sellerId) {
    throw new Error('You do not own this item');
  }

  if (item.roomId !== null) {
    throw new Error('Cannot list items that are placed in a room');
  }

  // Check if item is already listed
  const [existing] = await sql`
    SELECT id FROM marketplace_listings
    WHERE item_id = ${itemId} AND status = 'active'
  `;

  if (existing) {
    throw new Error('Item is already listed on the marketplace');
  }

  const id = createId();

  const [listing] = await sql<MarketplaceListing[]>`
    INSERT INTO marketplace_listings (id, item_id, seller_id, item_type, price, status)
    VALUES (${id}, ${itemId}, ${sellerId}, ${itemType}, ${price}, 'active')
    RETURNING 
      id,
      item_id AS "itemId",
      seller_id AS "sellerId",
      item_type AS "itemType",
      price,
      status,
      buyer_id AS "buyerId",
      created_at AS "createdAt",
      sold_at AS "soldAt"
  `;

  return listing;
}

/**
 * Buy a listing - atomic transfer of coins and item
 */
export async function buyListing(
  listingId: string,
  buyerId: string,
  sql: Sql
): Promise<void> {
  await sql.begin(async (tx: any) => {
    // Get listing
    const [listing] = await tx`
      SELECT 
        id,
        item_id AS "itemId",
        seller_id AS "sellerId",
        item_type AS "itemType",
        price,
        status
      FROM marketplace_listings
      WHERE id = ${listingId}
    `;

    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.status !== 'active') {
      throw new Error('Listing is not active');
    }

    if (listing.sellerId === buyerId) {
      throw new Error('Cannot buy your own listing');
    }

    // Check buyer has enough coins
    const [buyerBalance] = await tx`
      SELECT coins FROM agent_balances WHERE agent_id = ${buyerId}
    `;

    if (!buyerBalance || buyerBalance.coins < listing.price) {
      throw new Error('Insufficient funds');
    }

    // Verify item still exists and belongs to seller
    const [item] = await tx`
      SELECT agent_id AS "agentId"
      FROM furniture
      WHERE id = ${listing.itemId}
    `;

    if (!item) {
      throw new Error('Item no longer exists');
    }

    if (item.agentId !== listing.sellerId) {
      throw new Error('Item ownership has changed');
    }

    // Deduct coins from buyer
    await tx`
      UPDATE agent_balances
      SET coins = coins - ${listing.price}
      WHERE agent_id = ${buyerId}
    `;

    // Add coins to seller
    await tx`
      UPDATE agent_balances
      SET coins = coins + ${listing.price}
      WHERE agent_id = ${listing.sellerId}
    `;

    // Transfer item ownership
    await tx`
      UPDATE furniture
      SET agent_id = ${buyerId}
      WHERE id = ${listing.itemId}
    `;

    // Mark listing as sold
    await tx`
      UPDATE marketplace_listings
      SET status = 'sold', buyer_id = ${buyerId}, sold_at = NOW()
      WHERE id = ${listingId}
    `;
  });
}

/**
 * Cancel a listing (seller only)
 */
export async function cancelListing(
  listingId: string,
  sellerId: string,
  sql: Sql
): Promise<void> {
  const [listing] = await sql`
    SELECT seller_id AS "sellerId", status
    FROM marketplace_listings
    WHERE id = ${listingId}
  `;

  if (!listing) {
    throw new Error('Listing not found');
  }

  if (listing.sellerId !== sellerId) {
    throw new Error('Only the seller can cancel this listing');
  }

  if (listing.status !== 'active') {
    throw new Error('Listing is not active');
  }

  await sql`
    UPDATE marketplace_listings
    SET status = 'cancelled'
    WHERE id = ${listingId}
  `;
}

/**
 * Get marketplace listings with filters and pagination
 */
export async function getListings(
  filters: ListingFilters,
  page: number = 1,
  limit: number = 20,
  sql: Sql
): Promise<MarketplaceListing[]> {
  const offset = (page - 1) * limit;
  const conditions = ['TRUE'];

  if (filters.status) {
    conditions.push(`status = '${filters.status}'`);
  }

  if (filters.itemType) {
    conditions.push(`item_type = '${filters.itemType}'`);
  }

  if (filters.minPrice !== undefined) {
    conditions.push(`price >= ${filters.minPrice}`);
  }

  if (filters.maxPrice !== undefined) {
    conditions.push(`price <= ${filters.maxPrice}`);
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    conditions.push(`LOWER(item_type) LIKE '%${searchTerm}%'`);
  }

  const whereClause = conditions.join(' AND ');

  const listings = await sql<MarketplaceListing[]>`
    SELECT 
      id,
      item_id AS "itemId",
      seller_id AS "sellerId",
      item_type AS "itemType",
      price,
      status,
      buyer_id AS "buyerId",
      created_at AS "createdAt",
      sold_at AS "soldAt"
    FROM marketplace_listings
    WHERE ${sql.unsafe(whereClause)}
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return listings;
}

/**
 * Get listings for a specific agent (as seller)
 */
export async function getMyListings(
  agentId: string,
  sql: Sql
): Promise<MarketplaceListing[]> {
  return await sql<MarketplaceListing[]>`
    SELECT 
      id,
      item_id AS "itemId",
      seller_id AS "sellerId",
      item_type AS "itemType",
      price,
      status,
      buyer_id AS "buyerId",
      created_at AS "createdAt",
      sold_at AS "soldAt"
    FROM marketplace_listings
    WHERE seller_id = ${agentId}
    ORDER BY created_at DESC
  `;
}

/**
 * Get a specific listing by ID
 */
export async function getListingById(
  listingId: string,
  sql: Sql
): Promise<MarketplaceListing | null> {
  const [listing] = await sql<MarketplaceListing[]>`
    SELECT 
      id,
      item_id AS "itemId",
      seller_id AS "sellerId",
      item_type AS "itemType",
      price,
      status,
      buyer_id AS "buyerId",
      created_at AS "createdAt",
      sold_at AS "soldAt"
    FROM marketplace_listings
    WHERE id = ${listingId}
  `;

  return listing || null;
}
