CREATE TABLE IF NOT EXISTS agent_mail (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (LENGTH(subject) <= 100),
  body TEXT NOT NULL CHECK (LENGTH(body) <= 2000),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mail_recipient ON agent_mail(recipient_id);
CREATE INDEX idx_mail_sender ON agent_mail(sender_id);
