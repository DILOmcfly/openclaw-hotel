/** Economy Dashboard Service - Aggregate economy statistics */

export type EconomySnapshot = {
  id: number; totalCoinsCirculation: bigint; totalTransactions: number;
  avgAgentBalance: number; richestAgentBalance: number; poorestAgentBalance: number;
  giniCoefficient: number; snapshotDate: string; createdAt: Date;
};

export type WealthDistribution = { bracket: string; count: number; percentage: number; };
export type TopEarner = { agentId: string; displayName: string; totalEarned: number; currentBalance: number; };
export type EconomyHealth = { status: 'healthy' | 'warning' | 'critical'; inflationRate: number; message: string; };

/** Calculate Gini coefficient from array of balances */
export function calculateGini(balances: number[]): number {
  if (balances.length <= 1) return 0;
  const sorted = [...balances].sort((a, b) => a - b);
  const n = sorted.length;
  let sumOfDifferences = 0, sumOfBalances = 0;
  for (let i = 0; i < n; i++) {
    sumOfBalances += sorted[i];
    sumOfDifferences += (i + 1) * sorted[i];
  }
  if (sumOfBalances === 0) return 0;
  const gini = (2 * sumOfDifferences) / (n * sumOfBalances) - (n + 1) / n;
  return Math.max(0, Math.min(1, gini));
}

/** Take a snapshot of current economy state */
export async function takeSnapshot(sql: any): Promise<EconomySnapshot> {
  const today = new Date().toISOString().split('T')[0];
  const balances = await sql`SELECT coins FROM agent_balances WHERE coins >= 0`;
  const balanceValues = balances.map((b: any) => b.coins);
  const totalCoins = balanceValues.reduce((sum: number, val: number) => sum + val, 0);
  const avgBalance = balanceValues.length > 0 ? Math.floor(totalCoins / balanceValues.length) : 0;
  const richest = balanceValues.length > 0 ? Math.max(...balanceValues) : 0;
  const poorest = balanceValues.length > 0 ? Math.min(...balanceValues) : 0;
  const gini = calculateGini(balanceValues);
  const countResult = await sql`SELECT COUNT(*) as count FROM agent_balances`;
  const totalTransactions = countResult[0]?.count || 0;

  const result = await sql`
    INSERT INTO economy_snapshots (
      total_coins_circulation, total_transactions, avg_agent_balance,
      richest_agent_balance, poorest_agent_balance, gini_coefficient,
      snapshot_date, created_at
    ) VALUES (${totalCoins}, ${totalTransactions}, ${avgBalance}, ${richest}, ${poorest}, ${gini}, ${today}, NOW())
    ON CONFLICT (snapshot_date) DO UPDATE SET
      total_coins_circulation = ${totalCoins}, total_transactions = ${totalTransactions},
      avg_agent_balance = ${avgBalance}, richest_agent_balance = ${richest},
      poorest_agent_balance = ${poorest}, gini_coefficient = ${gini}, created_at = NOW()
    RETURNING id, total_coins_circulation AS "totalCoinsCirculation",
      total_transactions AS "totalTransactions", avg_agent_balance AS "avgAgentBalance",
      richest_agent_balance AS "richestAgentBalance", poorest_agent_balance AS "poorestAgentBalance",
      gini_coefficient AS "giniCoefficient", snapshot_date AS "snapshotDate", created_at AS "createdAt"
  `;
  return result[0];
}

/** Get latest economy snapshot */
export async function getLatestSnapshot(sql: any): Promise<EconomySnapshot | null> {
  const result = await sql`
    SELECT id, total_coins_circulation AS "totalCoinsCirculation",
      total_transactions AS "totalTransactions", avg_agent_balance AS "avgAgentBalance",
      richest_agent_balance AS "richestAgentBalance", poorest_agent_balance AS "poorestAgentBalance",
      gini_coefficient AS "giniCoefficient", snapshot_date AS "snapshotDate", created_at AS "createdAt"
    FROM economy_snapshots ORDER BY snapshot_date DESC LIMIT 1
  `;
  return result.length > 0 ? result[0] : null;
}

