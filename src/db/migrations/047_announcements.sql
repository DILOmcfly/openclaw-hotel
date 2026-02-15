CREATE TABLE IF NOT EXISTS room_announcements (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (LENGTH(title) <= 100),
  body TEXT NOT NULL CHECK (LENGTH(body) <= 1000),
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_announcements_room ON room_announcements(room_id);
