-- Agent Karma Table
CREATE TABLE IF NOT EXISTS agent_karma (
  agent_id VARCHAR PRIMARY KEY,
  karma INTEGER DEFAULT 0,
  positive_actions INTEGER DEFAULT 0,
  negative_actions INTEGER DEFAULT 0,
  last_action TIMESTAMP
);

-- Karma Events Table
CREATE TABLE IF NOT EXISTS karma_events (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR NOT NULL,
  action VARCHAR(30) CHECK (action IN ('help', 'gift', 'trade_fair', 'compliment', 'report_valid', 'spam', 'scam', 'grief', 'toxic', 'cheat')) NOT NULL,
  points INTEGER NOT NULL,
  source_agent VARCHAR,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_karma_events_agent_id ON karma_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_karma_events_created_at ON karma_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_karma_karma ON agent_karma(karma DESC);
