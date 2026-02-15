/**
 * Lucky Wheel Service - Daily spin-the-wheel game
 */

import { nanoid } from 'nanoid';
import * as economyService from './economy.js';

export type WheelSegment = {
  type: 'coins' | 'item' | 'title' | 'jackpot';
  label: string;
  value: number;
  probability: number;
};

export type SpinResult = {
  id: string;
  agentId: string;
  prizeType: string;
  prizeValue: number;
  prizeLabel: string;
  createdAt: Date;
};

const DAILY_SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Define 8 wheel segments with probabilities
const WHEEL_SEGMENTS: WheelSegment[] = [
  { type: 'coins', label: '10 Coins', value: 10, probability: 0.30 },      // 30%
  { type: 'coins', label: '25 Coins', value: 25, probability: 0.25 },      // 25%
  { type: 'coins', label: '50 Coins', value: 50, probability: 0.20 },      // 20%
  { type: 'coins', label: '100 Coins', value: 100, probability: 0.10 },    // 10%
  { type: 'coins', label: '500 Coins', value: 500, probability: 0.05 },    // 5%
  { type: 'item', label: 'Random Item', value: 0, probability: 0.05 },     // 5%
  { type: 'title', label: 'Title "Lucky"', value: 0, probability: 0.03 },  // 3%
  { type: 'jackpot', label: 'Jackpot 1000 Coins', value: 1000, probability: 0.02 }, // 2%
];

/**
 * Get all wheel segments with probabilities
 */
export function getWheelSegments(): WheelSegment[] {
  return [...WHEEL_SEGMENTS];
}

/**
 * Get the last spin for an agent
 */
async function getLastSpin(agentId: string, sql: any): Promise<SpinResult | null> {
  const result = await sql`
    SELECT id, agent_id AS "agentId", prize_type AS "prizeType", 
           prize_value AS "prizeValue", prize_label AS "prizeLabel", created_at AS "createdAt"
    FROM lucky_wheel_spins
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return result.length > 0 ? result[0] : null;
}

/**
 * Check if agent can spin (24h cooldown)
 */
export async function canSpin(agentId: string, sql: any): Promise<boolean> {
  const lastSpin = await getLastSpin(agentId, sql);

  if (!lastSpin) return true;

  const timeSinceLastSpin = Date.now() - lastSpin.createdAt.getTime();
  return timeSinceLastSpin >= DAILY_SPIN_COOLDOWN_MS;
}

/**
 * Weighted random selection
 */
function selectPrize(): WheelSegment {
  const random = Math.random();
  let cumulativeProbability = 0;

  for (const segment of WHEEL_SEGMENTS) {
    cumulativeProbability += segment.probability;
    if (random < cumulativeProbability) {
      return segment;
    }
  }

  // Fallback (should never happen with correct probabilities)
  return WHEEL_SEGMENTS[0];
}

/**
 * Spin the wheel and award prize
 */
export async function spin(agentId: string, sql: any): Promise<SpinResult> {
  // Check daily cooldown
  const canSpinNow = await canSpin(agentId, sql);
  if (!canSpinNow) {
    const lastSpin = await getLastSpin(agentId, sql);
    const timeSinceLastSpin = Date.now() - lastSpin!.createdAt.getTime();
    const hoursRemaining = Math.ceil((DAILY_SPIN_COOLDOWN_MS - timeSinceLastSpin) / (60 * 60 * 1000));
    throw new Error(`You can only spin once per day. Try again in ${hoursRemaining} hours.`);
  }

  // Select prize
  const prize = selectPrize();

  // Award prize
  if (prize.type === 'coins' || prize.type === 'jackpot') {
    await economyService.addCoins(agentId, prize.value, sql);
  }
  // For items and titles, we just record them (could be handled by inventory/titles services later)

  // Record spin
  const id = nanoid();
  const inserted = await sql`
    INSERT INTO lucky_wheel_spins (id, agent_id, prize_type, prize_value, prize_label, created_at)
    VALUES (${id}, ${agentId}, ${prize.type}, ${prize.value}, ${prize.label}, NOW())
    RETURNING id, agent_id AS "agentId", prize_type AS "prizeType", 
              prize_value AS "prizeValue", prize_label AS "prizeLabel", created_at AS "createdAt"
  `;

  return inserted[0];
}

/**
 * Get recent wins for display
 */
export async function getRecentWins(limit: number, sql: any): Promise<SpinResult[]> {
  const result = await sql`
    SELECT id, agent_id AS "agentId", prize_type AS "prizeType", 
           prize_value AS "prizeValue", prize_label AS "prizeLabel", created_at AS "createdAt"
    FROM lucky_wheel_spins
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result;
}
