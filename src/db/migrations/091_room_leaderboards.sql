-- Room Leaderboards table
CREATE TABLE IF NOT EXISTS room_leaderboards (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  name VARCHAR(100),
  metric VARCHAR(50) NOT NULL,
  sort_order VARCHAR(4) DEFAULT 'desc' CHECK (sort_order IN ('asc', 'desc')),
  max_entries INT DEFAULT 100,
  reset_period VARCHAR(20) DEFAULT 'never' CHECK (reset_period IN ('never', 'daily', 'weekly', 'monthly')),
  last_reset TIMESTAMP,
  created_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Leaderboard Entries table
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  leaderboard_id INT REFERENCES room_leaderboards(id) ON DELETE CASCADE,
  agent_id VARCHAR NOT NULL,
  score FLOAT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (leaderboard_id, agent_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_leaderboards_room_id ON room_leaderboards(room_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_agent_id ON leaderboard_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_score ON leaderboard_entries(leaderboard_id, score DESC);
