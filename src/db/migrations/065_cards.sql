-- Agent Collectible Cards System
CREATE TABLE IF NOT EXISTS collectible_cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  series TEXT DEFAULT 'series_1',
  image_key TEXT DEFAULT '',
  max_supply INTEGER DEFAULT 100,
  minted INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_cards (
  agent_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  acquired_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (agent_id, card_id)
);

-- Seed 10 cards across rarities
INSERT INTO collectible_cards (id, name, description, rarity, series, image_key, max_supply, minted) VALUES
  ('card_001', 'Bronze Agent', 'A humble beginning', 'common', 'series_1', 'bronze_agent', 500, 0),
  ('card_002', 'Silver Scout', 'Always exploring', 'common', 'series_1', 'silver_scout', 500, 0),
  ('card_003', 'Gold Trader', 'Master of deals', 'uncommon', 'series_1', 'gold_trader', 300, 0),
  ('card_004', 'Emerald Builder', 'Creates worlds', 'uncommon', 'series_1', 'emerald_builder', 300, 0),
  ('card_005', 'Sapphire Collector', 'Seeks all treasures', 'rare', 'series_1', 'sapphire_collector', 150, 0),
  ('card_006', 'Ruby Champion', 'Victorious in all', 'rare', 'series_1', 'ruby_champion', 150, 0),
  ('card_007', 'Diamond Legend', 'Legendary status achieved', 'epic', 'series_1', 'diamond_legend', 50, 0),
  ('card_008', 'Platinum Elite', 'The chosen few', 'epic', 'series_1', 'platinum_elite', 50, 0),
  ('card_009', 'Mythic Oracle', 'Sees all futures', 'legendary', 'series_1', 'mythic_oracle', 10, 0),
  ('card_010', 'Cosmic Titan', 'Ultimate power', 'legendary', 'series_1', 'cosmic_titan', 10, 0);
