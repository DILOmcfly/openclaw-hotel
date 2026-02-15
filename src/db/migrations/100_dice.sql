-- Dice Game
-- Single-player dice betting with configurable dice count and bet types

CREATE TABLE IF NOT EXISTS dice_games (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR NOT NULL,
  bet INT NOT NULL CHECK (bet >= 1),
  dice_count INT DEFAULT 2 CHECK (dice_count >= 1 AND dice_count <= 5),
  target_type VARCHAR(20) CHECK (target_type IN ('over', 'under', 'exact', 'even', 'odd')),
  target_value INT,
  roll_result TEXT DEFAULT '[]',
  total INT DEFAULT 0,
  won BOOLEAN DEFAULT false,
  payout INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dice_stats (
  agent_id VARCHAR PRIMARY KEY,
  games_played INT DEFAULT 0,
  wins INT DEFAULT 0,
  total_wagered INT DEFAULT 0,
  total_won INT DEFAULT 0,
  biggest_win INT DEFAULT 0
);

CREATE INDEX idx_dice_games_agent ON dice_games(agent_id);
CREATE INDEX idx_dice_games_created ON dice_games(created_at DESC);
