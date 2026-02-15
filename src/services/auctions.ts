/**
 * Auction Service - Agent auction system
 */

export type Auction = {
  id: string;
  sellerId: string;
  itemId: string;
  itemType: string;
  startingPrice: number;
  currentBid: number;
  currentBidder: string | null;
  bidCount: number;
  status: 'active' | 'ended' | 'cancelled';
  endsAt: string;
  createdAt: string;
};

export type AuctionBid = {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  createdAt: string;
};

/**
 * Create a new auction (max 24 hours)
 */
export async function createAuction(
  sellerId: string,
  itemId: string,
  itemType: string,
  startingPrice: number,
  durationHours: number,
  sql: any
): Promise<Auction> {
  if (durationHours > 24 || durationHours <= 0) {
    throw new Error('Duration must be between 1 and 24 hours');
  }

  if (startingPrice <= 0) {
    throw new Error('Starting price must be greater than 0');
  }

  // Verify item exists and belongs to seller
  const itemQuery = sql`
    SELECT id, agent_id, item_def_id
    FROM furniture
    WHERE id = ${sql.typed.uuid(itemId)}
  `;

  const items = await itemQuery;

  if (items.length === 0) {
    throw new Error('Item not found');
  }

  if (items[0].agent_id !== sellerId) {
    throw new Error('Item does not belong to seller');
  }

  const auctionId = crypto.randomUUID();
  const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  const insertQuery = sql`
    INSERT INTO auctions (
      id,
      seller_id,
      item_id,
      item_type,
      starting_price,
      current_bid,
      status,
      ends_at
    ) VALUES (
      ${sql.typed.text(auctionId)},
      ${sql.typed.text(sellerId)},
      ${sql.typed.uuid(itemId)},
      ${sql.typed.text(itemType)},
      ${sql.typed.int4(startingPrice)},
      0,
      'active',
      ${sql.typed.timestamptz(endsAt.toISOString())}
    )
    RETURNING 
      id,
      seller_id AS "sellerId",
      item_id AS "itemId",
      item_type AS "itemType",
      starting_price AS "startingPrice",
      current_bid AS "currentBid",
      current_bidder AS "currentBidder",
      bid_count AS "bidCount",
      status,
      ends_at AS "endsAt",
      created_at AS "createdAt"
  `;

  const results = await insertQuery;
  return results[0];
}

/**
 * Place a bid on an auction
 */
export async function placeBid(
  auctionId: string,
  bidderId: string,
  amount: number,
  sql: any
): Promise<AuctionBid> {
  // Get auction
  const auctionQuery = sql`
    SELECT 
      id,
      seller_id AS "sellerId",
      current_bid AS "currentBid",
      starting_price AS "startingPrice",
      status,
      ends_at AS "endsAt"
    FROM auctions
    WHERE id = ${sql.typed.text(auctionId)}
  `;

  const auctions = await auctionQuery;

  if (auctions.length === 0) {
    throw new Error('Auction not found');
  }

  const auction = auctions[0];

  if (auction.status !== 'active') {
    throw new Error('Auction is not active');
  }

  if (new Date(auction.endsAt) < new Date()) {
    throw new Error('Auction has ended');
  }

  if (auction.sellerId === bidderId) {
    throw new Error('Cannot bid on own auction');
  }

  const minBid = auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingPrice;

  if (amount < minBid) {
    throw new Error(`Bid must be at least ${minBid}`);
  }

  // Create bid record
  const bidId = crypto.randomUUID();

  const insertBidQuery = sql`
    INSERT INTO auction_bids (
      id,
      auction_id,
      bidder_id,
      amount
    ) VALUES (
      ${sql.typed.text(bidId)},
      ${sql.typed.text(auctionId)},
      ${sql.typed.text(bidderId)},
      ${sql.typed.int4(amount)}
    )
    RETURNING 
      id,
      auction_id AS "auctionId",
      bidder_id AS "bidderId",
      amount,
      created_at AS "createdAt"
  `;

  const bidResults = await insertBidQuery;

  // Update auction
  const updateAuctionQuery = sql`
    UPDATE auctions
    SET 
      current_bid = ${sql.typed.int4(amount)},
      current_bidder = ${sql.typed.text(bidderId)},
      bid_count = bid_count + 1
    WHERE id = ${sql.typed.text(auctionId)}
  `;

  await updateAuctionQuery;

  return bidResults[0];
}

/**
 * Get all active auctions
 */
export async function getActiveAuctions(sql: any): Promise<Auction[]> {
  const query = sql`
    SELECT 
      id,
      seller_id AS "sellerId",
      item_id AS "itemId",
      item_type AS "itemType",
      starting_price AS "startingPrice",
      current_bid AS "currentBid",
      current_bidder AS "currentBidder",
      bid_count AS "bidCount",
      status,
      ends_at AS "endsAt",
      created_at AS "createdAt"
    FROM auctions
    WHERE status = 'active'
      AND ends_at > NOW()
    ORDER BY created_at DESC
  `;

  const results = await query;
  return results;
}

