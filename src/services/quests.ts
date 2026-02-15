/**
 * Quests Service - Manages agent daily/weekly/special quests
 */

export type Quest = {
  id: number;
  name: string;
  description: string;
  questType: 'daily' | 'weekly' | 'special';
  requirementType: string;
  requirementValue: number;
  rewardCoins: number;
  rewardXp: number;
  active: boolean;
  createdAt: Date;
};

export type AgentQuest = Quest & {
  progress: number;
  completed: boolean;
  completedAt: Date | null;
  assignedAt: Date;
};

/**
 * Get all available quests (optionally filtered by type)
 */
export async function getAvailableQuests(
  sql: any,
  questType?: 'daily' | 'weekly' | 'special'
): Promise<Quest[]> {
  const filter = questType
    ? sql`WHERE active = true AND quest_type = ${questType}`
    : sql`WHERE active = true`;

  const result = await sql`
    SELECT id, name, description,
           quest_type AS "questType",
           requirement_type AS "requirementType",
           requirement_value AS "requirementValue",
           reward_coins AS "rewardCoins",
           reward_xp AS "rewardXp",
           active,
           created_at AS "createdAt"
    FROM quests
    ${filter}
    ORDER BY quest_type, id
  `;

  return result;
}

/**
 * Assign all active daily quests to an agent
 */
export async function assignDailyQuests(agentId: string, sql: any): Promise<number> {
  const dailyQuests = await getAvailableQuests(sql, 'daily');

  let assigned = 0;
  for (const quest of dailyQuests) {
    await sql`
      INSERT INTO agent_quests (agent_id, quest_id, progress, completed, assigned_at)
      VALUES (${agentId}, ${quest.id}, 0, false, NOW())
      ON CONFLICT (agent_id, quest_id) DO NOTHING
    `;
    assigned++;
  }

  return assigned;
}

/**
 * Get agent's quests with completion status
 */
export async function getAgentQuests(
  agentId: string,
  sql: any,
  questType?: 'daily' | 'weekly' | 'special'
): Promise<AgentQuest[]> {
  const typeFilter = questType ? sql`AND q.quest_type = ${questType}` : sql``;

  const result = await sql`
    SELECT q.id, q.name, q.description,
           q.quest_type AS "questType",
           q.requirement_type AS "requirementType",
           q.requirement_value AS "requirementValue",
           q.reward_coins AS "rewardCoins",
           q.reward_xp AS "rewardXp",
           q.active,
           q.created_at AS "createdAt",
           aq.progress,
           aq.completed,
           aq.completed_at AS "completedAt",
           aq.assigned_at AS "assignedAt"
    FROM agent_quests aq
    JOIN quests q ON aq.quest_id = q.id
    WHERE aq.agent_id = ${agentId} ${typeFilter}
    ORDER BY q.quest_type, q.id
  `;

  return result;
}

/**
 * Update quest progress and auto-complete if requirement met
 */
export async function updateProgress(
  agentId: string,
  questId: number,
  increment: number,
  sql: any
): Promise<AgentQuest | null> {
  // Get quest details
  const questResult = await sql`
    SELECT q.requirement_value AS "requirementValue"
    FROM quests q
    WHERE q.id = ${questId}
  `;

  if (questResult.length === 0) return null;

  const { requirementValue } = questResult[0];

  // Update progress
  const updated = await sql`
    UPDATE agent_quests
    SET progress = LEAST(progress + ${increment}, ${requirementValue})
    WHERE agent_id = ${agentId} AND quest_id = ${questId} AND completed = false
    RETURNING progress
  `;

  if (updated.length === 0) return null;

  const newProgress = updated[0].progress;

  // Auto-complete if requirement met
  if (newProgress >= requirementValue) {
    await sql`
      UPDATE agent_quests
      SET completed = true, completed_at = NOW()
      WHERE agent_id = ${agentId} AND quest_id = ${questId}
    `;
  }

  // Return updated quest
  const result = await getAgentQuests(agentId, sql);
  return result.find((q) => q.id === questId) || null;
}

/**
 * Claim quest reward (add coins to balance)
 */
export async function claimReward(
  agentId: string,
  questId: number,
  sql: any
): Promise<{ coins: number; xp: number } | null> {
  // Check if quest is completed and not yet claimed
  const questResult = await sql`
    SELECT aq.completed, q.reward_coins AS "rewardCoins", q.reward_xp AS "rewardXp"
    FROM agent_quests aq
    JOIN quests q ON aq.quest_id = q.id
    WHERE aq.agent_id = ${agentId} AND aq.quest_id = ${questId}
  `;

  if (questResult.length === 0 || !questResult[0].completed) {
    return null;
  }

  const { rewardCoins, rewardXp } = questResult[0];

  // Award coins
  await sql`
    UPDATE agent_balances
    SET coins = coins + ${rewardCoins}
    WHERE agent_id = ${agentId}
  `;

  return { coins: rewardCoins, xp: rewardXp };
}
