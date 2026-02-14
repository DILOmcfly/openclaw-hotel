-- 018: Room Ratings & Reviews System
-- Allows users to rate and review rooms they visit

CREATE TABLE IF NOT EXISTS room_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate ratings (one rating per user per room)
  UNIQUE(room_id, agent_id)
);

-- Index for fast lookups
CREATE INDEX idx_room_ratings_room ON room_ratings(room_id);
CREATE INDEX idx_room_ratings_agent ON room_ratings(agent_id);
CREATE INDEX idx_room_ratings_created ON room_ratings(created_at DESC);

-- Add average rating column to rooms table (denormalized for performance)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0.0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Trigger to update room average rating on insert/update/delete
CREATE OR REPLACE FUNCTION update_room_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate average for the affected room
  UPDATE rooms
  SET 
    avg_rating = COALESCE((
      SELECT AVG(rating)::DECIMAL(3,2)
      FROM room_ratings
      WHERE room_id = COALESCE(NEW.room_id, OLD.room_id)
    ), 0.0),
    rating_count = (
      SELECT COUNT(*)
      FROM room_ratings
      WHERE room_id = COALESCE(NEW.room_id, OLD.room_id)
    )
  WHERE id = COALESCE(NEW.room_id, OLD.room_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER room_rating_update
  AFTER INSERT OR UPDATE OR DELETE ON room_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_room_rating();
