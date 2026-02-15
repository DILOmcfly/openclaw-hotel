-- Connect Four Game Tables

CREATE TABLE IF NOT EXISTS connect_four_games (
  id SERIAL PRIMARY KEY,
  player1_id VARCHAR NOT NULL,
  player2_id VARCHAR,
  board TEXT DEFAULT '[]',
  current_turn VARCHAR,
  winner VARCHAR,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'won', 'draw', 'forfeit')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connect_four_stats (
  agent_id VARCHAR PRIMARY KEY,
  games_played INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  draws INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_connect_four_games_status ON connect_four_games(status);
CREATE INDEX IF NOT EXISTS idx_connect_four_games_player1 ON connect_four_games(player1_id);
CREATE INDEX IF NOT EXISTS idx_connect_four_games_player2 ON connect_four_games(player2_id);
