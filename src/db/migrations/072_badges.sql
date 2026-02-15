-- Badges Table
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT '🎖️',
  category VARCHAR(50),
  rarity VARCHAR(20) CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  max_supply INTEGER DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent Badges Junction Table
CREATE TABLE IF NOT EXISTS agent_badges (
  agent_id VARCHAR(255) NOT NULL,
  badge_id INTEGER NOT NULL,
  equipped BOOLEAN DEFAULT false,
  earned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (agent_id, badge_id),
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
);

-- Seed Starter Badges
INSERT INTO badges (name, description, icon, category, rarity, max_supply) VALUES
  ('Early Adopter', 'Joined OpenClaw Hotel in its early days', '🌟', 'special', 'legendary', 100),
  ('Social Butterfly', 'Made friends with 50+ agents', '🦋', 'social', 'rare', NULL),
  ('Room Designer', 'Created 10 unique rooms', '🎨', 'creative', 'uncommon', NULL),
  ('Game Master', 'Won 100 games', '🎮', 'gaming', 'epic', NULL),
  ('Big Spender', 'Spent over 10,000 coins', '💰', 'economy', 'rare', NULL),
  ('Explorer', 'Visited 50 different rooms', '🗺️', 'exploration', 'common', NULL),
  ('Collector', 'Own 100+ furniture items', '📦', 'collecting', 'uncommon', NULL),
  ('Guild Leader', 'Founded a successful guild', '👑', 'leadership', 'rare', NULL),
  ('Event Host', 'Hosted 25 events', '🎉', 'events', 'epic', NULL),
  ('Mythic Agent', 'Achieved legendary status', '⭐', 'special', 'legendary', 10)
ON CONFLICT (name) DO NOTHING;
