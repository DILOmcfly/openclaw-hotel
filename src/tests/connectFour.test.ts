import { describe, it, expect } from 'vitest';
import { createGame, dropDisc, getGameState } from '../services/connectFour.js';

describe('Connect Four Game', () => {
  const roomId = 'test-room-cf';
  const p1 = 'agent-red';
  const p2 = 'agent-yellow';

  describe('Game Creation & Basic Moves', () => {
    it('should create game with 6x7 empty board', () => {
      const game = createGame(roomId, p1, p2);
      expect(game.board).toHaveLength(6);
      expect(game.board[0]).toHaveLength(7);
      expect(game.currentTurn).toBe(p1);
      expect(game.winnerId).toBeNull();
    });

    it('should drop disc to bottom with gravity', () => {
      const game = createGame(roomId, p1, p2);
      const updated = dropDisc(game.id, p1, 3);
      expect(updated.board[5][3]).toBe('R');
      expect(updated.currentTurn).toBe(p2);
    });

    it('should stack discs correctly', () => {
      const game = createGame(roomId, p1, p2);
      dropDisc(game.id, p1, 3);
      dropDisc(game.id, p2, 3);
      const updated = dropDisc(game.id, p1, 3);
      expect(updated.board[5][3]).toBe('R');
      expect(updated.board[4][3]).toBe('Y');
      expect(updated.board[3][3]).toBe('R');
    });
  });

  describe('Validation', () => {
    it('should reject full column', () => {
      const game = createGame(roomId, p1, p2);
      for (let i = 0; i < 6; i++) {
        dropDisc(game.id, i % 2 === 0 ? p1 : p2, 0);
      }
      expect(() => dropDisc(game.id, p1, 0)).toThrow('Column is full');
    });

    it('should reject invalid column', () => {
      const game = createGame(roomId, p1, p2);
      expect(() => dropDisc(game.id, p1, -1)).toThrow('Invalid column');
      expect(() => dropDisc(game.id, p1, 7)).toThrow('Invalid column');
    });

    it('should reject wrong turn', () => {
      const game = createGame(roomId, p1, p2);
      expect(() => dropDisc(game.id, p2, 0)).toThrow('Not your turn');
    });

    it('should reject non-player', () => {
      const game = createGame(roomId, p1, p2);
      expect(() => dropDisc(game.id, 'stranger', 0)).toThrow('not a player');
    });

    it('should reject moves after completion', () => {
      const game = createGame(roomId, p1, p2);
      // Quick vertical win
      for (let i = 0; i < 4; i++) {
        dropDisc(game.id, p1, 0);
        if (i < 3) dropDisc(game.id, p2, 1);
      }
      expect(() => dropDisc(game.id, p2, 2)).toThrow('not active');
    });
  });

  describe('Horizontal Wins', () => {
    it('should detect horizontal win (bottom)', () => {
      const game = createGame(roomId, p1, p2);
      dropDisc(game.id, p1, 0);
      dropDisc(game.id, p2, 0);
      dropDisc(game.id, p1, 1);
      dropDisc(game.id, p2, 1);
      dropDisc(game.id, p1, 2);
      dropDisc(game.id, p2, 2);
      const final = dropDisc(game.id, p1, 3);
      expect(final.status).toBe('completed');
      expect(final.winnerId).toBe(p1);
      expect(final.isDraw).toBe(false);
    });

    it('should detect horizontal win (middle row)', () => {
      const game = createGame(roomId, p1, p2);
      // p2 builds row 2 (on top of p1's row 1)
      dropDisc(game.id, p1, 0); // p1 col0 row0
      dropDisc(game.id, p2, 2); // p2 col2 row0
      dropDisc(game.id, p1, 2); // p1 col2 row1
      dropDisc(game.id, p2, 3); // p2 col3 row0
      dropDisc(game.id, p1, 3); // p1 col3 row1
      dropDisc(game.id, p2, 4); // p2 col4 row0
      dropDisc(game.id, p1, 4); // p1 col4 row1
      const final = dropDisc(game.id, p2, 5); // p2 col5 row0 → 4 in a row (2,3,4,5)
      expect(final.winnerId).toBe(p2);
    });
  });

  describe('Vertical Win', () => {
    it('should detect vertical win', () => {
      const game = createGame(roomId, p1, p2);
      dropDisc(game.id, p1, 3);
      dropDisc(game.id, p2, 4);
      dropDisc(game.id, p1, 3);
      dropDisc(game.id, p2, 4);
      dropDisc(game.id, p1, 3);
      dropDisc(game.id, p2, 4);
      const final = dropDisc(game.id, p1, 3);
      expect(final.winnerId).toBe(p1);
    });
  });

  describe('Diagonal Wins', () => {
    it('should detect diagonal \\ win', () => {
      const game = createGame(roomId, p1, p2);
      dropDisc(game.id, p1, 0); // [5][0] R
      dropDisc(game.id, p2, 1); // [5][1] Y
      dropDisc(game.id, p1, 1); // [4][1] R
      dropDisc(game.id, p2, 2); // [5][2] Y
      dropDisc(game.id, p1, 2); // [4][2] R
      dropDisc(game.id, p2, 3); // [5][3] Y
      dropDisc(game.id, p1, 2); // [3][2] R
      dropDisc(game.id, p2, 3); // [4][3] Y
      dropDisc(game.id, p1, 3); // [3][3] R
      dropDisc(game.id, p2, 0); // [4][0] Y
      const final = dropDisc(game.id, p1, 3); // [2][3] R - WIN
      expect(final.winnerId).toBe(p1);
    });

    it('should detect diagonal / win', () => {
      const game = createGame(roomId, p1, p2);
      dropDisc(game.id, p1, 3); // [5][3] R
      dropDisc(game.id, p2, 2); // [5][2] Y
      dropDisc(game.id, p1, 2); // [4][2] R
      dropDisc(game.id, p2, 1); // [5][1] Y
      dropDisc(game.id, p1, 1); // [4][1] R
      dropDisc(game.id, p2, 0); // [5][0] Y
      dropDisc(game.id, p1, 1); // [3][1] R
      dropDisc(game.id, p2, 0); // [4][0] Y
      dropDisc(game.id, p1, 0); // [3][0] R
      dropDisc(game.id, p2, 6); // [5][6] Y
      const final = dropDisc(game.id, p1, 0); // [2][0] R - WIN
      expect(final.winnerId).toBe(p1);
    });
  });

  describe('Draw Detection', () => {
    it('should not declare draw with a winner', () => {
      const game = createGame(roomId, p1, p2);
      for (let i = 0; i < 4; i++) {
        dropDisc(game.id, p1, 0);
        if (i < 3) dropDisc(game.id, p2, 1);
      }
      const state = getGameState(game.id);
      expect(state.winnerId).toBe(p1);
      expect(state.isDraw).toBe(false);
    });
  });

  describe('Game State', () => {
    it('should retrieve state correctly', () => {
      const game = createGame(roomId, p1, p2);
      dropDisc(game.id, p1, 3);
      const state = getGameState(game.id);
      expect(state.board[5][3]).toBe('R');
      expect(state.currentTurn).toBe(p2);
    });

    it('should throw for non-existent game', () => {
      expect(() => getGameState('fake')).toThrow('not found');
    });
  });
});
