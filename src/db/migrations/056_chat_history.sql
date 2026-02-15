CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  message TEXT NOT NULL CHECK (LENGTH(message) <= 500),
  message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'emote', 'system', 'command')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_room ON chat_messages(room_id, created_at DESC);
