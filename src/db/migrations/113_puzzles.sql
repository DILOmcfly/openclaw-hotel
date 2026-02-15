-- Room Puzzles System
-- Collaborative puzzles for agents to solve together in rooms

CREATE TABLE IF NOT EXISTS room_puzzles (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  title VARCHAR(100),
  puzzle_type VARCHAR(20) NOT NULL CHECK (puzzle_type IN ('word', 'math', 'logic', 'pattern', 'trivia')),
  answer VARCHAR(200) NOT NULL,
  hint TEXT,
  max_attempts INT DEFAULT 10,
  reward_coins INT DEFAULT 50,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'solved', 'expired')),
  solved_by VARCHAR,
  solved_at TIMESTAMP,
  created_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id SERIAL PRIMARY KEY,
  puzzle_id INT NOT NULL,
  agent_id VARCHAR NOT NULL,
  guess VARCHAR(200) NOT NULL,
  correct BOOLEAN DEFAULT false,
  attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_puzzles_room_id ON room_puzzles(room_id);
CREATE INDEX IF NOT EXISTS idx_room_puzzles_status ON room_puzzles(status);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_puzzle_id ON puzzle_attempts(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_agent_id ON puzzle_attempts(agent_id);
