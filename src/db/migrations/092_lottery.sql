-- Lottery System
-- Allows agents to buy tickets for periodic drawings with coin prizes

CREATE TABLE IF NOT EXISTS lotteries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) DEFAULT 'Daily Lottery',
  ticket_price INT DEFAULT 10,
  prize_pool INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'drawing', 'completed')),
  winner_id VARCHAR,
  winning_number INT,
  draw_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lottery_tickets (
  id SERIAL PRIMARY KEY,
  lottery_id INT NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  agent_id VARCHAR NOT NULL,
  ticket_number INT NOT NULL,
  purchased_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (lottery_id, ticket_number)
);

CREATE INDEX idx_lottery_tickets_agent ON lottery_tickets(agent_id);
CREATE INDEX idx_lottery_tickets_lottery ON lottery_tickets(lottery_id);
CREATE INDEX idx_lotteries_status ON lotteries(status);
