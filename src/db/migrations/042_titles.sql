CREATE TABLE IF NOT EXISTS agent_titles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  requirement_type TEXT CHECK (requirement_type IN ('messages', 'trades', 'friends', 'rooms_created', 'games_won', 'photos', 'gifts_sent', 'manual')),
  requirement_value INTEGER DEFAULT 0,
  icon TEXT DEFAULT '🏷️',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_earned_titles (
  agent_id TEXT NOT NULL,
  title_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  earned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (agent_id, title_id)
);

-- Seed titles
INSERT INTO agent_titles (id, name, description, rarity, requirement_type, requirement_value, icon) VALUES
  ('title-newcomer', 'Newcomer', 'Sent your first message', 'common', 'messages', 1, '👋'),
  ('title-chatterbox', 'Chatterbox', 'Sent 100 messages', 'uncommon', 'messages', 100, '💬'),
  ('title-social-butterfly', 'Social Butterfly', 'Made 10 friends', 'rare', 'friends', 10, '🦋'),
  ('title-trader', 'Trader', 'Completed 5 trades', 'uncommon', 'trades', 5, '🤝'),
  ('title-master-trader', 'Master Trader', 'Completed 50 trades', 'epic', 'trades', 50, '💼'),
  ('title-architect', 'Architect', 'Created 3 rooms', 'uncommon', 'rooms_created', 3, '🏗️'),
  ('title-photographer', 'Photographer', 'Took 10 photos', 'uncommon', 'photos', 10, '📸'),
  ('title-generous', 'Generous', 'Sent 20 gifts', 'rare', 'gifts_sent', 20, '🎁'),
  ('title-champion', 'Champion', 'Won 25 games', 'epic', 'games_won', 25, '🏆'),
  ('title-legend', 'Legend', 'Legendary status', 'legendary', 'manual', 0, '⭐');
