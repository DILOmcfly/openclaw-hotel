/**
 * Game Service - Mini-Games System
 * Supports: dice, coinflip, rock-paper-scissors
 */

export type GameType = 'dice' | 'coinflip' | 'rps' | 'tictactoe';
export type GameStatus = 'waiting' | 'active' | 'completed';
export type RPSChoice = 'rock' | 'paper' | 'scissors';
export type CoinSide = 'heads' | 'tails';
export type TicTacToeCell = 'X' | 'O' | null;
export type TicTacToeBoard = TicTacToeCell[];

export type Game = {
  id: string;
  roomId: string;
  type: GameType;
  hostId: string;
  status: GameStatus;
  createdAt: Date;
  completedAt: Date | null;
  participants: string[];
  moves: Map<string, number | string>; // agentId -> move
  result: GameResult | null;
  // Tic-Tac-Toe specific
  board?: TicTacToeBoard;
  currentTurn?: string; // agentId
};

export type GameResult = {
  winnerId: string | null; // null for draw
  details: {
    dice?: { roll: number };
    coinflip?: { result: CoinSide };
    rps?: { hostChoice: RPSChoice; opponentChoice: RPSChoice };
    tictactoe?: { board: TicTacToeBoard; draw: boolean };
  };
};

// In-memory game storage (for MVP - could move to DB later)
const games = new Map<string, Game>();

/**
 * Generate unique game ID
 */
