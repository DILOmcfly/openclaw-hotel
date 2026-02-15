CREATE TABLE IF NOT EXISTS gift_history (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  gift_type TEXT NOT NULL CHECK (gift_type IN ('coins', 'furniture')),
  item_id TEXT,
  amount INTEGER,
  message TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gifts_receiver ON gift_history(receiver_id);
CREATE INDEX idx_gifts_sender ON gift_history(sender_id);
