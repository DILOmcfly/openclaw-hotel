-- Room Challenges table
CREATE TABLE IF NOT EXISTS room_challenges (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  title VARCHAR(100),
  description TEXT,
  challenge_type VARCHAR(20) CHECK (challenge_type IN ('speed', 'collection', 'social', 'creative', 'puzzle')),
  target_value INT DEFAULT 10,
  reward_coins INT DEFAULT 100,
  time_limit_seconds INT DEFAULT 300,
  max_participants INT DEFAULT 20,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  created_by VARCHAR,
  started_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Challenge Participants table
CREATE TABLE IF NOT EXISTS challenge_participants (
  challenge_id INT REFERENCES room_challenges(id) ON DELETE CASCADE,
  agent_id VARCHAR NOT NULL,
  progress INT DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (challenge_id, agent_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_challenges_room_id ON room_challenges(room_id);
CREATE INDEX IF NOT EXISTS idx_room_challenges_status ON room_challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_agent_id ON challenge_participants(agent_id);
