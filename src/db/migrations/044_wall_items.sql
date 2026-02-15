CREATE TABLE IF NOT EXISTS room_wall_items (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  wall TEXT NOT NULL CHECK (wall IN ('north', 'south', 'east', 'west')),
  position_x REAL DEFAULT 0.5,
  position_y REAL DEFAULT 0.5,
  item_type TEXT NOT NULL CHECK (item_type IN ('poster', 'clock', 'sign', 'mirror', 'shelf', 'painting', 'banner', 'window')),
  content TEXT DEFAULT '',
  placed_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wall_items_room ON room_wall_items(room_id);
