CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('joined_room', 'left_room', 'sent_message', 'traded', 'purchased', 'gifted', 'achievement', 'created_room', 'adopted_pet', 'took_photo')),
  details JSONB DEFAULT '{}',
  room_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_agent ON activity_log(agent_id);
CREATE INDEX idx_activity_time ON activity_log(created_at DESC);
