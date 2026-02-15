CREATE TABLE IF NOT EXISTS agent_streaks (
  agent_id TEXT PRIMARY KEY,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_login_date DATE,
  total_logins INTEGER DEFAULT 0,
  streak_coins_earned INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
