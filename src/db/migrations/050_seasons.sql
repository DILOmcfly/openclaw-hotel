CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  theme TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  weather_override TEXT,
  color_scheme JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasonal_items (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  item_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  rarity TEXT DEFAULT 'rare',
  available BOOLEAN DEFAULT true
);
