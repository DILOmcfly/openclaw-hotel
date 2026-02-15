/**
 * Rock-Paper-Scissors Service
 */

export type RPSGame = {
  id: number;
  player1Id: string;
  player2Id: string | null;
  player1Move: string | null;
  player2Move: string | null;
  bet: number;
  winnerId: string | null;
  status: 'waiting' | 'playing' | 'resolved' | 'cancelled';
  createdAt: Date;
};

export type RPSStats = {
  agentId: string;
  wins: number;
  losses: number;
  draws: number;
  totalWagered: number;
  totalWon: number;
};

const VALID_MOVES = ['rock', 'paper', 'scissors'];

export function determineWinner(move1: string, move2: string): number {
  if (move1 === move2) return 0;
  if ((move1 === 'rock' && move2 === 'scissors') || (move1 === 'paper' && move2 === 'rock') || (move1 === 'scissors' && move2 === 'paper')) return 1;
  return 2;
}

export async function createGame(agentId: string, bet: number, sql: any): Promise<RPSGame> {
  if (bet < 0) throw new Error('Bet cannot be negative');
  const result = await sql`INSERT INTO rps_games (player1_id, bet, status) VALUES (${agentId}, ${bet}, 'waiting') RETURNING id, player1_id AS "player1Id", player2_id AS "player2Id", player1_move AS "player1Move", player2_move AS "player2Move", bet, winner_id AS "winnerId", status, created_at AS "createdAt"`;
  return result[0];
}

export async function joinGame(gameId: number, agentId: string, sql: any): Promise<RPSGame> {
  const game = await sql`SELECT * FROM rps_games WHERE id = ${gameId}`;
  if (game.length === 0) throw new Error('Game not found');
  if (game[0].status !== 'waiting') throw new Error('Game not available');
  if (game[0].player1_id === agentId) throw new Error('Cannot join your own game');
  const result = await sql`UPDATE rps_games SET player2_id = ${agentId}, status = 'playing' WHERE id = ${gameId} RETURNING id, player1_id AS "player1Id", player2_id AS "player2Id", player1_move AS "player1Move", player2_move AS "player2Move", bet, winner_id AS "winnerId", status, created_at AS "createdAt"`;
  return result[0];
}

export async function makeMove(gameId: number, agentId: string, move: string, sql: any): Promise<RPSGame> {
  if (!VALID_MOVES.includes(move)) throw new Error('Invalid move');
  const game = await sql`SELECT * FROM rps_games WHERE id = ${gameId}`;
  if (game.length === 0) throw new Error('Game not found');
  if (game[0].status !== 'playing') throw new Error('Game not in playing state');
  const isPlayer1 = game[0].player1_id === agentId;
  const isPlayer2 = game[0].player2_id === agentId;
  if (!isPlayer1 && !isPlayer2) throw new Error('Not a player in this game');
  if (isPlayer1) {
    if (game[0].player1_move) throw new Error('Move already made');
    await sql`UPDATE rps_games SET player1_move = ${move} WHERE id = ${gameId}`;
  } else {
    if (game[0].player2_move) throw new Error('Move already made');
    await sql`UPDATE rps_games SET player2_move = ${move} WHERE id = ${gameId}`;
  }
  const updated = await sql`SELECT id, player1_id AS "player1Id", player2_id AS "player2Id", player1_move AS "player1Move", player2_move AS "player2Move", bet, winner_id AS "winnerId", status, created_at AS "createdAt" FROM rps_games WHERE id = ${gameId}`;
  if (updated[0].player1Move && updated[0].player2Move) return resolveGame(gameId, sql);
  return updated[0];
}

export async function resolveGame(gameId: number, sql: any): Promise<RPSGame> {
  const game = await sql`SELECT * FROM rps_games WHERE id = ${gameId}`;
  if (game.length === 0) throw new Error('Game not found');
  const g = game[0];
  if (!g.player1_move || !g.player2_move) throw new Error('Both players must move');
  const result = determineWinner(g.player1_move, g.player2_move);
  let winnerId = result === 1 ? g.player1_id : result === 2 ? g.player2_id : null;
  await sql`UPDATE rps_games SET status = 'resolved', winner_id = ${winnerId} WHERE id = ${gameId}`;
  if (winnerId) {
    const loserId = winnerId === g.player1_id ? g.player2_id : g.player1_id;
    await sql`INSERT INTO rps_stats (agent_id, wins, total_won) VALUES (${winnerId}, 1, ${g.bet}) ON CONFLICT (agent_id) DO UPDATE SET wins = rps_stats.wins + 1, total_won = rps_stats.total_won + ${g.bet}`;
    await sql`INSERT INTO rps_stats (agent_id, losses, total_wagered) VALUES (${loserId}, 1, ${g.bet}) ON CONFLICT (agent_id) DO UPDATE SET losses = rps_stats.losses + 1, total_wagered = rps_stats.total_wagered + ${g.bet}`;
  } else {
    await sql`INSERT INTO rps_stats (agent_id, draws) VALUES (${g.player1_id}, 1), (${g.player2_id}, 1) ON CONFLICT (agent_id) DO UPDATE SET draws = rps_stats.draws + 1`;
  }
  const resolved = await sql`SELECT id, player1_id AS "player1Id", player2_id AS "player2Id", player1_move AS "player1Move", player2_move AS "player2Move", bet, winner_id AS "winnerId", status, created_at AS "createdAt" FROM rps_games WHERE id = ${gameId}`;
  return resolved[0];
}

export async function getGame(gameId: number, agentId: string, sql: any): Promise<any> {
  const game = await sql`SELECT id, player1_id AS "player1Id", player2_id AS "player2Id", player1_move AS "player1Move", player2_move AS "player2Move", bet, winner_id AS "winnerId", status, created_at AS "createdAt" FROM rps_games WHERE id = ${gameId}`;
  if (game.length === 0) throw new Error('Game not found');
  const g = game[0];
  if (g.status !== 'resolved') {
    if (g.player1Id !== agentId) g.player1Move = null;
    if (g.player2Id !== agentId) g.player2Move = null;
  }
  return g;
}

export async function getStats(agentId: string, sql: any): Promise<RPSStats> {
  const result = await sql`SELECT agent_id AS "agentId", wins, losses, draws, total_wagered AS "totalWagered", total_won AS "totalWon" FROM rps_stats WHERE agent_id = ${agentId}`;
  if (result.length === 0) return { agentId, wins: 0, losses: 0, draws: 0, totalWagered: 0, totalWon: 0 };
  return result[0];
}

export async function getRecentGames(limit: number, sql: any): Promise<RPSGame[]> {
  const result = await sql`SELECT id, player1_id AS "player1Id", player2_id AS "player2Id", player1_move AS "player1Move", player2_move AS "player2Move", bet, winner_id AS "winnerId", status, created_at AS "createdAt" FROM rps_games WHERE status = 'resolved' ORDER BY created_at DESC LIMIT ${limit}`;
  return result;
}
