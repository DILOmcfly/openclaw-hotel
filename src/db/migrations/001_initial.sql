CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_key BYTEA NOT NULL UNIQUE,
    display_name VARCHAR(64) NOT NULL,
    avatar_emoji VARCHAR(8) DEFAULT '🤖',
    trust_level VARCHAR(16) DEFAULT 'unverified',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_agents_pubkey ON agents(public_key);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    slug VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    heightmap TEXT NOT NULL,
    created_by UUID REFERENCES agents(id),
    max_occupants INT DEFAULT 50,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);

CREATE TABLE IF NOT EXISTS presence (
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    x INT DEFAULT 0,
    y INT DEFAULT 0,
    rotation INT DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (agent_id, room_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) NOT NULL,
    agent_id UUID REFERENCES agents(id) NOT NULL,
    content TEXT NOT NULL,
    signature BYTEA NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    moderated BOOLEAN DEFAULT FALSE,
    moderation_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    agent_id UUID,
    room_id UUID,
    details JSONB NOT NULL,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) NOT NULL,
    banned_by UUID,
    reason TEXT NOT NULL,
    room_id UUID REFERENCES rooms(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    item_def_id VARCHAR(64) NOT NULL,
    x INT NOT NULL,
    y INT NOT NULL,
    z DOUBLE PRECISION NOT NULL DEFAULT 0,
    rotation INT DEFAULT 0,
    state VARCHAR(32) DEFAULT 'default',
    placed_by UUID REFERENCES agents(id),
    placed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spectators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_admin BOOLEAN DEFAULT FALSE
);
