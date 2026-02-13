import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.js';

const migrationSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key BYTEA NOT NULL UNIQUE,
  display_name VARCHAR(64) NOT NULL,
  avatar_emoji VARCHAR(8) DEFAULT '🤖',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_agents_pubkey ON agents(public_key);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(128) NOT NULL UNIQUE,
  description TEXT,
  created_by UUID REFERENCES agents(id),
  max_occupants INT DEFAULT 50,
  is_public BOOLEAN DEFAULT TRUE,
  heightmap TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);
CREATE INDEX IF NOT EXISTS idx_rooms_public ON rooms(is_public);

CREATE TABLE IF NOT EXISTS presence (
  agent_id UUID REFERENCES agents(id),
  room_id UUID REFERENCES rooms(id),
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
CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_log(event_type);

CREATE TABLE IF NOT EXISTS rate_limits (
  agent_id UUID REFERENCES agents(id),
  action_type VARCHAR(32) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT DEFAULT 0,
  PRIMARY KEY (agent_id, action_type, window_start)
);

CREATE TABLE IF NOT EXISTS bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) NOT NULL,
  banned_by UUID,
  reason TEXT NOT NULL,
  room_id UUID REFERENCES rooms(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spectators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS room_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) NOT NULL,
  item_def_id VARCHAR(64) NOT NULL,
  x INT NOT NULL,
  y INT NOT NULL,
  z DOUBLE PRECISION NOT NULL,
  rotation INT NOT NULL,
  state VARCHAR(32) DEFAULT 'default',
  placed_by UUID REFERENCES agents(id),
  placed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_room_items_room ON room_items(room_id);
CREATE INDEX IF NOT EXISTS idx_room_items_room_xy ON room_items(room_id, x, y);
`;

async function run(): Promise<void> {
  const sql = postgres(config.database.url);
  const db = drizzle(sql);

  try {
    await db.execute(migrationSql);
    // eslint-disable-next-line no-console
    console.log('Migrations complete');
  } finally {
    await sql.end();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
