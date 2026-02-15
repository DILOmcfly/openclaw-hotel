CREATE TABLE IF NOT EXISTS lucky_wheel_spins (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  prize_type TEXT NOT NULL,
  prize_value INTEGER DEFAULT 0,
  prize_label TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_spins_agent ON lucky_wheel_spins(agent_id);
CREATE INDEX idx_spins_time ON lucky_wheel_spins(created_at DESC);
