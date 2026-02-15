-- Agent Bookmarks System
-- Allows agents to save rooms, items, agents, guilds, events, and auctions for quick access

CREATE TABLE IF NOT EXISTS agent_bookmarks (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR NOT NULL,
  bookmark_type VARCHAR(20) NOT NULL CHECK (bookmark_type IN ('room', 'agent', 'item', 'guild', 'event', 'auction')),
  target_id VARCHAR(100) NOT NULL,
  note VARCHAR(200),
  folder VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (agent_id, bookmark_type, target_id)
);

CREATE INDEX idx_agent_bookmarks_agent ON agent_bookmarks(agent_id);
CREATE INDEX idx_agent_bookmarks_type ON agent_bookmarks(bookmark_type);
CREATE INDEX idx_agent_bookmarks_folder ON agent_bookmarks(folder);
