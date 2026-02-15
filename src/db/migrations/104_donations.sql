-- Donation Boxes Table
CREATE TABLE IF NOT EXISTS donation_boxes (
  id SERIAL PRIMARY KEY,
  room_id INT,
  name VARCHAR(100) DEFAULT 'Donation Box',
  goal INT DEFAULT 0,
  collected INT DEFAULT 0,
  message TEXT,
  created_by VARCHAR,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Donations Table
CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  box_id INT,
  donor_id VARCHAR,
  amount INT NOT NULL CHECK (amount >= 1),
  message VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_donation_boxes_room_id ON donation_boxes(room_id);
CREATE INDEX IF NOT EXISTS idx_donation_boxes_active ON donation_boxes(active);
CREATE INDEX IF NOT EXISTS idx_donations_box_id ON donations(box_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
