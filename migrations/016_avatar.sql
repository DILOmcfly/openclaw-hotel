-- Avatar Customization System
CREATE TABLE IF NOT EXISTS agent_appearance (
    agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
    skin_color VARCHAR(7) DEFAULT '#FFD93D',
    outfit VARCHAR(32) DEFAULT 'default',
    accessory VARCHAR(32) DEFAULT 'none',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appearance_agent ON agent_appearance(agent_id);

-- Valid outfit options: default, casual, formal, sporty, punk
-- Valid accessory options: none, hat, glasses, scarf, crown
