-- Room Reviews System

CREATE TABLE IF NOT EXISTS room_reviews (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, agent_id)
);

CREATE TABLE IF NOT EXISTS review_helpful (
  review_id INT NOT NULL REFERENCES room_reviews(id) ON DELETE CASCADE,
  agent_id VARCHAR(255) NOT NULL,
  PRIMARY KEY (review_id, agent_id)
);

CREATE INDEX idx_room_reviews_room_id ON room_reviews(room_id);
CREATE INDEX idx_room_reviews_agent_id ON room_reviews(agent_id);
CREATE INDEX idx_room_reviews_rating ON room_reviews(rating);
CREATE INDEX idx_review_helpful_review_id ON review_helpful(review_id);
