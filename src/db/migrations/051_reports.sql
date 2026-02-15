CREATE TABLE IF NOT EXISTS agent_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  reported_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'cheating', 'impersonation', 'other')),
  description TEXT DEFAULT '' CHECK (LENGTH(description) <= 500),
  room_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  resolved_by TEXT,
  resolution_note TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE INDEX idx_reports_status ON agent_reports(status);
CREATE INDEX idx_reports_reported ON agent_reports(reported_id);
