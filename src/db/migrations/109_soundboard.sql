-- Room Soundboards Table
CREATE TABLE IF NOT EXISTS room_soundboards (
  room_id INT PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  cooldown_seconds INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Soundboard Sounds Table
CREATE TABLE IF NOT EXISTS soundboard_sounds (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  sound_key VARCHAR(50) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('effect', 'music', 'ambient', 'voice', 'meme')),
  volume INT DEFAULT 80 CHECK (volume >= 0 AND volume <= 100),
  play_count INT DEFAULT 0,
  added_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_soundboard_sounds_room_id ON soundboard_sounds(room_id);
CREATE INDEX IF NOT EXISTS idx_soundboard_sounds_category ON soundboard_sounds(category);
CREATE INDEX IF NOT EXISTS idx_soundboard_sounds_play_count ON soundboard_sounds(play_count DESC);
