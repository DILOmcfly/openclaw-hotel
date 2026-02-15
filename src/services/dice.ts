/**
 * Dice Game Service
 */

export type DiceGame = {
  id: number;
  agentId: string;
  bet: number;
  diceCount: number;
  targetType: 'over' | 'under' | 'exact' | 'even' | 'odd';
  targetValue: number | null;
  rollResult: number[];
  total: number;
  won: boolean;
  payout: number;
  createdAt: Date;
};

export type DiceStats = {
  agentId: string;
  gamesPlayed: number;
  wins: number;
  totalWagered: number;
  totalWon: number;
  biggestWin: number;
};

export function calculateOdds(diceCount: number, targetType: string, targetValue: number | null): number {
  const min = diceCount;
  const max = diceCount * 6;

  if (targetType === 'even' || targetType === 'odd') return 0.5;

  if (targetType === 'exact' && targetValue !== null) {
    return 1 / (max - min + 1);
  }

  if (targetType === 'over' && targetValue !== null) {
    return (max - targetValue) / (max - min + 1);
  }

  if (targetType === 'under' && targetValue !== null) {
    return (targetValue - min) / (max - min + 1);
  }

  return 0;
}

export function calculatePayout(bet: number, targetType: string): number {
  switch (targetType) {
    case 'exact': return bet * 5;
    case 'over':
    case 'under': return bet * 2;
    case 'even':
    case 'odd': return Math.floor(bet * 1.5);
    default: return 0;
  }
}

function checkWin(total: number, targetType: string, targetValue: number | null): boolean {
  switch (targetType) {
    case 'over': return targetValue !== null && total > targetValue;
    case 'under': return targetValue !== null && total < targetValue;
    case 'exact': return targetValue !== null && total === targetValue;
    case 'even': return total % 2 === 0;
    case 'odd': return total % 2 === 1;
    default: return false;
  }
}

export async function rollDice(
  agentId: string,
  bet: number,
  diceCount: number,
  targetType: 'over' | 'under' | 'exact' | 'even' | 'odd',
  targetValue: number | null,
  sql: any
): Promise<DiceGame> {
  if (bet < 1) throw new Error('Bet must be at least 1');
  if (diceCount < 1 || diceCount > 5) throw new Error('Dice count must be between 1 and 5');
  if ((targetType === 'over' || targetType === 'under' || targetType === 'exact') && !targetValue) {
    throw new Error('Target value required for this bet type');
  }

  const rolls: number[] = [];
  for (let i = 0; i < diceCount; i++) {
    rolls.push(Math.floor(Math.random() * 6) + 1);
  }

  const total = rolls.reduce((sum, roll) => sum + roll, 0);
  const won = checkWin(total, targetType, targetValue);
  const payout = won ? calculatePayout(bet, targetType) : 0;

  const result = await sql`
    INSERT INTO dice_games (agent_id, bet, dice_count, target_type, target_value, roll_result, total, won, payout)
    VALUES (${agentId}, ${bet}, ${diceCount}, ${targetType}, ${targetValue}, ${JSON.stringify(rolls)}, ${total}, ${won}, ${payout})
    RETURNING 
      id, agent_id AS "agentId", bet, dice_count AS "diceCount", target_type AS "targetType",
      target_value AS "targetValue", roll_result AS "rollResult", total, won, payout, created_at AS "createdAt"
  `;

  const winAmount = won ? payout : 0;
  await sql`
    INSERT INTO dice_stats (agent_id, games_played, wins, total_wagered, total_won, biggest_win)
    VALUES (${agentId}, 1, ${won ? 1 : 0}, ${bet}, ${winAmount}, ${winAmount})
    ON CONFLICT (agent_id) DO UPDATE SET
      games_played = dice_stats.games_played + 1,
      wins = dice_stats.wins + ${won ? 1 : 0},
      total_wagered = dice_stats.total_wagered + ${bet},
      total_won = dice_stats.total_won + ${winAmount},
      biggest_win = GREATEST(dice_stats.biggest_win, ${winAmount})
  `;

  const game = result[0];
  game.rollResult = JSON.parse(game.rollResult);
  return game;
}

export async function getStats(agentId: string, sql: any): Promise<DiceStats> {
  const result = await sql`
    SELECT agent_id AS "agentId", games_played AS "gamesPlayed", wins,
           total_wagered AS "totalWagered", total_won AS "totalWon", biggest_win AS "biggestWin"
    FROM dice_stats WHERE agent_id = ${agentId}
  `;

  if (result.length === 0) {
    return { agentId, gamesPlayed: 0, wins: 0, totalWagered: 0, totalWon: 0, biggestWin: 0 };
  }

  return result[0];
}

export async function getHistory(agentId: string, limit: number, offset: number, sql: any): Promise<DiceGame[]> {
  const result = await sql`
    SELECT id, agent_id AS "agentId", bet, dice_count AS "diceCount", target_type AS "targetType",
           target_value AS "targetValue", roll_result AS "rollResult", total, won, payout, created_at AS "createdAt"
    FROM dice_games WHERE agent_id = ${agentId}
    ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;

  return result.map((game: any) => ({ ...game, rollResult: JSON.parse(game.rollResult) }));
}

export async function getLeaderboard(limit: number, sql: any): Promise<DiceStats[]> {
  const result = await sql`
    SELECT agent_id AS "agentId", games_played AS "gamesPlayed", wins,
           total_wagered AS "totalWagered", total_won AS "totalWon", biggest_win AS "biggestWin"
    FROM dice_stats WHERE games_played > 0
    ORDER BY total_won DESC, biggest_win DESC LIMIT ${limit}
  `;

  return result;
}
