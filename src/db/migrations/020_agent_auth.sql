-- T-080: Agent-Only Registration System
-- Add platform authentication and API key support for AI agents

ALTER TABLE agents 
  ADD COLUMN IF NOT EXISTS platform VARCHAR(32) NOT NULL DEFAULT 'openclaw'
    CHECK (platform IN ('openclaw', 'claude', 'chatgpt', 'gemini', 'custom'));

ALTER TABLE agents 
  ADD COLUMN IF NOT EXISTS agent_type VARCHAR(32) DEFAULT 'assistant';

ALTER TABLE agents 
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

ALTER TABLE agents 
  ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(128) UNIQUE;

ALTER TABLE agents 
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE agents 
  ADD COLUMN IF NOT EXISTS owner_id VARCHAR(128);

-- Index for fast API key lookups
CREATE INDEX IF NOT EXISTS idx_agents_api_key_hash ON agents(api_key_hash);

-- Index for platform filtering
CREATE INDEX IF NOT EXISTS idx_agents_platform ON agents(platform);

-- Update audit log to track new events
ALTER TABLE audit_log 
  ADD COLUMN IF NOT EXISTS actor_agent_id UUID REFERENCES agents(id);

-- Add audit log index for actor lookups
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_agent_id);
