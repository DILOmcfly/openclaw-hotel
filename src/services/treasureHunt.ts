/**
 * Treasure Hunt Service - Hidden items in rooms for agents to find
 */

export type TreasureHunt = {
  id: number; roomId: number; name: string | null; totalTreasures: number;
  rewardPerFind: number; bonusCompletion: number; status: 'active' | 'completed' | 'cancelled';
  createdBy: string | null; createdAt: Date;
};

export type HiddenTreasure = {
  id: number; huntId: number; x: number; y: number; hint: string | null;
  foundBy: string | null; foundAt: Date | null;
};

export type HuntParticipant = {
  huntId: number; agentId: string; foundCount: number; joinedAt: Date;
};

/**
 * Create a new treasure hunt with random treasure placement
 */
export async function createHunt(
  roomId: number, createdBy: string, name: string | null, totalTreasures: number,
  rewardPerFind: number, bonusCompletion: number, sql: any
): Promise<TreasureHunt> {
  const [hunt] = await sql`
    INSERT INTO treasure_hunts (room_id, name, total_treasures, reward_per_find, bonus_completion, created_by)
    VALUES (${roomId}, ${name}, ${totalTreasures}, ${rewardPerFind}, ${bonusCompletion}, ${createdBy})
    RETURNING id, room_id AS "roomId", name, total_treasures AS "totalTreasures",
              reward_per_find AS "rewardPerFind", bonus_completion AS "bonusCompletion",
              status, created_by AS "createdBy", created_at AS "createdAt"
  `;

  const usedPositions = new Set<string>();
  for (let i = 0; i < totalTreasures; i++) {
    let x: number, y: number, posKey: string;
    do {
      x = Math.floor(Math.random() * 30);
      y = Math.floor(Math.random() * 30);
      posKey = `${x},${y}`;
    } while (usedPositions.has(posKey));
    usedPositions.add(posKey);
    await sql`INSERT INTO hidden_treasures (hunt_id, x, y, hint)
              VALUES (${hunt.id}, ${x}, ${y}, ${`Search around (${x}, ${y})`})`;
  }
  return hunt;
}

/**
 * Join a treasure hunt
 */
export async function joinHunt(huntId: number, agentId: string, sql: any): Promise<HuntParticipant> {
  const [p] = await sql`
    INSERT INTO hunt_participants (hunt_id, agent_id) VALUES (${huntId}, ${agentId})
    ON CONFLICT (hunt_id, agent_id) DO UPDATE SET joined_at = hunt_participants.joined_at
    RETURNING hunt_id AS "huntId", agent_id AS "agentId", found_count AS "foundCount", joined_at AS "joinedAt"
  `;
  return p;
}

/**
 * Search a tile for treasure
 */
export async function searchTile(
  huntId: number, agentId: string, x: number, y: number, sql: any
): Promise<{ found: boolean; treasure?: HiddenTreasure; reward: number }> {
  const treasures = await sql`
    SELECT id, hunt_id AS "huntId", x, y, hint, found_by AS "foundBy", found_at AS "foundAt"
    FROM hidden_treasures WHERE hunt_id = ${huntId} AND x = ${x} AND y = ${y} AND found_by IS NULL
  `;
  if (treasures.length === 0) return { found: false, reward: 0 };

  const treasure = treasures[0];
  await sql`UPDATE hidden_treasures SET found_by = ${agentId}, found_at = NOW() WHERE id = ${treasure.id}`;
  await sql`
    INSERT INTO hunt_participants (hunt_id, agent_id, found_count) VALUES (${huntId}, ${agentId}, 1)
    ON CONFLICT (hunt_id, agent_id) DO UPDATE SET found_count = hunt_participants.found_count + 1
  `;

  const [hunt] = await sql`SELECT reward_per_find AS "rewardPerFind" FROM treasure_hunts WHERE id = ${huntId}`;
  const reward = hunt.rewardPerFind;
  await sql`UPDATE agent_balances SET coins = coins + ${reward} WHERE agent_id = ${agentId}`;

  treasure.foundBy = agentId;
  treasure.foundAt = new Date();
  return { found: true, treasure, reward };
}

/**
 * Get hunt progress for an agent
 */
export async function getHuntProgress(
  huntId: number, agentId: string, sql: any
): Promise<{ foundCount: number; totalTreasures: number; remaining: number }> {
  const [hunt] = await sql`SELECT total_treasures AS "totalTreasures" FROM treasure_hunts WHERE id = ${huntId}`;
  const participants = await sql`
    SELECT found_count AS "foundCount" FROM hunt_participants WHERE hunt_id = ${huntId} AND agent_id = ${agentId}
  `;
  const foundCount = participants.length > 0 ? participants[0].foundCount : 0;
  return { foundCount, totalTreasures: hunt.totalTreasures, remaining: hunt.totalTreasures - foundCount };
}

/**
 * Get hunt leaderboard
 */
export async function getLeaderboard(huntId: number, sql: any): Promise<HuntParticipant[]> {
  return await sql`
    SELECT hunt_id AS "huntId", agent_id AS "agentId", found_count AS "foundCount", joined_at AS "joinedAt"
    FROM hunt_participants WHERE hunt_id = ${huntId} ORDER BY found_count DESC, joined_at ASC
  `;
}

/**
 * End hunt and distribute completion bonuses
 */
export async function endHunt(huntId: number, sql: any): Promise<{ completedAgents: string[]; bonusAwarded: number }> {
  const [hunt] = await sql`
    SELECT total_treasures AS "totalTreasures", bonus_completion AS "bonusCompletion"
    FROM treasure_hunts WHERE id = ${huntId}
  `;
  const completers = await sql`
    SELECT agent_id AS "agentId" FROM hunt_participants
    WHERE hunt_id = ${huntId} AND found_count = ${hunt.totalTreasures}
  `;
  const completedAgents = completers.map((c: any) => c.agentId);
  
  // Batch update coins for all completers
  if (completedAgents.length > 0) {
    await sql`
      UPDATE agent_balances
      SET coins = coins + ${hunt.bonusCompletion}
      WHERE agent_id = ANY(${completedAgents})
    `;
  }
  
  await sql`UPDATE treasure_hunts SET status = 'completed' WHERE id = ${huntId}`;
  return { completedAgents, bonusAwarded: hunt.bonusCompletion };
}

/**
 * Get hunt history for a room
 */
export async function getHuntHistory(roomId: number, limit: number, sql: any): Promise<TreasureHunt[]> {
  return await sql`
    SELECT id, room_id AS "roomId", name, total_treasures AS "totalTreasures",
           reward_per_find AS "rewardPerFind", bonus_completion AS "bonusCompletion",
           status, created_by AS "createdBy", created_at AS "createdAt"
    FROM treasure_hunts WHERE room_id = ${roomId} ORDER BY created_at DESC LIMIT ${limit}
  `;
}
