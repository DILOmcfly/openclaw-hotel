/**
 * Connect Four Service - Manages Connect Four games between agents
 */
export type ConnectFourGame = {
  id: number;
  player1Id: string;
  player2Id: string | null;
  board: number[][];
  currentTurn: string | null;
  winner: string | null;
  status: 'waiting' | 'playing' | 'won' | 'draw' | 'forfeit';
  createdAt: Date;
  updatedAt: Date;
};

export type ConnectFourStats = {
  agentId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
};

const ROWS = 6;
const COLS = 7;

function createEmptyBoard(): number[][] {
  return Array(ROWS).fill(0).map(() => Array(COLS).fill(0));
}

export function checkWinner(board: number[][]): number {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const v = board[r][c];
      if (v !== 0 && board[r][c + 1] === v && board[r][c + 2] === v && board[r][c + 3] === v) return v;
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const v = board[r][c];
      if (v !== 0 && board[r + 1][c] === v && board[r + 2][c] === v && board[r + 3][c] === v) return v;
    }
  }
  // Diagonal (\)
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const v = board[r][c];
      if (v !== 0 && board[r + 1][c + 1] === v && board[r + 2][c + 2] === v && board[r + 3][c + 3] === v) return v;
    }
  }
  // Diagonal (/)
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const v = board[r][c];
      if (v !== 0 && board[r - 1][c + 1] === v && board[r - 2][c + 2] === v && board[r - 3][c + 3] === v) return v;
    }
  }
  return 0;
}

export function isBoardFull(board: number[][]): boolean {
  return board[0].every(cell => cell !== 0);
}

export async function createGame(player1Id: string, sql: any): Promise<ConnectFourGame> {
  const result = await sql`
    INSERT INTO connect_four_games (player1_id, board, status)
    VALUES (${player1Id}, ${JSON.stringify(createEmptyBoard())}, 'waiting')
    RETURNING id, player1_id AS "player1Id", player2_id AS "player2Id", board, current_turn AS "currentTurn",
              winner, status, created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  const game = result[0];
  game.board = JSON.parse(game.board);
  return game;
}

export async function joinGame(gameId: number, player2Id: string, sql: any): Promise<ConnectFourGame> {
  const existing = await sql`SELECT player1_id AS "player1Id", status FROM connect_four_games WHERE id = ${gameId}`;
  if (existing.length === 0) throw new Error('Game not found');
  if (existing[0].status !== 'waiting') throw new Error('Game already started');
  if (existing[0].player1Id === player2Id) throw new Error('Cannot play against yourself');
  const result = await sql`
    UPDATE connect_four_games SET player2_id = ${player2Id}, current_turn = player1_id, status = 'playing', updated_at = NOW()
    WHERE id = ${gameId}
    RETURNING id, player1_id AS "player1Id", player2_id AS "player2Id", board, current_turn AS "currentTurn",
              winner, status, created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  const game = result[0];
  game.board = JSON.parse(game.board);
  return game;
}

