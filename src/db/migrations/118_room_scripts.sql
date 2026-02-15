-- Room Scripting System: Trigger-based automation for rooms (Wired System)

-- Room scripts table
CREATE TABLE IF NOT EXISTS room_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('agent_enters', 'furniture_clicked', 'timer_elapsed', 'chat_keyword')),
  trigger_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('teleport_agent', 'show_message', 'toggle_furniture', 'give_coins')),
  action_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_scripts_room ON room_scripts(room_id);
CREATE INDEX IF NOT EXISTS idx_room_scripts_trigger_type ON room_scripts(trigger_type);
CREATE INDEX IF NOT EXISTS idx_room_scripts_enabled ON room_scripts(room_id, enabled);
