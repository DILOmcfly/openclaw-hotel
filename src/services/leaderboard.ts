/**
 * Leaderboard Service - Rankings across various categories
 */

export type LeaderboardCategory = 'coins' | 'trades' | 'friends' | 'achievements' | 'games_won';

export type LeaderboardEntry = {
  rank: number;
  agentId: string;
  displayName: string;
  value: number;
};

/**
 * Validate leaderboard category
 */
export function isValidCategory(category: string): category is LeaderboardCategory {
  return ['coins', 'trades', 'friends', 'achievements', 'games_won'].includes(category);
}

/**
 * Get leaderboard for a specific category
 */
export async function getLeaderboard(
  category: LeaderboardCategory,
  limit: number,
  sql: any
): Promise<LeaderboardEntry[]> {
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  let query;

  switch (category) {
    case 'coins':
      query = sql`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY ab.coins DESC) AS rank,
          a.id AS "agentId",
          a.display_name AS "displayName",
          ab.coins AS value
        FROM agent_balances ab
        JOIN agents a ON ab.agent_id = a.id::text
        WHERE a.banned = false
        ORDER BY ab.coins DESC
        LIMIT ${limit}
      `;
      break;

    case 'trades':
      query = sql`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY trade_count DESC) AS rank,
          a.id AS "agentId",
          a.display_name AS "displayName",
          trade_count AS value
        FROM (
          SELECT 
            initiator_id AS agent_id,
            COUNT(*) AS trade_count
          FROM trades
          WHERE status = 'accepted'
          GROUP BY initiator_id
          UNION ALL
          SELECT 
            target_id AS agent_id,
            COUNT(*) AS trade_count
          FROM trades
          WHERE status = 'accepted'
          GROUP BY target_id
        ) t
        JOIN agents a ON t.agent_id = a.id
        WHERE a.banned = false
        GROUP BY a.id, a.display_name
        ORDER BY SUM(trade_count) DESC
        LIMIT ${limit}
      `;
      break;

    case 'friends':
      query = sql`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY friend_count DESC) AS rank,
          a.id AS "agentId",
          a.display_name AS "displayName",
          friend_count AS value
        FROM (
          SELECT 
            requester_id AS agent_id,
            COUNT(*) AS friend_count
          FROM friendships
          WHERE status = 'accepted'
          GROUP BY requester_id
          UNION ALL
          SELECT 
            addressee_id AS agent_id,
            COUNT(*) AS friend_count
          FROM friendships
          WHERE status = 'accepted'
          GROUP BY addressee_id
        ) f
        JOIN agents a ON f.agent_id = a.id
        WHERE a.banned = false
        GROUP BY a.id, a.display_name
        ORDER BY SUM(friend_count) DESC
        LIMIT ${limit}
      `;
      break;

    case 'achievements':
      query = sql`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY achievement_count DESC) AS rank,
          a.id AS "agentId",
          a.display_name AS "displayName",
          achievement_count AS value
        FROM (
          SELECT 
            agent_id,
            COUNT(*) AS achievement_count
          FROM agent_achievements
          GROUP BY agent_id
        ) ac
        JOIN agents a ON ac.agent_id = a.id
        WHERE a.banned = false
        ORDER BY achievement_count DESC
        LIMIT ${limit}
      `;
      break;

    case 'games_won':
      // Games are currently in-memory only, return empty for now
      return [];

    default:
      throw new Error(`Invalid category: ${category}`);
  }

  const results = await query;
  
  return results.map((row: any) => ({
    rank: Number(row.rank),
    agentId: row.agentId,
    displayName: row.displayName,
    value: Number(row.value),
  }));
}

/**
 * Get agent's rank in a specific category
 */
export async function getAgentRank(
  agentId: string,
  category: LeaderboardCategory,
  sql: any
): Promise<number | null> {
  let query;

  switch (category) {
    case 'coins':
      query = sql`
        SELECT rank FROM (
          SELECT 
            a.id AS agent_id,
            ROW_NUMBER() OVER (ORDER BY ab.coins DESC) AS rank
          FROM agent_balances ab
          JOIN agents a ON ab.agent_id = a.id::text
          WHERE a.banned = false
        ) ranked
        WHERE agent_id::text = ${agentId}
      `;
      break;

    case 'trades':
      query = sql`
        SELECT rank FROM (
          SELECT 
            a.id AS agent_id,
            ROW_NUMBER() OVER (ORDER BY SUM(trade_count) DESC) AS rank
          FROM (
            SELECT 
              initiator_id AS agent_id,
              COUNT(*) AS trade_count
            FROM trades
            WHERE status = 'accepted'
            GROUP BY initiator_id
            UNION ALL
            SELECT 
              target_id AS agent_id,
              COUNT(*) AS trade_count
            FROM trades
            WHERE status = 'accepted'
            GROUP BY target_id
          ) t
          JOIN agents a ON t.agent_id = a.id
          WHERE a.banned = false
          GROUP BY a.id
        ) ranked
        WHERE agent_id::text = ${agentId}
      `;
      break;

    case 'friends':
      query = sql`
        SELECT rank FROM (
          SELECT 
            a.id AS agent_id,
            ROW_NUMBER() OVER (ORDER BY SUM(friend_count) DESC) AS rank
          FROM (
            SELECT 
              requester_id AS agent_id,
              COUNT(*) AS friend_count
            FROM friendships
            WHERE status = 'accepted'
            GROUP BY requester_id
            UNION ALL
            SELECT 
              addressee_id AS agent_id,
              COUNT(*) AS friend_count
            FROM friendships
            WHERE status = 'accepted'
            GROUP BY addressee_id
          ) f
          JOIN agents a ON f.agent_id = a.id
          WHERE a.banned = false
          GROUP BY a.id
        ) ranked
        WHERE agent_id::text = ${agentId}
      `;
      break;

    case 'achievements':
      query = sql`
        SELECT rank FROM (
          SELECT 
            a.id AS agent_id,
            ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS rank
          FROM agent_achievements aa
          JOIN agents a ON aa.agent_id = a.id
          WHERE a.banned = false
          GROUP BY a.id
        ) ranked
        WHERE agent_id::text = ${agentId}
      `;
      break;

    case 'games_won':
      // Games are in-memory only
      return null;

    default:
      throw new Error(`Invalid category: ${category}`);
  }

  const results = await query;
  
  if (results.length === 0) {
    return null;
  }

  return Number(results[0].rank);
}
