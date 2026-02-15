-- Daily Fortunes Table
CREATE TABLE IF NOT EXISTS daily_fortunes (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR NOT NULL,
  fortune_text TEXT NOT NULL,
  lucky_number INT,
  lucky_color VARCHAR(20),
  mood_prediction VARCHAR(30),
  category VARCHAR(20) CHECK (category IN ('love', 'career', 'social', 'adventure', 'wealth', 'health')),
  fortune_date DATE NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, fortune_date)
);

-- Fortune Templates Table
CREATE TABLE IF NOT EXISTS fortune_templates (
  id SERIAL PRIMARY KEY,
  template TEXT NOT NULL,
  category VARCHAR(20) NOT NULL,
  rarity VARCHAR(10) CHECK (rarity IN ('common', 'rare', 'epic'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_fortunes_agent_id ON daily_fortunes(agent_id);
CREATE INDEX IF NOT EXISTS idx_daily_fortunes_date ON daily_fortunes(fortune_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_fortunes_shared ON daily_fortunes(is_shared, fortune_date DESC);

-- Seed Fortune Templates
INSERT INTO fortune_templates (template, category, rarity) VALUES
  ('Your {color} aura attracts unexpected friendships today. Lucky number: {number}', 'social', 'common'),
  ('A romantic opportunity knocks. Answer with confidence!', 'love', 'rare'),
  ('Your career path shines bright. Bold moves will be rewarded.', 'career', 'common'),
  ('Adventure calls from unexpected corners. Follow your curiosity!', 'adventure', 'common'),
  ('Financial winds blow in your favor. Trust your instincts.', 'wealth', 'common'),
  ('Energy levels peak today. Channel it into creative pursuits!', 'health', 'common'),
  ('A mysterious stranger will change your perspective forever.', 'social', 'epic'),
  ('True love recognizes you in the most ordinary moment.', 'love', 'epic'),
  ('A career breakthrough arrives from an unlikely mentor.', 'career', 'rare'),
  ('Your greatest adventure begins with a single word: yes.', 'adventure', 'rare'),
  ('Wealth finds those who share generously. Give first.', 'wealth', 'rare'),
  ('Mind, body, spirit align perfectly. You are unstoppable.', 'health', 'rare'),
  ('Today you inspire someone without knowing it.', 'social', 'common'),
  ('Old flames flicker. Choose wisely between past and future.', 'love', 'common'),
  ('Your idea will spark a revolution. Document everything.', 'career', 'epic'),
  ('The path less traveled holds your destiny. Take it boldly.', 'adventure', 'epic'),
  ('Fortune favors the brave. Double down on your vision today.', 'wealth', 'epic'),
  ('Your body whispers secrets. Listen carefully and rest well.', 'health', 'common'),
  ('Three conversations today will shift your world axis.', 'social', 'rare'),
  ('Soulmate energy surrounds you. Keep your heart open.', 'love', 'rare');
