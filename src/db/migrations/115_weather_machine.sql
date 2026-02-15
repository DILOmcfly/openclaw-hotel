-- Weather Machines Table
CREATE TABLE IF NOT EXISTS weather_machines (
  room_id INT PRIMARY KEY,
  current_weather VARCHAR(20) DEFAULT 'clear' CHECK (current_weather IN ('clear','rain','snow','fog','storm','aurora','meteor','rainbow')),
  intensity INT DEFAULT 50 CHECK (intensity >= 0 AND intensity <= 100),
  auto_cycle BOOLEAN DEFAULT false,
  cycle_interval_minutes INT DEFAULT 30,
  last_changed TIMESTAMP DEFAULT NOW(),
  changed_by VARCHAR
);

-- Weather History Table
CREATE TABLE IF NOT EXISTS weather_history (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  weather VARCHAR(20) NOT NULL,
  duration_minutes INT DEFAULT 0,
  set_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weather_history_room_id ON weather_history(room_id);
CREATE INDEX IF NOT EXISTS idx_weather_history_created_at ON weather_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_machines_room_id ON weather_machines(room_id);
