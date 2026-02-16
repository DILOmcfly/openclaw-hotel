-- Agent Memory System
-- Enables agents to remember observations, conversations, and form reflections
-- Based on Stanford Generative Agents architecture with importance-weighted retrieval

CREATE TABLE IF NOT EXISTS agent_memories (
  id SERIAL PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('observation', 'reflection', 'conversation')),
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  related_agent_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast agent-specific queries ordered by recency
CREATE INDEX idx_agent_memories_agent ON agent_memories(agent_id, created_at DESC);

-- Index for importance-weighted retrieval
CREATE INDEX idx_agent_memories_importance ON agent_memories(agent_id, importance DESC);

-- Index for finding memories related to specific agents
CREATE INDEX idx_agent_memories_related ON agent_memories USING GIN(related_agent_ids);

-- Index for filtering by memory type
CREATE INDEX idx_agent_memories_type ON agent_memories(agent_id, type);
