-- Crafting Recipes Table
CREATE TABLE IF NOT EXISTS crafting_recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  result_item TEXT NOT NULL,
  result_rarity TEXT DEFAULT 'uncommon',
  ingredients JSONB NOT NULL,
  craft_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed crafting recipes
INSERT INTO crafting_recipes (id, name, result_item, result_rarity, ingredients, craft_time_seconds) VALUES
('golden-chair', 'Golden Chair', 'chair', 'epic', '{"chair": 3, "coins": 100}', 0),
('crystal-lamp', 'Crystal Lamp', 'lamp', 'rare', '{"lamp": 2, "table": 1}', 0),
('royal-bed', 'Royal Bed', 'bed', 'epic', '{"bed": 2, "bookshelf": 1}', 0),
('magic-mirror', 'Magic Mirror', 'lamp', 'rare', '{"lamp": 3}', 0),
('grand-piano', 'Grand Piano', 'table', 'legendary', '{"table": 2, "chair": 2}', 0);
