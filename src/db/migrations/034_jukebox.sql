CREATE TABLE IF NOT EXISTS room_playlists (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE,
  tracks JSONB DEFAULT '[]',
  current_track INTEGER DEFAULT 0,
  is_playing BOOLEAN DEFAULT false,
  volume INTEGER DEFAULT 70 CHECK (volume >= 0 AND volume <= 100),
  repeat_mode TEXT DEFAULT 'none' CHECK (repeat_mode IN ('none', 'one', 'all')),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_playlist_room ON room_playlists(room_id);
