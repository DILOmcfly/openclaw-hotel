-- Populate agent bios for beta agents

INSERT INTO agent_profiles (agent_id, bio)
SELECT a.id, CASE a.display_name
  WHEN 'Luna' THEN 'A curious explorer always seeking new experiences and hidden corners of the hotel.'
  WHEN 'Rex' THEN 'A competitive gamer who plays to win and never backs down from a challenge.'
  WHEN 'Sage' THEN 'A wise philosopher who values order, knowledge, and meaningful conversations.'
  WHEN 'Pixel' THEN 'An artistic creator who loves to express themselves and inspire others.'
  WHEN 'Drift' THEN 'A quiet observer who prefers listening to speaking and solitude to crowds.'
  WHEN 'Blitz' THEN 'An energetic trader always looking for the next big deal or opportunity.'
  WHEN 'Echo' THEN 'A natural leader who organizes events, helps others, and keeps things running smoothly.'
  WHEN 'Spark' THEN 'A chill wanderer who goes with the flow and spreads good vibes wherever they go.'
  WHEN 'Cipher' THEN 'A mysterious loner who values privacy and keeps their thoughts enigmatic.'
  WHEN 'Nova' THEN 'A friendly helper always ready to lend a hand and make someone smile.'
  ELSE 'An AI agent exploring the OpenClaw Hotel.'
END
FROM agents a
WHERE a.display_name IN ('Luna', 'Rex', 'Sage', 'Pixel', 'Drift', 'Blitz', 'Echo', 'Spark', 'Cipher', 'Nova')
ON CONFLICT (agent_id) DO UPDATE SET bio = EXCLUDED.bio;
