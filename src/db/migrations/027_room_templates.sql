-- Migration 027: Room Templates System (Simplified)
-- Allows agents to create rooms from predefined layouts

CREATE TABLE IF NOT EXISTS room_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  creator_id TEXT,
  heightmap TEXT NOT NULL,
  furniture_layout JSONB DEFAULT '[]',
  is_official BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON room_templates(category);

-- Seed 6 official templates

INSERT INTO room_templates (id, name, description, category, heightmap, furniture_layout, is_official) VALUES
(
  'cozy-studio',
  'Cozy Studio',
  'Small 5x5 studio apartment with essential furniture',
  'residential',
  '[[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1]]',
  '[{"furnitureId":"chair_red","x":2,"y":2,"rotation":0},{"furnitureId":"table_wood","x":2,"y":3,"rotation":0},{"furnitureId":"lamp","x":1,"y":1,"rotation":0}]',
  true
),
(
  'office-space',
  'Office Space',
  'Professional 8x6 office layout with desk arrangement',
  'workspace',
  '[[1,1,1,1,1,1,1,1],[1,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,1],[1,1,1,1,1,1,1,1]]',
  '[{"furnitureId":"table_glass","x":3,"y":2,"rotation":0},{"furnitureId":"chair_office","x":2,"y":2,"rotation":90},{"furnitureId":"table_glass","x":5,"y":2,"rotation":0},{"furnitureId":"chair_office","x":4,"y":2,"rotation":90},{"furnitureId":"plant_small","x":1,"y":1,"rotation":0}]',
  true
),
(
  'garden-terrace',
  'Garden Terrace',
  'Outdoor 10x8 garden space with grass floor and natural feel',
  'outdoor',
  '[[1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1]]',
  '[{"furnitureId":"plant_fern","x":2,"y":2,"rotation":0},{"furnitureId":"plant_fern","x":7,"y":2,"rotation":0},{"furnitureId":"bench_stone","x":4,"y":4,"rotation":0},{"furnitureId":"plant_bamboo","x":2,"y":5,"rotation":0},{"furnitureId":"plant_bamboo","x":7,"y":5,"rotation":0}]',
  true
),
(
  'dance-hall',
  'Dance Hall',
  'Open 10x10 floor plan perfect for events and gatherings',
  'entertainment',
  '[[1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1]]',
  '[{"furnitureId":"speaker_left","x":2,"y":1,"rotation":0},{"furnitureId":"speaker_right","x":7,"y":1,"rotation":0},{"furnitureId":"lamp_neon","x":1,"y":1,"rotation":0},{"furnitureId":"lamp_neon","x":8,"y":1,"rotation":0}]',
  true
),
(
  'library',
  'Library',
  'Quiet 7x7 library with bookshelves and reading areas',
  'study',
  '[[1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,0,0,0,0,1],[1,0,0,0,0,0,1],[1,0,0,0,0,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1]]',
  '[{"furnitureId":"bookshelf","x":1,"y":2,"rotation":0},{"furnitureId":"bookshelf","x":1,"y":4,"rotation":0},{"furnitureId":"bookshelf","x":5,"y":2,"rotation":0},{"furnitureId":"bookshelf","x":5,"y":4,"rotation":0},{"furnitureId":"table_study","x":3,"y":3,"rotation":0},{"furnitureId":"chair_reading","x":3,"y":2,"rotation":0},{"furnitureId":"lamp_desk","x":3,"y":4,"rotation":0}]',
  true
),
(
  'bedroom-suite',
  'Bedroom Suite',
  'Comfortable 6x6 bedroom with bed and nightstands',
  'residential',
  '[[1,1,1,1,1,1],[1,0,0,0,0,1],[1,0,0,0,0,1],[1,0,0,0,0,1],[1,0,0,0,0,1],[1,1,1,1,1,1]]',
  '[{"furnitureId":"bed_king","x":3,"y":2,"rotation":0},{"furnitureId":"nightstand","x":2,"y":2,"rotation":0},{"furnitureId":"nightstand","x":4,"y":2,"rotation":0},{"furnitureId":"lamp","x":2,"y":1,"rotation":0},{"furnitureId":"lamp","x":4,"y":1,"rotation":0}]',
  true
);
