/**
 * Agent Skills Service - Manages skill learning and progression
 */

export type Skill = {
  id: number;
  name: string;
  description: string;
  category: string;
  maxLevel: number;
  xpPerLevel: number;
  createdAt: Date;
};

export type AgentSkill = {
  agentId: string;
  skillId: number;
  level: number;
  xp: number;
  unlockedAt: Date;
  skillName?: string;
  skillCategory?: string;
  progressPercent?: number;
};

/**
 * Get all available skills
 */
export async function getAllSkills(sql: any): Promise<Skill[]> {
  const result = await sql`
    SELECT id, name, description, category,
           max_level AS "maxLevel",
           xp_per_level AS "xpPerLevel",
           created_at AS "createdAt"
    FROM skills
    ORDER BY category, name
  `;
  return result;
}

/**
 * Learn a new skill (first-time unlock)
 * Cost: skill level × 50 coins
 */
export async function learnSkill(agentId: string, skillId: number, sql: any): Promise<AgentSkill> {
  // Check if already learned
  const existing = await sql`
    SELECT agent_id AS "agentId", skill_id AS "skillId",
           level, xp, unlocked_at AS "unlockedAt"
    FROM agent_skills
    WHERE agent_id = ${agentId} AND skill_id = ${skillId}
  `;

  if (existing.length > 0) {
    throw new Error('Skill already learned');
  }

  // Get skill info
  const skill = await sql`
    SELECT id, max_level AS "maxLevel"
    FROM skills
    WHERE id = ${skillId}
  `;

  if (skill.length === 0) {
    throw new Error('Skill not found');
  }

  const cost = 50; // Level 1 cost: 1 × 50

  // Check balance
  const balance = await sql`
    SELECT coins FROM agent_balances WHERE agent_id = ${agentId}
  `;

  if (balance.length === 0 || balance[0].coins < cost) {
    throw new Error('Insufficient coins');
  }

  // Deduct coins
  await sql`
    UPDATE agent_balances
    SET coins = coins - ${cost}
    WHERE agent_id = ${agentId}
  `;

  // Insert skill
  const result = await sql`
    INSERT INTO agent_skills (agent_id, skill_id, level, xp)
    VALUES (${agentId}, ${skillId}, 1, 0)
    RETURNING agent_id AS "agentId", skill_id AS "skillId",
              level, xp, unlocked_at AS "unlockedAt"
  `;

  return result[0];
}

/**
 * Add XP to a skill and check for level up
 */
export async function addSkillXP(
  agentId: string,
  skillId: number,
  xpAmount: number,
  sql: any
): Promise<{ levelUp: boolean; newLevel: number; xp: number }> {
  // Get current skill progress
  const agentSkill = await sql`
    SELECT level, xp FROM agent_skills
    WHERE agent_id = ${agentId} AND skill_id = ${skillId}
  `;

  if (agentSkill.length === 0) {
    throw new Error('Skill not learned yet');
  }

  // Get skill max level and xp per level
  const skill = await sql`
    SELECT max_level AS "maxLevel", xp_per_level AS "xpPerLevel"
    FROM skills WHERE id = ${skillId}
  `;

  if (skill.length === 0) {
    throw new Error('Skill not found');
  }

  let currentLevel = agentSkill[0].level;
  let currentXP = agentSkill[0].xp + xpAmount;
  const { maxLevel, xpPerLevel } = skill[0];
  let levelUp = false;

  // Check for level up
  while (currentXP >= xpPerLevel && currentLevel < maxLevel) {
    currentXP -= xpPerLevel;
    currentLevel += 1;
    levelUp = true;
  }

  // Cap XP at max level
  if (currentLevel >= maxLevel) {
    currentLevel = maxLevel;
    currentXP = 0;
  }

  // Update skill
  await sql`
    UPDATE agent_skills
    SET level = ${currentLevel}, xp = ${currentXP}
    WHERE agent_id = ${agentId} AND skill_id = ${skillId}
  `;

  return { levelUp, newLevel: currentLevel, xp: currentXP };
}

/**
 * Get all skills for an agent with progress percentage
 */
export async function getAgentSkills(agentId: string, sql: any): Promise<AgentSkill[]> {
  const result = await sql`
    SELECT 
      ags.agent_id AS "agentId",
      ags.skill_id AS "skillId",
      ags.level,
      ags.xp,
      ags.unlocked_at AS "unlockedAt",
      s.name AS "skillName",
      s.category AS "skillCategory",
      s.max_level AS "maxLevel",
      s.xp_per_level AS "xpPerLevel"
    FROM agent_skills ags
    JOIN skills s ON ags.skill_id = s.id
    WHERE ags.agent_id = ${agentId}
    ORDER BY s.category, s.name
  `;

  return result.map((row: any) => ({
    agentId: row.agentId,
    skillId: row.skillId,
    level: row.level,
    xp: row.xp,
    unlockedAt: row.unlockedAt,
    skillName: row.skillName,
    skillCategory: row.skillCategory,
    progressPercent: row.level >= row.maxLevel ? 100 : Math.floor((row.xp / row.xpPerLevel) * 100),
  }));
}

/**
 * Get skill level for an agent
 */
export async function getSkillLevel(agentId: string, skillId: number, sql: any): Promise<number> {
  const result = await sql`
    SELECT level FROM agent_skills
    WHERE agent_id = ${agentId} AND skill_id = ${skillId}
  `;
  return result.length > 0 ? result[0].level : 0;
}

/**
 * Get top skilled agents by total skill levels
 */
export async function getTopSkilledAgents(limit: number, sql: any): Promise<any[]> {
  const result = await sql`
    SELECT agent_id AS "agentId",
           SUM(level) AS "totalLevels",
           COUNT(*) AS "skillsLearned"
    FROM agent_skills
    GROUP BY agent_id
    ORDER BY "totalLevels" DESC, "skillsLearned" DESC
    LIMIT ${limit}
  `;
  return result;
}

/**
 * Get skill recommendations for an agent
 * Returns skills they haven't learned in their most active category
 */
export async function getSkillRecommendations(agentId: string, sql: any): Promise<Skill[]> {
  // Find agent's most active category
  const mostActive = await sql`
    SELECT s.category, COUNT(*) AS count
    FROM agent_skills ags
    JOIN skills s ON ags.skill_id = s.id
    WHERE ags.agent_id = ${agentId}
    GROUP BY s.category
    ORDER BY count DESC
    LIMIT 1
  `;

  const category = mostActive.length > 0 ? mostActive[0].category : 'social';

  // Get unlearned skills in that category
  const result = await sql`
    SELECT id, name, description, category,
           max_level AS "maxLevel",
           xp_per_level AS "xpPerLevel",
           created_at AS "createdAt"
    FROM skills
    WHERE category = ${category}
      AND id NOT IN (
        SELECT skill_id FROM agent_skills WHERE agent_id = ${agentId}
      )
    ORDER BY name
    LIMIT 3
  `;

  return result;
}
