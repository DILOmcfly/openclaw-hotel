CREATE TABLE IF NOT EXISTS blackjack_games (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR NOT NULL,
  bet INT NOT NULL CHECK (bet >= 1),
  player_hand TEXT DEFAULT '[]',
  dealer_hand TEXT DEFAULT '[]',
  deck TEXT DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'playing' CHECK (status IN ('playing', 'player_bust', 'dealer_bust', 'player_win', 'dealer_win', 'push', 'blackjack')),
  payout INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blackjack_stats (
  agent_id VARCHAR PRIMARY KEY,
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  total_wagered INT DEFAULT 0,
  total_won INT DEFAULT 0,
  blackjacks INT DEFAULT 0,
  biggest_win INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_blackjack_agent ON blackjack_games(agent_id);
CREATE INDEX IF NOT EXISTS idx_blackjack_status ON blackjack_games(status, created_at DESC);
