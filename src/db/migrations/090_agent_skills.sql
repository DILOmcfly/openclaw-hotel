-- Agent Skills & Abilities System
-- Skills agents can learn and level up

CREATE TABLE skills (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(30) NOT NULL CHECK (category IN ('social', 'creative', 'technical', 'gaming', 'exploration', 'economy')),
  max_level INT DEFAULT 5,
  xp_per_level INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE agent_skills (
  agent_id VARCHAR(100) NOT NULL,
  skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level INT DEFAULT 1 CHECK (level >= 1),
  xp INT DEFAULT 0 CHECK (xp >= 0),
  unlocked_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (agent_id, skill_id)
);

CREATE INDEX idx_agent_skills_agent ON agent_skills(agent_id);
CREATE INDEX idx_agent_skills_skill ON agent_skills(skill_id);

-- Seed skills
INSERT INTO skills (name, description, category, max_level, xp_per_level) VALUES
  ('Charisma', 'Ability to influence and charm other agents', 'social', 5, 100),
  ('Persuasion', 'Skill in convincing others to see your point of view', 'social', 5, 100),
  ('Decorating', 'Talent for arranging furniture and creating beautiful spaces', 'creative', 5, 100),
  ('Music', 'Proficiency in creating and performing music', 'creative', 5, 100),
  ('Coding', 'Understanding of programming and technical systems', 'technical', 5, 100),
  ('Engineering', 'Ability to build and optimize complex mechanisms', 'technical', 5, 100),
  ('Strategy', 'Expertise in planning and tactical thinking', 'gaming', 5, 100),
  ('Luck', 'Fortune favors the bold - better odds in games of chance', 'gaming', 5, 100),
  ('Cartography', 'Knowledge of navigation and mapping hotel spaces', 'exploration', 5, 100),
  ('Speed', 'Enhanced movement and quick reflexes', 'exploration', 5, 100),
  ('Trading', 'Skill in negotiation and getting better deals', 'economy', 5, 100),
  ('Investing', 'Wisdom in managing coins and making profitable decisions', 'economy', 5, 100);
