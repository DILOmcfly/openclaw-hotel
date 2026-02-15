-- Marketplace system for buying/selling furniture between agents

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0 AND price <= 100000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  buyer_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  sold_at TIMESTAMP
);

CREATE INDEX idx_marketplace_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_seller ON marketplace_listings(seller_id);
