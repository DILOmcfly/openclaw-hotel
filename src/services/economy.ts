/**
 * Economy Service - Manages agent balances, coins, and daily bonuses
 */

export type Balance = {
  agentId: string;
  coins: number;
  lastDailyClaim: Date | null;
};

const DAILY_BONUS_AMOUNT = 100;
const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const STARTER_COINS = 500;

/**
 * Get agent's current balance
 */
export async function getBalance(agentId: string, sql: any): Promise<Balance> {
  const result = await sql`
    SELECT agent_id AS "agentId", coins, last_daily_claim AS "lastDailyClaim"
    FROM agent_balances
    WHERE agent_id = ${agentId}
  `;

  if (result.length === 0) {
    // Create default balance for new agents
    return await createDefaultBalance(agentId, sql);
  }

  return result[0];
}

/**
 * Add coins to agent's balance
 */
export async function addCoins(agentId: string, amount: number, sql: any): Promise<Balance> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  // Ensure balance exists
  await getBalance(agentId, sql);

  const updated = await sql`
    UPDATE agent_balances
    SET coins = coins + ${amount}
    WHERE agent_id = ${agentId}
    RETURNING agent_id AS "agentId", coins, last_daily_claim AS "lastDailyClaim"
  `;

  return updated[0];
}

/**
 * Deduct coins from agent's balance
 * Throws error if insufficient funds
 */
export async function deductCoins(agentId: string, amount: number, sql: any): Promise<Balance> {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const balance = await getBalance(agentId, sql);

  if (balance.coins < amount) {
    throw new Error(`Insufficient funds. Required: ${amount}, Available: ${balance.coins}`);
  }

  const updated = await sql`
    UPDATE agent_balances
    SET coins = coins - ${amount}
    WHERE agent_id = ${agentId}
    RETURNING agent_id AS "agentId", coins, last_daily_claim AS "lastDailyClaim"
  `;

  return updated[0];
}

/**
 * Grant daily bonus to agent
 * Only allows claim once per 24 hours
 */
export async function grantDailyBonus(agentId: string, sql: any): Promise<Balance> {
  const balance = await getBalance(agentId, sql);

  // Check if daily bonus already claimed within cooldown period
  if (balance.lastDailyClaim) {
    const timeSinceLastClaim = Date.now() - balance.lastDailyClaim.getTime();
    if (timeSinceLastClaim < DAILY_BONUS_COOLDOWN_MS) {
      const hoursRemaining = Math.ceil((DAILY_BONUS_COOLDOWN_MS - timeSinceLastClaim) / (60 * 60 * 1000));
      throw new Error(`Daily bonus already claimed. Try again in ${hoursRemaining} hours.`);
    }
  }

  const updated = await sql`
    UPDATE agent_balances
    SET coins = coins + ${DAILY_BONUS_AMOUNT}, last_daily_claim = NOW()
    WHERE agent_id = ${agentId}
    RETURNING agent_id AS "agentId", coins, last_daily_claim AS "lastDailyClaim"
  `;

  return updated[0];
}

/**
 * Create default balance for new agent
 */
export async function createDefaultBalance(agentId: string, sql: any): Promise<Balance> {
  const inserted = await sql`
    INSERT INTO agent_balances (agent_id, coins, last_daily_claim)
    VALUES (${agentId}, ${STARTER_COINS}, NULL)
    ON CONFLICT (agent_id) DO NOTHING
    RETURNING agent_id AS "agentId", coins, last_daily_claim AS "lastDailyClaim"
  `;

  if (inserted.length === 0) {
    // Already exists, fetch it
    return await getBalance(agentId, sql);
  }

  return inserted[0];
}

/**
 * Check if agent can claim daily bonus
 */
export function canClaimDailyBonus(lastDailyClaim: Date | null): boolean {
  if (!lastDailyClaim) return true;
  
  const timeSinceLastClaim = Date.now() - lastDailyClaim.getTime();
  return timeSinceLastClaim >= DAILY_BONUS_COOLDOWN_MS;
}
