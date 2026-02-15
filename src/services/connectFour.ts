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

function checkWin(board: Board, row: number, col: number, player: Cell): boolean {
  if (!player) return false;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dRow, dCol] of dirs) {
    let count = 1;
    for (let i = 1; i < 4; i++) {
      const r = row + dRow * i, c = col + dCol * i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r][c] !== player) break;
      count++;
    }
    for (let i = 1; i < 4; i++) {
      const r = row - dRow * i, c = col - dCol * i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r][c] !== player) break;
      count++;
    }
    if (count >= 4) return true;
  }
  return false;
}

const isBoardFull = (board: Board): boolean => board[0].every(cell => cell !== null);

export function dropDisc(gameId: string, playerId: string, column: number): ConnectFourGame {
  const game = games.get(gameId);
  if (!game) throw new Error('Game not found');
  if (game.status !== 'active') throw new Error('Game is not active');
  if (playerId !== game.player1 && playerId !== game.player2) throw new Error('You are not a player in this game');
  if (game.currentTurn !== playerId) throw new Error('Not your turn');
  if (column < 0 || column > 6) throw new Error('Invalid column (must be 0-6)');

  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (game.board[r][column] === null) {
      row = r;
      break;
    }
  }
  if (row === -1) throw new Error('Column is full');

  const playerColor: Cell = playerId === game.player1 ? 'R' : 'Y';
  game.board[row][column] = playerColor;

  if (checkWin(game.board, row, column, playerColor)) {
    game.status = 'completed';
    game.winnerId = playerId;
    game.completedAt = new Date();
  } else if (isBoardFull(game.board)) {
    game.status = 'completed';
    game.isDraw = true;
    game.completedAt = new Date();
  } else {
    game.currentTurn = game.currentTurn === game.player1 ? game.player2 : game.player1;
  }
  return game;
}

export function getGameState(gameId: string): ConnectFourGame {
  const game = games.get(gameId);
  if (!game) throw new Error('Game not found');
  return game;
}

export function cleanupOldGames(maxAgeMs = 3600000): void {
  const now = Date.now();
  for (const [gameId, game] of games) {
    if (game.completedAt && now - game.completedAt.getTime() > maxAgeMs) {
      games.delete(gameId);
    }
  }
}
