/** Daily Calendar Service - Monthly rewards calendar with escalating bonuses */

export type CalendarReward = {
  day: number;
  rewardType: string;
  rewardValue: number;
  description: string;
  claimed: boolean;
};

export type MonthlyProgress = {
  claimed: number;
  total: number;
  coinsEarned: number;
  claimRate: number;
};

/** Claim today's reward (once per day) */
export async function claimToday(agentId: string, sql: any): Promise<CalendarReward & { coinsAwarded: number }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const existing = await sql`SELECT * FROM daily_calendar_claims
    WHERE agent_id = ${agentId} AND year = ${year} AND month = ${month} AND day = ${day}`;
  if (existing.length > 0) throw new Error('Already claimed today');

  const reward = await sql`SELECT day, reward_type AS "rewardType", reward_value AS "rewardValue", description
    FROM daily_calendar_rewards WHERE day = ${day}`;
  if (reward.length === 0) throw new Error('No reward configured for today');

  const todayReward = reward[0];
  await sql`INSERT INTO daily_calendar_claims (agent_id, year, month, day)
    VALUES (${agentId}, ${year}, ${month}, ${day})`;

  const coinsAwarded = todayReward.rewardType === 'coins' ? todayReward.rewardValue : 0;
  if (coinsAwarded > 0) {
    await sql`UPDATE agent_balances SET coins = coins + ${coinsAwarded} WHERE agent_id = ${agentId}`;
  }

  return { ...todayReward, claimed: true, coinsAwarded };
}

/** Get full month calendar with claimed status */
export async function getCalendar(agentId: string, sql: any): Promise<CalendarReward[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const rewards = await sql`SELECT day, reward_type AS "rewardType", reward_value AS "rewardValue", description
    FROM daily_calendar_rewards ORDER BY day ASC`;
  const claims = await sql`SELECT day FROM daily_calendar_claims
    WHERE agent_id = ${agentId} AND year = ${year} AND month = ${month}`;
  const claimedDays = new Set(claims.map((c: any) => c.day));

  return rewards.map((r: any) => ({ ...r, claimed: claimedDays.has(r.day) }));
}

/** Get which days agent has claimed this month */
export async function getClaimedDays(agentId: string, sql: any): Promise<number[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const claims = await sql`SELECT day FROM daily_calendar_claims
    WHERE agent_id = ${agentId} AND year = ${year} AND month = ${month} ORDER BY day ASC`;
  return claims.map((c: any) => c.day);
}

/** Get monthly progress (claimed/total, total coins earned) */
export async function getMonthlyProgress(agentId: string, sql: any): Promise<MonthlyProgress> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentDay = now.getDate();

  const claims = await sql`SELECT c.day, r.reward_value AS "rewardValue"
    FROM daily_calendar_claims c
    JOIN daily_calendar_rewards r ON c.day = r.day
    WHERE c.agent_id = ${agentId} AND c.year = ${year} AND c.month = ${month}`;

  const claimed = claims.length;
  const total = currentDay;
  const coinsEarned = claims.reduce((sum: number, c: any) => sum + c.rewardValue, 0);
  const claimRate = total > 0 ? Math.round((claimed / total) * 100) : 0;

  return { claimed, total, coinsEarned, claimRate };
}

/** Get days agent didn't claim this month */
export async function getMissedDays(agentId: string, sql: any): Promise<number[]> {
  const now = new Date();
  const currentDay = now.getDate();
  const claimedDays = await getClaimedDays(agentId, sql);
  const claimedSet = new Set(claimedDays);
  const missed: number[] = [];
  for (let day = 1; day < currentDay; day++) {
    if (!claimedSet.has(day)) missed.push(day);
  }
  return missed;
}

/** Get streak bonus (consecutive claims this month, bonus 10% per consecutive day) */
export async function getStreakBonus(agentId: string, sql: any): Promise<{ streak: number; bonusPercent: number }> {
  const claimedDays = await getClaimedDays(agentId, sql);
  if (claimedDays.length === 0) return { streak: 0, bonusPercent: 0 };

  let streak = 1;
  for (let i = claimedDays.length - 1; i > 0; i--) {
    if (claimedDays[i] - claimedDays[i - 1] === 1) streak++;
    else break;
  }
  return { streak, bonusPercent: streak * 10 };
}
