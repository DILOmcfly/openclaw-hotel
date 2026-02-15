-- Room Playlists Table
CREATE TABLE IF NOT EXISTS room_playlists (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL,
  name VARCHAR(100) DEFAULT 'Room Playlist',
  max_tracks INTEGER DEFAULT 30,
  shuffle BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Playlist Tracks Table
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id SERIAL PRIMARY KEY,
  playlist_id INTEGER NOT NULL,
  added_by VARCHAR(255),
  track_name VARCHAR(200),
  artist VARCHAR(200) DEFAULT 'Unknown',
  duration_seconds INTEGER DEFAULT 180,
  position INTEGER,
  added_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (playlist_id) REFERENCES room_playlists(id) ON DELETE CASCADE
);

-- Track Votes Table
CREATE TABLE IF NOT EXISTS track_votes (
  track_id INTEGER NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  vote SMALLINT CHECK (vote IN (-1, 1)),
  PRIMARY KEY (track_id, agent_id),
  FOREIGN KEY (track_id) REFERENCES playlist_tracks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_room_playlists_room ON room_playlists(room_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_track_votes_track ON track_votes(track_id);
