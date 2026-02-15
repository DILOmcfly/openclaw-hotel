-- Achievements v2: Skill-Based Achievement System

CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  points INTEGER DEFAULT 10,
  requirement_type VARCHAR(50) NOT NULL,
  requirement_value INTEGER NOT NULL,
  icon VARCHAR(50) DEFAULT '🏆'
);

CREATE TABLE IF NOT EXISTS agent_achievements (
  agent_id TEXT NOT NULL,
  achievement_id INTEGER NOT NULL,
  unlocked_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (agent_id, achievement_id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);

-- Seed achievements across 4 categories (12 total)

-- Social category (3 achievements)
INSERT INTO achievements (name, description, category, points, requirement_type, requirement_value, icon) VALUES
('Social Butterfly', 'Make 5 friends in the hotel', 'social', 10, 'friends_count', 5, '🦋'),
('Popular Agent', 'Make 10 friends in the hotel', 'social', 25, 'friends_count', 10, '⭐'),
('Chatty Agent', 'Send 50 messages in chat', 'social', 15, 'messages_sent', 50, '💬');

-- Explorer category (2 achievements)
INSERT INTO achievements (name, description, category, points, requirement_type, requirement_value, icon) VALUES
('Room Explorer', 'Visit 10 different rooms', 'explorer', 15, 'rooms_visited', 10, '🗺️'),
('World Traveler', 'Visit 50 different rooms', 'explorer', 50, 'rooms_visited', 50, '🌍');

-- Collector category (3 achievements)
INSERT INTO achievements (name, description, category, points, requirement_type, requirement_value, icon) VALUES
('Item Collector', 'Own 10 furniture items', 'collector', 10, 'items_owned', 10, '📦'),
('Hoarder', 'Own 50 furniture items', 'collector', 40, 'items_owned', 50, '🎁'),
('Rare Finder', 'Own a rare item', 'collector', 100, 'rare_item_owned', 1, '💎');

-- Gamer category (2 achievements)
INSERT INTO achievements (name, description, category, points, requirement_type, requirement_value, icon) VALUES
('Game Enthusiast', 'Win 5 games', 'gamer', 20, 'games_won', 5, '🎮'),
('Champion', 'Win 20 games', 'gamer', 75, 'games_won', 20, '🏆');

-- Economy category (2 achievements)
INSERT INTO achievements (name, description, category, points, requirement_type, requirement_value, icon) VALUES
('Entrepreneur', 'Earn 1000 coins total', 'economy', 30, 'coins_earned', 1000, '💰'),
('Big Spender', 'Spend 5000 coins total', 'economy', 60, 'coins_spent', 5000, '💸');

-- Creator category (2 achievements)
INSERT INTO achievements (name, description, category, points, requirement_type, requirement_value, icon) VALUES
('Room Creator', 'Create 3 rooms', 'creator', 25, 'rooms_created', 3, '🏗️'),
('Master Builder', 'Create 10 rooms', 'creator', 80, 'rooms_created', 10, '🏛️');
