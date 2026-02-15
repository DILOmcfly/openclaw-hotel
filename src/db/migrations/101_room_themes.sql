-- Room Themes & Decoration Packs System
-- Apply coordinated visual settings to rooms with pre-designed themes

CREATE TABLE IF NOT EXISTS room_themes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(30) CHECK (category IN ('nature','urban','fantasy','scifi','holiday','retro','luxury','horror')),
  floor_pattern VARCHAR(50),
  wall_color VARCHAR(7),
  ambient_sound VARCHAR(50),
  weather VARCHAR(20),
  lighting VARCHAR(20),
  furniture_list TEXT DEFAULT '[]',
  price INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_room_themes_category ON room_themes(category);
CREATE INDEX idx_room_themes_price ON room_themes(price);

CREATE TABLE IF NOT EXISTS applied_themes (
  room_id INT PRIMARY KEY,
  theme_id INT NOT NULL REFERENCES room_themes(id) ON DELETE CASCADE,
  applied_by VARCHAR(255),
  applied_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_applied_themes_theme ON applied_themes(theme_id);
CREATE INDEX idx_applied_themes_by ON applied_themes(applied_by);

-- Seed 8 themed decoration packs
INSERT INTO room_themes (name, description, category, floor_pattern, wall_color, ambient_sound, weather, lighting, furniture_list, price) VALUES
  ('Forest Cabin', 'Cozy woodland retreat with natural wood and greenery', 'nature', 'wood_planks', '#8B7355', 'forest_birds', 'clear', 'warm', '["pine_table","log_chair","campfire","deer_trophy"]', 500),
  ('Beach Resort', 'Tropical paradise with sand and ocean vibes', 'nature', 'sand', '#87CEEB', 'ocean_waves', 'sunny', 'bright', '["palm_tree","beach_chair","surfboard","tiki_bar"]', 600),
  ('Space Station', 'Futuristic orbital habitat with zero-g aesthetics', 'scifi', 'metal_grid', '#1C1C2E', 'space_hum', 'none', 'neon', '["hologram_console","cryo_pod","star_map","astronaut_suit"]', 800),
  ('Medieval Castle', 'Grand stone fortress fit for royalty', 'fantasy', 'stone_tiles', '#4A4A4A', 'castle_echo', 'cloudy', 'candlelight', '["throne","suit_of_armor","banner","round_table"]', 750),
  ('Neon City', 'Cyberpunk urban landscape with electric flair', 'urban', 'concrete', '#FF00FF', 'city_traffic', 'rain', 'neon', '["vending_machine","hologram_ad","neon_sign","cyber_bike"]', 700),
  ('Winter Wonderland', 'Snowy festive scene with holiday cheer', 'holiday', 'snow', '#E0F7FF', 'wind_bells', 'snow', 'cool', '["christmas_tree","ice_sculpture","fireplace","snowman"]', 650),
  ('Haunted Manor', 'Spooky Victorian mansion with ghostly inhabitants', 'horror', 'creaky_wood', '#2B1B17', 'ghost_whispers', 'fog', 'dim', '["coffin","cobweb_chandelier","skeleton","creepy_portrait"]', 900),
  ('Luxury Penthouse', 'High-end modern apartment with premium finishes', 'luxury', 'marble', '#F5F5DC', 'jazz_lounge', 'clear', 'spotlight', '["grand_piano","champagne_bar","modern_sofa","crystal_chandelier"]', 1000);
