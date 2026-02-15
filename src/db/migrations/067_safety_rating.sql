-- Room Safety Rating System
CREATE TABLE IF NOT EXISTS room_safety (
  room_id TEXT PRIMARY KEY,
  rating TEXT DEFAULT 'everyone' CHECK (rating IN ('everyone', 'teen', 'mature', 'restricted')),
  content_warnings JSONB DEFAULT '[]',
  verified_by TEXT,
  verified_at TIMESTAMP,
  reports_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
