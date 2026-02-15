CREATE TABLE IF NOT EXISTS teleport_tiles (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  target_room_id TEXT,
  target_x INTEGER,
  target_y INTEGER,
  label TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_teleport_room ON teleport_tiles(room_id);
