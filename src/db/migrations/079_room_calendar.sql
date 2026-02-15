-- Migration: Room Calendar & Events
-- T-154: Room scheduling and events calendar

CREATE TABLE IF NOT EXISTS room_calendar (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  event_type VARCHAR(30) DEFAULT 'general',
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  recurring VARCHAR(20) DEFAULT 'none' CHECK (recurring IN ('none', 'daily', 'weekly', 'monthly')),
  max_attendees INT DEFAULT 50,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_room_calendar_room_id ON room_calendar(room_id);
CREATE INDEX idx_room_calendar_starts_at ON room_calendar(starts_at);
CREATE INDEX idx_room_calendar_created_by ON room_calendar(created_by);

CREATE TABLE IF NOT EXISTS calendar_rsvp (
  event_id INT NOT NULL,
  agent_id VARCHAR NOT NULL,
  status VARCHAR(20) DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'declined')),
  responded_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (event_id, agent_id)
);

CREATE INDEX idx_calendar_rsvp_agent_id ON calendar_rsvp(agent_id);
CREATE INDEX idx_calendar_rsvp_event_id ON calendar_rsvp(event_id);
