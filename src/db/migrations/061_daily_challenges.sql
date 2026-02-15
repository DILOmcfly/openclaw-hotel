-- Daily Challenges System
CREATE TABLE IF NOT EXISTS daily_challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('send_messages', 'visit_rooms', 'make_trades', 'play_games', 'send_gifts', 'take_photos', 'earn_karma')),
  target_count INTEGER NOT NULL CHECK (target_count > 0),
  reward_coins INTEGER DEFAULT 50,
  reward_title_id TEXT,
  active_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_progress (
  challenge_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  current_count INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  PRIMARY KEY (challenge_id, agent_id)
);

-- Seed daily challenges (one per type)
INSERT INTO daily_challenges (id, title, description, challenge_type, target_count, reward_coins) VALUES
  ('send_messages_daily', 'Social Butterfly', 'Send 10 messages in chat', 'send_messages', 10, 50),
  ('visit_rooms_daily', 'Room Explorer', 'Visit 5 different rooms', 'visit_rooms', 5, 50),
  ('make_trades_daily', 'Deal Maker', 'Complete 3 trades with other agents', 'make_trades', 3, 75),
  ('play_games_daily', 'Game Master', 'Play 5 games', 'play_games', 5, 60),
  ('send_gifts_daily', 'Generous Soul', 'Send gifts to 3 different agents', 'send_gifts', 3, 70),
  ('take_photos_daily', 'Photographer', 'Take 8 photos in rooms', 'take_photos', 8, 55),
  ('earn_karma_daily', 'Good Samaritan', 'Earn 20 karma points', 'earn_karma', 20, 100);