export async function dropPiece(gameId: number, playerId: string, column: number, sql: any): Promise<ConnectFourGame> {
  if (column < 0 || column >= COLS) throw new Error('Invalid column');
  const existing = await sql`
    SELECT id, player1_id AS "player1Id", player2_id AS "player2Id", board, current_turn AS "currentTurn", status
    FROM connect_four_games WHERE id = ${gameId}
  `;
  if (existing.length === 0) throw new Error('Game not found');
  const game = existing[0];
  if (game.status !== 'playing') throw new Error('Game is not active');
  if (game.currentTurn !== playerId) throw new Error('Not your turn');
  const board: number[][] = JSON.parse(game.board);
  const playerNum = game.player1Id === playerId ? 1 : 2;
  let row = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][column] === 0) { row = r; break; }
  }
  if (row === -1) throw new Error('Column is full');
  board[row][column] = playerNum;
  const winnerNum = checkWinner(board);
  const isDraw = winnerNum === 0 && isBoardFull(board);
  let status: 'playing' | 'won' | 'draw' = 'playing';
  let winner: string | null = null;
  if (winnerNum !== 0) {
    status = 'won';
    winner = winnerNum === 1 ? game.player1Id : game.player2Id;
    await updateStats(game.player1Id, game.player2Id, winner, sql);
  } else if (isDraw) {
    status = 'draw';
    await updateStats(game.player1Id, game.player2Id, null, sql);
  }
  const nextTurn = status === 'playing' ? (game.currentTurn === game.player1Id ? game.player2Id : game.player1Id) : null;
  const result = await sql`
    UPDATE connect_four_games SET board = ${JSON.stringify(board)}, current_turn = ${nextTurn},
           status = ${status}, winner = ${winner}, updated_at = NOW()
    WHERE id = ${gameId}
    RETURNING id, player1_id AS "player1Id", player2_id AS "player2Id", board, current_turn AS "currentTurn",
              winner, status, created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  const updatedGame = result[0];
  updatedGame.board = JSON.parse(updatedGame.board);
  return updatedGame;
}

export async function getGame(gameId: number, sql: any): Promise<ConnectFourGame> {
  const result = await sql`
    SELECT id, player1_id AS "player1Id", player2_id AS "player2Id", board, current_turn AS "currentTurn",
           winner, status, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM connect_four_games WHERE id = ${gameId}
  `;
  if (result.length === 0) throw new Error('Game not found');
  const game = result[0];
  game.board = JSON.parse(game.board);
  return game;
}

export async function forfeit(gameId: number, playerId: string, sql: any): Promise<ConnectFourGame> {
  const existing = await sql`
    SELECT player1_id AS "player1Id", player2_id AS "player2Id", status FROM connect_four_games WHERE id = ${gameId}
  `;
  if (existing.length === 0) throw new Error('Game not found');
  if (existing[0].status !== 'playing') throw new Error('Game is not active');
  const game = existing[0];
  if (game.player1Id !== playerId && game.player2Id !== playerId) throw new Error('Not a player in this game');
  const winner = game.player1Id === playerId ? game.player2Id : game.player1Id;
  await updateStats(game.player1Id, game.player2Id, winner, sql);
  const result = await sql`
    UPDATE connect_four_games SET status = 'forfeit', winner = ${winner}, updated_at = NOW() WHERE id = ${gameId}
    RETURNING id, player1_id AS "player1Id", player2_id AS "player2Id", board, current_turn AS "currentTurn",
              winner, status, created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  const updatedGame = result[0];
  updatedGame.board = JSON.parse(updatedGame.board);
  return updatedGame;
}

export async function getStats(agentId: string, sql: any): Promise<ConnectFourStats> {
  const result = await sql`
    SELECT agent_id AS "agentId", games_played AS "gamesPlayed", wins, losses, draws
    FROM connect_four_stats WHERE agent_id = ${agentId}
  `;
  return result.length === 0 ? { agentId, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 } : result[0];
}

async function updateStats(player1Id: string, player2Id: string, winner: string | null, sql: any): Promise<void> {
  for (const playerId of [player1Id, player2Id]) {
    const isWinner = winner === playerId;
    const isLoser = winner !== null && winner !== playerId;
    const isDraw = winner === null;
    await sql`
      INSERT INTO connect_four_stats (agent_id, games_played, wins, losses, draws)
      VALUES (${playerId}, 1, ${isWinner ? 1 : 0}, ${isLoser ? 1 : 0}, ${isDraw ? 1 : 0})
      ON CONFLICT (agent_id) DO UPDATE SET
        games_played = connect_four_stats.games_played + 1,
        wins = connect_four_stats.wins + ${isWinner ? 1 : 0},
        losses = connect_four_stats.losses + ${isLoser ? 1 : 0},
        draws = connect_four_stats.draws + ${isDraw ? 1 : 0}
    `;
  }
}
