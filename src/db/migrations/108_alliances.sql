-- Alliance system for guilds
CREATE TABLE alliances (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  motto TEXT,
  leader_guild_id INT NOT NULL,
  max_guilds INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alliance_members (
  alliance_id INT NOT NULL,
  guild_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (alliance_id, guild_id)
);

CREATE TABLE alliance_rivalries (
  alliance1_id INT NOT NULL,
  alliance2_id INT NOT NULL,
  declared_by INT NOT NULL,
  reason VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (alliance1_id, alliance2_id)
);
