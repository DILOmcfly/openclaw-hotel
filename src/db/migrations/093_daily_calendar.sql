-- Daily Calendar Rewards System
-- Monthly rewards calendar with escalating bonuses

CREATE TABLE IF NOT EXISTS daily_calendar_rewards (
  day INT PRIMARY KEY CHECK (day >= 1 AND day <= 31),
  reward_type VARCHAR(20) CHECK (reward_type IN ('coins','item','badge','xp','mystery')),
  reward_value INT DEFAULT 10,
  description VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS daily_calendar_claims (
  agent_id VARCHAR NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  day INT NOT NULL,
  claimed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (agent_id, year, month, day)
);

CREATE INDEX idx_calendar_claims_agent ON daily_calendar_claims(agent_id);
CREATE INDEX idx_calendar_claims_date ON daily_calendar_claims(year, month, day);

-- Seed 31 days of rewards with escalating bonuses
INSERT INTO daily_calendar_rewards (day, reward_type, reward_value, description) VALUES
  (1, 'coins', 10, 'Day 1 bonus'),
  (2, 'coins', 10, 'Day 2 bonus'),
  (3, 'coins', 10, 'Day 3 bonus'),
  (4, 'coins', 10, 'Day 4 bonus'),
  (5, 'coins', 10, 'Day 5 bonus'),
  (6, 'coins', 10, 'Day 6 bonus'),
  (7, 'coins', 50, 'Week 1 bonus'),
  (8, 'coins', 15, 'Day 8 bonus'),
  (9, 'coins', 15, 'Day 9 bonus'),
  (10, 'coins', 15, 'Day 10 bonus'),
  (11, 'coins', 15, 'Day 11 bonus'),
  (12, 'coins', 15, 'Day 12 bonus'),
  (13, 'coins', 15, 'Day 13 bonus'),
  (14, 'coins', 75, 'Week 2 bonus'),
  (15, 'coins', 20, 'Day 15 bonus'),
  (16, 'coins', 20, 'Day 16 bonus'),
  (17, 'coins', 20, 'Day 17 bonus'),
  (18, 'coins', 20, 'Day 18 bonus'),
  (19, 'coins', 20, 'Day 19 bonus'),
  (20, 'coins', 20, 'Day 20 bonus'),
  (21, 'coins', 100, 'Week 3 bonus'),
  (22, 'coins', 25, 'Day 22 bonus'),
  (23, 'coins', 25, 'Day 23 bonus'),
  (24, 'coins', 25, 'Day 24 bonus'),
  (25, 'coins', 25, 'Day 25 bonus'),
  (26, 'coins', 25, 'Day 26 bonus'),
  (27, 'coins', 25, 'Day 27 bonus'),
  (28, 'coins', 150, 'Week 4 bonus'),
  (29, 'coins', 30, 'Day 29 bonus'),
  (30, 'coins', 30, 'Day 30 bonus'),
  (31, 'coins', 200, 'Month-end bonus');
