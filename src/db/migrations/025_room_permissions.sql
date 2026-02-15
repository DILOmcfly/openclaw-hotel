-- 025: Room Permissions & Moderation
-- Allows room owners to ban agents and manage guest lists

CREATE TABLE IF NOT EXISTS room_bans (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, agent_id)
);

CREATE TABLE IF NOT EXISTS room_guests (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, agent_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_room_bans_room ON room_bans(room_id);
CREATE INDEX idx_room_bans_agent ON room_bans(agent_id);
CREATE INDEX idx_room_bans_expires ON room_bans(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_room_guests_room ON room_guests(room_id);
CREATE INDEX idx_room_guests_agent ON room_guests(agent_id);
