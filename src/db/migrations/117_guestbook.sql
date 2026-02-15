-- Guest Book System: Allows visitors to leave messages in rooms

-- Room guest book settings table
CREATE TABLE IF NOT EXISTS room_guestbooks (
  room_id INT PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  max_entries INT DEFAULT 100 CHECK (max_entries > 0 AND max_entries <= 1000),
  allow_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Guest book entries table
CREATE TABLE IF NOT EXISTS guestbook_entries (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  author_id VARCHAR(255) NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) > 0 AND char_length(message) <= 500),
  mood VARCHAR(20) DEFAULT 'happy' CHECK (mood IN ('happy', 'sad', 'excited', 'chill', 'love', 'funny', 'inspired', 'grateful')),
  pinned BOOLEAN DEFAULT false,
  likes INT DEFAULT 0 CHECK (likes >= 0),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guestbook_entries_room ON guestbook_entries(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guestbook_entries_author ON guestbook_entries(author_id);
CREATE INDEX IF NOT EXISTS idx_guestbook_entries_pinned ON guestbook_entries(room_id, pinned, created_at DESC);
