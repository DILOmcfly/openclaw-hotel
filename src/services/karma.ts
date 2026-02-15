/**
 * Karma Service - Manages agent karma and events
 */

export type KarmaAction = 'help' | 'gift' | 'trade_fair' | 'compliment' | 'report_valid' | 'spam' | 'scam' | 'grief' | 'toxic' | 'cheat';

export type KarmaEvent = {
  id: number;
  agentId: string;
  action: KarmaAction;
  points: number;
  sourceAgent: string | null;
  reason: string | null;
  createdAt: Date;
};

export type AgentKarma = {
  agentId: string;
  karma: number;
  positiveActions: number;
  negativeActions: number;
  lastAction: Date | null;
};

export type KarmaLevel = 'saint' | 'good' | 'neutral' | 'suspicious' | 'banned';

export const KARMA_POINTS: Record<KarmaAction, number> = {
  help: 5, gift: 3, trade_fair: 2, compliment: 1, report_valid: 5,
  spam: -3, scam: -10, grief: -5, toxic: -5, cheat: -10,
};

/**
 * Add a karma event and update agent karma
 */
export async function addKarmaEvent(
  agentId: string,
  action: KarmaAction,
  sql: any,
  sourceAgent?: string,
  reason?: string
): Promise<KarmaEvent> {
  const points = KARMA_POINTS[action];
  const isPositive = points > 0;

  const event = await sql`
    INSERT INTO karma_events (agent_id, action, points, source_agent, reason)
    VALUES (${agentId}, ${action}, ${points}, ${sourceAgent || null}, ${reason || null})
    RETURNING id, agent_id AS "agentId", action, points, source_agent AS "sourceAgent", reason, created_at AS "createdAt"
  `;

  await sql`
    INSERT INTO agent_karma (agent_id, karma, positive_actions, negative_actions, last_action)
    VALUES (${agentId}, ${points}, ${isPositive ? 1 : 0}, ${isPositive ? 0 : 1}, NOW())
    ON CONFLICT (agent_id) DO UPDATE SET
      karma = agent_karma.karma + ${points},
      positive_actions = agent_karma.positive_actions + ${isPositive ? 1 : 0},
      negative_actions = agent_karma.negative_actions + ${isPositive ? 0 : 1},
      last_action = NOW()
  `;

  return event[0];
}

/**
 * Get agent's current karma
 */
export async function getKarma(agentId: string, sql: any): Promise<AgentKarma> {
  const result = await sql`
    SELECT agent_id AS "agentId", karma, positive_actions AS "positiveActions",
           negative_actions AS "negativeActions", last_action AS "lastAction"
    FROM agent_karma WHERE agent_id = ${agentId}
  `;

  if (result.length === 0) {
    return { agentId, karma: 0, positiveActions: 0, negativeActions: 0, lastAction: null };
  }

  return result[0];
}

/**
 * Get karma event history (paginated)
 */
export async function getKarmaHistory(
  agentId: string,
  sql: any,
  limit = 50,
  offset = 0
): Promise<KarmaEvent[]> {
  const result = await sql`
    SELECT id, agent_id AS "agentId", action, points, source_agent AS "sourceAgent",
           reason, created_at AS "createdAt"
    FROM karma_events WHERE agent_id = ${agentId}
    ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;

  return result;
}

/**
 * Get karma leaderboard
 */
export async function getKarmaLeaderboard(limit: number, sql: any): Promise<AgentKarma[]> {
  const result = await sql`
    SELECT agent_id AS "agentId", karma, positive_actions AS "positiveActions",
           negative_actions AS "negativeActions", last_action AS "lastAction"
    FROM agent_karma ORDER BY karma DESC LIMIT ${limit}
  `;

  return result;
}

/**
 * Get karma level based on karma points
 */
export function getKarmaLevel(karma: number): KarmaLevel {
  if (karma > 100) return 'saint';
  if (karma > 50) return 'good';
  if (karma > -10) return 'neutral';
  if (karma > -50) return 'suspicious';
  return 'banned';
}

/**
 * Check if agent can perform action based on minimum karma
 */
export async function canPerformAction(agentId: string, minKarma: number, sql: any): Promise<boolean> {
  const { karma } = await getKarma(agentId, sql);
  return karma >= minKarma;
}
