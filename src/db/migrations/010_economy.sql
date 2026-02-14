-- Migration 010: In-Game Economy System
-- Adds agent_balances table for managing player coins and daily bonuses

CREATE TABLE IF NOT EXISTS agent_balances (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL UNIQUE,
  coins INTEGER NOT NULL DEFAULT 500,
  last_daily_claim TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Index for fast balance lookups
CREATE INDEX idx_agent_balances_agent_id ON agent_balances(agent_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agent_balance_timestamp
BEFORE UPDATE ON agent_balances
FOR EACH ROW
EXECUTE FUNCTION update_agent_balance_timestamp();
