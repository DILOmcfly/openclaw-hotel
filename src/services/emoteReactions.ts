/** Emote Reactions Service - Manage agent reactions to content */

export type EmoteReaction = {
  id: number;
  targetType: string;
  targetId: string;
  agentId: string;
  emote: string;
  createdAt: Date;
};

export type GroupedReaction = {
  emote: string;
  count: number;
  reactors: string[];
};

const MAX_UNIQUE_EMOTES_PER_TARGET = 20;

/** Add a reaction (one per agent per emote per target) */
export async function addReaction(
  targetType: string,
  targetId: string,
  agentId: string,
  emote: string,
  sql: any
): Promise<EmoteReaction | null> {
  const uniqueEmotes = await sql`
    SELECT DISTINCT emote FROM emote_reactions
    WHERE target_type = ${targetType} AND target_id = ${targetId}
  `;

  if (uniqueEmotes.length >= MAX_UNIQUE_EMOTES_PER_TARGET) {
    const hasEmote = uniqueEmotes.some((r: any) => r.emote === emote);
    if (!hasEmote) return null;
  }

  const result = await sql`
    INSERT INTO emote_reactions (target_type, target_id, agent_id, emote)
    VALUES (${targetType}, ${targetId}, ${agentId}, ${emote})
    ON CONFLICT (target_type, target_id, agent_id, emote) DO NOTHING
    RETURNING id, target_type AS "targetType", target_id AS "targetId",
              agent_id AS "agentId", emote, created_at AS "createdAt"
  `;

  return result[0] || null;
}

/** Remove a reaction */
export async function removeReaction(
  targetType: string,
  targetId: string,
  agentId: string,
  emote: string,
  sql: any
): Promise<boolean> {
  const result = await sql`
    DELETE FROM emote_reactions
    WHERE target_type = ${targetType} AND target_id = ${targetId}
      AND agent_id = ${agentId} AND emote = ${emote}
    RETURNING id
  `;
  return result.length > 0;
}

/** Get reactions for a target, grouped by emote */
export async function getReactions(
  targetType: string,
  targetId: string,
  sql: any
): Promise<GroupedReaction[]> {
  const reactions = await sql`
    SELECT emote, agent_id AS "agentId"
    FROM emote_reactions
    WHERE target_type = ${targetType} AND target_id = ${targetId}
    ORDER BY created_at ASC
  `;

  const grouped = reactions.reduce((acc: Record<string, string[]>, r: any) => {
    if (!acc[r.emote]) acc[r.emote] = [];
    acc[r.emote].push(r.agentId);
    return acc;
  }, {});

  return Object.entries(grouped).map(([emote, reactors]) => ({
    emote,
    count: (reactors as string[]).length,
    reactors: reactors as string[],
  }));
}

/** Get what an agent has reacted to */
export async function getAgentReactions(agentId: string, limit: number, sql: any): Promise<EmoteReaction[]> {
  const result = await sql`
    SELECT id, target_type AS "targetType", target_id AS "targetId",
           agent_id AS "agentId", emote, created_at AS "createdAt"
    FROM emote_reactions
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result;
}

/** Get most popular emotes globally */
export async function getPopularEmotes(limit: number, sql: any): Promise<{ emote: string; count: number }[]> {
  const result = await sql`
    SELECT emote, COUNT(*) AS count
    FROM emote_reactions
    GROUP BY emote
    ORDER BY count DESC
    LIMIT ${limit}
  `;
  return result.map((r: any) => ({ emote: r.emote, count: parseInt(r.count) }));
}

/** Get total reaction count for a target */
export async function getReactionCount(targetType: string, targetId: string, sql: any): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) AS count
    FROM emote_reactions
    WHERE target_type = ${targetType} AND target_id = ${targetId}
  `;
  return parseInt(result[0]?.count || 0);
}
