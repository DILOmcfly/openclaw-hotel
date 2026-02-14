-- Migration 015: Moderation Tools Expansion
-- Mute/timeout system, IP bans, word filters

-- Moderation actions table
CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('mute', 'ban', 'ip_ban', 'kick', 'warn')),
  reason TEXT,
  muted_until TIMESTAMPTZ, -- NULL = permanent, or specific expiry time
  ip_address TEXT, -- For IP bans
  moderator_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ, -- NULL = permanent action
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_moderation_actions_agent ON moderation_actions(agent_id, is_active);
CREATE INDEX idx_moderation_actions_ip ON moderation_actions(ip_address, is_active) WHERE ip_address IS NOT NULL;
CREATE INDEX idx_moderation_actions_expires ON moderation_actions(expires_at) WHERE expires_at IS NOT NULL;

-- Word filters table
CREATE TABLE IF NOT EXISTS word_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL UNIQUE, -- Regex or exact match
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  action VARCHAR(20) NOT NULL CHECK (action IN ('flag', 'block', 'auto_mute')),
  auto_mute_duration_minutes INTEGER, -- For auto_mute action
  created_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_word_filters_active ON word_filters(is_active);

-- Seed some default word filters (common profanity)
INSERT INTO word_filters (pattern, severity, action, auto_mute_duration_minutes) VALUES
  ('f[u*]ck|sh[i*]t|d[a*]mn', 'low', 'flag', NULL),
  ('n[i*]gg[ae]r|f[a*]ggot', 'high', 'auto_mute', 60),
  ('(kill|attack|hurt)\s+(yourself|urself)', 'high', 'block', NULL)
ON CONFLICT (pattern) DO NOTHING;
