export type Badge = {
  id: number; name: string; description: string; icon: string; category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  maxSupply: number | null; createdAt: Date;
};

export type AgentBadge = {
  agentId: string; badgeId: number; equipped: boolean; earnedAt: Date;
};

export type BadgeWithStatus = Badge & { equipped: boolean; earnedAt: Date; };

const MAX_EQUIPPED_BADGES = 3;

export async function getAllBadges(sql: any): Promise<Badge[]> {
  return await sql`
    SELECT id, name, description, icon, category, rarity,
           max_supply AS "maxSupply", created_at AS "createdAt"
    FROM badges
    ORDER BY CASE rarity WHEN 'legendary' THEN 1 WHEN 'epic' THEN 2 
      WHEN 'rare' THEN 3 WHEN 'uncommon' THEN 4 WHEN 'common' THEN 5 END, name ASC
  `;
}

export async function awardBadge(agentId: string, badgeId: number, sql: any): Promise<AgentBadge | null> {
  const badge = await sql`SELECT id, max_supply AS "maxSupply" FROM badges WHERE id = ${badgeId}`;
  if (badge.length === 0) return null;

  if (badge[0].maxSupply !== null) {
    const holders = await sql`SELECT COUNT(*) AS count FROM agent_badges WHERE badge_id = ${badgeId}`;
    if (holders[0].count >= badge[0].maxSupply) return null;
  }

  const result = await sql`
    INSERT INTO agent_badges (agent_id, badge_id, equipped, earned_at)
    VALUES (${agentId}, ${badgeId}, false, NOW())
    ON CONFLICT (agent_id, badge_id) DO NOTHING
    RETURNING agent_id AS "agentId", badge_id AS "badgeId", equipped, earned_at AS "earnedAt"
  `;
  return result.length > 0 ? result[0] : null;
}

export async function getAgentBadges(agentId: string, sql: any): Promise<BadgeWithStatus[]> {
  return await sql`
    SELECT b.id, b.name, b.description, b.icon, b.category, b.rarity,
           b.max_supply AS "maxSupply", b.created_at AS "createdAt",
           ab.equipped, ab.earned_at AS "earnedAt"
    FROM badges b INNER JOIN agent_badges ab ON b.id = ab.badge_id
    WHERE ab.agent_id = ${agentId} ORDER BY ab.earned_at DESC
  `;
}

export async function equipBadge(agentId: string, badgeId: number, sql: any): Promise<boolean> {
  const owned = await sql`SELECT badge_id FROM agent_badges WHERE agent_id = ${agentId} AND badge_id = ${badgeId}`;
  if (owned.length === 0) return false;

  const equipped = await sql`SELECT COUNT(*) AS count FROM agent_badges WHERE agent_id = ${agentId} AND equipped = true`;
  if (equipped[0].count >= MAX_EQUIPPED_BADGES) return false;

  await sql`UPDATE agent_badges SET equipped = true WHERE agent_id = ${agentId} AND badge_id = ${badgeId}`;
  return true;
}

export async function unequipBadge(agentId: string, badgeId: number, sql: any): Promise<boolean> {
  const result = await sql`UPDATE agent_badges SET equipped = false 
    WHERE agent_id = ${agentId} AND badge_id = ${badgeId} RETURNING badge_id`;
  return result.length > 0;
}

export async function getBadgeHolders(badgeId: number, sql: any): Promise<string[]> {
  const result = await sql`SELECT agent_id AS "agentId" FROM agent_badges 
    WHERE badge_id = ${badgeId} ORDER BY earned_at ASC`;
  return result.map((r: any) => r.agentId);
}

export async function getEquippedBadges(agentId: string, sql: any): Promise<BadgeWithStatus[]> {
  return await sql`
    SELECT b.id, b.name, b.description, b.icon, b.category, b.rarity,
           b.max_supply AS "maxSupply", b.created_at AS "createdAt",
           ab.equipped, ab.earned_at AS "earnedAt"
    FROM badges b INNER JOIN agent_badges ab ON b.id = ab.badge_id
    WHERE ab.agent_id = ${agentId} AND ab.equipped = true ORDER BY ab.earned_at ASC
  `;
}
