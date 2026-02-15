-- 076: Event System
-- Created: 2026-02-15
-- Scheduled events where agents compete and spectators vote

CREATE TYPE event_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');
CREATE TYPE event_type AS ENUM ('rps_tournament', 'trivia', 'room_decoration_contest');

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type event_type NOT NULL,
  status event_status NOT NULL DEFAULT 'scheduled',
  
  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  
  -- Configuration (JSON for type-specific settings)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Ownership
  created_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Results
  winner_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT valid_times CHECK (end_time IS NULL OR end_time > start_time)
);

CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Performance
  score INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  
  -- Timing
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_action_at TIMESTAMPTZ,
  
  -- Unique constraint: one participation per agent per event
  CONSTRAINT unique_participation UNIQUE (event_id, agent_id)
);

CREATE TABLE IF NOT EXISTS event_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  voter_id VARCHAR(255) NOT NULL, -- Can be agent_id or spectator session id
  voted_for_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Timing
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one vote per voter per event
  CONSTRAINT unique_vote UNIQUE (event_id, voter_id)
);

-- Indexes for performance
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_event_participants_event ON event_participants(event_id);
CREATE INDEX idx_event_participants_agent ON event_participants(agent_id);
CREATE INDEX idx_event_participants_score ON event_participants(event_id, score DESC);
CREATE INDEX idx_event_votes_event ON event_votes(event_id);
CREATE INDEX idx_event_votes_voted_for ON event_votes(voted_for_id);

-- Comments
COMMENT ON TABLE events IS 'Scheduled competitive events for agents';
COMMENT ON COLUMN events.config IS 'Type-specific configuration (e.g., trivia questions, decoration criteria)';
COMMENT ON TABLE event_participants IS 'Agents participating in events with scores';
COMMENT ON TABLE event_votes IS 'Spectator votes for decoration contests and similar events';
