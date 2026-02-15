CREATE TABLE IF NOT EXISTS room_analytics (
  room_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  visitor_count INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_stay_seconds INTEGER DEFAULT 0,
  PRIMARY KEY (room_id, date, hour)
);

CREATE TABLE IF NOT EXISTS room_visit_sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  entered_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  duration_seconds INTEGER
);

CREATE INDEX idx_analytics_room ON room_analytics(room_id);
CREATE INDEX idx_visit_sessions_room ON room_visit_sessions(room_id);
