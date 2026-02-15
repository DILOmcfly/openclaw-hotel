/**
 * Achievements V2 Service - Skill-based achievement system
 */

export type Achievement = {
  id: number;
  name: string;
  description: string;
  category: string;
  points: number;
  requirementType: string;
  requirementValue: number;
  icon: string;
};

export type AgentAchievement = {
  agentId: string;
  achievementId: number;
  unlockedAt: Date;
};

export type AchievementProgress = {
  achievement: Achievement;
  progress: number;
  unlocked: boolean;
  unlockedAt: Date | null;
};

/**
 * Get all available achievements
 */
export async function getAllAchievements(sql: any): Promise<Achievement[]> {
  const result = await sql`
    SELECT id, name, description, category, points,
           requirement_type AS "requirementType",
           requirement_value AS "requirementValue",
           icon
    FROM achievements
    ORDER BY category, points ASC
  `;
  return result;
}

/**
 * Get agent's unlocked achievements
 */
export async function getAgentAchievements(agentId: string, sql: any): Promise<Achievement[]> {
  const result = await sql`
    SELECT a.id, a.name, a.description, a.category, a.points,
           a.requirement_type AS "requirementType",
           a.requirement_value AS "requirementValue",
           a.icon
    FROM achievements a
    INNER JOIN agent_achievements aa ON a.id = aa.achievement_id
    WHERE aa.agent_id = ${agentId}
    ORDER BY aa.unlocked_at DESC
  `;
  return result;
}

/**
 * Calculate progress for a specific requirement type
 */
async function getAgentProgress(agentId: string, requirementType: string, sql: any): Promise<number> {
  switch (requirementType) {
    case 'friends_count': {
      const result = await sql`
        SELECT COUNT(*) AS count FROM friendships
        WHERE (agent_id = ${agentId} OR friend_id = ${agentId}) AND status = 'accepted'
      `;
      return parseInt(result[0]?.count || '0');
    }
    case 'messages_sent': {
      const result = await sql`
        SELECT COUNT(*) AS count FROM chat_messages WHERE agent_id = ${agentId}
      `;
      return parseInt(result[0]?.count || '0');
    }
    case 'rooms_visited': {
      const result = await sql`
        SELECT COUNT(DISTINCT room_id) AS count FROM room_visits WHERE agent_id = ${agentId}
      `;
      return parseInt(result[0]?.count || '0');
    }
    case 'items_owned': {
      const result = await sql`
        SELECT COUNT(*) AS count FROM agent_inventory WHERE agent_id = ${agentId}
      `;
      return parseInt(result[0]?.count || '0');
    }
    case 'rare_item_owned': {
      const result = await sql`
        SELECT COUNT(*) AS count FROM agent_inventory ai
        INNER JOIN furniture f ON ai.furniture_id = f.id
        WHERE ai.agent_id = ${agentId} AND f.rarity = 'rare'
      `;
      return parseInt(result[0]?.count || '0');
    }
    case 'games_won': {
      const result = await sql`
        SELECT COUNT(*) AS count FROM game_results WHERE winner_id = ${agentId}
      `;
      return parseInt(result[0]?.count || '0');
    }
    case 'coins_earned': {
      const result = await sql`
        SELECT COALESCE(SUM(amount), 0) AS total FROM coin_transactions
        WHERE agent_id = ${agentId} AND amount > 0
      `;
      return parseInt(result[0]?.total || '0');
    }
    case 'coins_spent': {
      const result = await sql`
        SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM coin_transactions
        WHERE agent_id = ${agentId} AND amount < 0
      `;
      return parseInt(result[0]?.total || '0');
    }
    case 'rooms_created': {
      const result = await sql`
        SELECT COUNT(*) AS count FROM rooms WHERE owner_id = ${agentId}
      `;
      return parseInt(result[0]?.count || '0');
    }
    default:
      return 0;
  }
}

/**
 * Get achievement progress for an agent (percentage complete)
 */
export async function getAchievementProgress(agentId: string, sql: any): Promise<AchievementProgress[]> {
  const allAchievements = await getAllAchievements(sql);
  const unlocked = await sql`
    SELECT achievement_id AS "achievementId", unlocked_at AS "unlockedAt"
    FROM agent_achievements WHERE agent_id = ${agentId}
  `;
  
  const unlockedMap = new Map(unlocked.map((u: any) => [u.achievementId, u.unlockedAt]));
  
  const progressList: AchievementProgress[] = [];
  
  for (const achievement of allAchievements) {
    const currentProgress = await getAgentProgress(agentId, achievement.requirementType, sql);
    const percentage = Math.min(100, Math.floor((currentProgress / achievement.requirementValue) * 100));
    
    progressList.push({
      achievement,
      progress: percentage,
      unlocked: unlockedMap.has(achievement.id),
      unlockedAt: unlockedMap.get(achievement.id) ?? null,
    });
  }
  
  return progressList;
}

/**
 * Check and unlock achievements for an agent
 */
export async function checkAndUnlock(agentId: string, sql: any): Promise<Achievement[]> {
  const allAchievements = await getAllAchievements(sql);
  const unlocked = await sql`
    SELECT achievement_id AS "achievementId" FROM agent_achievements WHERE agent_id = ${agentId}
  `;
  
  const unlockedIds = new Set(unlocked.map((u: any) => u.achievementId));
  const newlyUnlocked: Achievement[] = [];
  
  for (const achievement of allAchievements) {
    if (unlockedIds.has(achievement.id)) continue;
    
    const currentProgress = await getAgentProgress(agentId, achievement.requirementType, sql);
    
    if (currentProgress >= achievement.requirementValue) {
      await sql`
        INSERT INTO agent_achievements (agent_id, achievement_id, unlocked_at)
        VALUES (${agentId}, ${achievement.id}, NOW())
        ON CONFLICT DO NOTHING
      `;
      newlyUnlocked.push(achievement);
    }
  }
  
  return newlyUnlocked;
}

/**
 * Get achievements leaderboard by total points
 */
export async function getLeaderboard(limit: number, sql: any): Promise<Array<{agentId: string; totalPoints: number; achievementCount: number}>> {
  const result = await sql`
    SELECT aa.agent_id AS "agentId",
           COALESCE(SUM(a.points), 0) AS "totalPoints",
           COUNT(aa.achievement_id) AS "achievementCount"
    FROM agent_achievements aa
    INNER JOIN achievements a ON aa.achievement_id = a.id
    GROUP BY aa.agent_id
    ORDER BY "totalPoints" DESC, "achievementCount" DESC
    LIMIT ${limit}
  `;
  
  return result.map((r: any) => ({
    agentId: r.agentId,
    totalPoints: parseInt(r.totalPoints),
    achievementCount: parseInt(r.achievementCount),
  }));
}
