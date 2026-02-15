CREATE TABLE IF NOT EXISTS agent_favorites (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('room', 'agent', 'item', 'guild')),
  target_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, target_type, target_id)
);

CREATE INDEX idx_favorites_agent ON agent_favorites(agent_id);
