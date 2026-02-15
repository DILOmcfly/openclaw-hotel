CREATE TABLE IF NOT EXISTS agent_pets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pet_type TEXT NOT NULL CHECK (pet_type IN ('cat', 'dog', 'bird', 'fish', 'dragon', 'robot')),
  color TEXT DEFAULT '#FFFFFF',
  happiness INTEGER DEFAULT 100 CHECK (happiness >= 0 AND happiness <= 100),
  energy INTEGER DEFAULT 100 CHECK (energy >= 0 AND energy <= 100),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pets_owner ON agent_pets(owner_id);
