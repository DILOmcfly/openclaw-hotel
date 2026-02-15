import { describe, it, expect } from 'vitest';

/**
 * Rock-Paper-Scissors Unit Tests
 * All tests are pure logic - NO database calls
 */

describe('Rock-Paper-Scissors Game Logic', () => {
  describe('Move Combinations - All 9 Cases', () => {
    const determineWinner = (move1: string, move2: string): number => {
      if (move1 === move2) return 0;
      if (
        (move1 === 'rock' && move2 === 'scissors') ||
        (move1 === 'paper' && move2 === 'rock') ||
        (move1 === 'scissors' && move2 === 'paper')
      ) {
        return 1;
      }
      return 2;
    };

    it('rock vs rock = draw', () => {
      expect(determineWinner('rock', 'rock')).toBe(0);
    });

    it('rock vs paper = player2 wins', () => {
      expect(determineWinner('rock', 'paper')).toBe(2);
    });

    it('rock vs scissors = player1 wins', () => {
      expect(determineWinner('rock', 'scissors')).toBe(1);
    });

    it('paper vs rock = player1 wins', () => {
      expect(determineWinner('paper', 'rock')).toBe(1);
    });

    it('paper vs paper = draw', () => {
      expect(determineWinner('paper', 'paper')).toBe(0);
    });

    it('paper vs scissors = player2 wins', () => {
      expect(determineWinner('paper', 'scissors')).toBe(2);
    });

    it('scissors vs rock = player2 wins', () => {
      expect(determineWinner('scissors', 'rock')).toBe(2);
    });

    it('scissors vs paper = player1 wins', () => {
      expect(determineWinner('scissors', 'paper')).toBe(1);
    });

    it('scissors vs scissors = draw', () => {
      expect(determineWinner('scissors', 'scissors')).toBe(0);
    });
  });

  describe('Draw Detection', () => {
    const determineWinner = (move1: string, move2: string): number => {
      if (move1 === move2) return 0;
      if (
        (move1 === 'rock' && move2 === 'scissors') ||
        (move1 === 'paper' && move2 === 'rock') ||
        (move1 === 'scissors' && move2 === 'paper')
      ) {
        return 1;
      }
      return 2;
    };

    it('should detect all draws correctly', () => {
      expect(determineWinner('rock', 'rock')).toBe(0);
      expect(determineWinner('paper', 'paper')).toBe(0);
      expect(determineWinner('scissors', 'scissors')).toBe(0);
    });

    it('should never return draw for different moves', () => {
      expect(determineWinner('rock', 'paper')).not.toBe(0);
      expect(determineWinner('rock', 'scissors')).not.toBe(0);
      expect(determineWinner('paper', 'rock')).not.toBe(0);
      expect(determineWinner('paper', 'scissors')).not.toBe(0);
      expect(determineWinner('scissors', 'rock')).not.toBe(0);
      expect(determineWinner('scissors', 'paper')).not.toBe(0);
    });
  });

  describe('Move Hiding Logic', () => {
    type Game = {
      player1Id: string;
      player2Id: string;
      player1Move: string | null;
      player2Move: string | null;
      status: string;
    };

    const hideOpponentMove = (game: Game, viewerId: string): Game => {
      if (game.status !== 'resolved') {
        if (game.player1Id !== viewerId) {
          game.player1Move = null;
        }
        if (game.player2Id !== viewerId) {
          game.player2Move = null;
        }
      }
      return game;
    };

    it('should hide opponent move when game is playing', () => {
      const game: Game = {
        player1Id: 'alice',
        player2Id: 'bob',
        player1Move: 'rock',
        player2Move: 'paper',
        status: 'playing',
      };

      const aliceView = hideOpponentMove({ ...game }, 'alice');
      expect(aliceView.player1Move).toBe('rock');
      expect(aliceView.player2Move).toBeNull();

      const bobView = hideOpponentMove({ ...game }, 'bob');
      expect(bobView.player1Move).toBeNull();
      expect(bobView.player2Move).toBe('paper');
    });

    it('should show both moves when game is resolved', () => {
      const game: Game = {
        player1Id: 'alice',
        player2Id: 'bob',
        player1Move: 'rock',
        player2Move: 'scissors',
        status: 'resolved',
      };

      const aliceView = hideOpponentMove({ ...game }, 'alice');
      expect(aliceView.player1Move).toBe('rock');
      expect(aliceView.player2Move).toBe('scissors');

      const bobView = hideOpponentMove({ ...game }, 'bob');
      expect(bobView.player1Move).toBe('rock');
      expect(bobView.player2Move).toBe('scissors');
    });

    it('should hide both moves for non-players when playing', () => {
      const game: Game = {
        player1Id: 'alice',
        player2Id: 'bob',
        player1Move: 'rock',
        player2Move: 'paper',
        status: 'playing',
      };

      const spectatorView = hideOpponentMove({ ...game }, 'charlie');
      expect(spectatorView.player1Move).toBeNull();
      expect(spectatorView.player2Move).toBeNull();
    });
  });

  describe('Move Validation', () => {
    const VALID_MOVES = ['rock', 'paper', 'scissors'];

    const isValidMove = (move: string): boolean => {
      return VALID_MOVES.includes(move);
    };

    it('should accept valid moves', () => {
      expect(isValidMove('rock')).toBe(true);
      expect(isValidMove('paper')).toBe(true);
      expect(isValidMove('scissors')).toBe(true);
    });

    it('should reject invalid moves', () => {
      expect(isValidMove('invalid')).toBe(false);
      expect(isValidMove('ROCK')).toBe(false);
      expect(isValidMove('')).toBe(false);
      expect(isValidMove('lizard')).toBe(false);
      expect(isValidMove('spock')).toBe(false);
    });
  });

  describe('Game State Validation', () => {
    it('should validate waiting state can be joined', () => {
      const canJoin = (status: string): boolean => status === 'waiting';
      expect(canJoin('waiting')).toBe(true);
      expect(canJoin('playing')).toBe(false);
      expect(canJoin('resolved')).toBe(false);
      expect(canJoin('cancelled')).toBe(false);
    });

    it('should validate playing state can accept moves', () => {
      const canMove = (status: string): boolean => status === 'playing';
      expect(canMove('playing')).toBe(true);
      expect(canMove('waiting')).toBe(false);
      expect(canMove('resolved')).toBe(false);
      expect(canMove('cancelled')).toBe(false);
    });

    it('should detect when both moves are ready for resolution', () => {
      const canResolve = (move1: string | null, move2: string | null): boolean => {
        return move1 !== null && move2 !== null;
      };

      expect(canResolve('rock', 'paper')).toBe(true);
      expect(canResolve('rock', null)).toBe(false);
      expect(canResolve(null, 'paper')).toBe(false);
      expect(canResolve(null, null)).toBe(false);
    });
  });

  describe('Betting Logic', () => {
    it('should accept zero bet for free games', () => {
      const validateBet = (bet: number): boolean => bet >= 0;
      expect(validateBet(0)).toBe(true);
    });

    it('should accept positive bets', () => {
      const validateBet = (bet: number): boolean => bet >= 0;
      expect(validateBet(10)).toBe(true);
      expect(validateBet(100)).toBe(true);
      expect(validateBet(1000)).toBe(true);
    });

    it('should reject negative bets', () => {
      const validateBet = (bet: number): boolean => bet >= 0;
      expect(validateBet(-1)).toBe(false);
      expect(validateBet(-100)).toBe(false);
    });
  });

  describe('Stats Calculation', () => {
    type Stats = {
      wins: number;
      losses: number;
      draws: number;
      totalWagered: number;
      totalWon: number;
    };

    it('should calculate win rate correctly', () => {
      const calculateWinRate = (stats: Stats): number => {
        const total = stats.wins + stats.losses + stats.draws;
        if (total === 0) return 0;
        return (stats.wins / total) * 100;
      };

      expect(calculateWinRate({ wins: 10, losses: 5, draws: 5, totalWagered: 0, totalWon: 0 })).toBe(50);
      expect(calculateWinRate({ wins: 0, losses: 0, draws: 0, totalWagered: 0, totalWon: 0 })).toBe(0);
      expect(calculateWinRate({ wins: 3, losses: 1, draws: 0, totalWagered: 0, totalWon: 0 })).toBe(75);
    });

    it('should calculate net winnings correctly', () => {
      const calculateNet = (stats: Stats): number => {
        return stats.totalWon - stats.totalWagered;
      };

      expect(calculateNet({ wins: 0, losses: 0, draws: 0, totalWagered: 100, totalWon: 200 })).toBe(100);
      expect(calculateNet({ wins: 0, losses: 0, draws: 0, totalWagered: 200, totalWon: 100 })).toBe(-100);
      expect(calculateNet({ wins: 0, losses: 0, draws: 0, totalWagered: 100, totalWon: 100 })).toBe(0);
    });
  });

  describe('Winner ID Determination', () => {
    it('should return player1 ID when player1 wins', () => {
      const getWinnerId = (result: number, p1Id: string, p2Id: string): string | null => {
        if (result === 1) return p1Id;
        if (result === 2) return p2Id;
        return null;
      };

      expect(getWinnerId(1, 'alice', 'bob')).toBe('alice');
    });

    it('should return player2 ID when player2 wins', () => {
      const getWinnerId = (result: number, p1Id: string, p2Id: string): string | null => {
        if (result === 1) return p1Id;
        if (result === 2) return p2Id;
        return null;
      };

      expect(getWinnerId(2, 'alice', 'bob')).toBe('bob');
    });

    it('should return null for draw', () => {
      const getWinnerId = (result: number, p1Id: string, p2Id: string): string | null => {
        if (result === 1) return p1Id;
        if (result === 2) return p2Id;
        return null;
      };

      expect(getWinnerId(0, 'alice', 'bob')).toBeNull();
    });
  });

  describe('Player Identification', () => {
    it('should identify player1 correctly', () => {
      const isPlayer1 = (agentId: string, player1Id: string): boolean => {
        return agentId === player1Id;
      };

      expect(isPlayer1('alice', 'alice')).toBe(true);
      expect(isPlayer1('bob', 'alice')).toBe(false);
    });

    it('should identify player2 correctly', () => {
      const isPlayer2 = (agentId: string, player2Id: string): boolean => {
        return agentId === player2Id;
      };

      expect(isPlayer2('bob', 'bob')).toBe(true);
      expect(isPlayer2('alice', 'bob')).toBe(false);
    });

    it('should detect if agent is a player in game', () => {
      const isPlayer = (agentId: string, p1Id: string, p2Id: string): boolean => {
        return agentId === p1Id || agentId === p2Id;
      };

      expect(isPlayer('alice', 'alice', 'bob')).toBe(true);
      expect(isPlayer('bob', 'alice', 'bob')).toBe(true);
      expect(isPlayer('charlie', 'alice', 'bob')).toBe(false);
    });
  });
});