/**
 * Get auction by ID with bid history
 */
export async function getAuctionById(
  id: string,
  sql: any
): Promise<{ auction: Auction; bids: AuctionBid[] } | null> {
  const auctionQuery = sql`
    SELECT 
      id,
      seller_id AS "sellerId",
      item_id AS "itemId",
      item_type AS "itemType",
      starting_price AS "startingPrice",
      current_bid AS "currentBid",
      current_bidder AS "currentBidder",
      bid_count AS "bidCount",
      status,
      ends_at AS "endsAt",
      created_at AS "createdAt"
    FROM auctions
    WHERE id = ${sql.typed.text(id)}
  `;

  const auctions = await auctionQuery;

  if (auctions.length === 0) {
    return null;
  }

  const bidsQuery = sql`
    SELECT 
      id,
      auction_id AS "auctionId",
      bidder_id AS "bidderId",
      amount,
      created_at AS "createdAt"
    FROM auction_bids
    WHERE auction_id = ${sql.typed.text(id)}
    ORDER BY created_at DESC
  `;

  const bids = await bidsQuery;

  return {
    auction: auctions[0],
    bids,
  };
}

/**
 * End auction - transfer item to winner, coins to seller
 */
export async function endAuction(auctionId: string, sql: any): Promise<void> {
  const auctionQuery = sql`
    SELECT 
      id,
      seller_id AS "sellerId",
      item_id AS "itemId",
      current_bid AS "currentBid",
      current_bidder AS "currentBidder",
      status
    FROM auctions
    WHERE id = ${sql.typed.text(auctionId)}
  `;

  const auctions = await auctionQuery;

  if (auctions.length === 0) {
    throw new Error('Auction not found');
  }

  const auction = auctions[0];

  if (auction.status !== 'active') {
    throw new Error('Auction is not active');
  }

  // If there's a winner, transfer item and coins
  if (auction.currentBidder && auction.currentBid > 0) {
    // Transfer item to winner
    const transferItemQuery = sql`
      UPDATE furniture
      SET agent_id = ${sql.typed.uuid(auction.currentBidder)}
      WHERE id = ${sql.typed.uuid(auction.itemId)}
    `;

    await transferItemQuery;

    // Deduct coins from winner
    const deductCoinsQuery = sql`
      UPDATE agent_balances
      SET coins = coins - ${sql.typed.int4(auction.currentBid)}
      WHERE agent_id = ${sql.typed.text(auction.currentBidder)}
    `;

    await deductCoinsQuery;

    // Add coins to seller
    const addCoinsQuery = sql`
      UPDATE agent_balances
      SET coins = coins + ${sql.typed.int4(auction.currentBid)}
      WHERE agent_id = ${sql.typed.text(auction.sellerId)}
    `;

    await addCoinsQuery;
  }

  // Mark auction as ended
  const updateAuctionQuery = sql`
    UPDATE auctions
    SET status = 'ended'
    WHERE id = ${sql.typed.text(auctionId)}
  `;

  await updateAuctionQuery;
}

/**
 * Cancel auction - only if no bids
 */
export async function cancelAuction(
  auctionId: string,
  sellerId: string,
  sql: any
): Promise<void> {
  const auctionQuery = sql`
    SELECT 
      id,
      seller_id AS "sellerId",
      bid_count AS "bidCount",
      status
    FROM auctions
    WHERE id = ${sql.typed.text(auctionId)}
  `;

  const auctions = await auctionQuery;

  if (auctions.length === 0) {
    throw new Error('Auction not found');
  }

  const auction = auctions[0];

  if (auction.sellerId !== sellerId) {
    throw new Error('Only seller can cancel auction');
  }

  if (auction.status !== 'active') {
    throw new Error('Auction is not active');
  }

  if (auction.bidCount > 0) {
    throw new Error('Cannot cancel auction with bids');
  }

  const updateQuery = sql`
    UPDATE auctions
    SET status = 'cancelled'
    WHERE id = ${sql.typed.text(auctionId)}
  `;

  await updateQuery;
}

/**
 * Get auctions by agent (seller or bidder)
 */
export async function getMyAuctions(agentId: string, sql: any): Promise<Auction[]> {
  const query = sql`
    SELECT DISTINCT
      a.id,
      a.seller_id AS "sellerId",
      a.item_id AS "itemId",
      a.item_type AS "itemType",
      a.starting_price AS "startingPrice",
      a.current_bid AS "currentBid",
      a.current_bidder AS "currentBidder",
      a.bid_count AS "bidCount",
      a.status,
      a.ends_at AS "endsAt",
      a.created_at AS "createdAt"
    FROM auctions a
    LEFT JOIN auction_bids b ON a.id = b.auction_id
    WHERE a.seller_id = ${sql.typed.text(agentId)}
       OR b.bidder_id = ${sql.typed.text(agentId)}
    ORDER BY a.created_at DESC
  `;

  const results = await query;
  return results;
}
