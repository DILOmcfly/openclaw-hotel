CREATE TABLE IF NOT EXISTS furniture_presets (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (LENGTH(name) <= 50),
  layout JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_presets_room ON furniture_presets(room_id);
