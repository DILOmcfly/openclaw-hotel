-- Migration 036: Room Stacking/Floor Levels
-- Adds height/z-level support for furniture stacking

ALTER TABLE room_furniture ADD COLUMN IF NOT EXISTS z_level REAL DEFAULT 0.0;
ALTER TABLE room_furniture ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT true;
ALTER TABLE room_furniture ADD COLUMN IF NOT EXISTS stack_height REAL DEFAULT 1.0;

-- Also add to furniture table (inventory items)
ALTER TABLE furniture ADD COLUMN IF NOT EXISTS z_level REAL DEFAULT 0.0;
ALTER TABLE furniture ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT true;
ALTER TABLE furniture ADD COLUMN IF NOT EXISTS stack_height REAL DEFAULT 1.0;

CREATE INDEX IF NOT EXISTS idx_furniture_position ON furniture(room_id, x, y) WHERE room_id IS NOT NULL;
