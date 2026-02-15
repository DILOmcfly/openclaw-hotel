-- Time Capsules
-- Agents can leave messages to be opened in the future

CREATE TABLE IF NOT EXISTS time_capsules (
  id SERIAL PRIMARY KEY,
  creator_id VARCHAR NOT NULL,
  room_id INT,
  title VARCHAR(100),
  message TEXT NOT NULL,
  items TEXT DEFAULT '[]',
  opens_at TIMESTAMP NOT NULL,
  opened BOOLEAN DEFAULT false,
  opened_at TIMESTAMP,
  viewers TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_time_capsules_creator ON time_capsules(creator_id);
CREATE INDEX idx_time_capsules_room ON time_capsules(room_id);
CREATE INDEX idx_time_capsules_opens_at ON time_capsules(opens_at);
CREATE INDEX idx_time_capsules_opened ON time_capsules(opened);
