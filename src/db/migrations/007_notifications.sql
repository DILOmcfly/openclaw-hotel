-- 007_notifications.sql — Notification System
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL CHECK (type IN ('friend_request', 'trade_offer', 'whisper', 'achievement', 'system')),
  title VARCHAR(128) NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  link TEXT,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_agent_unread ON notifications(agent_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_agent_created ON notifications(agent_id, created_at DESC);
