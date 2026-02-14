-- Migration 009: Notifications System
-- Unified in-app notifications for friend requests, trades, whispers, achievements, etc.

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('friend_request', 'trade_offer', 'whisper', 'achievement', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- Optional URL/path for click action
  read_at TIMESTAMP WITH TIME ZONE, -- When marked as read (NULL = unread)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for fast queries: get unread notifications for an agent
CREATE INDEX IF NOT EXISTS idx_notifications_agent_unread 
  ON notifications(agent_id, read_at);

-- Index for type filtering
CREATE INDEX IF NOT EXISTS idx_notifications_type 
  ON notifications(type);
