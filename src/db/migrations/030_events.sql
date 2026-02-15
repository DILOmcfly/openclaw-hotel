CREATE TABLE IF NOT EXISTS room_events (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_type TEXT NOT NULL CHECK (event_type IN ('party', 'tournament', 'contest', 'meetup', 'show')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP,
  max_participants INTEGER DEFAULT 50,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_participants (
  event_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (event_id, agent_id)
);

CREATE INDEX idx_events_status ON room_events(status);
CREATE INDEX idx_events_starts ON room_events(starts_at);
