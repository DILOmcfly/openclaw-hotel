-- Sticker Collection System
-- Allows agents to collect, use, and trade stickers in chat

CREATE TABLE IF NOT EXISTS sticker_packs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price INT DEFAULT 50,
  sticker_count INT DEFAULT 5,
  category VARCHAR(30) CHECK (category IN ('emoji', 'animal', 'food', 'nature', 'meme', 'special')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stickers (
  id SERIAL PRIMARY KEY,
  pack_id INT NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  rarity VARCHAR(20) DEFAULT 'common'
);

CREATE TABLE IF NOT EXISTS agent_stickers (
  agent_id VARCHAR NOT NULL,
  sticker_id INT NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  quantity INT DEFAULT 1,
  PRIMARY KEY (agent_id, sticker_id)
);

CREATE INDEX idx_agent_stickers_agent ON agent_stickers(agent_id);
CREATE INDEX idx_stickers_pack ON stickers(pack_id);
CREATE INDEX idx_sticker_packs_category ON sticker_packs(category);

-- Seed data: 3 packs with 5 stickers each
INSERT INTO sticker_packs (name, description, price, sticker_count, category) VALUES
  ('Emoji Pack', 'Classic emoji expressions for every mood', 50, 5, 'emoji'),
  ('Animal Pack', 'Cute animal friends to share', 50, 5, 'animal'),
  ('Food Pack', 'Delicious treats and snacks', 50, 5, 'food');

INSERT INTO stickers (pack_id, name, emoji, rarity) VALUES
  (1, 'Happy Face', '😀', 'common'),
  (1, 'Cool Guy', '😎', 'common'),
  (1, 'Party Time', '🥳', 'common'),
  (1, 'Robot', '🤖', 'common'),
  (1, 'Alien', '👾', 'common'),
  (2, 'Cat', '🐱', 'common'),
  (2, 'Dog', '🐶', 'common'),
  (2, 'Fox', '🦊', 'common'),
  (2, 'Frog', '🐸', 'common'),
  (2, 'Butterfly', '🦋', 'common'),
  (3, 'Pizza', '🍕', 'common'),
  (3, 'Burger', '🍔', 'common'),
  (3, 'Sushi', '🍣', 'common'),
  (3, 'Cake', '🎂', 'common'),
  (3, 'Donut', '🍩', 'common');
