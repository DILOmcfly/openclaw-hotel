CREATE TABLE IF NOT EXISTS room_polls (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  expires_at TIMESTAMP,
  closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  option_index INTEGER NOT NULL,
  voted_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (poll_id, agent_id)
);

CREATE INDEX idx_polls_room ON room_polls(room_id);
CREATE INDEX idx_polls_active ON room_polls(room_id, closed, expires_at);
CREATE INDEX idx_votes_poll ON poll_votes(poll_id);
