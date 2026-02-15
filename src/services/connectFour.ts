/**
 * Connect Four Service - 6x7 grid, connect 4 to win
 */

export type Cell = 'R' | 'Y' | null;
export type Board = Cell[][];
export type GameStatus = 'waiting' | 'active' | 'completed';

export type ConnectFourGame = {
  id: string;
  roomId: string;
  player1: string;
  player2: string;
  status: GameStatus;
  board: Board;
  currentTurn: string;
  winnerId: string | null;
  isDraw: boolean;
  createdAt: Date;
  completedAt: Date | null;
};

const games = new Map<string, ConnectFourGame>();

const generateGameId = (): string => `cf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const createBoard = (): Board => Array(6).fill(null).map(() => Array(7).fill(null));

export function createGame(roomId: string, player1: string, player2: string): ConnectFourGame {
  const game: ConnectFourGame = {
    id: generateGameId(),
    roomId,
    player1,
    player2,
    status: 'active',
    board: createBoard(),
    currentTurn: player1,
    winnerId: null,
    isDraw: false,
    createdAt: new Date(),
    completedAt: null,
  };
  games.set(game.id, game);
  return game;
}

/**
 * Check if a player has won (4 in a row)
 */
function checkWin(board: Board, row: number, col: number, player: Cell): boolean {
  if (!player) return false;

  // Directions: horizontal, vertical, diagonal /, diagonal \
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal \
    [1, -1], // diagonal /
  ];

  for (const [dRow, dCol] of directions) {
    let count = 1; // Current disc

    // Check forward direction
    for (let i = 1; i < 4; i++) {
      const r = row + dRow * i;
      const c = col + dCol * i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r][c] !== player) {
        break;
      }
      count++;
    }

    // Check backward direction
    for (let i = 1; i < 4; i++) {
      const r = row - dRow * i;
      const c = col - dCol * i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r][c] !== player) {
        break;
      }
      count++;
    }

    if (count >= 4) return true;
  }

  return false;
}

/**
 * Check if board is full (draw)
 */
function isBoardFull(board: Board): boolean {
  return board[0].every(cell => cell !== null);
}

/**
 * Drop a disc in a column (with gravity)
 */
export function dropDisc(gameId: string, playerId: string, column: number): ConnectFourGame {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  if (game.status !== 'active') {
    throw new Error('Game is not active');
  }

  if (playerId !== game.player1 && playerId !== game.player2) {
    throw new Error('You are not a player in this game');
  }

  if (game.currentTurn !== playerId) {
    throw new Error('Not your turn');
  }

  if (column < 0 || column > 6) {
    throw new Error('Invalid column (must be 0-6)');
  }

  // Find lowest empty row in column (gravity)
  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (game.board[r][column] === null) {
      row = r;
      break;
    }
  }

  if (row === -1) {
    throw new Error('Column is full');
  }

  // Place disc
  const playerColor: Cell = playerId === game.player1 ? 'R' : 'Y';
  game.board[row][column] = playerColor;

  // Check for win
  if (checkWin(game.board, row, column, playerColor)) {
    game.status = 'completed';
    game.winnerId = playerId;
    game.completedAt = new Date();
  } 
  // Check for draw
  else if (isBoardFull(game.board)) {
    game.status = 'completed';
    game.isDraw = true;
    game.completedAt = new Date();
  } 
  // Switch turns
  else {
    game.currentTurn = game.currentTurn === game.player1 ? game.player2 : game.player1;
  }

  return game;
}

/**
 * Get game state
 */
export function getGameState(gameId: string): ConnectFourGame {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }
  return game;
}

/**
 * Clean up old games (memory management)
 */
export function cleanupOldGames(maxAgeMs: number = 3600000): void {
  const now = Date.now();
  for (const [gameId, game] of games) {
    if (game.completedAt && now - game.completedAt.getTime() > maxAgeMs) {
      games.delete(gameId);
    }
  }
}
