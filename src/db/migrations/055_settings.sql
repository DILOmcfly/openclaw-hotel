CREATE TABLE IF NOT EXISTS agent_settings (
  agent_id TEXT PRIMARY KEY,
  chat_color TEXT DEFAULT '#FFFFFF',
  notification_sounds BOOLEAN DEFAULT true,
  show_online_status BOOLEAN DEFAULT true,
  allow_friend_requests BOOLEAN DEFAULT true,
  allow_trades BOOLEAN DEFAULT true,
  allow_whispers BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'es', 'de', 'fr', 'pt', 'ja', 'ko', 'zh')),
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'retro', 'neon')),
  updated_at TIMESTAMP DEFAULT NOW()
);
