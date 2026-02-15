/** Room Leaderboards Service - Configurable leaderboards for rooms */
export type Leaderboard = {
  id: number; roomId: number; name: string | null; metric: string; sortOrder: 'asc' | 'desc';
  maxEntries: number; resetPeriod: 'never' | 'daily' | 'weekly' | 'monthly';
  lastReset: Date | null; createdBy: string | null; createdAt: Date;
};
export type LeaderboardEntry = { agentId: string; score: number; rank: number; updatedAt: Date; };

/** Create a new leaderboard (owner only, max 5 per room) */
export async function createLeaderboard(
  roomId: number, ownerId: string,
  data: { name?: string; metric: string; sortOrder?: 'asc' | 'desc'; maxEntries?: number; resetPeriod?: 'never' | 'daily' | 'weekly' | 'monthly'; },
  sql: any
): Promise<Leaderboard> {
  const room = await sql`SELECT created_by FROM rooms WHERE id = ${roomId}`;
  if (room.length === 0 || room[0].created_by !== ownerId) throw new Error('Only room owner can create leaderboards');
  
  const existing = await sql`SELECT COUNT(*) as count FROM room_leaderboards WHERE room_id = ${roomId}`;
  if (parseInt(existing[0].count) >= 5) throw new Error('Maximum 5 leaderboards per room');

  const result = await sql`
    INSERT INTO room_leaderboards (room_id, name, metric, sort_order, max_entries, reset_period, created_by)
    VALUES (${roomId}, ${data.name || null}, ${data.metric}, ${data.sortOrder || 'desc'}, 
            ${data.maxEntries || 100}, ${data.resetPeriod || 'never'}, ${ownerId})
    RETURNING id, room_id AS "roomId", name, metric, sort_order AS "sortOrder", 
              max_entries AS "maxEntries", reset_period AS "resetPeriod", 
              last_reset AS "lastReset", created_by AS "createdBy", created_at AS "createdAt"
  `;
  return result[0];
}

/** Submit a score (update if better based on sort order) */
export async function submitScore(
  leaderboardId: number, agentId: string, score: number, sql: any
): Promise<{ updated: boolean; rank: number }> {
  const lb = await sql`SELECT sort_order AS "sortOrder" FROM room_leaderboards WHERE id = ${leaderboardId}`;
  if (lb.length === 0) throw new Error('Leaderboard not found');

  const existing = await sql`SELECT score FROM leaderboard_entries 
                             WHERE leaderboard_id = ${leaderboardId} AND agent_id = ${agentId}`;
  const shouldUpdate = existing.length === 0 || 
    (lb[0].sortOrder === 'desc' && score > existing[0].score) ||
    (lb[0].sortOrder === 'asc' && score < existing[0].score);

  if (shouldUpdate) {
    await sql`INSERT INTO leaderboard_entries (leaderboard_id, agent_id, score)
      VALUES (${leaderboardId}, ${agentId}, ${score})
      ON CONFLICT (leaderboard_id, agent_id) DO UPDATE SET score = ${score}, updated_at = NOW()`;
  }

  const rank = await getAgentRank(leaderboardId, agentId, sql);
  return { updated: shouldUpdate, rank: rank?.rank || 0 };
}

/** Get leaderboard with ranked entries */
export async function getLeaderboard(leaderboardId: number, limit: number, sql: any): Promise<LeaderboardEntry[]> {
  const lb = await sql`SELECT sort_order AS "sortOrder", max_entries AS "maxEntries" 
                        FROM room_leaderboards WHERE id = ${leaderboardId}`;
  if (lb.length === 0) return [];

  const order = lb[0].sortOrder === 'desc' ? sql`DESC` : sql`ASC`;
  const maxLimit = Math.min(limit, lb[0].maxEntries);

  const entries = await sql`
    SELECT agent_id AS "agentId", score, updated_at AS "updatedAt",
           ROW_NUMBER() OVER (ORDER BY score ${order}) as rank
    FROM leaderboard_entries
    WHERE leaderboard_id = ${leaderboardId}
    ORDER BY score ${order}
    LIMIT ${maxLimit}
  `;
  return entries;
}

/** Get agent's rank and score on a specific leaderboard */
export async function getAgentRank(
  leaderboardId: number, agentId: string, sql: any
): Promise<{ rank: number; score: number } | null> {
  const lb = await sql`SELECT sort_order AS "sortOrder" FROM room_leaderboards WHERE id = ${leaderboardId}`;
  if (lb.length === 0) return null;

  const order = lb[0].sortOrder === 'desc' ? sql`DESC` : sql`ASC`;
  const result = await sql`
    WITH ranked AS (
      SELECT agent_id AS "agentId", score, ROW_NUMBER() OVER (ORDER BY score ${order}) as rank
      FROM leaderboard_entries
      WHERE leaderboard_id = ${leaderboardId}
    )
    SELECT rank, score FROM ranked WHERE "agentId" = ${agentId}
  `;
  return result.length > 0 ? result[0] : null;
}

/** Reset leaderboard (owner only or auto-reset) */
export async function resetLeaderboard(leaderboardId: number, requesterId: string, sql: any): Promise<void> {
  const lb = await sql`SELECT created_by FROM room_leaderboards WHERE id = ${leaderboardId}`;
  if (lb.length === 0) throw new Error('Leaderboard not found');
  if (lb[0].created_by !== requesterId) throw new Error('Only owner can reset leaderboard');

  await sql`DELETE FROM leaderboard_entries WHERE leaderboard_id = ${leaderboardId}`;
  await sql`UPDATE room_leaderboards SET last_reset = NOW() WHERE id = ${leaderboardId}`;
}

/** Delete leaderboard (owner only) */
export async function deleteLeaderboard(leaderboardId: number, requesterId: string, sql: any): Promise<void> {
  const lb = await sql`SELECT created_by FROM room_leaderboards WHERE id = ${leaderboardId}`;
  if (lb.length === 0) throw new Error('Leaderboard not found');
  if (lb[0].created_by !== requesterId) throw new Error('Only owner can delete leaderboard');

  await sql`DELETE FROM room_leaderboards WHERE id = ${leaderboardId}`;
}

/** Get all leaderboards for a room */
export async function getRoomLeaderboards(roomId: number, sql: any): Promise<Leaderboard[]> {
  const result = await sql`
    SELECT id, room_id AS "roomId", name, metric, sort_order AS "sortOrder",
           max_entries AS "maxEntries", reset_period AS "resetPeriod",
           last_reset AS "lastReset", created_by AS "createdBy", created_at AS "createdAt"
    FROM room_leaderboards
    WHERE room_id = ${roomId}
    ORDER BY created_at DESC
  `;
  return result;
}

/** Get all leaderboards where an agent has a score */
export async function getAgentScores(agentId: string, sql: any): Promise<Array<Leaderboard & { score: number; rank: number }>> {
  const result = await sql`
    SELECT l.id, l.room_id AS "roomId", l.name, l.metric, l.sort_order AS "sortOrder",
           l.max_entries AS "maxEntries", l.reset_period AS "resetPeriod",
           l.last_reset AS "lastReset", l.created_by AS "createdBy", l.created_at AS "createdAt",
           e.score
    FROM room_leaderboards l
    JOIN leaderboard_entries e ON e.leaderboard_id = l.id
    WHERE e.agent_id = ${agentId}
    ORDER BY e.updated_at DESC
  `;

  const withRanks = await Promise.all(result.map(async (entry: any) => {
    const rankInfo = await getAgentRank(entry.id, agentId, sql);
    return { ...entry, rank: rankInfo?.rank || 0 };
  }));
  return withRanks;
}
