/**
 * Game Service - Mini-Games System
 * Supports: dice, coinflip, rock-paper-scissors
 */

export type GameType = 'dice' | 'coinflip' | 'rps';
export type GameStatus = 'waiting' | 'active' | 'completed';
export type RPSChoice = 'rock' | 'paper' | 'scissors';
export type CoinSide = 'heads' | 'tails';

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
};

export type GameResult = {
  winnerId: string | null; // null for draw
  details: {
    dice?: { roll: number };
    coinflip?: { result: CoinSide };
    rps?: { hostChoice: RPSChoice; opponentChoice: RPSChoice };
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

  // Dice and coinflip are single-player, RPS needs 2 players
  if (game.type === 'rps' && game.participants.length >= 2) {
    throw new Error('Game is full');
  }

  if (game.status !== 'waiting') {
    throw new Error('Game already started or completed');
  }

  game.participants.push(agentId);
  
  // Auto-start RPS when 2 players join
  if (game.type === 'rps' && game.participants.length === 2) {
    game.status = 'active';
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
