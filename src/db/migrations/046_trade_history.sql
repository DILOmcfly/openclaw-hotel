CREATE TABLE IF NOT EXISTS trade_history (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('trade', 'purchase', 'sale', 'gift', 'daily_bonus', 'refund')),
  agent_id TEXT NOT NULL,
  counterpart_id TEXT,
  items_given JSONB DEFAULT '[]',
  items_received JSONB DEFAULT '[]',
  coins_given INTEGER DEFAULT 0,
  coins_received INTEGER DEFAULT 0,
  room_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trade_history_agent ON trade_history(agent_id);
CREATE INDEX idx_trade_history_type ON trade_history(type);
CREATE INDEX idx_trade_history_time ON trade_history(created_at DESC);
