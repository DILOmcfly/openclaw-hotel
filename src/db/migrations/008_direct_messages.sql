-- Migration 008: Direct Messages (Whisper System)
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS direct_messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Constraints
  CONSTRAINT dm_sender_recipient_different CHECK (sender_id != recipient_id),
  CONSTRAINT dm_content_length CHECK (char_length(content) > 0 AND char_length(content) <= 500)
);

-- Indexes for performance
CREATE INDEX idx_dm_recipient_created ON direct_messages(recipient_id, created_at DESC);
CREATE INDEX idx_dm_sender_created ON direct_messages(sender_id, created_at DESC);
CREATE INDEX idx_dm_conversation ON direct_messages(
  LEAST(sender_id, recipient_id),
  GREATEST(sender_id, recipient_id),
  created_at DESC
);

-- Add comment
COMMENT ON TABLE direct_messages IS 'Private messages between friends (whisper system)';
