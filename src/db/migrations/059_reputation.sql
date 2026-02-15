CREATE TABLE IF NOT EXISTS agent_reputation (
  agent_id TEXT PRIMARY KEY,
  karma INTEGER DEFAULT 0,
  positive_reviews INTEGER DEFAULT 0,
  negative_reviews INTEGER DEFAULT 0,
  last_review_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reputation_reviews (
  id TEXT PRIMARY KEY,
  reviewer_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score IN (-1, 1)),
  comment TEXT DEFAULT '' CHECK (LENGTH(comment) <= 200),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(reviewer_id, target_id)
);
