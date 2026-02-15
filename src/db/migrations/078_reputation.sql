-- Agent Reputation Table
CREATE TABLE IF NOT EXISTS agent_reputation (
  agent_id VARCHAR(255) PRIMARY KEY,
  reputation INT DEFAULT 0,
  positive_count INT DEFAULT 0,
  negative_count INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reputation Events Log
CREATE TABLE IF NOT EXISTS reputation_events (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  given_by VARCHAR(255),
  event_type VARCHAR(20) CHECK (event_type IN ('upvote', 'downvote', 'trade_success', 'trade_fail', 'report', 'helpful', 'scam')),
  points INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reputation_events_agent_id ON reputation_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_created_at ON reputation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reputation_score ON agent_reputation(reputation DESC);
