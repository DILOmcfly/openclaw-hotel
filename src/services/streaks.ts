/**
 * Streaks Service - Manages agent login streaks and rewards
 */

export type Streak = {
  agentId: string;
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: Date | null;
  totalLogins: number;
  streakCoinsEarned: number;
  updatedAt: Date;
};

const MAX_STREAK_REWARD = 500;
const REWARD_PER_STREAK = 10;

/**
 * Calculate reward coins for a given streak
 * Formula: streak × 10, capped at 500
 */
export function getStreakReward(streak: number): number {
  if (streak <= 0) return 0;
  return Math.min(streak * REWARD_PER_STREAK, MAX_STREAK_REWARD);
}

/**
 * Check if agent has logged in today
 */
export async function hasLoggedInToday(agentId: string, sql: any): Promise<boolean> {
  const result = await sql`
    SELECT last_login_date
    FROM agent_streaks
    WHERE agent_id = ${agentId}
  `;

  if (result.length === 0) return false;

  const lastLogin = result[0].last_login_date;
  if (!lastLogin) return false;

  const today = new Date().toISOString().split('T')[0];
  const lastLoginDate = new Date(lastLogin).toISOString().split('T')[0];

  return today === lastLoginDate;
}

/**
 * Record a login and update streak
 * Returns updated streak info with coins awarded
 */
export async function recordLogin(agentId: string, sql: any): Promise<Streak & { coinsAwarded: number }> {
  // Check if already logged in today
  if (await hasLoggedInToday(agentId, sql)) {
    const current = await getStreak(agentId, sql);
    return { ...current, coinsAwarded: 0 };
  }

  // Get current streak data
  const existing = await sql`
    SELECT agent_id AS "agentId", 
           current_streak AS "currentStreak",
           longest_streak AS "longestStreak",
           last_login_date AS "lastLoginDate",
           total_logins AS "totalLogins",
           streak_coins_earned AS "streakCoinsEarned",
           updated_at AS "updatedAt"
    FROM agent_streaks
    WHERE agent_id = ${agentId}
  `;

  const today = new Date().toISOString().split('T')[0];
  let newStreak = 1;
  let longestStreak = 1;

  if (existing.length > 0) {
    const lastLogin = existing[0].lastLoginDate;
    
    if (lastLogin) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const lastLoginStr = new Date(lastLogin).toISOString().split('T')[0];

      // Consecutive day: increment streak
      if (lastLoginStr === yesterdayStr) {
        newStreak = existing[0].currentStreak + 1;
      }
      // Gap: reset to 1
    }

    longestStreak = Math.max(existing[0].longestStreak, newStreak);
  }

  const coinsAwarded = getStreakReward(newStreak);

  // Update streak record
  const updated = await sql`
    INSERT INTO agent_streaks (
      agent_id, current_streak, longest_streak, last_login_date, 
      total_logins, streak_coins_earned, updated_at
    )
    VALUES (
      ${agentId}, ${newStreak}, ${longestStreak}, ${today}, 
      1, ${coinsAwarded}, NOW()
    )
    ON CONFLICT (agent_id) DO UPDATE SET
      current_streak = ${newStreak},
      longest_streak = ${longestStreak},
      last_login_date = ${today},
      total_logins = agent_streaks.total_logins + 1,
      streak_coins_earned = agent_streaks.streak_coins_earned + ${coinsAwarded},
      updated_at = NOW()
    RETURNING 
      agent_id AS "agentId",
      current_streak AS "currentStreak",
      longest_streak AS "longestStreak",
      last_login_date AS "lastLoginDate",
      total_logins AS "totalLogins",
      streak_coins_earned AS "streakCoinsEarned",
      updated_at AS "updatedAt"
  `;

  // Award coins to balance
  if (coinsAwarded > 0) {
    await sql`
      UPDATE agent_balances
      SET coins = coins + ${coinsAwarded}
      WHERE agent_id = ${agentId}
    `;
  }

  return { ...updated[0], coinsAwarded };
}

/**
 * Get agent's current streak info
 */
export async function getStreak(agentId: string, sql: any): Promise<Streak> {
  const result = await sql`
    SELECT agent_id AS "agentId",
           current_streak AS "currentStreak",
           longest_streak AS "longestStreak",
           last_login_date AS "lastLoginDate",
           total_logins AS "totalLogins",
           streak_coins_earned AS "streakCoinsEarned",
           updated_at AS "updatedAt"
    FROM agent_streaks
    WHERE agent_id = ${agentId}
  `;

  if (result.length === 0) {
    // Return default values for new agent
    return {
      agentId,
      currentStreak: 0,
      longestStreak: 0,
      lastLoginDate: null,
      totalLogins: 0,
      streakCoinsEarned: 0,
      updatedAt: new Date(),
    };
  }

  return result[0];
}

/**
 * Get top streaks leaderboard
 */
export async function getTopStreaks(limit: number, sql: any): Promise<Streak[]> {
  const result = await sql`
    SELECT agent_id AS "agentId",
           current_streak AS "currentStreak",
           longest_streak AS "longestStreak",
           last_login_date AS "lastLoginDate",
           total_logins AS "totalLogins",
           streak_coins_earned AS "streakCoinsEarned",
           updated_at AS "updatedAt"
    FROM agent_streaks
    WHERE current_streak > 0
    ORDER BY current_streak DESC, longest_streak DESC
    LIMIT ${limit}
  `;

  return result;
}
