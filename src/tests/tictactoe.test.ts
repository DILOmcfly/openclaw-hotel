import { describe, it, expect } from 'vitest';
import {
  createGame,
  joinGame,
  makeMove,
  getGameState,
  type TicTacToeBoard,
} from '../services/games.js';

describe('Tic-Tac-Toe Game', () => {
  const roomId = 'test-room-tictactoe';
  const player1 = 'agent-player1';
  const player2 = 'agent-player2';

  describe('Game Creation', () => {
    it('should create a tictactoe game', () => {
      const game = createGame(roomId, 'tictactoe', player1);

      expect(game.id).toBeDefined();
      expect(game.type).toBe('tictactoe');
      expect(game.status).toBe('waiting');
      expect(game.hostId).toBe(player1);
      expect(game.participants).toEqual([player1]);
      expect(game.board).toBeUndefined(); // Not initialized until 2 players join
    });

    it('should initialize board when second player joins', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      const updated = joinGame(game.id, player2);

      expect(updated.status).toBe('active');
      expect(updated.participants).toHaveLength(2);
      expect(updated.board).toBeDefined();
      expect(updated.board).toHaveLength(9);
      expect(updated.board?.every((cell) => cell === null)).toBe(true);
      expect(updated.currentTurn).toBe(player1); // Host goes first
    });

    it('should reject third player', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      expect(() => joinGame(game.id, 'agent-third')).toThrow('Game is full');
    });
  });

  describe('Making Moves', () => {
    it('should allow valid move on empty cell', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      const updated = makeMove(game.id, player1, 0); // Top-left

      expect(updated.board?.[0]).toBe('X');
      expect(updated.currentTurn).toBe(player2);
      expect(updated.status).toBe('active');
    });

    it('should reject move on occupied cell', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 0);

      expect(() => makeMove(game.id, player2, 0)).toThrow('Cell already occupied');
    });

    it('should reject move when not your turn', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      // Player1 goes first
      expect(() => makeMove(game.id, player2, 0)).toThrow('Not your turn');
    });

    it('should reject invalid cell number', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      expect(() => makeMove(game.id, player1, 9)).toThrow('Invalid cell');
      expect(() => makeMove(game.id, player1, -1)).toThrow('Invalid cell');
    });

    it('should alternate turns correctly', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      const turn1 = makeMove(game.id, player1, 0);
      expect(turn1.currentTurn).toBe(player2);

      const turn2 = makeMove(game.id, player2, 1);
      expect(turn2.currentTurn).toBe(player1);

      const turn3 = makeMove(game.id, player1, 2);
      expect(turn3.currentTurn).toBe(player2);
    });
  });

  describe('Win Detection - Rows', () => {
    it('should detect top row win', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 0); // X
      makeMove(game.id, player2, 3); // O
      makeMove(game.id, player1, 1); // X
      makeMove(game.id, player2, 4); // O
      const final = makeMove(game.id, player1, 2); // X wins

      expect(final.status).toBe('completed');
      expect(final.result?.winnerId).toBe(player1);
      expect(final.result?.details.tictactoe?.draw).toBe(false);
    });

    it('should detect middle row win', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 3); // X
      makeMove(game.id, player2, 0); // O
      makeMove(game.id, player1, 4); // X
      makeMove(game.id, player2, 1); // O
      const final = makeMove(game.id, player1, 5); // X wins

      expect(final.status).toBe('completed');
      expect(final.result?.winnerId).toBe(player1);
    });

    it('should detect bottom row win', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 6); // X
      makeMove(game.id, player2, 0); // O
      makeMove(game.id, player1, 7); // X
      makeMove(game.id, player2, 1); // O
      const final = makeMove(game.id, player1, 8); // X wins

      expect(final.status).toBe('completed');
      expect(final.result?.winnerId).toBe(player1);
    });
  });

  describe('Win Detection - Columns', () => {
    it('should detect left column win', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 0); // X
      makeMove(game.id, player2, 1); // O
      makeMove(game.id, player1, 3); // X
      makeMove(game.id, player2, 2); // O
      const final = makeMove(game.id, player1, 6); // X wins

      expect(final.status).toBe('completed');
      expect(final.result?.winnerId).toBe(player1);
    });

    it('should detect middle column win', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 1); // X
      makeMove(game.id, player2, 0); // O
      makeMove(game.id, player1, 4); // X
      makeMove(game.id, player2, 2); // O
      const final = makeMove(game.id, player1, 7); // X wins

      expect(final.status).toBe('completed');
      expect(final.result?.winnerId).toBe(player1);
    });

    it('should detect right column win', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 2); // X
      makeMove(game.id, player2, 0); // O
      makeMove(game.id, player1, 5); // X
      makeMove(game.id, player2, 1); // O
      const final = makeMove(game.id, player1, 8); // X wins

      expect(final.status).toBe('completed');
      expect(final.result?.winnerId).toBe(player1);
    });
  });

  describe('Win Detection - Diagonals', () => {
    it('should detect diagonal win (top-left to bottom-right)', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 0); // X
      makeMove(game.id, player2, 1); // O
      makeMove(game.id, player1, 4); // X
      makeMove(game.id, player2, 2); // O
      const final = makeMove(game.id, player1, 8); // X wins

      expect(final.status).toBe('completed');
      expect(final.result?.winnerId).toBe(player1);
    });

    it('should detect diagonal win (top-right to bottom-left)', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 2); // X
      makeMove(game.id, player2, 0); // O
      makeMove(game.id, player1, 4); // X
      makeMove(game.id, player2, 1); // O
      const final = makeMove(game.id, player1, 6); // X wins

      expect(final.status).toBe('completed');
      expect(final.result?.winnerId).toBe(player1);
    });
  });

  describe('Draw Detection', () => {
    it('should detect draw when board is full with no winner', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      // Create a draw scenario:
      // X O X
      // O X X
      // O X O
      makeMove(game.id, player1, 0); // X
      makeMove(game.id, player2, 1); // O
      makeMove(game.id, player1, 2); // X
      makeMove(game.id, player2, 3); // O
      makeMove(game.id, player1, 4); // X
      makeMove(game.id, player2, 6); // O
      makeMove(game.id, player1, 5); // X
      makeMove(game.id, player2, 8); // O
      const final = makeMove(game.id, player1, 7); // X

      expect(final.status).toBe('completed');
      expect(final.result?.winnerId).toBeNull();
      expect(final.result?.details.tictactoe?.draw).toBe(true);
    });
  });

  describe('Game State', () => {
    it('should maintain correct board state', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 0); // X at position 0
      makeMove(game.id, player2, 4); // O at position 4
      const state = getGameState(game.id);

      expect(state.board?.[0]).toBe('X');
      expect(state.board?.[4]).toBe('O');
      expect(state.board?.[1]).toBeNull();
    });

    it('should update board correctly for player 2 (O)', () => {
      const game = createGame(roomId, 'tictactoe', player1);
      joinGame(game.id, player2);

      makeMove(game.id, player1, 0); // X
      const updated = makeMove(game.id, player2, 1); // O

      expect(updated.board?.[1]).toBe('O');
    });
  });
});
