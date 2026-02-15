-- Room Mini-Map Settings
-- Configure mini-map display for each room

CREATE TABLE IF NOT EXISTS minimap_settings (
  room_id INT PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  show_furniture BOOLEAN DEFAULT true,
  show_agents BOOLEAN DEFAULT true,
  zoom_level FLOAT DEFAULT 1.0 CHECK (zoom_level >= 0.5 AND zoom_level <= 3.0),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minimap_room_id ON minimap_settings(room_id);
