-- Migration 017: Room Templates System
-- Allows users to create rooms from pre-built templates

CREATE TABLE IF NOT EXISTS room_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('lounge', 'office', 'cafe', 'nightclub', 'garden', 'beach', 'library', 'penthouse', 'custom')),
  
  -- Room layout (heightmap format: array of rows, each row is array of tile heights 0-9)
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Furniture preset: array of {furnitureId, x, y, rotation}
  furniture_preset JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  thumbnail_url VARCHAR(255), -- Optional preview image
  is_premium BOOLEAN DEFAULT FALSE, -- Whether template requires premium/admin
  use_count INTEGER DEFAULT 0, -- Track popularity
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_room_templates_category ON room_templates(category);
CREATE INDEX idx_room_templates_premium ON room_templates(is_premium);
CREATE INDEX idx_room_templates_popularity ON room_templates(use_count DESC);

-- Insert pre-built templates

-- 1. Cozy Lounge (15x15, comfortable seating area)
INSERT INTO room_templates (name, description, category, layout, furniture_preset) VALUES (
  'Cozy Lounge',
  'A warm and inviting lounge with comfortable seating and ambient lighting',
  'lounge',
  -- 15x15 grid: perimeter walls (9), interior floor (1-2), small elevated area (3)
  '[[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,2,2,2,2,2,2,2,2,2,1,1,9],[9,1,1,2,2,2,2,2,2,2,2,2,1,1,9],[9,1,1,2,2,2,2,2,2,2,2,2,1,1,9],[9,1,1,2,2,2,3,3,3,2,2,2,1,1,9],[9,1,1,2,2,2,3,3,3,2,2,2,1,1,9],[9,1,1,2,2,2,3,3,3,2,2,2,1,1,9],[9,1,1,2,2,2,2,2,2,2,2,2,1,1,9],[9,1,1,2,2,2,2,2,2,2,2,2,1,1,9],[9,1,1,2,2,2,2,2,2,2,2,2,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]]'::jsonb,
  -- Furniture: chairs in circle, table in center, lamps in corners
  '[{"furnitureId":"chair_red","x":5,"y":5,"rotation":0},{"furnitureId":"chair_red","x":7,"y":5,"rotation":0},{"furnitureId":"chair_red","x":9,"y":5,"rotation":0},{"furnitureId":"chair_blue","x":5,"y":7,"rotation":90},{"furnitureId":"chair_blue","x":9,"y":7,"rotation":270},{"furnitureId":"table_wood","x":7,"y":7,"rotation":0},{"furnitureId":"lamp","x":3,"y":3,"rotation":0},{"furnitureId":"lamp","x":11,"y":3,"rotation":0},{"furnitureId":"plant_fern","x":3,"y":11,"rotation":0},{"furnitureId":"plant_fern","x":11,"y":11,"rotation":0}]'::jsonb
);

-- 2. Modern Office (20x15, desk area + meeting space)
INSERT INTO room_templates (name, description, category, layout, furniture_preset) VALUES (
  'Modern Office',
  'Professional workspace with desks, meeting area, and organized layout',
  'office',
  -- 20x15: open floor plan with perimeter walls
  '[[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,2,2,2,2,2,1,1,1,2,2,2,2,2,2,1,1,9],[9,1,1,2,2,2,2,2,1,1,1,2,2,2,2,2,2,1,1,9],[9,1,1,2,2,2,2,2,1,1,1,2,2,2,2,2,2,1,1,9],[9,1,1,2,2,2,2,2,1,1,1,2,2,2,2,2,2,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]]'::jsonb,
  '[{"furnitureId":"table_glass","x":4,"y":4,"rotation":0},{"furnitureId":"chair_office","x":3,"y":4,"rotation":90},{"furnitureId":"chair_office","x":5,"y":4,"rotation":270},{"furnitureId":"table_glass","x":4,"y":6,"rotation":0},{"furnitureId":"chair_office","x":3,"y":6,"rotation":90},{"furnitureId":"table_glass","x":13,"y":4,"rotation":0},{"furnitureId":"chair_office","x":12,"y":4,"rotation":90},{"furnitureId":"chair_office","x":14,"y":4,"rotation":270},{"furnitureId":"table_conference","x":9,"y":9,"rotation":0},{"furnitureId":"chair_red","x":7,"y":9,"rotation":90},{"furnitureId":"chair_red","x":11,"y":9,"rotation":270},{"furnitureId":"plant_small","x":2,"y":2,"rotation":0},{"furnitureId":"plant_small","x":17,"y":2,"rotation":0}]'::jsonb
);

