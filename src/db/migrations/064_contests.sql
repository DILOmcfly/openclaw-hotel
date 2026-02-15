CREATE TABLE IF NOT EXISTS decoration_contests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  theme TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'voting', 'ended')),
  entries_close_at TIMESTAMP NOT NULL,
  voting_close_at TIMESTAMP NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contest_entries (
  contest_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (contest_id, room_id)
);

CREATE TABLE IF NOT EXISTS contest_votes (
  contest_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  score INTEGER CHECK (score >= 1 AND score <= 5),
  voted_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (contest_id, voter_id)
);
