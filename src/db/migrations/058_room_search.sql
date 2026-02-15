CREATE TABLE IF NOT EXISTS room_tags_v2 (
  room_id TEXT NOT NULL,
  tag TEXT NOT NULL CHECK (LENGTH(tag) <= 20),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (room_id, tag)
);

CREATE INDEX idx_room_tags_tag ON room_tags_v2(tag);

CREATE TABLE IF NOT EXISTS room_descriptions (
  room_id TEXT PRIMARY KEY,
  short_desc TEXT DEFAULT '' CHECK (LENGTH(short_desc) <= 200),
  long_desc TEXT DEFAULT '' CHECK (LENGTH(long_desc) <= 2000),
  rules TEXT DEFAULT '' CHECK (LENGTH(rules) <= 500),
  updated_at TIMESTAMP DEFAULT NOW()
);
