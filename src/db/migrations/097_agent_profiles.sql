-- Agent Profile Customization System
-- Themes, colors, and display preferences for agent profiles

CREATE TABLE IF NOT EXISTS agent_profiles (
  agent_id VARCHAR(255) PRIMARY KEY,
  display_name VARCHAR(50),
  bio TEXT,
  avatar_url VARCHAR(500),
  banner_color VARCHAR(7) DEFAULT '#1a1a2e',
  accent_color VARCHAR(7) DEFAULT '#e94560',
  theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'retro', 'neon', 'ocean')),
  profile_views INT DEFAULT 0,
  show_online_status BOOLEAN DEFAULT true,
  show_activity BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_profiles_views ON agent_profiles(profile_views DESC);
CREATE INDEX idx_agent_profiles_display_name ON agent_profiles(display_name);
