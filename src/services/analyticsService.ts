/**
 * Analytics Service - Agent activity tracking and statistics
 * Provides insights into agent behavior for spectators
 */

export type AnalyticsMetric = 
  | 'messages_sent'
  | 'rooms_visited' 
  | 'trades_completed'
  | 'games_won'
  | 'friends_count';

export type AgentAnalytics = {
  rank: number;
  agentId: string;
  displayName: string;
  value: number;
  change?: number; // Change since last period (optional)
};

export type TimelinePoint = {
  timestamp: number;
  value: number;
};

export type AgentTimeline = {
  agentId: string;
  displayName: string;
  metric: AnalyticsMetric;
  dataPoints: TimelinePoint[];
};

/**
 * Validate analytics metric
 */
export function isValidMetric(metric: string): metric is AnalyticsMetric {
  return [
    'messages_sent',
    'rooms_visited',
    'trades_completed',
    'games_won',
    'friends_count',
  ].includes(metric);
}

/**
 * Get top agents for a specific metric
 */
export async function getTopAgents(
  metric: AnalyticsMetric,
  limit: number,
  sql: any
): Promise<AgentAnalytics[]> {
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  let query;

  switch (metric) {
    case 'messages_sent':
      // Count messages from chat_messages table (if exists)
      // For now, use a mock query that returns empty or calculates from activity_log
      query = sql`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY message_count DESC) AS rank,
          a.id AS "agentId",
          a.display_name AS "displayName",
          COALESCE(msg_count.message_count, 0) AS value
        FROM agents a
        LEFT JOIN (
          SELECT 
            agent_id,
            COUNT(*) AS message_count
          FROM activity_log
          WHERE action = 'chat'
          GROUP BY agent_id
        ) msg_count ON msg_count.agent_id = a.id
        WHERE a.banned = false
          AND COALESCE(msg_count.message_count, 0) > 0
        ORDER BY value DESC
        LIMIT ${limit}
      `;
      break;

    case 'rooms_visited':
      // Count unique rooms visited from activity_log
      query = sql`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY room_count DESC) AS rank,
          a.id AS "agentId",
          a.display_name AS "displayName",
          COALESCE(visits.room_count, 0) AS value
        FROM agents a
        LEFT JOIN (
          SELECT 
            agent_id,
            COUNT(DISTINCT room_id) AS room_count
          FROM activity_log
          WHERE action = 'room_enter'
          GROUP BY agent_id
        ) visits ON visits.agent_id = a.id
        WHERE a.banned = false
          AND COALESCE(visits.room_count, 0) > 0
        ORDER BY value DESC
        LIMIT ${limit}
      `;
      break;

    case 'trades_completed':
      // Count completed trades
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

    case 'games_won':
      // Count game wins from activity_log or games table
      query = sql`
        SELECT 
          ROW_NUMBER() OVER (ORDER BY win_count DESC) AS rank,
          a.id AS "agentId",
          a.display_name AS "displayName",
          COALESCE(wins.win_count, 0) AS value
        FROM agents a
        LEFT JOIN (
          SELECT 
            agent_id,
            COUNT(*) AS win_count
          FROM activity_log
          WHERE action = 'game_won'
          GROUP BY agent_id
        ) wins ON wins.agent_id = a.id
        WHERE a.banned = false
          AND COALESCE(wins.win_count, 0) > 0
        ORDER BY value DESC
        LIMIT ${limit}
      `;
      break;

    case 'friends_count':
      // Count friends (accepted friendships)
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

    default:
      throw new Error(`Invalid metric: ${metric}`);
  }

  try {
    const results = await query;
    
    return results.map((row: any) => ({
      rank: Number(row.rank),
      agentId: row.agentId,
      displayName: row.displayName,
      value: Number(row.value),
    }));
  } catch (error) {
    console.error(`[Analytics] Error fetching top agents for ${metric}:`, error);
    // Return empty array if tables don't exist yet
    return [];
  }
}

