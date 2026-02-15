CREATE TABLE IF NOT EXISTS agent_relationships (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('rival', 'partner', 'mentor', 'mentee', 'blocked')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, target_id, relationship_type)
);

CREATE INDEX idx_relationships_agent ON agent_relationships(agent_id);
CREATE INDEX idx_relationships_target ON agent_relationships(target_id);
