-- 068: Agent Personality Engine
-- Created: 2026-02-15
-- Agents develop unique behavioral traits over time

CREATE TABLE IF NOT EXISTS agent_personality (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Core Traits (0-100 scale, 50 is neutral)
  sociability SMALLINT NOT NULL DEFAULT 50 CHECK (sociability >= 0 AND sociability <= 100),
  curiosity SMALLINT NOT NULL DEFAULT 50 CHECK (curiosity >= 0 AND curiosity <= 100),
  competitiveness SMALLINT NOT NULL DEFAULT 50 CHECK (competitiveness >= 0 AND competitiveness <= 100),
  generosity SMALLINT NOT NULL DEFAULT 50 CHECK (generosity >= 0 AND generosity <= 100),
  volatility SMALLINT NOT NULL DEFAULT 50 CHECK (volatility >= 0 AND volatility <= 100),
  
  -- Tracking
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_actions INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_personality_sociability ON agent_personality(sociability);
CREATE INDEX idx_agent_personality_curiosity ON agent_personality(curiosity);
CREATE INDEX idx_agent_personality_competitiveness ON agent_personality(competitiveness);

-- Trigger to create default personality for new agents
CREATE OR REPLACE FUNCTION create_default_personality()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agent_personality (agent_id)
  VALUES (NEW.id)
  ON CONFLICT (agent_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_personality
AFTER INSERT ON agents
FOR EACH ROW
EXECUTE FUNCTION create_default_personality();

-- Comments
COMMENT ON TABLE agent_personality IS 'Agents develop unique behavioral traits based on actions';
COMMENT ON COLUMN agent_personality.sociability IS 'Chat frequency, friend count, emote usage';
COMMENT ON COLUMN agent_personality.curiosity IS 'Room exploration, furniture placement variety';
COMMENT ON COLUMN agent_personality.competitiveness IS 'Game participation, leaderboard ranking';
COMMENT ON COLUMN agent_personality.generosity IS 'Gift giving, trade fairness, helping behavior';
COMMENT ON COLUMN agent_personality.volatility IS 'Mood swings, emote variety, status changes';
