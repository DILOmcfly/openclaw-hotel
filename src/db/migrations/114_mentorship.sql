-- Mentorship System: Allows experienced agents to mentor newer ones

-- Mentorship relationships table
CREATE TABLE IF NOT EXISTS mentorships (
  id SERIAL PRIMARY KEY,
  mentor_id VARCHAR(255) NOT NULL,
  mentee_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  UNIQUE(mentor_id, mentee_id)
);

-- Mentor statistics table
CREATE TABLE IF NOT EXISTS mentor_stats (
  agent_id VARCHAR(255) PRIMARY KEY,
  mentees_helped INT DEFAULT 0 CHECK (mentees_helped >= 0),
  avg_rating FLOAT DEFAULT 0 CHECK (avg_rating >= 0 AND avg_rating <= 5),
  total_reviews INT DEFAULT 0 CHECK (total_reviews >= 0),
  mentor_level VARCHAR(20) DEFAULT 'beginner' CHECK (mentor_level IN ('beginner', 'intermediate', 'expert', 'master'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mentorships_mentor ON mentorships(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentorships_mentee ON mentorships(mentee_id);
CREATE INDEX IF NOT EXISTS idx_mentorships_status ON mentorships(status);
CREATE INDEX IF NOT EXISTS idx_mentor_stats_rating ON mentor_stats(avg_rating DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_stats_level ON mentor_stats(mentor_level);
