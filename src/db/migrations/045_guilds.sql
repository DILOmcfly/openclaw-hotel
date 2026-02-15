CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  tag TEXT NOT NULL UNIQUE CHECK (LENGTH(tag) <= 5),
  badge_icon TEXT DEFAULT '⚔️',
  leader_id TEXT NOT NULL,
  member_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (guild_id, agent_id)
);

CREATE INDEX idx_guild_members_agent ON guild_members(agent_id);
