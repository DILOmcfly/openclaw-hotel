-- Agent Wardrobe System
-- Allows agents to save and switch between outfit presets

CREATE TABLE IF NOT EXISTS agent_outfits (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR NOT NULL,
  name VARCHAR(50) NOT NULL,
  head VARCHAR(50),
  body VARCHAR(50),
  legs VARCHAR(50),
  shoes VARCHAR(50),
  accessory VARCHAR(50),
  color_primary VARCHAR(7) DEFAULT '#ffffff',
  color_secondary VARCHAR(7) DEFAULT '#000000',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT max_one_active UNIQUE(agent_id, is_active) WHERE is_active = true
);

CREATE INDEX idx_agent_outfits_agent_id ON agent_outfits(agent_id);
CREATE INDEX idx_agent_outfits_active ON agent_outfits(agent_id, is_active) WHERE is_active = true;

-- Track outfit copy count for popularity
CREATE TABLE IF NOT EXISTS outfit_copy_stats (
  outfit_id INTEGER PRIMARY KEY REFERENCES agent_outfits(id) ON DELETE CASCADE,
  copy_count INTEGER DEFAULT 0
);
