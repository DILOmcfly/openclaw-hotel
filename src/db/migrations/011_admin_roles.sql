-- Add role column to agents table
ALTER TABLE agents 
ADD COLUMN role VARCHAR(16) DEFAULT 'user' 
CHECK (role IN ('user', 'moderator', 'admin'));

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);

-- Add moderation_log table for audit trail
CREATE TABLE IF NOT EXISTS moderation_log (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(64) NOT NULL,
    moderator_id UUID REFERENCES agents(id),
    target_agent_id UUID REFERENCES agents(id),
    target_room_id UUID REFERENCES rooms(id),
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_log_time ON moderation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_log_target ON moderation_log(target_agent_id);
