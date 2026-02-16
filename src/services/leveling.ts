// Leveling Service - Manages agent XP, levels, and rewards

export type AgentLevel = {
  agentId: string;
  xp: number;
  level: number;
  totalXpEarned: number;
  updatedAt: Date;
};

export type LevelReward = {
  level: number;
  title: string;
  rewardCoins: number;
  description: string;
};

export type LevelUpResult = {
  leveledUp: boolean;
  newLevel: number;
  reward: LevelReward | null;
};

export type LevelProgress = {
  agentId: string;
  xp: number;
  level: number;
  totalXpEarned: number;
  xpForNextLevel: number;
  progressPercent: number;
};

// Calculate XP required for a given level (formula: level^2 * 100)
export function getLevelRequirement(level: number): number {
  if (level <= 1) return 0;
  return level * level * 100;
}

// Calculate current level from total XP
export function calculateLevel(totalXp: number): number {
  let level = 1;
  while (getLevelRequirement(level + 1) <= totalXp) {
    level++;
  }
  return level;
}

// Add XP to agent and check for level up
export async function addXP(agentId: string, xpToAdd: number, sql: any): Promise<LevelUpResult> {
  if (xpToAdd <= 0) throw new Error('XP amount must be positive');

  const existing = await sql`
    SELECT agent_id AS "agentId",
           xp,
           level,
           total_xp_earned AS "totalXpEarned",
           updated_at AS "updatedAt"
    FROM agent_levels
    WHERE agent_id = ${agentId}
  `;

  const currentXp = existing.length > 0 ? existing[0].totalXpEarned : 0;
  const currentLevel = existing.length > 0 ? existing[0].level : 1;
  const newTotalXp = currentXp + xpToAdd;
  const newLevel = calculateLevel(newTotalXp);
  const leveledUp = newLevel > currentLevel;

  await sql`
    INSERT INTO agent_levels (agent_id, xp, level, total_xp_earned, updated_at)
    VALUES (${agentId}, ${newTotalXp}, ${newLevel}, ${newTotalXp}, NOW())
    ON CONFLICT (agent_id) DO UPDATE SET
      xp = ${newTotalXp},
      level = ${newLevel},
      total_xp_earned = ${newTotalXp},
      updated_at = NOW()
  `;

  let reward: LevelReward | null = null;
  if (leveledUp) {
    const rewardResult = await sql`
      SELECT level, title, reward_coins AS "rewardCoins", description
      FROM level_rewards
      WHERE level = ${newLevel}
    `;

    if (rewardResult.length > 0) {
      reward = rewardResult[0];
      if (reward && reward.rewardCoins > 0) {
        await sql`
          INSERT INTO agent_balances (agent_id, coins)
          VALUES (${agentId}, ${reward!.rewardCoins})
          ON CONFLICT (agent_id) DO UPDATE SET
            coins = agent_balances.coins + ${reward!.rewardCoins}
        `;
      }
    }
  }

  return {
    leveledUp,
    newLevel,
    reward,
  };
}

/**
 * Get agent's current level and progress
 */
export async function getLevel(agentId: string, sql: any): Promise<LevelProgress> {
  const result = await sql`
    SELECT agent_id AS "agentId",
           xp,
           level,
           total_xp_earned AS "totalXpEarned",
           updated_at AS "updatedAt"
    FROM agent_levels
    WHERE agent_id = ${agentId}
  `;

  if (result.length === 0) {
    return {
      agentId,
      xp: 0,
      level: 1,
      totalXpEarned: 0,
      xpForNextLevel: getLevelRequirement(2),
      progressPercent: 0,
    };
  }

  const levelData = result[0];
  const xpForNextLevel = getLevelRequirement(levelData.level + 1);
  const xpForCurrentLevel = getLevelRequirement(levelData.level);
  const xpProgress = levelData.totalXpEarned - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const progressPercent = xpNeeded > 0 ? Math.floor((xpProgress / xpNeeded) * 100) : 100;

  return {
    agentId: levelData.agentId,
    xp: levelData.xp,
    level: levelData.level,
    totalXpEarned: levelData.totalXpEarned,
    xpForNextLevel,
    progressPercent,
  };
}

/**
 * Get level leaderboard (top agents by level and XP)
 */
export async function getLeaderboard(limit: number, sql: any): Promise<AgentLevel[]> {
  const result = await sql`
    SELECT agent_id AS "agentId",
           xp,
           level,
           total_xp_earned AS "totalXpEarned",
           updated_at AS "updatedAt"
    FROM agent_levels
    ORDER BY level DESC, total_xp_earned DESC
    LIMIT ${limit}
  `;

  return result;
}

/**
 * Get reward info for a specific level
 */
export async function getLevelReward(level: number, sql: any): Promise<LevelReward | null> {
  const result = await sql`
    SELECT level, title, reward_coins AS "rewardCoins", description
    FROM level_rewards
    WHERE level = ${level}
  `;

  return result.length > 0 ? result[0] : null;
}
