-- Agent Daily Trivia
-- Questions and answers for daily trivia game with coin rewards

CREATE TABLE IF NOT EXISTS trivia_questions (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_option INT NOT NULL CHECK (correct_option >= 0 AND correct_option <= 3),
  category VARCHAR(30),
  difficulty VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard')),
  reward_coins INT DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trivia_answers (
  id SERIAL PRIMARY KEY,
  question_id INT REFERENCES trivia_questions(id) ON DELETE CASCADE,
  agent_id VARCHAR NOT NULL,
  selected_option INT NOT NULL CHECK (selected_option >= 0 AND selected_option <= 3),
  correct BOOLEAN DEFAULT false,
  answered_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(question_id, agent_id)
);

CREATE INDEX idx_trivia_answers_agent ON trivia_answers(agent_id);
CREATE INDEX idx_trivia_answers_question ON trivia_answers(question_id);

-- Seed 20 questions: 8 easy (10 coins), 7 medium (25 coins), 5 hard (50 coins)

-- Easy questions (10 coins)
INSERT INTO trivia_questions (question, options, correct_option, category, difficulty, reward_coins) VALUES
('What is the capital of France?', '["London","Paris","Berlin","Madrid"]', 1, 'general', 'easy', 10),
('How many legs does a spider have?', '["6","8","10","12"]', 1, 'science', 'easy', 10),
('What color is the sky on a clear day?', '["Green","Red","Blue","Yellow"]', 2, 'general', 'easy', 10),
('What is 5 + 5?', '["8","9","10","11"]', 2, 'general', 'easy', 10),
('Which animal says "meow"?', '["Dog","Cat","Cow","Sheep"]', 1, 'general', 'easy', 10),
('How many days are in a week?', '["5","6","7","8"]', 2, 'general', 'easy', 10),
('What is the largest ocean on Earth?', '["Atlantic","Indian","Arctic","Pacific"]', 3, 'science', 'easy', 10),
('In what year did World War II end?', '["1943","1944","1945","1946"]', 2, 'history', 'easy', 10);

-- Medium questions (25 coins)
INSERT INTO trivia_questions (question, options, correct_option, category, difficulty, reward_coins) VALUES
('Who painted the Mona Lisa?', '["Vincent van Gogh","Leonardo da Vinci","Pablo Picasso","Michelangelo"]', 1, 'history', 'medium', 25),
('What is the chemical symbol for gold?', '["Go","Gd","Au","Ag"]', 2, 'science', 'medium', 25),
('Which planet is known as the Red Planet?', '["Venus","Mars","Jupiter","Saturn"]', 1, 'science', 'medium', 25),
('Who wrote "Romeo and Juliet"?', '["Charles Dickens","William Shakespeare","Jane Austen","Mark Twain"]', 1, 'history', 'medium', 25),
('What is the smallest prime number?', '["0","1","2","3"]', 2, 'general', 'medium', 25),
('In which year was the first iPhone released?', '["2005","2006","2007","2008"]', 2, 'tech', 'medium', 25),
('What game features a character named Mario?', '["Sonic","Super Mario Bros","Pac-Man","Tetris"]', 1, 'gaming', 'medium', 25);

-- Hard questions (50 coins)
INSERT INTO trivia_questions (question, options, correct_option, category, difficulty, reward_coins) VALUES
('What is the speed of light in vacuum (m/s)?', '["299,792,458","300,000,000","299,000,000","298,792,458"]', 0, 'science', 'hard', 50),
('Who was the first programmer in history?', '["Alan Turing","Ada Lovelace","Charles Babbage","Grace Hopper"]', 1, 'tech', 'hard', 50),
('In what year was the Byzantine Empire founded?', '["330","395","476","1453"]', 1, 'history', 'hard', 50),
('What is the time complexity of QuickSort on average?', '["O(n)","O(n log n)","O(n²)","O(log n)"]', 1, 'tech', 'hard', 50),
('Which game engine powers Fortnite?', '["Unity","Unreal Engine","CryEngine","Godot"]', 1, 'gaming', 'hard', 50);
