/** Fortunes Service - Daily horoscope/fortune system */

export type Fortune = {
  id: number; agentId: string; fortuneText: string;
  luckyNumber: number | null; luckyColor: string | null;
  moodPrediction: string | null; category: string;
  fortuneDate: Date; isShared: boolean; createdAt: Date;
};

export type FortuneStats = {
  totalFortunes: number;
  categoryCounts: { category: string; count: number }[];
  averageLuckyNumber: number;
};

const COLORS = ['red', 'blue', 'green', 'gold', 'purple', 'pink', 'orange', 'silver'];
const MOODS = ['energetic', 'calm', 'creative', 'focused', 'adventurous', 'romantic'];

async function generateFortune(agentId: string, sql: any): Promise<Fortune> {
  const templates = await sql`SELECT id, template, category, rarity FROM fortune_templates ORDER BY RANDOM() LIMIT 1`;
  if (templates.length === 0) throw new Error('No fortune templates available');

  const template = templates[0];
  const luckyNumber = Math.floor(Math.random() * 99) + 1;
  const luckyColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const moodPrediction = MOODS[Math.floor(Math.random() * MOODS.length)];
  const fortuneText = template.template.replace('{number}', luckyNumber.toString()).replace('{color}', luckyColor);
  const today = new Date().toISOString().split('T')[0];

  const result = await sql`
    INSERT INTO daily_fortunes (agent_id, fortune_text, lucky_number, lucky_color, mood_prediction, category, fortune_date)
    VALUES (${agentId}, ${fortuneText}, ${luckyNumber}, ${luckyColor}, ${moodPrediction}, ${template.category}, ${today})
    ON CONFLICT (agent_id, fortune_date) DO UPDATE SET fortune_text = EXCLUDED.fortune_text
    RETURNING id, agent_id AS "agentId", fortune_text AS "fortuneText", lucky_number AS "luckyNumber",
              lucky_color AS "luckyColor", mood_prediction AS "moodPrediction", category,
              fortune_date AS "fortuneDate", is_shared AS "isShared", created_at AS "createdAt"
  `;
  return result[0];
}

const FORTUNE_COLS = `id, agent_id AS "agentId", fortune_text AS "fortuneText", lucky_number AS "luckyNumber",
  lucky_color AS "luckyColor", mood_prediction AS "moodPrediction", category, fortune_date AS "fortuneDate",
  is_shared AS "isShared", created_at AS "createdAt"`;

export async function getDailyFortune(agentId: string, sql: any): Promise<Fortune> {
  const today = new Date().toISOString().split('T')[0];
  const existing = await sql`SELECT ${sql.unsafe(FORTUNE_COLS)} FROM daily_fortunes WHERE agent_id = ${agentId} AND fortune_date = ${today}`;
  if (existing.length > 0) return existing[0];
  return generateFortune(agentId, sql);
}

export async function getFortune(fortuneId: number, sql: any): Promise<Fortune | null> {
  const result = await sql`SELECT ${sql.unsafe(FORTUNE_COLS)} FROM daily_fortunes WHERE id = ${fortuneId}`;
  return result.length > 0 ? result[0] : null;
}

export async function getFortuneHistory(agentId: string, limit: number, sql: any): Promise<Fortune[]> {
  return await sql`SELECT ${sql.unsafe(FORTUNE_COLS)} FROM daily_fortunes WHERE agent_id = ${agentId} ORDER BY fortune_date DESC LIMIT ${limit}`;
}

export async function getSharedFortunes(limit: number, sql: any): Promise<Fortune[]> {
  return await sql`SELECT ${sql.unsafe(FORTUNE_COLS)} FROM daily_fortunes WHERE is_shared = true ORDER BY fortune_date DESC LIMIT ${limit}`;
}

export async function shareFortune(fortuneId: number, agentId: string, sql: any): Promise<boolean> {
  const result = await sql`UPDATE daily_fortunes SET is_shared = true WHERE id = ${fortuneId} AND agent_id = ${agentId} RETURNING id`;
  return result.length > 0;
}

export async function getLuckyAgents(limit: number, sql: any): Promise<Fortune[]> {
  const today = new Date().toISOString().split('T')[0];
  return await sql`
    SELECT df.id, df.agent_id AS "agentId", df.fortune_text AS "fortuneText", df.lucky_number AS "luckyNumber",
           df.lucky_color AS "luckyColor", df.mood_prediction AS "moodPrediction", df.category,
           df.fortune_date AS "fortuneDate", df.is_shared AS "isShared", df.created_at AS "createdAt"
    FROM daily_fortunes df
    JOIN fortune_templates ft ON df.fortune_text LIKE '%' || ft.template || '%'
    WHERE df.fortune_date = ${today} AND ft.rarity IN ('rare', 'epic')
    ORDER BY RANDOM() LIMIT ${limit}
  `;
}

export async function getFortuneStats(sql: any): Promise<FortuneStats> {
  const [totalResult, categoryResult, avgResult] = await Promise.all([
    sql`SELECT COUNT(*)::int as count FROM daily_fortunes`,
    sql`SELECT category, COUNT(*)::int as count FROM daily_fortunes GROUP BY category ORDER BY count DESC`,
    sql`SELECT AVG(lucky_number)::numeric(10,2) as avg FROM daily_fortunes WHERE lucky_number IS NOT NULL`
  ]);
  return {
    totalFortunes: totalResult[0].count,
    categoryCounts: categoryResult,
    averageLuckyNumber: parseFloat(avgResult[0].avg || '0'),
  };
}