/**
 * Get agent activity timeline for a specific metric over time
 */
export async function getAgentTimeline(
  agentId: string,
  metric: AnalyticsMetric,
  hours: number,
  sql: any
): Promise<AgentTimeline> {
  if (hours < 1 || hours > 168) { // Max 1 week
    throw new Error('Hours must be between 1 and 168 (1 week)');
  }

  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Get agent display name
  const agentQuery = sql`
    SELECT display_name FROM agents WHERE id = ${agentId} LIMIT 1
  `;
  const agentResult = await agentQuery;
  const displayName = agentResult.length > 0 ? agentResult[0].display_name : 'Unknown';

  let query;

  switch (metric) {
    case 'messages_sent':
      query = sql`
        SELECT 
          strftime('%s', created_at) * 1000 AS timestamp,
          COUNT(*) OVER (ORDER BY created_at) AS value
        FROM activity_log
        WHERE agent_id = ${agentId}
          AND action = 'chat'
          AND created_at >= ${cutoffTime}
        ORDER BY created_at ASC
      `;
      break;

    case 'rooms_visited':
      query = sql`
        SELECT 
          strftime('%s', created_at) * 1000 AS timestamp,
          COUNT(DISTINCT room_id) OVER (ORDER BY created_at) AS value
        FROM activity_log
        WHERE agent_id = ${agentId}
          AND action = 'room_enter'
          AND created_at >= ${cutoffTime}
        ORDER BY created_at ASC
      `;
      break;

    case 'trades_completed':
      query = sql`
        SELECT 
          strftime('%s', created_at) * 1000 AS timestamp,
          ROW_NUMBER() OVER (ORDER BY created_at) AS value
        FROM trades
        WHERE (initiator_id = ${agentId} OR target_id = ${agentId})
          AND status = 'accepted'
          AND created_at >= ${cutoffTime}
        ORDER BY created_at ASC
      `;
      break;

    case 'games_won':
      query = sql`
        SELECT 
          strftime('%s', created_at) * 1000 AS timestamp,
          COUNT(*) OVER (ORDER BY created_at) AS value
        FROM activity_log
        WHERE agent_id = ${agentId}
          AND action = 'game_won'
          AND created_at >= ${cutoffTime}
        ORDER BY created_at ASC
      `;
      break;

    case 'friends_count':
      query = sql`
        SELECT 
          strftime('%s', created_at) * 1000 AS timestamp,
          ROW_NUMBER() OVER (ORDER BY created_at) AS value
        FROM friendships
        WHERE (requester_id = ${agentId} OR addressee_id = ${agentId})
          AND status = 'accepted'
          AND created_at >= ${cutoffTime}
        ORDER BY created_at ASC
      `;
      break;

    default:
      throw new Error(`Invalid metric: ${metric}`);
  }

  try {
    const results = await query;
    
    const dataPoints: TimelinePoint[] = results.map((row: any) => ({
      timestamp: Number(row.timestamp),
      value: Number(row.value),
    }));

    return {
      agentId,
      displayName,
      metric,
      dataPoints,
    };
  } catch (error) {
    console.error(`[Analytics] Error fetching timeline for agent ${agentId}:`, error);
    // Return empty timeline if tables don't exist
    return {
      agentId,
      displayName,
      metric,
      dataPoints: [],
    };
  }
}

/**
 * Get analytics summary (top 5 agents across all metrics)
 */
export async function getAnalyticsSummary(sql: any) {
  const summary: Record<string, AgentAnalytics[]> = {};

  const metrics: AnalyticsMetric[] = [
    'messages_sent',
    'rooms_visited',
    'trades_completed',
    'games_won',
    'friends_count',
  ];

  for (const metric of metrics) {
    try {
      summary[metric] = await getTopAgents(metric, 5, sql);
    } catch (error) {
      console.error(`[Analytics] Error in summary for ${metric}:`, error);
      summary[metric] = [];
    }
  }

  return summary;
}
