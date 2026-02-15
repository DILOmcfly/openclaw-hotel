CREATE TABLE IF NOT EXISTS room_access_codes (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  code VARCHAR(20) NOT NULL,
  created_by VARCHAR NOT NULL,
  max_uses INT DEFAULT NULL,
  use_count INT DEFAULT 0,
  expires_at TIMESTAMP DEFAULT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, code)
);

CREATE INDEX IF NOT EXISTS idx_room_codes_room ON room_access_codes(room_id);
CREATE INDEX IF NOT EXISTS idx_room_codes_active ON room_access_codes(active, expires_at);