/** Get historical snapshots within date range */
export async function getHistory(sql: any, startDate: string, endDate: string): Promise<EconomySnapshot[]> {
  return await sql`
    SELECT id, total_coins_circulation AS "totalCoinsCirculation",
      total_transactions AS "totalTransactions", avg_agent_balance AS "avgAgentBalance",
      richest_agent_balance AS "richestAgentBalance", poorest_agent_balance AS "poorestAgentBalance",
      gini_coefficient AS "giniCoefficient", snapshot_date AS "snapshotDate", created_at AS "createdAt"
    FROM economy_snapshots
    WHERE snapshot_date >= ${startDate} AND snapshot_date <= ${endDate}
    ORDER BY snapshot_date DESC
  `;
}

/** Get wealth distribution by brackets */
export async function getWealthDistribution(sql: any): Promise<WealthDistribution[]> {
  const result = await sql`
    SELECT CASE
        WHEN coins BETWEEN 0 AND 100 THEN '0-100'
        WHEN coins BETWEEN 101 AND 500 THEN '101-500'
        WHEN coins BETWEEN 501 AND 1000 THEN '501-1000'
        WHEN coins BETWEEN 1001 AND 5000 THEN '1001-5000'
        ELSE '5001+' END as bracket, COUNT(*) as count
    FROM agent_balances GROUP BY bracket ORDER BY MIN(coins)
  `;
  const total = result.reduce((sum: number, r: any) => sum + r.count, 0);
  return result.map((r: any) => ({
    bracket: r.bracket, count: r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
  }));
}

/** Get top earners by total coins earned */
export async function getTopEarners(sql: any, limit: number = 10): Promise<TopEarner[]> {
  const result = await sql`
    SELECT a.id as "agentId", a.display_name as "displayName", ab.coins as "currentBalance",
      COALESCE(s.streak_coins_earned, 0) as "streakCoinsEarned",
      (ab.coins + COALESCE(s.streak_coins_earned, 0)) as "totalEarned"
    FROM agents a
    JOIN agent_balances ab ON a.id = ab.agent_id
    LEFT JOIN agent_streaks s ON a.id = s.agent_id
    ORDER BY "totalEarned" DESC LIMIT ${limit}
  `;
  return result.map((r: any) => ({
    agentId: r.agentId, displayName: r.displayName,
    totalEarned: r.totalEarned, currentBalance: r.currentBalance,
  }));
}

/** Check economy health (inflation warning if avg balance grows >10%/day) */
export async function getEconomyHealth(sql: any): Promise<EconomyHealth> {
  const snapshots = await sql`
    SELECT avg_agent_balance AS "avgAgentBalance", snapshot_date AS "snapshotDate"
    FROM economy_snapshots ORDER BY snapshot_date DESC LIMIT 2
  `;
  if (snapshots.length < 2) {
    return { status: 'healthy', inflationRate: 0,
      message: 'Insufficient data for health check (need 2+ snapshots)' };
  }
  const latest = snapshots[0].avgAgentBalance;
  const previous = snapshots[1].avgAgentBalance;
  if (previous === 0) {
    return { status: 'healthy', inflationRate: 0,
      message: 'Cannot calculate inflation rate (previous average was 0)' };
  }
  const inflationRate = ((latest - previous) / previous) * 100;
  const rounded = Math.round(inflationRate * 100) / 100;
  if (inflationRate > 20) {
    return { status: 'critical', inflationRate: rounded,
      message: `Critical inflation: average balance increased by ${inflationRate.toFixed(1)}% per day` };
  }
  if (inflationRate > 10) {
    return { status: 'warning', inflationRate: rounded,
      message: `High inflation detected: average balance increased by ${inflationRate.toFixed(1)}% per day` };
  }
  return { status: 'healthy', inflationRate: rounded,
    message: `Economy stable: ${inflationRate >= 0 ? '+' : ''}${inflationRate.toFixed(1)}% change in average balance` };
}
