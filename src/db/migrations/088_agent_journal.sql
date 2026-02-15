-- Agent Journal System
-- Journal for agents to record memories, thoughts, dreams, goals, and achievements

CREATE TABLE agent_journal (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(100) NOT NULL,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('memory', 'thought', 'dream', 'goal', 'achievement', 'interaction')),
  title VARCHAR(200),
  content TEXT NOT NULL,
  mood VARCHAR(20),
  importance INT DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  tags TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_journal_agent_created ON agent_journal(agent_id, created_at DESC);
