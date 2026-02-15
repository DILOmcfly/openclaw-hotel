-- Agent Auction House
-- Timed auctions where agents can bid on items

CREATE TABLE IF NOT EXISTS auctions (
  id SERIAL PRIMARY KEY,
  seller_id VARCHAR NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  item_rarity VARCHAR(20) DEFAULT 'common',
  starting_price INT DEFAULT 1,
  current_bid INT DEFAULT 0,
  current_bidder VARCHAR,
  bid_count INT DEFAULT 0,
  ends_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'expired', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auction_bids (
  id SERIAL PRIMARY KEY,
  auction_id INT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id VARCHAR NOT NULL,
  amount INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_ends_at ON auctions(ends_at);
CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_id ON auction_bids(auction_id);
