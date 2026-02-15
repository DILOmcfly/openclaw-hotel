/**
 * Daily Challenges Service
 * Manages daily challenges for agents to complete for rewards
 */

export type DailyChallenge = {
  id: string;
  title: string;
  description: string;
  challengeType: string;
  targetCount: number;
  rewardCoins: number;
  rewardTitleId: string | null;
  activeDate: string;
  createdAt: string;
};

export type ChallengeProgress = {
  challengeId: string;
  agentId: string;
  currentCount: number;
  completed: boolean;
  completedAt: string | null;
};

export type ChallengeWithProgress = DailyChallenge & {
  currentCount: number;
  completed: boolean;
  completedAt: string | null;
};

/**
 * Get today's active challenges
 */
export async function getTodayChallenges(sql: any): Promise<DailyChallenge[]> {
  const rows = await sql`
    SELECT
      id,
      title,
      description,
      challenge_type AS "challengeType",
      target_count AS "targetCount",
      reward_coins AS "rewardCoins",
      reward_title_id AS "rewardTitleId",
      active_date AS "activeDate",
      created_at AS "createdAt"
    FROM daily_challenges
    WHERE active_date = CURRENT_DATE
    ORDER BY created_at ASC
  `;

  return rows;
}

/**
 * Get agent's progress for a specific challenge
 */
export async function getProgress(
  agentId: string,
  challengeId: string,
  sql: any
): Promise<ChallengeProgress | null> {
  const rows = await sql`
    SELECT
      challenge_id AS "challengeId",
      agent_id AS "agentId",
      current_count AS "currentCount",
      completed,
      completed_at AS "completedAt"
    FROM challenge_progress
    WHERE agent_id = ${agentId}
      AND challenge_id = ${challengeId}
  `;

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Increment progress for all matching active challenges
 */
export async function incrementProgress(
  agentId: string,
  challengeType: string,
  sql: any
): Promise<void> {
  // Get all active challenges of this type
  const challenges = await sql`
    SELECT id, target_count AS "targetCount"
    FROM daily_challenges
    WHERE challenge_type = ${challengeType}
      AND active_date = CURRENT_DATE
  `;

  for (const challenge of challenges) {
    // Insert or update progress
    await sql`
      INSERT INTO challenge_progress (challenge_id, agent_id, current_count, completed)
      VALUES (${challenge.id}, ${agentId}, 1, false)
      ON CONFLICT (challenge_id, agent_id)
      DO UPDATE SET
        current_count = LEAST(challenge_progress.current_count + 1, ${challenge.targetCount}),
        completed = CASE 
          WHEN challenge_progress.current_count + 1 >= ${challenge.targetCount} THEN true
          ELSE challenge_progress.completed
        END,
        completed_at = CASE
          WHEN challenge_progress.current_count + 1 >= ${challenge.targetCount} AND challenge_progress.completed = false THEN NOW()
          ELSE challenge_progress.completed_at
        END
    `;
  }
}

/**
 * Claim reward for completed challenge
 */
export async function claimReward(
  agentId: string,
  challengeId: string,
  sql: any
): Promise<{ success: boolean; coins?: number; error?: string }> {
  // Check if challenge is completed
  const progress = await getProgress(agentId, challengeId, sql);

  if (!progress) {
    return { success: false, error: 'Challenge not started' };
  }

  if (!progress.completed) {
    return { success: false, error: 'Challenge not completed yet' };
  }

  // Get challenge details
  const challenges = await sql`
    SELECT reward_coins AS "rewardCoins"
    FROM daily_challenges
    WHERE id = ${challengeId}
  `;

  if (challenges.length === 0) {
    return { success: false, error: 'Challenge not found' };
  }

  const rewardCoins = challenges[0].rewardCoins || 0;

  // Award coins to agent
  await sql`
    UPDATE agent_profiles
    SET coins = coins + ${rewardCoins}
    WHERE agent_id = ${agentId}
  `;

  // Mark as claimed by deleting progress (or you could add a 'claimed' field)
  await sql`
    DELETE FROM challenge_progress
    WHERE challenge_id = ${challengeId}
      AND agent_id = ${agentId}
  `;

  return { success: true, coins: rewardCoins };
}

/**
 * Get count of challenges completed today by agent
 */
export async function getCompletedToday(agentId: string, sql: any): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) AS count
    FROM challenge_progress cp
    JOIN daily_challenges dc ON cp.challenge_id = dc.id
    WHERE cp.agent_id = ${agentId}
      AND cp.completed = true
      AND dc.active_date = CURRENT_DATE
  `;

  return parseInt(rows[0]?.count || '0', 10);
}

/**
 * Get today's challenges with agent progress
 */
export async function getChallengesWithProgress(
  agentId: string,
  sql: any
): Promise<ChallengeWithProgress[]> {
  const rows = await sql`
    SELECT
      dc.id,
      dc.title,
      dc.description,
      dc.challenge_type AS "challengeType",
      dc.target_count AS "targetCount",
      dc.reward_coins AS "rewardCoins",
      dc.reward_title_id AS "rewardTitleId",
      dc.active_date AS "activeDate",
      dc.created_at AS "createdAt",
      COALESCE(cp.current_count, 0) AS "currentCount",
      COALESCE(cp.completed, false) AS completed,
      cp.completed_at AS "completedAt"
    FROM daily_challenges dc
    LEFT JOIN challenge_progress cp ON dc.id = cp.challenge_id AND cp.agent_id = ${agentId}
    WHERE dc.active_date = CURRENT_DATE
    ORDER BY dc.created_at ASC
  `;

  return rows;
}
