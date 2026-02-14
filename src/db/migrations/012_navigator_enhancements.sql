-- T-063: Navigator Enhancement
-- Adds categories, tags, favorites, and visit tracking

-- Add category column to rooms with CHECK constraint
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS category VARCHAR(32) DEFAULT 'public' 
  CHECK (category IN ('public', 'official', 'roleplay', 'games', 'trading', 'hangout', 'custom'));

-- Create room tags table (many-to-many)
CREATE TABLE IF NOT EXISTS room_tags (
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    tag VARCHAR(32) NOT NULL,
    PRIMARY KEY (room_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_room_tags_tag ON room_tags(tag);

-- Create room favorites table
CREATE TABLE IF NOT EXISTS room_favorites (
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    favorited_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (agent_id, room_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_agent ON room_favorites(agent_id);

-- Create room visits table (for "recent rooms" feature)
CREATE TABLE IF NOT EXISTS room_visits (
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    last_visited_at TIMESTAMPTZ DEFAULT NOW(),
    visit_count INT DEFAULT 1,
    PRIMARY KEY (agent_id, room_id)
);
CREATE INDEX IF NOT EXISTS idx_visits_agent_time ON room_visits(agent_id, last_visited_at DESC);

-- Update existing rooms to have default category
UPDATE rooms SET category = 'public' WHERE category IS NULL;

-- Add some default categories (via metadata)
COMMENT ON COLUMN rooms.category IS 'Categories: public, official, roleplay, games, trading, hangout, custom';
