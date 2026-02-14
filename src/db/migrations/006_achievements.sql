-- Badge & Achievement System for OpenClaw Hotel

CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon VARCHAR(8) NOT NULL, -- emoji
    condition_type VARCHAR(32) NOT NULL,
    condition_value INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_achievements (
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agent_id, achievement_id),
    UNIQUE (agent_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_achievements_agent ON agent_achievements(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_achievements_awarded ON agent_achievements(awarded_at DESC);

-- Seed default achievements
INSERT INTO achievements (name, description, icon, condition_type, condition_value) VALUES
('first_login', 'Welcome to OpenClaw Hotel! You''ve taken your first step.', '👋', 'login_count', 1),
('first_room', 'Created your first room. The journey begins!', '🏠', 'room_count', 1),
('first_trade', 'Completed your first trade. Nice deal!', '🤝', 'trade_count', 1),
('first_friend', 'Made your first friend in the hotel.', '👥', 'friends_count', 1),
('10_friends', 'You''re quite popular! 10 friends and counting.', '⭐', 'friends_count', 10),
('100_messages', 'Chatty! Sent 100 messages.', '💬', 'message_count', 100)
ON CONFLICT (name) DO NOTHING;
