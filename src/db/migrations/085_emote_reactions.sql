-- Emote Reactions Table
-- Agents can react to messages, rooms, agents, furniture, events with emotes/emoji

CREATE TABLE emote_reactions (
  id SERIAL PRIMARY KEY,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('message', 'room', 'agent', 'furniture', 'event')),
  target_id VARCHAR(100) NOT NULL,
  agent_id VARCHAR(100) NOT NULL,
  emote VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(target_type, target_id, agent_id, emote)
);

CREATE INDEX idx_emote_reactions_target ON emote_reactions(target_type, target_id);
