CREATE TABLE IF NOT EXISTS agent_status (
  agent_id TEXT PRIMARY KEY,
  mood TEXT DEFAULT 'neutral' CHECK (mood IN ('happy', 'sad', 'excited', 'busy', 'away', 'neutral', 'angry', 'sleepy', 'creative', 'social')),
  status_text TEXT DEFAULT '',
  is_visible BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);
