/**
 * Auctions Service - Manages agent auction house and bidding
 */

export type Auction = {
  id: number;
  sellerId: string;
  itemName: string;
  itemRarity: string;
  startingPrice: number;
  currentBid: number;
  currentBidder: string | null;
  bidCount: number;
  endsAt: Date;
  status: 'active' | 'sold' | 'expired' | 'cancelled';
  createdAt: Date;
};

export type AuctionBid = {
  id: number;
  auctionId: number;
  bidderId: string;
  amount: number;
  createdAt: Date;
};

const MIN_HOURS = 1;
const MAX_HOURS = 168; // 7 days

const AUCTION_SELECT = `
  id, seller_id AS "sellerId", item_name AS "itemName", item_rarity AS "itemRarity",
  starting_price AS "startingPrice", current_bid AS "currentBid", current_bidder AS "currentBidder",
  bid_count AS "bidCount", ends_at AS "endsAt", status, created_at AS "createdAt"
`;

export async function createAuction(
  sellerId: string,
  itemName: string,
  itemRarity: string,
  startingPrice: number,
  durationHours: number,
  sql: any
): Promise<Auction> {
  if (durationHours < MIN_HOURS) throw new Error(`Min duration: ${MIN_HOURS}h`);
  if (durationHours > MAX_HOURS) throw new Error(`Max duration: ${MAX_HOURS / 24}d`);

  const endsAt = new Date(Date.now() + durationHours * 3600000);
  const result = await sql`
    INSERT INTO auctions (seller_id, item_name, item_rarity, starting_price, current_bid, ends_at)
    VALUES (${sellerId}, ${itemName}, ${itemRarity}, ${startingPrice}, ${startingPrice}, ${endsAt})
    RETURNING ${sql(AUCTION_SELECT)}
  `;
  return result[0];
}

export async function placeBid(
  auctionId: number,
  bidderId: string,
  amount: number,
  sql: any
): Promise<Auction> {
  const auction = await getAuctionById(auctionId, sql);
  if (!auction) throw new Error('Auction not found');
  if (auction.status !== 'active') throw new Error('Auction not active');
  if (new Date() >= auction.endsAt) throw new Error('Auction expired');
  if (auction.sellerId === bidderId) throw new Error('Cannot bid on own auction');
  if (amount <= auction.currentBid) throw new Error('Bid must exceed current');

  await sql`INSERT INTO auction_bids (auction_id, bidder_id, amount) VALUES (${auctionId}, ${bidderId}, ${amount})`;

  const updated = await sql`
    UPDATE auctions SET current_bid = ${amount}, current_bidder = ${bidderId}, bid_count = bid_count + 1
    WHERE id = ${auctionId}
    RETURNING ${sql(AUCTION_SELECT)}
  `;
  return updated[0];
}

export async function getActiveAuctions(
  limit = 20,
  offset = 0,
  sortBy: 'ending_soon' | 'price' | 'bids' = 'ending_soon',
  sql: any
): Promise<Auction[]> {
  const order = sortBy === 'price' ? 'current_bid DESC' : sortBy === 'bids' ? 'bid_count DESC' : 'ends_at ASC';
  return await sql.unsafe(`
    SELECT ${AUCTION_SELECT}
    FROM auctions
    WHERE status = 'active' AND ends_at > NOW()
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}
  `);
}

export async function getAuctionById(auctionId: number, sql: any): Promise<Auction | null> {
  const result = await sql`SELECT ${sql(AUCTION_SELECT)} FROM auctions WHERE id = ${auctionId}`;
  return result.length > 0 ? result[0] : null;
}

export async function getAuctionBidHistory(auctionId: number, sql: any): Promise<AuctionBid[]> {
  return await sql`
    SELECT id, auction_id AS "auctionId", bidder_id AS "bidderId", amount, created_at AS "createdAt"
    FROM auction_bids WHERE auction_id = ${auctionId} ORDER BY created_at DESC
  `;
}

export async function cancelAuction(auctionId: number, sellerId: string, sql: any): Promise<Auction> {
  const auction = await getAuctionById(auctionId, sql);
  if (!auction) throw new Error('Auction not found');
  if (auction.sellerId !== sellerId) throw new Error('Only seller can cancel');
  if (auction.bidCount > 0) throw new Error('Cannot cancel with bids');

  const updated = await sql`
    UPDATE auctions SET status = 'cancelled' WHERE id = ${auctionId}
    RETURNING ${sql(AUCTION_SELECT)}
  `;
  return updated[0];
}

export async function expireAuctions(sql: any): Promise<number> {
  const result = await sql`
    UPDATE auctions
    SET status = CASE WHEN bid_count > 0 THEN 'sold' ELSE 'expired' END
    WHERE status = 'active' AND ends_at <= NOW()
    RETURNING id
  `;
  return result.length;
}

export async function getAgentAuctions(agentId: string, sql: any): Promise<Auction[]> {
  return await sql`
    SELECT ${sql(AUCTION_SELECT)}
    FROM auctions WHERE seller_id = ${agentId} ORDER BY created_at DESC
  `;
}
