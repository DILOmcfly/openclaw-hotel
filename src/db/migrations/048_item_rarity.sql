-- Migration 048: Item Rarity & Collectibility System
-- Create furniture definitions table and add rarity system

CREATE TABLE IF NOT EXISTS furniture (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  width INTEGER DEFAULT 1,
  depth INTEGER DEFAULT 1,
  height REAL DEFAULT 1.0,
  can_sit BOOLEAN DEFAULT false,
  walkable BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE furniture ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'));
ALTER TABLE furniture ADD COLUMN IF NOT EXISTS tradeable BOOLEAN DEFAULT true;
ALTER TABLE furniture ADD COLUMN IF NOT EXISTS max_per_agent INTEGER DEFAULT 99;
ALTER TABLE furniture ADD COLUMN IF NOT EXISTS release_date TIMESTAMP DEFAULT NOW();
ALTER TABLE furniture ADD COLUMN IF NOT EXISTS retired BOOLEAN DEFAULT false;

-- Seed existing catalog items with rarities
INSERT INTO furniture (id, name, width, depth, height, can_sit, walkable, rarity, tradeable) VALUES
  ('chair_wood', 'Wooden Chair', 1, 1, 1.0, true, false, 'common', true),
  ('table_round', 'Round Table', 2, 2, 0.8, false, false, 'common', true),
  ('lamp_floor', 'Floor Lamp', 1, 1, 1.5, false, false, 'uncommon', true),
  ('plant_pot', 'Potted Plant', 1, 1, 0.5, false, false, 'common', true),
  ('bookshelf', 'Bookshelf', 2, 1, 2.0, false, false, 'rare', true),
  ('sofa_2seat', 'Two-Seat Sofa', 2, 1, 0.8, true, false, 'uncommon', true),
  ('rug_small', 'Small Rug', 2, 2, 0.01, false, true, 'common', true),
  ('tv_screen', 'TV Screen', 2, 1, 1.2, false, false, 'epic', true),
  ('desk_office', 'Office Desk', 2, 1, 0.8, false, false, 'uncommon', true),
  ('bed_single', 'Single Bed', 1, 2, 0.6, true, false, 'rare', true)
ON CONFLICT (id) DO UPDATE SET
  width = EXCLUDED.width,
  depth = EXCLUDED.depth,
  height = EXCLUDED.height,
  can_sit = EXCLUDED.can_sit,
  walkable = EXCLUDED.walkable;

CREATE INDEX IF NOT EXISTS idx_furniture_rarity ON furniture(rarity) WHERE retired = false;
CREATE INDEX IF NOT EXISTS idx_furniture_tradeable ON furniture(tradeable) WHERE retired = false;
