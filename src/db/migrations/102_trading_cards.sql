-- Trading Cards System

CREATE TABLE IF NOT EXISTS trading_cards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    rarity VARCHAR(20) CHECK (rarity IN ('common','uncommon','rare','epic','legendary','mythic')) NOT NULL,
    category VARCHAR(30) CHECK (category IN ('agent','room','item','event','special')) NOT NULL,
    power INT DEFAULT 1,
    image_url VARCHAR(500),
    max_supply INT DEFAULT NULL,
    total_minted INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_cards (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR NOT NULL,
    card_id INT REFERENCES trading_cards(id) ON DELETE CASCADE,
    serial_number INT NOT NULL,
    acquired_at TIMESTAMP DEFAULT NOW(),
    tradeable BOOLEAN DEFAULT true,
    UNIQUE(agent_id, card_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_agent_cards_agent ON agent_cards(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_cards_card ON agent_cards(card_id);

-- Seed 15 cards: 5 common, 4 uncommon, 3 rare, 2 epic, 1 legendary
INSERT INTO trading_cards (name, description, rarity, category, power, max_supply) VALUES
-- Common (5)
('Welcome Bot', 'First friend in the hotel', 'common', 'agent', 1, NULL),
('Basic Chair', 'Simple seating furniture', 'common', 'item', 1, NULL),
('Lobby Entrance', 'Where every journey begins', 'common', 'room', 1, NULL),
('Rubber Duck', 'Classic bath companion', 'common', 'item', 1, NULL),
('Plant Pot', 'Adds life to any room', 'common', 'item', 1, NULL),
-- Uncommon (4)
('DJ Agent', 'Master of the turntables', 'uncommon', 'agent', 3, 1000),
('Gaming Console', 'Hours of entertainment', 'uncommon', 'item', 3, 500),
('Pool Party', 'Summer vibes room', 'uncommon', 'room', 3, NULL),
('Neon Sign', 'Glows in the dark', 'uncommon', 'item', 3, 750),
-- Rare (3)
('Legendary Trader', 'Known across all hotels', 'rare', 'agent', 5, 250),
('Golden Throne', 'Sit like royalty', 'rare', 'item', 5, 100),
('Secret Garden', 'Hidden peaceful sanctuary', 'rare', 'room', 5, 150),
-- Epic (2)
('Grand Opening 2024', 'Witnessed the beginning', 'epic', 'event', 10, 50),
('Cosmic Portal', 'Gateway to other dimensions', 'epic', 'special', 10, 25),
-- Legendary (1)
('Founding Agent', 'One of the first pioneers', 'legendary', 'agent', 25, 10);
