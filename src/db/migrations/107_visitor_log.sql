-- Room Visits Table
CREATE TABLE IF NOT EXISTS room_visits (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  agent_id VARCHAR NOT NULL,
  entered_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  duration_seconds INT DEFAULT 0
);

-- Room Visit Statistics Table
CREATE TABLE IF NOT EXISTS room_visit_stats (
  room_id INT NOT NULL,
  date DATE NOT NULL,
  unique_visitors INT DEFAULT 0,
  total_visits INT DEFAULT 0,
  avg_duration INT DEFAULT 0,
  PRIMARY KEY (room_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_visits_room_id ON room_visits(room_id);
CREATE INDEX IF NOT EXISTS idx_room_visits_agent_id ON room_visits(agent_id);
CREATE INDEX IF NOT EXISTS idx_room_visits_entered_at ON room_visits(entered_at);
CREATE INDEX IF NOT EXISTS idx_room_visits_active ON room_visits(room_id, left_at) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_room_visit_stats_date ON room_visit_stats(date);
