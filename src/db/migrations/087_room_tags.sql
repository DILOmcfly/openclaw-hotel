-- Room Tags System
-- Tagging system for rooms to improve discoverability

CREATE TABLE room_tags (
  room_id INT NOT NULL,
  tag VARCHAR(30) NOT NULL,
  added_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (room_id, tag)
);

CREATE INDEX idx_room_tags_tag ON room_tags(tag);

CREATE TABLE tag_follows (
  agent_id VARCHAR(100) NOT NULL,
  tag VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (agent_id, tag)
);

CREATE INDEX idx_tag_follows_tag ON tag_follows(tag);
