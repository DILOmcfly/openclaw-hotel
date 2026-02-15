export type Reputation = {
  agentId: string;
  reputation: number;
  positiveCount: number;
  negativeCount: number;
  updatedAt: Date;
};

export type ReputationEvent = {
  id: number;
  agentId: string;
  givenBy: string | null;
  eventType: string;
  points: number;
  reason: string | null;
  createdAt: Date;
};

export type TrustLevel = {
  level: string;
  score: number;
  minRequired: number;
  maxRequired: number;
};

const EVENT_POINTS: Record<string, number> = {
  upvote: 5, downvote: -5, trade_success: 10, trade_fail: -10,
  report: -25, helpful: 15, scam: -50,
};

const TRUST_LEVELS = [
  { level: 'untrusted', min: -Infinity, max: -50 },
  { level: 'new', min: -49, max: 0 },
  { level: 'basic', min: 1, max: 50 },
  { level: 'trusted', min: 51, max: 150 },
  { level: 'verified', min: 151, max: 300 },
  { level: 'elite', min: 301, max: Infinity },
];
export async function addEvent(agentId: string, eventType: string, givenBy: string | null, reason: string | null, sql: any): Promise<ReputationEvent> {
  const points = EVENT_POINTS[eventType] || 0;
  const eventResult = await sql`
    INSERT INTO reputation_events (agent_id, given_by, event_type, points, reason)
    VALUES (${agentId}, ${givenBy}, ${eventType}, ${points}, ${reason})
    RETURNING id, agent_id AS "agentId", given_by AS "givenBy", event_type AS "eventType", points, reason, created_at AS "createdAt"
  `;
  const isPositive = points > 0;
  await sql`
    INSERT INTO agent_reputation (agent_id, reputation, positive_count, negative_count, updated_at)
    VALUES (${agentId}, ${points}, ${isPositive ? 1 : 0}, ${isPositive ? 0 : 1}, NOW())
    ON CONFLICT (agent_id) DO UPDATE SET
      reputation = agent_reputation.reputation + ${points},
      positive_count = agent_reputation.positive_count + ${isPositive ? 1 : 0},
      negative_count = agent_reputation.negative_count + ${isPositive ? 0 : 1},
      updated_at = NOW()
  `;
  return eventResult[0];
}
export async function getReputation(agentId: string, sql: any): Promise<Reputation> {
  const result = await sql`
    SELECT agent_id AS "agentId", reputation, positive_count AS "positiveCount", negative_count AS "negativeCount", updated_at AS "updatedAt"
    FROM agent_reputation WHERE agent_id = ${agentId}
  `;
  if (result.length === 0) {
    return { agentId, reputation: 0, positiveCount: 0, negativeCount: 0, updatedAt: new Date() };
  }
  return result[0];
}

export async function getReputationHistory(agentId: string, limit: number = 20, offset: number = 0, sql: any): Promise<ReputationEvent[]> {
  return await sql`
    SELECT id, agent_id AS "agentId", given_by AS "givenBy", event_type AS "eventType", points, reason, created_at AS "createdAt"
    FROM reputation_events WHERE agent_id = ${agentId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getLeaderboard(limit: number, sql: any): Promise<Reputation[]> {
  return await sql`
    SELECT agent_id AS "agentId", reputation, positive_count AS "positiveCount", negative_count AS "negativeCount", updated_at AS "updatedAt"
    FROM agent_reputation ORDER BY reputation DESC LIMIT ${limit}
  `;
}
export function calculateTrustLevel(reputation: number): TrustLevel {
  for (const level of TRUST_LEVELS) {
    if (reputation >= level.min && reputation <= level.max) {
      return {
        level: level.level,
        score: Math.max(0, Math.min(100, Math.round((reputation + 100) / 4))),
        minRequired: level.min === -Infinity ? -1000 : level.min,
        maxRequired: level.max === Infinity ? 10000 : level.max,
      };
    }
  }
  return { level: 'new', score: 50, minRequired: -49, maxRequired: 0 };
}

export function canTrade(reputation: number, tradeValue: number = 0): boolean {
  if (tradeValue >= 1000 && reputation < 50) return false;
  if (tradeValue >= 5000 && reputation < 150) return false;
  return reputation >= 1;
}
