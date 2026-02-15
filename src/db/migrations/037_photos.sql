CREATE TABLE IF NOT EXISTS room_photos (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  taken_by TEXT NOT NULL,
  caption TEXT DEFAULT '',
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photo_likes (
  photo_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (photo_id, agent_id)
);

CREATE INDEX idx_photos_room ON room_photos(room_id);
CREATE INDEX idx_photos_agent ON room_photos(taken_by);
