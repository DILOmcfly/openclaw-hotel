/**
 * Slots Service - Slot machine gambling mini-game
 */

export type SlotMachine = {
  id: number;
  name: string;
  minBet: number;
  maxBet: number;
  jackpotPool: number;
  spinsCount: number;
  createdAt: Date;
};

export type SlotSpin = {
  id: number;
  machineId: number;
  agentId: string;
  bet: number;
  result: string;
  payout: number;
  jackpotWon: boolean;
  createdAt: Date;
};

export type SpinResult = {
  symbols: string[];
  payout: number;
  jackpotWon: boolean;
  message: string;
};

const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
const JACKPOT_CONTRIBUTION = 0.05;

/**
 * Generate 3 random symbols for a spin
 */
export function generateSymbols(): string[] {
  return Array(3).fill(0).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
}

/**
 * Calculate payout based on symbols and bet
 */
export function calculatePayout(symbols: string[], bet: number, jackpotPool: number): SpinResult {
  const [s1, s2, s3] = symbols;

  // Triple 7️⃣ = jackpot
  if (s1 === '7️⃣' && s2 === '7️⃣' && s3 === '7️⃣') {
    return {
      symbols,
      payout: jackpotPool,
      jackpotWon: true,
      message: `🎰 JACKPOT! 7️⃣7️⃣7️⃣ You won ${jackpotPool} coins!`,
    };
  }

  // Triple 💎 = bet × 25
  if (s1 === '💎' && s2 === '💎' && s3 === '💎') {
    return { symbols, payout: bet * 25, jackpotWon: false, message: `💎💎💎 Triple diamonds! +${bet * 25} coins!` };
  }

  // 3 matching = bet × 10
  if (s1 === s2 && s2 === s3) {
    return { symbols, payout: bet * 10, jackpotWon: false, message: `${s1}${s2}${s3} Triple match! +${bet * 10} coins!` };
  }

  // 2 matching = bet × 2
  if (s1 === s2 || s2 === s3 || s1 === s3) {
    return { symbols, payout: bet * 2, jackpotWon: false, message: `${s1}${s2}${s3} Pair! +${bet * 2} coins!` };
  }

  return { symbols, payout: 0, jackpotWon: false, message: `${s1}${s2}${s3} No match. Better luck next time!` };
}

/**
 * Get all available slot machines
 */
export async function getMachines(sql: any): Promise<SlotMachine[]> {
  return await sql`
    SELECT id, name, min_bet AS "minBet", max_bet AS "maxBet",
           jackpot_pool AS "jackpotPool", spins_count AS "spinsCount", created_at AS "createdAt"
    FROM slot_machines ORDER BY id ASC
  `;
}

/**
 * Get machine stats
 */
export async function getMachineStats(machineId: number, sql: any): Promise<SlotMachine | null> {
  const result = await sql`
    SELECT id, name, min_bet AS "minBet", max_bet AS "maxBet",
           jackpot_pool AS "jackpotPool", spins_count AS "spinsCount", created_at AS "createdAt"
    FROM slot_machines WHERE id = ${machineId}
  `;
  return result.length > 0 ? result[0] : null;
}

/**
 * Get agent's spin history
 */
export async function getAgentHistory(agentId: string, sql: any, limit = 20): Promise<SlotSpin[]> {
  return await sql`
    SELECT id, machine_id AS "machineId", agent_id AS "agentId",
           bet, result, payout, jackpot_won AS "jackpotWon", created_at AS "createdAt"
    FROM slot_spins WHERE agent_id = ${agentId}
    ORDER BY created_at DESC LIMIT ${limit}
  `;
}

/**
 * Get current jackpot amount
 */
export async function getJackpotAmount(machineId: number, sql: any): Promise<number> {
  const result = await sql`SELECT jackpot_pool AS "jackpotPool" FROM slot_machines WHERE id = ${machineId}`;
  return result.length > 0 ? result[0].jackpotPool : 0;
}

/**
 * Contribute to jackpot pool (5% of bet)
 */
export async function contributeToJackpot(machineId: number, bet: number, sql: any): Promise<void> {
  const contribution = Math.floor(bet * JACKPOT_CONTRIBUTION);
  await sql`
    UPDATE slot_machines
    SET jackpot_pool = jackpot_pool + ${contribution}, spins_count = spins_count + 1
    WHERE id = ${machineId}
  `;
}

/**
 * Perform a slot machine spin
 */
export async function spin(machineId: number, agentId: string, bet: number, sql: any): Promise<SpinResult> {
  const machine = await getMachineStats(machineId, sql);
  if (!machine) throw new Error('Slot machine not found');
  if (bet < machine.minBet || bet > machine.maxBet) {
    throw new Error(`Bet must be between ${machine.minBet} and ${machine.maxBet}`);
  }

  const symbols = generateSymbols();
  const result = calculatePayout(symbols, bet, machine.jackpotPool);

  await contributeToJackpot(machineId, bet, sql);

  if (result.jackpotWon) {
    await sql`UPDATE slot_machines SET jackpot_pool = 0 WHERE id = ${machineId}`;
  }

  await sql`
    INSERT INTO slot_spins (machine_id, agent_id, bet, result, payout, jackpot_won)
    VALUES (${machineId}, ${agentId}, ${bet}, ${symbols.join('')}, ${result.payout}, ${result.jackpotWon})
  `;

  return result;
}
