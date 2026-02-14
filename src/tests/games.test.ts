import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGame,
  joinGame,
  makeMove,
  getGameState,
  endGame,
  getActiveGamesInRoom,
} from '../services/games.js';

describe('Games Service', () => {
  const roomId = 'test-room-1';
  const hostId = 'agent-host';
  const opponentId = 'agent-opponent';

  describe('createGame', () => {
    it('should create a dice game', () => {
      const game = createGame(roomId, 'dice', hostId);

      expect(game.id).toBeDefined();
      expect(game.roomId).toBe(roomId);
      expect(game.type).toBe('dice');
      expect(game.hostId).toBe(hostId);
      expect(game.status).toBe('waiting');
      expect(game.participants).toEqual([hostId]);
    });

    it('should create a coinflip game', () => {
      const game = createGame(roomId, 'coinflip', hostId);

      expect(game.type).toBe('coinflip');
      expect(game.status).toBe('waiting');
    });

    it('should create an RPS game', () => {
      const game = createGame(roomId, 'rps', hostId);

      expect(game.type).toBe('rps');
      expect(game.status).toBe('waiting');
    });
  });

  describe('joinGame', () => {
    it('should allow joining an RPS game', () => {
      const game = createGame(roomId, 'rps', hostId);
      const updated = joinGame(game.id, opponentId);

      expect(updated.participants).toHaveLength(2);
      expect(updated.participants).toContain(opponentId);
      expect(updated.status).toBe('active'); // RPS auto-starts with 2 players
    });

    it('should throw error if game is full', () => {
      const game = createGame(roomId, 'rps', hostId);
      joinGame(game.id, opponentId);

      expect(() => joinGame(game.id, 'agent-third')).toThrow('Game is full');
    });

    it('should throw error if already joined', () => {
      const game = createGame(roomId, 'rps', hostId);

      expect(() => joinGame(game.id, hostId)).toThrow('Already in this game');
    });
  });

  describe('Dice Game', () => {
    it('should roll dice in range 1-6', () => {
      const game = createGame(roomId, 'dice', hostId);
      const updated = makeMove(game.id, hostId, 1); // move is ignored for dice

      expect(updated.status).toBe('completed');
      expect(updated.result).toBeDefined();
      expect(updated.result?.details.dice?.roll).toBeGreaterThanOrEqual(1);
      expect(updated.result?.details.dice?.roll).toBeLessThanOrEqual(6);
      expect(updated.result?.winnerId).toBe(hostId);
    });

    it('should complete game immediately', () => {
      const game = createGame(roomId, 'dice', hostId);
      const updated = makeMove(game.id, hostId, 1);

      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeDefined();
    });
  });

  describe('Coin Flip Game', () => {
    it('should accept valid coin choices', () => {
      const game = createGame(roomId, 'coinflip', hostId);
      const updated = makeMove(game.id, hostId, 'heads');

      expect(updated.status).toBe('completed');
      expect(updated.result?.details.coinflip?.result).toMatch(/^(heads|tails)$/);
    });

    it('should reject invalid coin choices', () => {
      const game = createGame(roomId, 'coinflip', hostId);

      expect(() => makeMove(game.id, hostId, 'invalid')).toThrow(
        'Invalid coin choice'
      );
    });

    it('should determine winner correctly', () => {
      const game = createGame(roomId, 'coinflip', hostId);
      const updated = makeMove(game.id, hostId, 'heads');

      const result = updated.result?.details.coinflip?.result;
      if (result === 'heads') {
        expect(updated.result?.winnerId).toBe(hostId);
      } else {
        expect(updated.result?.winnerId).toBeNull();
      }
    });
  });

  describe('Rock Paper Scissors', () => {
    it('should accept valid RPS choices', () => {
      const game = createGame(roomId, 'rps', hostId);
      joinGame(game.id, opponentId);

      const updated1 = makeMove(game.id, hostId, 'rock');
      expect(updated1.status).toBe('active'); // Still waiting for opponent

      const updated2 = makeMove(game.id, opponentId, 'scissors');
      expect(updated2.status).toBe('completed');
    });

    it('should reject invalid RPS choices', () => {
      const game = createGame(roomId, 'rps', hostId);
      joinGame(game.id, opponentId);

      expect(() => makeMove(game.id, hostId, 'invalid')).toThrow('Invalid RPS choice');
    });

    it('should determine rock beats scissors', () => {
      const game = createGame(roomId, 'rps', hostId);
      joinGame(game.id, opponentId);

      makeMove(game.id, hostId, 'rock');
      const updated = makeMove(game.id, opponentId, 'scissors');

      expect(updated.result?.winnerId).toBe(hostId);
      expect(updated.result?.details.rps?.hostChoice).toBe('rock');
      expect(updated.result?.details.rps?.opponentChoice).toBe('scissors');
    });

    it('should determine paper beats rock', () => {
      const game = createGame(roomId, 'rps', hostId);
      joinGame(game.id, opponentId);

      makeMove(game.id, hostId, 'rock');
      const updated = makeMove(game.id, opponentId, 'paper');

      expect(updated.result?.winnerId).toBe(opponentId);
    });

    it('should determine scissors beats paper', () => {
      const game = createGame(roomId, 'rps', hostId);
      joinGame(game.id, opponentId);

      makeMove(game.id, hostId, 'scissors');
      const updated = makeMove(game.id, opponentId, 'paper');

      expect(updated.result?.winnerId).toBe(hostId);
    });

    it('should handle draw', () => {
      const game = createGame(roomId, 'rps', hostId);
      joinGame(game.id, opponentId);

      makeMove(game.id, hostId, 'rock');
      const updated = makeMove(game.id, opponentId, 'rock');

      expect(updated.result?.winnerId).toBeNull();
    });
  });

  describe('getGameState', () => {
    it('should retrieve game state', () => {
      const game = createGame(roomId, 'dice', hostId);
      const retrieved = getGameState(game.id);

      expect(retrieved.id).toBe(game.id);
      expect(retrieved.type).toBe('dice');
    });

    it('should throw error for non-existent game', () => {
      expect(() => getGameState('non-existent-id')).toThrow('Game not found');
    });
  });

  describe('endGame', () => {
    it('should end a game', () => {
      const game = createGame(roomId, 'dice', hostId);
      const ended = endGame(game.id);

      expect(ended.status).toBe('completed');
      expect(ended.completedAt).toBeDefined();
    });
  });

  describe('getActiveGamesInRoom', () => {
    it('should return active games in room', () => {
      const testRoomId = 'test-room-unique-123';
      const game1 = createGame(testRoomId, 'dice', hostId);
      const game2 = createGame(testRoomId, 'coinflip', hostId);
      makeMove(game1.id, hostId, 1); // Complete game1

      const activeGames = getActiveGamesInRoom(testRoomId);

      expect(activeGames).toHaveLength(1);
      expect(activeGames[0].id).toBe(game2.id);
    });
  });
});
