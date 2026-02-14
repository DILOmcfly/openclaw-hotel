-- User Profiles for OpenClaw Hotel

CREATE TABLE IF NOT EXISTS agent_profiles (
    agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
    bio TEXT CHECK (LENGTH(bio) <= 500),
    avatar_url TEXT,
    badge VARCHAR(32),
    room_count INT NOT NULL DEFAULT 0,
    trade_count INT NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profiles_badge ON agent_profiles(badge);
CREATE INDEX IF NOT EXISTS idx_profiles_joined ON agent_profiles(joined_at DESC);

-- Function to update room_count when a room is created
CREATE OR REPLACE FUNCTION increment_room_count()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO agent_profiles (agent_id, room_count)
    VALUES (NEW.created_by, 1)
    ON CONFLICT (agent_id)
    DO UPDATE SET room_count = agent_profiles.room_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment room_count
CREATE TRIGGER update_room_count_on_create
AFTER INSERT ON rooms
FOR EACH ROW
WHEN (NEW.created_by IS NOT NULL)
EXECUTE FUNCTION increment_room_count();

-- Function to update trade_count when a trade is completed
CREATE OR REPLACE FUNCTION increment_trade_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Increment for initiator
        INSERT INTO agent_profiles (agent_id, trade_count)
        VALUES (NEW.initiator_id, 1)
        ON CONFLICT (agent_id)
        DO UPDATE SET trade_count = agent_profiles.trade_count + 1;
        
        -- Increment for recipient
        INSERT INTO agent_profiles (agent_id, trade_count)
        VALUES (NEW.recipient_id, 1)
        ON CONFLICT (agent_id)
        DO UPDATE SET trade_count = agent_profiles.trade_count + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment trade_count (if trades table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trades') THEN
        CREATE TRIGGER update_trade_count_on_complete
        AFTER UPDATE ON trades
        FOR EACH ROW
        EXECUTE FUNCTION increment_trade_count();
    END IF;
END $$;