-- 3. Cafe Corner (18x18, bar + seating)
INSERT INTO room_templates (name, description, category, layout, furniture_preset) VALUES (
  'Cafe Corner',
  'Cozy cafe with bar counter, tables, and relaxed atmosphere',
  'cafe',
  '[[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,2,2,2,2,2,2,2,1,1,1,1,1,1,1,9],[9,1,1,2,2,2,2,2,2,2,1,1,1,1,1,1,1,9],[9,1,1,2,2,2,2,2,2,2,1,1,3,3,3,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,3,3,3,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,3,3,3,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,3,3,1,1,1,3,3,1,1,1,1,1,9],[9,1,1,1,1,3,3,1,1,1,3,3,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,3,3,1,1,1,3,3,1,1,1,1,1,9],[9,1,1,1,1,3,3,1,1,1,3,3,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]]'::jsonb,
  '[{"furnitureId":"table_bar","x":4,"y":4,"rotation":0},{"furnitureId":"chair_bar","x":3,"y":4,"rotation":90},{"furnitureId":"chair_bar","x":3,"y":5,"rotation":90},{"furnitureId":"table_round","x":5,"y":10,"rotation":0},{"furnitureId":"chair_red","x":4,"y":10,"rotation":90},{"furnitureId":"chair_red","x":6,"y":10,"rotation":270},{"furnitureId":"table_round","x":10,"y":10,"rotation":0},{"furnitureId":"chair_blue","x":9,"y":10,"rotation":90},{"furnitureId":"chair_blue","x":11,"y":10,"rotation":270},{"furnitureId":"table_round","x":5,"y":13,"rotation":0},{"furnitureId":"table_round","x":10,"y":13,"rotation":0},{"furnitureId":"plant_large","x":13,"y":6,"rotation":0},{"furnitureId":"lamp","x":2,"y":2,"rotation":0}]'::jsonb
);

-- 4. Nightclub VIP (25x20, dance floor + VIP area)
INSERT INTO room_templates (name, description, category, layout, furniture_preset, is_premium) VALUES (
  'Nightclub VIP',
  'High-energy nightclub with dance floor, DJ booth, and exclusive VIP lounge',
  'nightclub',
  '[[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,4,4,4,4,4,4,4,4,4,4,4,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,4,4,4,4,4,4,4,4,4,4,4,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,4,4,4,4,4,4,4,4,4,4,4,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,4,4,4,4,4,4,4,4,4,4,4,1,1,1,1,5,5,5,5,1,1,9],[9,1,1,4,4,4,4,4,4,4,4,4,4,4,1,1,1,1,5,5,5,5,1,1,9],[9,1,1,4,4,4,4,4,4,4,4,4,4,4,1,1,1,1,5,5,5,5,1,1,9],[9,1,1,4,4,4,4,4,4,4,4,4,4,4,1,1,1,1,5,5,5,5,1,1,9],[9,1,1,4,4,4,4,4,4,4,4,4,4,4,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,4,4,4,4,4,4,4,4,4,4,4,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]]'::jsonb,
  '[{"furnitureId":"dj_booth","x":7,"y":16,"rotation":0},{"furnitureId":"speaker_left","x":4,"y":15,"rotation":0},{"furnitureId":"speaker_right","x":10,"y":15,"rotation":0},{"furnitureId":"couch_vip","x":19,"y":7,"rotation":0},{"furnitureId":"couch_vip","x":19,"y":9,"rotation":0},{"furnitureId":"table_glass","x":20,"y":8,"rotation":0},{"furnitureId":"lamp_neon","x":19,"y":6,"rotation":0},{"furnitureId":"lamp_neon","x":21,"y":6,"rotation":0},{"furnitureId":"bar_counter","x":15,"y":2,"rotation":0},{"furnitureId":"chair_bar","x":14,"y":2,"rotation":90}]'::jsonb,
  TRUE
);

