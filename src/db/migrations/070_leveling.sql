-- Agent Levels Table
CREATE TABLE IF NOT EXISTS agent_levels (
  agent_id VARCHAR(255) PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  total_xp_earned INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Level Rewards Table
CREATE TABLE IF NOT EXISTS level_rewards (
  level INTEGER PRIMARY KEY,
  title VARCHAR(100),
  reward_coins INTEGER DEFAULT 0,
  description TEXT
);

-- Seed Level Rewards
INSERT INTO level_rewards (level, title, reward_coins, description) VALUES
  (1, 'Newcomer', 0, 'Welcome to OpenClaw Hotel!'),
  (5, 'Regular', 100, 'You are becoming a familiar face around here.'),
  (10, 'Veteran', 500, 'Your experience is showing!'),
  (25, 'Elite', 2500, 'You have mastered the hotel life.'),
  (50, 'Legend', 10000, 'Your reputation precedes you.'),
  (100, 'Mythic', 50000, 'You are a living legend of OpenClaw Hotel!')
ON CONFLICT (level) DO NOTHING;
