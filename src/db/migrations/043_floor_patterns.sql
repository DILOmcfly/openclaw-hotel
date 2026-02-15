CREATE TABLE IF NOT EXISTS room_floor_tiles (
  room_id TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  pattern TEXT DEFAULT 'solid' CHECK (pattern IN ('solid', 'checkerboard', 'stripes', 'dots', 'diamond', 'wood', 'marble', 'grass', 'carpet', 'tile')),
  color TEXT DEFAULT '#CCCCCC',
  secondary_color TEXT DEFAULT '#999999',
  PRIMARY KEY (room_id, x, y)
);