-- 5. Zen Garden (20x20, peaceful outdoor space)
INSERT INTO room_templates (name, description, category, layout, furniture_preset) VALUES (
  'Zen Garden',
  'Tranquil outdoor garden with plants, water features, and natural elements',
  'garden',
  '[[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,9],[9,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,9],[9,1,2,2,1,1,1,1,1,1,1,1,1,1,1,2,2,2,1,9],[9,1,2,2,1,1,1,1,1,1,1,1,1,1,1,2,2,2,1,9],[9,1,2,2,1,1,0,0,0,0,0,0,0,1,1,2,2,2,1,9],[9,1,2,2,1,1,0,0,0,0,0,0,0,1,1,2,2,2,1,9],[9,1,2,2,1,1,0,0,0,0,0,0,0,1,1,2,2,2,1,9],[9,1,2,2,1,1,0,0,0,0,0,0,0,1,1,2,2,2,1,9],[9,1,2,2,1,1,0,0,0,0,0,0,0,1,1,2,2,2,1,9],[9,1,2,2,1,1,0,0,0,0,0,0,0,1,1,2,2,2,1,9],[9,1,2,2,1,1,0,0,0,0,0,0,0,1,1,2,2,2,1,9],[9,1,2,2,1,1,1,1,1,1,1,1,1,1,1,2,2,2,1,9],[9,1,2,2,1,1,1,1,1,1,1,1,1,1,1,2,2,2,1,9],[9,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,9],[9,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]]'::jsonb,
  '[{"furnitureId":"plant_bamboo","x":5,"y":5,"rotation":0},{"furnitureId":"plant_bamboo","x":14,"y":5,"rotation":0},{"furnitureId":"plant_fern","x":5,"y":14,"rotation":0},{"furnitureId":"plant_fern","x":14,"y":14,"rotation":0},{"furnitureId":"fountain","x":9,"y":9,"rotation":0},{"furnitureId":"bench_stone","x":7,"y":6,"rotation":0},{"furnitureId":"bench_stone","x":11,"y":6,"rotation":0},{"furnitureId":"lantern","x":6,"y":8,"rotation":0},{"furnitureId":"lantern","x":12,"y":8,"rotation":0},{"furnitureId":"plant_large","x":3,"y":3,"rotation":0},{"furnitureId":"plant_large","x":16,"y":3,"rotation":0},{"furnitureId":"rock_zen","x":8,"y":11,"rotation":0},{"furnitureId":"rock_zen","x":10,"y":11,"rotation":0}]'::jsonb
);

-- 6. Beach Paradise (22x18, sand + water)
INSERT INTO room_templates (name, description, category, layout, furniture_preset) VALUES (
  'Beach Paradise',
  'Tropical beach getaway with sand, water, and vacation vibes',
  'beach',
  '[[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9],[9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9],[9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9],[9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9],[9,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,9],[9,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,9],[9,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,9],[9,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]]'::jsonb,
  '[{"furnitureId":"beach_chair","x":12,"y":10,"rotation":0},{"furnitureId":"beach_chair","x":14,"y":10,"rotation":0},{"furnitureId":"beach_umbrella","x":13,"y":9,"rotation":0},{"furnitureId":"palm_tree","x":5,"y":9,"rotation":0},{"furnitureId":"palm_tree","x":18,"y":9,"rotation":0},{"furnitureId":"surfboard","x":3,"y":11,"rotation":0},{"furnitureId":"cooler","x":11,"y":12,"rotation":0},{"furnitureId":"beach_ball","x":16,"y":13,"rotation":0},{"furnitureId":"sand_castle","x":8,"y":14,"rotation":0}]'::jsonb
);

