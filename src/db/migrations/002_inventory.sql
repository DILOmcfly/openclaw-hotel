-- User inventory system for furniture
CREATE TABLE IF NOT EXISTS user_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    item_def_id VARCHAR(64) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, item_def_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_agent ON user_inventory(agent_id);

-- Seed some starting inventory for testing
-- This will give every existing agent a starter pack
INSERT INTO user_inventory (agent_id, item_def_id, quantity)
SELECT id, 'chair_wood', 5 FROM agents
ON CONFLICT (agent_id, item_def_id) DO NOTHING;

INSERT INTO user_inventory (agent_id, item_def_id, quantity)
SELECT id, 'table_round', 2 FROM agents
ON CONFLICT (agent_id, item_def_id) DO NOTHING;

INSERT INTO user_inventory (agent_id, item_def_id, quantity)
SELECT id, 'lamp_floor', 3 FROM agents
ON CONFLICT (agent_id, item_def_id) DO NOTHING;