function generateGameId(): string {
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new game
 */
export function createGame(roomId: string, gameType: GameType, hostId: string): Game {
  const game: Game = {
    id: generateGameId(),
    roomId,
    type: gameType,
    hostId,
    status: 'waiting',
    createdAt: new Date(),
    completedAt: null,
    participants: [hostId],
    moves: new Map(),
    result: null,
  };

  games.set(game.id, game);
  return game;
}

/**
 * Join an existing game
 */
export function joinGame(gameId: string, agentId: string): Game {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  if (game.participants.includes(agentId)) {
    throw new Error('Already in this game');
  }

  // Dice and coinflip are single-player, RPS and TicTacToe need 2 players
  if ((game.type === 'rps' || game.type === 'tictactoe') && game.participants.length >= 2) {
    throw new Error('Game is full');
  }

  if (game.status !== 'waiting') {
    throw new Error('Game already started or completed');
  }

  game.participants.push(agentId);
  
  // Auto-start RPS and TicTacToe when 2 players join
  if ((game.type === 'rps' || game.type === 'tictactoe') && game.participants.length === 2) {
    game.status = 'active';
    
    // Initialize TicTacToe board
    if (game.type === 'tictactoe') {
      game.board = Array(9).fill(null);
      game.currentTurn = game.hostId; // Host goes first as X
    }
  }

  return game;
}

/**
 * Roll dice (1-6)
 */
function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Flip coin
 */
function flipCoin(): CoinSide {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

/**
 * Determine RPS winner
 */
function determineRPSWinner(choice1: RPSChoice, choice2: RPSChoice): number {
  if (choice1 === choice2) return 0; // Draw
  
  const winMap: Record<RPSChoice, RPSChoice> = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };

  return winMap[choice1] === choice2 ? 1 : -1; // 1 = player1 wins, -1 = player2 wins
}

/**
 * Check for Tic-Tac-Toe winner
 */
function checkTicTacToeWinner(board: TicTacToeBoard): TicTacToeCell {
  const winPatterns = [
    [0, 1, 2], // Top row
    [3, 4, 5], // Middle row
    [6, 7, 8], // Bottom row
    [0, 3, 6], // Left column
    [1, 4, 7], // Middle column
    [2, 5, 8], // Right column
    [0, 4, 8], // Diagonal \
    [2, 4, 6], // Diagonal /
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

/**
 * Check if Tic-Tac-Toe board is full (draw)
 */
function isTicTacToeDraw(board: TicTacToeBoard): boolean {
  return board.every((cell) => cell !== null) && !checkTicTacToeWinner(board);
}

/**
 * Make a move in a game
 */
export function makeMove(gameId: string, agentId: string, move: number | string): Game {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  if (!game.participants.includes(agentId)) {
    throw new Error('Not a participant in this game');
  }

  if (game.status === 'completed') {
    throw new Error('Game already completed');
  }

  // Handle different game types
  switch (game.type) {
    case 'dice': {
      // Auto-roll for dice - ignore move parameter
      const roll = rollDice();
      game.moves.set(agentId, roll);
      game.status = 'completed';
      game.completedAt = new Date();
      game.result = {
        winnerId: agentId, // Always the player for dice
        details: { dice: { roll } },
      };
      break;
    }

    case 'coinflip': {
      // move should be 'heads' or 'tails' (player's guess)
      if (move !== 'heads' && move !== 'tails') {
        throw new Error('Invalid coin choice. Must be heads or tails');
      }

      const result = flipCoin();
      game.moves.set(agentId, move);
      game.status = 'completed';
      game.completedAt = new Date();
      game.result = {
        winnerId: move === result ? agentId : null,
        details: { coinflip: { result } },
      };
      break;
    }

    case 'rps': {
      // move should be 'rock', 'paper', or 'scissors'
      if (move !== 'rock' && move !== 'paper' && move !== 'scissors') {
        throw new Error('Invalid RPS choice. Must be rock, paper, or scissors');
      }

      game.moves.set(agentId, move);

      // Check if both players have moved
      if (game.moves.size === 2) {
        const [player1Id, player2Id] = game.participants;
        const choice1 = game.moves.get(player1Id) as RPSChoice;
        const choice2 = game.moves.get(player2Id) as RPSChoice;

        const outcome = determineRPSWinner(choice1, choice2);
        
        game.status = 'completed';
        game.completedAt = new Date();
        game.result = {
          winnerId: outcome === 1 ? player1Id : outcome === -1 ? player2Id : null,
          details: {
            rps: {
              hostChoice: choice1,
              opponentChoice: choice2,
            },
          },
        };
      }
      break;
    }

    case 'tictactoe': {
      // move should be a cell number (0-8)
      const cell = typeof move === 'number' ? move : parseInt(move as string, 10);
      
      if (isNaN(cell) || cell < 0 || cell > 8) {
        throw new Error('Invalid cell. Must be 0-8');
      }

      if (!game.board) {
        throw new Error('Game board not initialized');
      }

      // Validate turn
      if (game.currentTurn !== agentId) {
        throw new Error('Not your turn');
      }

      // Validate cell is empty
      if (game.board[cell] !== null) {
        throw new Error('Cell already occupied');
      }

      // Make move
      const symbol: TicTacToeCell = agentId === game.hostId ? 'X' : 'O';
      game.board[cell] = symbol;

      // Check for winner
      const winner = checkTicTacToeWinner(game.board);
      const draw = isTicTacToeDraw(game.board);

      if (winner || draw) {
        game.status = 'completed';
        game.completedAt = new Date();
        game.result = {
          winnerId: winner ? agentId : null,
          details: {
            tictactoe: {
              board: game.board,
              draw,
            },
          },
        };
      } else {
        // Switch turns
        const [player1, player2] = game.participants;
        game.currentTurn = game.currentTurn === player1 ? player2 : player1;
      }
      break;
    }
  }

  return game;
}

/**
 * Get game state
 */
export function getGameState(gameId: string): Game {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }
  return game;
}

/**
 * End/cancel a game
 */
export function endGame(gameId: string): Game {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }

  game.status = 'completed';
  game.completedAt = new Date();
  
  return game;
}

/**
 * Get active games in a room
 */
export function getActiveGamesInRoom(roomId: string): Game[] {
  return Array.from(games.values()).filter(
    (game) => game.roomId === roomId && game.status !== 'completed'
  );
}

/**
 * Clean up old games (optional - for memory management)
 */
export function cleanupOldGames(maxAgeMs: number = 3600000): void {
  const now = Date.now();
  for (const [gameId, game] of games) {
    if (game.completedAt && now - game.completedAt.getTime() > maxAgeMs) {
      games.delete(gameId);
    }
  }
}