-- 7. Grand Library (20x25, bookshelves + reading areas)
INSERT INTO room_templates (name, description, category, layout, furniture_preset, is_premium) VALUES (
  'Grand Library',
  'Elegant library with towering bookshelves, reading nooks, and study areas',
  'library',
  '[[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,2,2,2,1,1,1,2,2,2,2,1,1,1,2,2,2,1,9],[9,1,2,2,2,1,1,1,2,2,2,2,1,1,1,2,2,2,1,9],[9,1,2,2,2,1,1,1,2,2,2,2,1,1,1,2,2,2,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,2,2,2,1,1,1,2,2,2,2,1,1,1,2,2,2,1,9],[9,1,2,2,2,1,1,1,2,2,2,2,1,1,1,2,2,2,1,9],[9,1,2,2,2,1,1,1,2,2,2,2,1,1,1,2,2,2,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,3,3,3,3,3,3,3,3,3,3,3,3,1,1,1,9],[9,1,1,1,3,3,3,3,3,3,3,3,3,3,3,3,1,1,1,9],[9,1,1,1,3,3,3,3,3,3,3,3,3,3,3,3,1,1,1,9],[9,1,1,1,3,3,3,3,3,3,3,3,3,3,3,3,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]]'::jsonb,
  '[{"furnitureId":"bookshelf","x":2,"y":2,"rotation":0},{"furnitureId":"bookshelf","x":3,"y":2,"rotation":0},{"furnitureId":"bookshelf","x":2,"y":7,"rotation":0},{"furnitureId":"bookshelf","x":3,"y":7,"rotation":0},{"furnitureId":"bookshelf","x":8,"y":2,"rotation":0},{"furnitureId":"bookshelf","x":9,"y":2,"rotation":0},{"furnitureId":"bookshelf","x":10,"y":2,"rotation":0},{"furnitureId":"bookshelf","x":8,"y":7,"rotation":0},{"furnitureId":"bookshelf","x":9,"y":7,"rotation":0},{"furnitureId":"bookshelf","x":10,"y":7,"rotation":0},{"furnitureId":"bookshelf","x":16,"y":2,"rotation":0},{"furnitureId":"bookshelf","x":17,"y":2,"rotation":0},{"furnitureId":"bookshelf","x":16,"y":7,"rotation":0},{"furnitureId":"bookshelf","x":17,"y":7,"rotation":0},{"furnitureId":"chair_reading","x":5,"y":13,"rotation":0},{"furnitureId":"lamp_desk","x":5,"y":12,"rotation":0},{"furnitureId":"table_study","x":10,"y":14,"rotation":0},{"furnitureId":"chair_office","x":9,"y":14,"rotation":90},{"furnitureId":"chair_office","x":11,"y":14,"rotation":270},{"furnitureId":"globe","x":14,"y":13,"rotation":0}]'::jsonb,
  TRUE
);

-- 8. Penthouse Suite (30x25, luxury apartment)
INSERT INTO room_templates (name, description, category, layout, furniture_preset, is_premium) VALUES (
  'Penthouse Suite',
  'Ultra-luxurious penthouse with living room, bedroom, and panoramic views',
  'penthouse',
  '[[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,4,4,4,4,4,4,4,4,4,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,4,4,4,4,4,4,4,4,4,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,4,4,4,4,4,4,4,4,4,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,4,4,4,4,4,4,4,4,4,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,4,4,4,4,4,4,4,4,4,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,4,4,4,4,4,4,4,4,4,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,4,4,4,4,4,4,4,4,4,1,1,9],[9,1,1,3,3,3,3,3,3,3,3,3,3,1,1,1,1,1,4,4,4,4,4,4,4,4,4,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,1,1,9],[9,1,1,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,1,1,9],[9,1,1,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,1,1,9],[9,1,1,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,1,1,9],[9,1,1,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,1,1,9],[9,1,1,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,1,1,9],[9,1,1,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9],[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]]'::jsonb,
  '[{"furnitureId":"couch_leather","x":5,"y":5,"rotation":0},{"furnitureId":"couch_leather","x":8,"y":5,"rotation":0},{"furnitureId":"table_coffee","x":6,"y":6,"rotation":0},{"furnitureId":"tv_flatscreen","x":6,"y":9,"rotation":180},{"furnitureId":"plant_large","x":3,"y":3,"rotation":0},{"furnitureId":"plant_large","x":11,"y":3,"rotation":0},{"furnitureId":"bed_king","x":22,"y":5,"rotation":0},{"furnitureId":"nightstand","x":20,"y":5,"rotation":0},{"furnitureId":"nightstand","x":25,"y":5,"rotation":0},{"furnitureId":"lamp_floor","x":20,"y":4,"rotation":0},{"furnitureId":"wardrobe","x":26,"y":8,"rotation":0},{"furnitureId":"table_dining","x":10,"y":15,"rotation":0},{"furnitureId":"chair_luxury","x":8,"y":15,"rotation":90},{"furnitureId":"chair_luxury","x":12,"y":15,"rotation":270},{"furnitureId":"chair_luxury","x":10,"y":13,"rotation":0},{"furnitureId":"chair_luxury","x":10,"y":17,"rotation":180},{"furnitureId":"bar_mini","x":20,"y":15,"rotation":0},{"furnitureId":"champagne_bucket","x":21,"y":15,"rotation":0},{"furnitureId":"chandelier","x":14,"y":15,"rotation":0},{"furnitureId":"piano_grand","x":24,"y":17,"rotation":0}]'::jsonb,
  TRUE
);
