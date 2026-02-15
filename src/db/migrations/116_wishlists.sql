-- Agent Wishlists Table
CREATE TABLE IF NOT EXISTS agent_wishlists (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('furniture','badge','sticker','card','outfit','theme')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  max_price INT,
  notes VARCHAR(200),
  fulfilled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, item_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_wishlists_agent_id ON agent_wishlists(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_wishlists_item_type ON agent_wishlists(item_type);
CREATE INDEX IF NOT EXISTS idx_agent_wishlists_priority ON agent_wishlists(priority);
CREATE INDEX IF NOT EXISTS idx_agent_wishlists_fulfilled ON agent_wishlists(fulfilled);
CREATE INDEX IF NOT EXISTS idx_agent_wishlists_item_name ON agent_wishlists(item_name);
