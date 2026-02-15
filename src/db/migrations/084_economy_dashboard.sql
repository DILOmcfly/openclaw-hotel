-- Migration 084: Economy Dashboard
-- Adds economy_snapshots table for aggregate economy statistics

CREATE TABLE IF NOT EXISTS economy_snapshots (
  id SERIAL PRIMARY KEY,
  total_coins_circulation BIGINT DEFAULT 0,
  total_transactions INT DEFAULT 0,
  avg_agent_balance INT DEFAULT 0,
  richest_agent_balance INT DEFAULT 0,
  poorest_agent_balance INT DEFAULT 0,
  gini_coefficient FLOAT DEFAULT 0,
  snapshot_date DATE NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast date-based queries
CREATE INDEX IF NOT EXISTS idx_economy_snapshots_date ON economy_snapshots(snapshot_date DESC);
