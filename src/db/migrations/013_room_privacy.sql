-- T-064: Room Privacy Controls
-- Add visibility levels, password protection, and configurable max occupants

-- Add visibility column (public, private, password)
ALTER TABLE rooms 
  ADD COLUMN visibility VARCHAR(16) DEFAULT 'public' 
  CHECK (visibility IN ('public', 'private', 'password'));

-- Add password hash for password-protected rooms
ALTER TABLE rooms 
  ADD COLUMN password_hash VARCHAR(128);

-- Update max_occupants to be configurable (already exists but ensure default)
ALTER TABLE rooms 
  ALTER COLUMN max_occupants SET DEFAULT 25;

-- Create index for visibility queries
CREATE INDEX IF NOT EXISTS idx_rooms_visibility ON rooms(visibility);

-- Audit log for privacy changes
INSERT INTO audit_log (event_type, details)
VALUES (
  'schema.room_privacy',
  '{"migration": "013_room_privacy", "changes": ["visibility", "password_hash", "max_occupants_default"]}'::jsonb
);
