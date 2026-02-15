-- Agent Whisper/DM System
-- Private messaging between agents with blocking functionality

CREATE TABLE IF NOT EXISTS whispers (
  id SERIAL PRIMARY KEY,
  sender_id VARCHAR(255) NOT NULL,
  receiver_id VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  deleted_by_sender BOOLEAN DEFAULT false,
  deleted_by_receiver BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_whispers_sender ON whispers(sender_id, created_at DESC);
CREATE INDEX idx_whispers_receiver ON whispers(receiver_id, created_at DESC);
CREATE INDEX idx_whispers_conversation ON whispers(sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_whispers_unread ON whispers(receiver_id, read) WHERE read = false;

CREATE TABLE IF NOT EXISTS blocked_agents (
  blocker_id VARCHAR(255) NOT NULL,
  blocked_id VARCHAR(255) NOT NULL,
  reason VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX idx_blocked_agents_blocker ON blocked_agents(blocker_id);
CREATE INDEX idx_blocked_agents_blocked ON blocked_agents(blocked_id);
