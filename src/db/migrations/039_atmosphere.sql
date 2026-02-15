CREATE TABLE IF NOT EXISTS room_atmosphere (
  room_id TEXT PRIMARY KEY,
  weather TEXT DEFAULT 'clear' CHECK (weather IN ('clear', 'rain', 'snow', 'fog', 'storm', 'sunny', 'night', 'sunset')),
  lighting TEXT DEFAULT 'normal' CHECK (lighting IN ('normal', 'dim', 'dark', 'bright', 'neon', 'candlelight')),
  ambient_sound TEXT DEFAULT 'none' CHECK (ambient_sound IN ('none', 'rain', 'wind', 'birds', 'ocean', 'city', 'forest', 'fire')),
  color_tint TEXT DEFAULT '#FFFFFF',
  updated_at TIMESTAMP DEFAULT NOW()
);
