/**
 * Achievement Service
 * Manages badges and achievement awards for agents
 */

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  conditionType: string;
  conditionValue: number;
  createdAt: string;
};

export type AgentAchievement = {
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  awardedAt: string;
};

export type AchievementWithStatus = Achievement & {
  earned: boolean;
  awardedAt: string | null;
};

/**
 * Get all available achievements
 */
export async function getAllAchievements(sql: any): Promise<Achievement[]> {
  const rows = await sql`
    SELECT
      id,
      name,
      description,
      icon,
      condition_type AS "conditionType",
      condition_value AS "conditionValue",
      created_at AS "createdAt"
    FROM achievements
    ORDER BY condition_value ASC, created_at ASC
  `;

  return rows;
}

/**
 * Get achievements earned by a specific agent
 */
export async function getAgentAchievements(agentId: string, sql: any): Promise<AgentAchievement[]> {
  const rows = await sql`
    SELECT
      a.id AS "achievementId",
      a.name,
      a.description,
      a.icon,
      aa.awarded_at AS "awardedAt"
    FROM agent_achievements aa
    JOIN achievements a ON aa.achievement_id = a.id
    WHERE aa.agent_id = ${agentId}
    ORDER BY aa.awarded_at DESC
  `;

  return rows;
}

/**
 * Get all achievements with earned status for an agent
 */
export async function getAchievementsWithStatus(
  agentId: string,
  sql: any
): Promise<AchievementWithStatus[]> {
  const rows = await sql`
    SELECT
      a.id,
      a.name,
      a.description,
      a.icon,
      a.condition_type AS "conditionType",
      a.condition_value AS "conditionValue",
      a.created_at AS "createdAt",
      CASE WHEN aa.agent_id IS NOT NULL THEN true ELSE false END AS earned,
      aa.awarded_at AS "awardedAt"
    FROM achievements a
    LEFT JOIN agent_achievements aa ON a.id = aa.achievement_id AND aa.agent_id = ${agentId}
    ORDER BY earned DESC, a.condition_value ASC, a.created_at ASC
  `;

  return rows;
}

/**
 * Award an achievement to an agent (idempotent)
 */
export async function awardBadge(
  agentId: string,
  achievementId: string,
  sql: any
): Promise<boolean> {
  try {
    const result = await sql`
      INSERT INTO agent_achievements (agent_id, achievement_id)
      VALUES (${agentId}, ${achievementId})
      ON CONFLICT (agent_id, achievement_id) DO NOTHING
      RETURNING agent_id
    `;

    return result.length > 0; // Returns true if newly awarded, false if already had it
  } catch (error) {
    console.error('[Achievements] Failed to award badge:', error);
    return false;
  }
}

/**
 * Check and award achievements based on event type
 */
export async function checkAndAward(
  agentId: string,
  eventType: 'login' | 'room_created' | 'trade_completed' | 'friend_added' | 'message_sent',
  sql: any
): Promise<string[]> {
  const awarded: string[] = [];

  // Map event types to condition types
  const conditionMap: Record<string, string> = {
    login: 'login_count',
    room_created: 'room_count',
    trade_completed: 'trade_count',
    friend_added: 'friends_count',
    message_sent: 'message_count',
  };

  const conditionType = conditionMap[eventType];
  if (!conditionType) return awarded;

  // Get current stats
  let currentValue = 0;

  if (conditionType === 'room_count' || conditionType === 'trade_count') {
    const profileRows = await sql`
      SELECT 
        COALESCE(room_count, 0) AS "roomCount",
        COALESCE(trade_count, 0) AS "tradeCount"
      FROM agent_profiles
      WHERE agent_id = ${agentId}
    `;
    
    if (profileRows.length > 0) {
      currentValue = conditionType === 'room_count' 
        ? profileRows[0].roomCount 
        : profileRows[0].tradeCount;
    }
  } else if (conditionType === 'friends_count') {
    const friendRows = await sql`
      SELECT COUNT(*) AS count
      FROM friendships
      WHERE (requester_id = ${agentId} OR addressee_id = ${agentId})
        AND status = 'accepted'
    `;
    currentValue = parseInt(friendRows[0]?.count || '0', 10);
  }

  // Find eligible achievements
  const eligibleAchievements = await sql`
    SELECT a.id, a.name
    FROM achievements a
    WHERE a.condition_type = ${conditionType}
      AND a.condition_value <= ${currentValue}
      AND NOT EXISTS (
        SELECT 1 FROM agent_achievements aa
        WHERE aa.agent_id = ${agentId} AND aa.achievement_id = a.id
      )
  `;

  // Award each eligible achievement
  for (const achievement of eligibleAchievements) {
    const wasAwarded = await awardBadge(agentId, achievement.id, sql);
    if (wasAwarded) {
      awarded.push(achievement.name);
    }
  }

  return awarded;
}
