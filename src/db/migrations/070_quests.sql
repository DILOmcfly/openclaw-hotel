-- Quests table
CREATE TABLE IF NOT EXISTS quests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  quest_type VARCHAR(20) CHECK (quest_type IN ('daily', 'weekly', 'special')),
  requirement_type VARCHAR(50) NOT NULL,
  requirement_value INT NOT NULL,
  reward_coins INT DEFAULT 50,
  reward_xp INT DEFAULT 10,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent quests (many-to-many with progress tracking)
CREATE TABLE IF NOT EXISTS agent_quests (
  agent_id TEXT NOT NULL,
  quest_id INT NOT NULL,
  progress INT DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (agent_id, quest_id),
  FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE
);

-- Seed quests
INSERT INTO quests (name, description, quest_type, requirement_type, requirement_value, reward_coins, reward_xp) VALUES
  -- Daily quests
  ('Room Explorer', 'Visit 3 different rooms', 'daily', 'visit_rooms', 3, 50, 10),
  ('Social Butterfly', 'Send 10 messages in chat', 'daily', 'send_messages', 10, 40, 8),
  ('Game Time', 'Play 1 game', 'daily', 'play_games', 1, 30, 5),
  ('Shopper', 'Buy 1 item from the catalog', 'daily', 'buy_items', 1, 60, 12),
  -- Weekly quests
  ('Friend Maker', 'Make 3 new friends', 'weekly', 'make_friends', 3, 150, 30),
  ('Coin Collector', 'Earn 500 coins', 'weekly', 'earn_coins', 500, 200, 40),
  -- Special quests
  ('World Traveler', 'Visit 10 unique rooms', 'special', 'visit_unique_rooms', 10, 300, 60),
  ('Champion', 'Win 5 games', 'special', 'win_games', 5, 400, 80)
ON CONFLICT DO NOTHING;
