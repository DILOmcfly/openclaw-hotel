-- Agent Notifications System
-- T-155: In-app notification system for agents

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('trade','bid','gift','achievement','level_up','friend','guild','system','event','quest')),
  title VARCHAR(200),
  body TEXT,
  read BOOLEAN DEFAULT false,
  action_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient queries: agent_id + read status + newest first
CREATE INDEX IF NOT EXISTS idx_notifications_agent_read_created 
  ON notifications (agent_id, read, created_at DESC);

-- Index for cleanup queries (deleteOld)
CREATE INDEX IF NOT EXISTS idx_notifications_created 
  ON notifications (created_at);
