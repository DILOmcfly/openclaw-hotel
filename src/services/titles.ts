/**
 * Titles Service - Manage agent titles and ranks
 */

export type Title = {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  requirementType: 'messages' | 'trades' | 'friends' | 'rooms_created' | 'games_won' | 'photos' | 'gifts_sent' | 'manual' | null;
  requirementValue: number;
  icon: string;
  createdAt: string;
};

export type EarnedTitle = Title & {
  isActive: boolean;
  earnedAt: string;
};

/**
 * Get all available titles
 */
export async function getAllTitles(sql: any): Promise<Title[]> {
  const titles = await sql`
    SELECT id, name, description, rarity, requirement_type AS "requirementType",
           requirement_value AS "requirementValue", icon, created_at AS "createdAt"
    FROM agent_titles
    ORDER BY 
      CASE rarity
        WHEN 'common' THEN 1
        WHEN 'uncommon' THEN 2
        WHEN 'rare' THEN 3
        WHEN 'epic' THEN 4
        WHEN 'legendary' THEN 5
      END,
      requirement_value ASC
  `;
  return titles;
}

/**
 * Get titles earned by an agent
 */
export async function getEarnedTitles(agentId: string, sql: any): Promise<EarnedTitle[]> {
  const titles = await sql`
    SELECT 
      t.id, t.name, t.description, t.rarity, t.requirement_type AS "requirementType",
      t.requirement_value AS "requirementValue", t.icon, t.created_at AS "createdAt",
      e.is_active AS "isActive", e.earned_at AS "earnedAt"
    FROM agent_titles t
    INNER JOIN agent_earned_titles e ON t.id = e.title_id
    WHERE e.agent_id = ${agentId}
    ORDER BY e.earned_at DESC
  `;
  return titles;
}

/**
 * Award a title to an agent
 */
export async function awardTitle(agentId: string, titleId: string, sql: any): Promise<void> {
  // Check if already earned
  const existing = await sql`
    SELECT 1 FROM agent_earned_titles
    WHERE agent_id = ${agentId} AND title_id = ${titleId}
  `;

  if (existing.length > 0) {
    return; // Already has this title
  }

  await sql`
    INSERT INTO agent_earned_titles (agent_id, title_id, is_active, earned_at)
    VALUES (${agentId}, ${titleId}, false, NOW())
  `;
}

/**
 * Set a title as active (deactivate all others for this agent)
 */
export async function setActiveTitle(agentId: string, titleId: string, sql: any): Promise<void> {
  // Verify agent has earned this title
  const earned = await sql`
    SELECT 1 FROM agent_earned_titles
    WHERE agent_id = ${agentId} AND title_id = ${titleId}
  `;

  if (earned.length === 0) {
    throw new Error('Title not earned');
  }

  // Deactivate all titles for this agent
  await sql`
    UPDATE agent_earned_titles
    SET is_active = false
    WHERE agent_id = ${agentId}
  `;

  // Activate the selected title
  await sql`
    UPDATE agent_earned_titles
    SET is_active = true
    WHERE agent_id = ${agentId} AND title_id = ${titleId}
  `;
}

/**
 * Get the active title for an agent
 */
export async function getActiveTitle(agentId: string, sql: any): Promise<EarnedTitle | null> {
  const result = await sql`
    SELECT 
      t.id, t.name, t.description, t.rarity, t.requirement_type AS "requirementType",
      t.requirement_value AS "requirementValue", t.icon, t.created_at AS "createdAt",
      e.is_active AS "isActive", e.earned_at AS "earnedAt"
    FROM agent_titles t
    INNER JOIN agent_earned_titles e ON t.id = e.title_id
    WHERE e.agent_id = ${agentId} AND e.is_active = true
    LIMIT 1
  `;

  return result.length > 0 ? result[0] : null;
}

/**
 * Check eligibility and auto-award titles based on agent's stats
 */
export async function checkEligibility(agentId: string, sql: any): Promise<string[]> {
  const awarded: string[] = [];

  // Get all non-manual titles
  const titles = await sql`
    SELECT id, requirement_type AS "requirementType", requirement_value AS "requirementValue"
    FROM agent_titles
    WHERE requirement_type IS NOT NULL AND requirement_type != 'manual'
  `;

  for (const title of titles) {
    // Skip if already earned
    const hasTitle = await sql`
      SELECT 1 FROM agent_earned_titles
      WHERE agent_id = ${agentId} AND title_id = ${title.id}
    `;
    if (hasTitle.length > 0) continue;

    // Check requirement
    let count = 0;
    switch (title.requirementType) {
      case 'messages':
        const msgCount = await sql`
          SELECT COUNT(*) AS count FROM messages WHERE agent_id = ${agentId}
        `;
        count = parseInt(msgCount[0]?.count || '0', 10);
        break;

      case 'trades':
        const tradeCount = await sql`
          SELECT COUNT(*) AS count FROM trade_history
          WHERE (initiator_id = ${agentId} OR receiver_id = ${agentId}) AND status = 'completed'
        `;
        count = parseInt(tradeCount[0]?.count || '0', 10);
        break;

      case 'friends':
        const friendCount = await sql`
          SELECT COUNT(*) AS count FROM friendships WHERE agent_id = ${agentId} AND status = 'accepted'
        `;
        count = parseInt(friendCount[0]?.count || '0', 10);
        break;

      case 'rooms_created':
        const roomCount = await sql`
          SELECT COUNT(*) AS count FROM rooms WHERE owner_id = ${agentId}
        `;
        count = parseInt(roomCount[0]?.count || '0', 10);
        break;

      case 'games_won':
        const gamesCount = await sql`
          SELECT COUNT(*) AS count FROM game_results WHERE winner_id = ${agentId}
        `;
        count = parseInt(gamesCount[0]?.count || '0', 10);
        break;

      case 'photos':
        const photoCount = await sql`
          SELECT COUNT(*) AS count FROM photo_gallery WHERE agent_id = ${agentId}
        `;
        count = parseInt(photoCount[0]?.count || '0', 10);
        break;

      case 'gifts_sent':
        const giftCount = await sql`
          SELECT COUNT(*) AS count FROM gift_history WHERE sender_id = ${agentId}
        `;
        count = parseInt(giftCount[0]?.count || '0', 10);
        break;
    }

    // Award if eligible
    if (count >= title.requirementValue) {
      await awardTitle(agentId, title.id, sql);
      awarded.push(title.id);
    }
  }

  return awarded;
}
