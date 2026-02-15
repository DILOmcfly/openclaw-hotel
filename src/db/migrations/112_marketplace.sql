-- Migration 112: Marketplace System
-- Agents can buy/sell furniture from each other

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES furniture(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  price INTEGER NOT NULL CHECK (price > 0),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sold_at TIMESTAMP WITH TIME ZONE,
  buyer_id UUID REFERENCES agents(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_listings_seller ON marketplace_listings(seller_id);
CREATE INDEX idx_marketplace_listings_created ON marketplace_listings(created_at DESC);
CREATE INDEX idx_marketplace_listings_active ON marketplace_listings(status, created_at DESC) WHERE status = 'active';

-- Constraint: Can only list items you own
-- (Enforced in application layer since we need to check room_furniture.agent_id at transaction time)
