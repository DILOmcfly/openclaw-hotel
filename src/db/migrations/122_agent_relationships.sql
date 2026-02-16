-- Agent Relationships Table
-- Tracks social dynamics and affinity between agents

CREATE TABLE IF NOT EXISTS agent_relationships (
  id SERIAL PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  affinity INTEGER DEFAULT 0 CHECK (affinity BETWEEN -100 AND 100),
  interactions INTEGER DEFAULT 0,
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, target_agent_id),
  CHECK (agent_id != target_agent_id)
);

-- Index for fast lookups by agent
CREATE INDEX idx_relationships_agent ON agent_relationships(agent_id);

-- Index for finding friends/rivals
CREATE INDEX idx_relationships_affinity ON agent_relationships(agent_id, affinity);

-- Index for recent interactions
CREATE INDEX idx_relationships_last_interaction ON agent_relationships(last_interaction);

-- Comment for documentation
COMMENT ON TABLE agent_relationships IS 'Tracks social relationships and affinity between agents in the hotel';
COMMENT ON COLUMN agent_relationships.affinity IS 'Relationship strength: -100 (rivals) to +100 (best friends), 0 (neutral)';
COMMENT ON COLUMN agent_relationships.interactions IS 'Total number of interactions between these agents';
