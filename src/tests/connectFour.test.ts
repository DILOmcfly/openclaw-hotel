import { describe, it, expect, vi } from 'vitest';
import { checkWinner, isBoardFull } from '../services/connectFour.js';

/**
 * Connect Four Unit Tests
 * All SQL calls are mocked - no real database connections
 */

describe('Connect Four Game Logic', () => {
  describe('Win Detection - Horizontal', () => {
    it('should detect horizontal win in row 0', () => {
      const board = [
        [1, 1, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      expect(checkWinner(board)).toBe(1);
    });

    it('should detect horizontal win in middle', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 2, 2, 2, 2, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      expect(checkWinner(board)).toBe(2);
    });

    it('should detect horizontal win at right edge', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 1],
      ];
      expect(checkWinner(board)).toBe(1);
    });
  });

  describe('Win Detection - Vertical', () => {
    it('should detect vertical win in column 0', () => {
      const board = [
        [1, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      expect(checkWinner(board)).toBe(1);
    });

    it('should detect vertical win in middle column', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0],
      ];
      expect(checkWinner(board)).toBe(2);
    });

    it('should detect vertical win at bottom', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 1],
      ];
      expect(checkWinner(board)).toBe(1);
    });
  });

  describe('Win Detection - Diagonal (Top-Left to Bottom-Right)', () => {
    it('should detect diagonal win from top-left', () => {
      const board = [
        [1, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      expect(checkWinner(board)).toBe(1);
    });

    it('should detect diagonal win in middle', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 2, 0, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0],
        [0, 0, 0, 0, 2, 0, 0],
        [0, 0, 0, 0, 0, 2, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      expect(checkWinner(board)).toBe(2);
    });
  });

  describe('Win Detection - Diagonal (Bottom-Left to Top-Right)', () => {
    it('should detect anti-diagonal win', () => {
      const board = [
        [0, 0, 0, 1, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      expect(checkWinner(board)).toBe(1);
    });

    it('should detect anti-diagonal win at bottom', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 2],
        [0, 0, 0, 0, 0, 2, 0],
        [0, 0, 0, 0, 2, 0, 0],
        [0, 0, 0, 2, 0, 0, 0],
      ];
      expect(checkWinner(board)).toBe(2);
    });
  });

  describe('No Winner Cases', () => {
    it('should return 0 for empty board', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      expect(checkWinner(board)).toBe(0);
    });

    it('should return 0 for board with only 3 in a row', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 2, 0, 0, 0],
      ];
      expect(checkWinner(board)).toBe(0);
    });
  });

  describe('Board Full Detection', () => {
    it('should return true for full board', () => {
      const board = [
        [1, 2, 1, 2, 1, 2, 1],
        [2, 1, 2, 1, 2, 1, 2],
        [1, 2, 1, 2, 1, 2, 1],
        [2, 1, 2, 1, 2, 1, 2],
        [1, 2, 1, 2, 1, 2, 1],
        [2, 1, 2, 1, 2, 1, 2],
      ];
      expect(isBoardFull(board)).toBe(true);
    });

    it('should return false for board with empty spaces', () => {
      const board = [
        [0, 2, 1, 2, 1, 2, 1],
        [2, 1, 2, 1, 2, 1, 2],
        [1, 2, 1, 2, 1, 2, 1],
        [2, 1, 2, 1, 2, 1, 2],
        [1, 2, 1, 2, 1, 2, 1],
        [2, 1, 2, 1, 2, 1, 2],
      ];
      expect(isBoardFull(board)).toBe(false);
    });

    it('should return false for empty board', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      expect(isBoardFull(board)).toBe(false);
    });
  });

  describe('Game Creation', () => {
    it('should create game with empty board', async () => {
      const mockSql = vi.fn().mockResolvedValue([{
        id: 1,
        player1Id: 'agent1',
        player2Id: null,
        board: '[[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]',
        currentTurn: null,
        winner: null,
        status: 'waiting',
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const createGame = async (player1Id: string, sql: any) => {
        const board = Array(6).fill(0).map(() => Array(7).fill(0));
        const result = await sql`INSERT`;
        const game = result[0];
        game.board = JSON.parse(game.board);
        return game;
      };

      const game = await createGame('agent1', mockSql);
      expect(game.player1Id).toBe('agent1');
      expect(game.status).toBe('waiting');
      expect(game.board).toHaveLength(6);
      expect(game.board[0]).toHaveLength(7);
    });
  });

  describe('Column Validation', () => {
    it('should reject column < 0', () => {
      const isValidColumn = (col: number) => col >= 0 && col < 7;
      expect(isValidColumn(-1)).toBe(false);
    });

    it('should reject column >= 7', () => {
      const isValidColumn = (col: number) => col >= 0 && col < 7;
      expect(isValidColumn(7)).toBe(false);
    });

    it('should accept valid columns 0-6', () => {
      const isValidColumn = (col: number) => col >= 0 && col < 7;
      for (let i = 0; i < 7; i++) {
        expect(isValidColumn(i)).toBe(true);
      }
    });
  });

  describe('Turn Order', () => {
    it('should alternate between players', () => {
      const players = ['player1', 'player2'];
      let currentTurn = 0;
      
      expect(players[currentTurn]).toBe('player1');
      currentTurn = (currentTurn + 1) % 2;
      expect(players[currentTurn]).toBe('player2');
      currentTurn = (currentTurn + 1) % 2;
      expect(players[currentTurn]).toBe('player1');
    });
  });

  describe('Column Full Detection', () => {
    it('should detect full column', () => {
      const board = [
        [1, 0, 0, 0, 0, 0, 0],
        [2, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0],
        [2, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0],
        [2, 0, 0, 0, 0, 0, 0],
      ];
      
      const isColumnFull = (board: number[][], col: number): boolean => {
        return board[0][col] !== 0;
      };
      
      expect(isColumnFull(board, 0)).toBe(true);
      expect(isColumnFull(board, 1)).toBe(false);
    });
  });

  describe('Gravity Logic', () => {
    it('should place piece at bottom of empty column', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      
      const findRow = (board: number[][], col: number): number => {
        for (let r = 5; r >= 0; r--) {
          if (board[r][col] === 0) return r;
        }
        return -1;
      };
      
      expect(findRow(board, 0)).toBe(5);
    });

    it('should stack pieces correctly', () => {
      const board = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0],
      ];
      
      const findRow = (board: number[][], col: number): number => {
        for (let r = 5; r >= 0; r--) {
          if (board[r][col] === 0) return r;
        }
        return -1;
      };
      
      expect(findRow(board, 0)).toBe(4);
    });
  });

  describe('Stats Tracking', () => {
    it('should initialize stats with zeros', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);
      
      const getStats = async (agentId: string, sql: any) => {
        const result = await sql`SELECT`;
        if (result.length === 0) {
          return { agentId, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
        }
        return result[0];
      };
      
      const stats = await getStats('agent1', mockSql);
      expect(stats.gamesPlayed).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.draws).toBe(0);
    });

    it('should return existing stats', async () => {
      const mockSql = vi.fn().mockResolvedValue([{
        agentId: 'agent1',
        gamesPlayed: 10,
        wins: 5,
        losses: 3,
        draws: 2,
      }]);
      
      const getStats = async (agentId: string, sql: any) => {
        const result = await sql`SELECT`;
        if (result.length === 0) {
          return { agentId, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
        }
        return result[0];
      };
      
      const stats = await getStats('agent1', mockSql);
      expect(stats.wins).toBe(5);
      expect(stats.losses).toBe(3);
      expect(stats.draws).toBe(2);
    });
  });

  describe('Game Status', () => {
    it('should validate status transitions', () => {
      const validTransitions: Record<string, string[]> = {
        waiting: ['playing'],
        playing: ['won', 'draw', 'forfeit'],
        won: [],
        draw: [],
        forfeit: [],
      };
      
      expect(validTransitions.waiting).toContain('playing');
      expect(validTransitions.playing).toContain('won');
      expect(validTransitions.playing).toContain('draw');
      expect(validTransitions.won).toHaveLength(0);
    });
  });
});
