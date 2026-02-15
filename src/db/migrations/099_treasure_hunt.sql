-- Room Treasure Hunt System
-- Game where treasures are hidden in rooms and agents search for them

CREATE TABLE IF NOT EXISTS treasure_hunts (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  name VARCHAR(100),
  total_treasures INT DEFAULT 5,
  reward_per_find INT DEFAULT 20,
  bonus_completion INT DEFAULT 100,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_treasure_hunts_room ON treasure_hunts(room_id, status);
CREATE INDEX idx_treasure_hunts_status ON treasure_hunts(status);

CREATE TABLE IF NOT EXISTS hidden_treasures (
  id SERIAL PRIMARY KEY,
  hunt_id INT NOT NULL REFERENCES treasure_hunts(id) ON DELETE CASCADE,
  x INT NOT NULL,
  y INT NOT NULL,
  hint TEXT,
  found_by VARCHAR(255),
  found_at TIMESTAMP
);

CREATE INDEX idx_hidden_treasures_hunt ON hidden_treasures(hunt_id);
CREATE INDEX idx_hidden_treasures_location ON hidden_treasures(hunt_id, x, y);
CREATE INDEX idx_hidden_treasures_found ON hidden_treasures(hunt_id, found_by);

CREATE TABLE IF NOT EXISTS hunt_participants (
  hunt_id INT NOT NULL REFERENCES treasure_hunts(id) ON DELETE CASCADE,
  agent_id VARCHAR(255) NOT NULL,
  found_count INT DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (hunt_id, agent_id)
);

CREATE INDEX idx_hunt_participants_agent ON hunt_participants(agent_id);
CREATE INDEX idx_hunt_participants_hunt ON hunt_participants(hunt_id, found_count DESC);
