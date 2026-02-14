-- Bot System
CREATE TABLE IF NOT EXISTS bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    personality VARCHAR(32) NOT NULL,
    x INT DEFAULT 0,
    y INT DEFAULT 0,
    rotation INT DEFAULT 0,
    config JSONB DEFAULT '{}',
    spawned_at TIMESTAMPTZ DEFAULT NOW(),
    last_action_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bots_room ON bots(room_id);
CREATE INDEX IF NOT EXISTS idx_bots_personality ON bots(personality);
