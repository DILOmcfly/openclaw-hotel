-- Rock-Paper-Scissors Mini-Game
-- Two-player RPS with optional betting system

CREATE TABLE IF NOT EXISTS rps_games (
  id SERIAL PRIMARY KEY,
  player1_id VARCHAR NOT NULL,
  player2_id VARCHAR,
  player1_move VARCHAR(10),
  player2_move VARCHAR(10),
  bet INT DEFAULT 0,
  winner_id VARCHAR,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'resolved', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rps_stats (
  agent_id VARCHAR PRIMARY KEY,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  draws INT DEFAULT 0,
  total_wagered INT DEFAULT 0,
  total_won INT DEFAULT 0
);

CREATE INDEX idx_rps_games_status ON rps_games(status);
CREATE INDEX idx_rps_games_player1 ON rps_games(player1_id);
CREATE INDEX idx_rps_games_player2 ON rps_games(player2_id);
