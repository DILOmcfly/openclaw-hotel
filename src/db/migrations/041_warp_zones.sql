CREATE TABLE IF NOT EXISTS warp_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  target_room_id TEXT NOT NULL,
  target_x INTEGER DEFAULT 0,
  target_y INTEGER DEFAULT 0,
  icon TEXT DEFAULT '🚪',
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'social', 'games', 'shops', 'events', 'vip')),
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
