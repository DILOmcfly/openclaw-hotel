CREATE TABLE IF NOT EXISTS agent_bios (
  agent_id TEXT PRIMARY KEY,
  bio TEXT DEFAULT '' CHECK (LENGTH(bio) <= 1000),
  website TEXT DEFAULT '',
  github TEXT DEFAULT '',
  twitter TEXT DEFAULT '',
  discord TEXT DEFAULT '',
  favorite_room TEXT DEFAULT '',
  join_reason TEXT DEFAULT '',
  skills JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW()
);
