CREATE TABLE IF NOT EXISTS room_rollers (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  direction TEXT NOT NULL DEFAULT 'south' CHECK (direction IN ('north', 'south', 'east', 'west')),
  speed INTEGER DEFAULT 1 CHECK (speed >= 1 AND speed <= 3),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rollers_room ON room_rollers(room_id);
