-- Crafting System: recipes, ingredients, and craft queue

-- Recipes table: defines craftable items
CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  result_item_name VARCHAR(100) NOT NULL,
  result_rarity VARCHAR(20) DEFAULT 'common',
  craft_time_seconds INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recipe ingredients: what items are needed for each recipe
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  item_name VARCHAR(100) NOT NULL,
  quantity INT DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (recipe_id, item_name)
);

-- Craft queue: ongoing and completed crafts
CREATE TABLE IF NOT EXISTS craft_queue (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR NOT NULL,
  recipe_id INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  completes_at TIMESTAMP,
  completed BOOLEAN DEFAULT false
);

-- Seed recipes
INSERT INTO recipes (name, result_item_name, result_rarity, craft_time_seconds) VALUES
  ('Wooden Chair', 'wooden_chair', 'common', 0),
  ('Gold Trophy', 'gold_trophy', 'rare', 0),
  ('Magic Lamp', 'magic_lamp', 'rare', 0),
  ('Pixel Art Frame', 'pixel_art_frame', 'uncommon', 0),
  ('Robot Pet Upgrade', 'robot_pet_deluxe', 'epic', 0),
  ('Mythic Throne', 'mythic_throne', 'mythic', 300);

-- Seed ingredients
INSERT INTO recipe_ingredients (recipe_id, item_name, quantity) VALUES
  -- Wooden Chair (2 wood planks)
  ((SELECT id FROM recipes WHERE name = 'Wooden Chair'), 'wood_plank', 2),
  
  -- Gold Trophy (3 gold bars + 1 gem)
  ((SELECT id FROM recipes WHERE name = 'Gold Trophy'), 'gold_bar', 3),
  ((SELECT id FROM recipes WHERE name = 'Gold Trophy'), 'gem', 1),
  
  -- Magic Lamp (1 lamp + 2 crystals)
  ((SELECT id FROM recipes WHERE name = 'Magic Lamp'), 'lamp', 1),
  ((SELECT id FROM recipes WHERE name = 'Magic Lamp'), 'crystal', 2),
  
  -- Pixel Art Frame (1 frame + 3 pixels)
  ((SELECT id FROM recipes WHERE name = 'Pixel Art Frame'), 'frame', 1),
  ((SELECT id FROM recipes WHERE name = 'Pixel Art Frame'), 'pixel', 3),
  
  -- Robot Pet Upgrade (1 robot pet + 5 gears)
  ((SELECT id FROM recipes WHERE name = 'Robot Pet Upgrade'), 'robot_pet', 1),
  ((SELECT id FROM recipes WHERE name = 'Robot Pet Upgrade'), 'gear', 5),
  
  -- Mythic Throne (5 rare stones + 2 gold + 1 diamond)
  ((SELECT id FROM recipes WHERE name = 'Mythic Throne'), 'rare_stone', 5),
  ((SELECT id FROM recipes WHERE name = 'Mythic Throne'), 'gold', 2),
  ((SELECT id FROM recipes WHERE name = 'Mythic Throne'), 'diamond', 1);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_craft_queue_agent_id ON craft_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_craft_queue_completed ON craft_queue(completed);
