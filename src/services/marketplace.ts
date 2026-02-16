import { sql } from '../db/index.js';

export interface MarketplaceListing {
  id: string;
  item_id: string;
  seller_id: string;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  created_at: Date;
  sold_at: Date | null;
  buyer_id: string | null;
  // Enriched fields (from JOINs)
  item_type?: string;
  seller_name?: string;
  buyer_name?: string;
}

export interface ListingFilters {
  status?: 'active' | 'sold' | 'cancelled';
  seller_id?: string;
  item_type?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create a new marketplace listing
 * Validates ownership before listing
 */
export async function createListing(
  itemId: string,
  sellerId: string,
  price: number,
  sqlClient: any = sql
): Promise<MarketplaceListing | null> {
  // Validate price
  if (price <= 0 || price > 1000000) {
    throw new Error('Invalid price (must be 1-1000000 coins)');
  }

  // Verify ownership: item must exist in room_furniture with agent_id = sellerId
  const ownership = await sqlClient`
    SELECT id, item_type, room_id FROM room_furniture
    WHERE id = ${itemId} AND agent_id = ${sellerId}
    LIMIT 1
  `;

  if (ownership.length === 0) {
    throw new Error('Item not found or you do not own it');
  }

  // Create listing
  const listing = await sqlClient`
    INSERT INTO marketplace_listings (item_id, seller_id, price, status, created_at)
    VALUES (${itemId}, ${sellerId}, ${price}, 'active', NOW())
    RETURNING *
  `;

  return listing[0] || null;
}

/**
 * Get all marketplace listings with filters
 */
export async function getListings(
  filters: ListingFilters = {},
  sqlClient: any = sql
): Promise<MarketplaceListing[]> {
  const {
    status = 'active',
    seller_id,
    item_type,
    min_price,
    max_price,
    search,
    limit = 50,
    offset = 0,
  } = filters;

  let query = `
    SELECT 
      ml.*, 
      f.name AS item_type,
      seller.display_name AS seller_name,
      buyer.display_name AS buyer_name
    FROM marketplace_listings ml
    JOIN room_furniture rf ON ml.item_id = rf.id
    JOIN furniture f ON rf.furniture_id = f.id
    JOIN agents seller ON ml.seller_id = seller.id
    LEFT JOIN agents buyer ON ml.buyer_id = buyer.id
    WHERE ml.status = $1
  `;
  const params: any[] = [status];
  let paramIndex = 2;

  if (seller_id) {
    query += ` AND ml.seller_id = $${paramIndex}`;
    params.push(seller_id);
    paramIndex++;
  }

  if (item_type) {
    query += ` AND rf.item_type = $${paramIndex}`;
    params.push(item_type);
    paramIndex++;
  }

  if (min_price !== undefined) {
    query += ` AND ml.price >= $${paramIndex}`;
    params.push(min_price);
    paramIndex++;
  }

  if (max_price !== undefined) {
    query += ` AND ml.price <= $${paramIndex}`;
    params.push(max_price);
    paramIndex++;
  }

  if (search) {
    query += ` AND (rf.item_type ILIKE $${paramIndex} OR seller.name ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  query += ` ORDER BY ml.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const listings = await sqlClient.unsafe(query, params);
  return listings;
}

/**
 * Get a single listing by ID
 */
export async function getListing(
  listingId: string,
  sqlClient: any = sql
): Promise<MarketplaceListing | null> {
  const listings = await sqlClient`
    SELECT 
      ml.*, 
      f.name AS item_type,
      seller.display_name AS seller_name,
      buyer.display_name AS buyer_name
    FROM marketplace_listings ml
    JOIN room_furniture rf ON ml.item_id = rf.id
    JOIN furniture f ON rf.furniture_id = f.id
    JOIN agents seller ON ml.seller_id = seller.id
    LEFT JOIN agents buyer ON ml.buyer_id = buyer.id
    WHERE ml.id = ${listingId}
    LIMIT 1
  `;
  return listings[0] || null;
}

/**
 * Get all listings by a specific seller
 */
export async function getMyListings(
  sellerId: string,
  sqlClient: any = sql
): Promise<MarketplaceListing[]> {
  return getListings({ seller_id: sellerId, status: 'active' }, sqlClient);
}

/**
 * Buy a listing (transaction: transfer item, deduct coins, mark sold)
 */
export async function buyListing(
  listingId: string,
  buyerId: string,
  sqlClient: any = sql
): Promise<{ success: boolean; error?: string }> {
  // Get listing details
  const listing = await getListing(listingId, sqlClient);
  if (!listing) {
    return { success: false, error: 'Listing not found' };
  }

  if (listing.status !== 'active') {
    return { success: false, error: 'Listing is not active' };
  }

  if (listing.seller_id === buyerId) {
    return { success: false, error: 'Cannot buy your own listing' };
  }

  // Check buyer balance
  const buyerBalance = await sqlClient`
    SELECT coins FROM agent_balances WHERE agent_id = ${buyerId} LIMIT 1
  `;
  if (buyerBalance.length === 0 || buyerBalance[0].coins < listing.price) {
    return { success: false, error: 'Insufficient coins' };
  }

  // BEGIN TRANSACTION
  try {
    await sqlClient.begin(async (tx: any) => {
      // 1. Deduct coins from buyer
      await tx`
        UPDATE agent_balances
        SET coins = coins - ${listing.price}
        WHERE agent_id = ${buyerId}
      `;

      // 2. Add coins to seller
      await tx`
        UPDATE agent_balances
        SET coins = coins + ${listing.price}
        WHERE agent_id = ${listing.seller_id}
      `;

      // 3. Transfer item ownership
      await tx`
        UPDATE room_furniture
        SET agent_id = ${buyerId}
        WHERE id = ${listing.item_id}
      `;

      // 4. Mark listing as sold
      await tx`
        UPDATE marketplace_listings
        SET status = 'sold', sold_at = NOW(), buyer_id = ${buyerId}
        WHERE id = ${listingId}
      `;

      // 5. Update seller's trade_count
      await tx`
        UPDATE agent_profiles
        SET trade_count = trade_count + 1
        WHERE agent_id = ${listing.seller_id}
      `;

      // 6. Update buyer's trade_count
      await tx`
        UPDATE agent_profiles
        SET trade_count = trade_count + 1
        WHERE agent_id = ${buyerId}
      `;
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Marketplace] Buy transaction failed:', error);
    return { success: false, error: 'Transaction failed' };
  }
}

/**
 * Cancel a listing (only seller can cancel)
 */
export async function cancelListing(
  listingId: string,
  sellerId: string,
  sqlClient: any = sql
): Promise<{ success: boolean; error?: string }> {
  // Verify ownership
  const listing = await getListing(listingId, sqlClient);
  if (!listing) {
    return { success: false, error: 'Listing not found' };
  }

  if (listing.seller_id !== sellerId) {
    return { success: false, error: 'Not your listing' };
  }

  if (listing.status !== 'active') {
    return { success: false, error: 'Listing is not active' };
  }

  // Mark as cancelled
  await sqlClient`
    UPDATE marketplace_listings
    SET status = 'cancelled'
    WHERE id = ${listingId}
  `;

  return { success: true };
}

/**
 * Get marketplace statistics
 */
export async function getMarketplaceStats(
  sqlClient: any = sql
): Promise<{
  total_active: number;
  total_sold_24h: number;
  avg_price: number;
}> {
  const stats = await sqlClient`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') AS total_active,
      COUNT(*) FILTER (WHERE status = 'sold' AND sold_at > NOW() - INTERVAL '24 hours') AS total_sold_24h,
      AVG(price) FILTER (WHERE status = 'active') AS avg_price
    FROM marketplace_listings
  `;

  return {
    total_active: parseInt(stats[0]?.total_active || '0'),
    total_sold_24h: parseInt(stats[0]?.total_sold_24h || '0'),
    avg_price: parseFloat(stats[0]?.avg_price || '0'),
  };
}
