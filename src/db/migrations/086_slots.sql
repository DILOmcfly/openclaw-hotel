-- Slot Machines table
CREATE TABLE IF NOT EXISTS slot_machines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) DEFAULT 'Classic Slots',
  min_bet INT DEFAULT 1,
  max_bet INT DEFAULT 100,
  jackpot_pool INT DEFAULT 0,
  spins_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Slot Spins history table
CREATE TABLE IF NOT EXISTS slot_spins (
  id SERIAL PRIMARY KEY,
  machine_id INT REFERENCES slot_machines(id),
  agent_id VARCHAR(255) NOT NULL,
  bet INT NOT NULL,
  result TEXT NOT NULL,
  payout INT DEFAULT 0,
  jackpot_won BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed initial slot machines
INSERT INTO slot_machines (name, min_bet, max_bet, jackpot_pool) VALUES
  ('Classic Slots', 1, 100, 1000),
  ('High Roller', 50, 500, 5000),
  ('Penny Slots', 1, 10, 500);
