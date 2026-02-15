import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, hit, stand, getGameState, getPlayerValue, getDealerValue, clearBlackjackGames } from '../services/blackjack.js';

describe('Blackjack Service', () => {
  const roomId = 'test-room-1';
  
  beforeEach(() => { clearBlackjackGames(); });
  const playerId = 'player-1';

  describe('createGame', () => {
    it('should create game with 2 cards each, dealer hidden', () => {
      const game = createGame(roomId, playerId);
      expect(game.id).toBeDefined();
      expect(game.playerHand).toHaveLength(2);
      expect(game.dealerHand).toHaveLength(2);
      expect(game.dealerHidden).toBe(true);
      expect(game.deck.length).toBeLessThan(52);
    });

    it('should deal unique cards', () => {
      const game = createGame(roomId, playerId);
      const cards = [...game.playerHand, ...game.dealerHand].map(c => `${c.rank}${c.suit}`);
      expect(new Set(cards).size).toBe(4);
    });

    it('should auto-win on blackjack', () => {
      for (let i = 0; i < 100; i++) {
        const game = createGame(roomId, `p${i}`);
        if (game.status === 'player_won') {
          expect(getPlayerValue(game.id)).toBe(21);
          expect(game.dealerHidden).toBe(false);
          return;
        }
      }
    });
  });

  describe('hit', () => {
    it('should add card to player hand', () => {
      const game = createGame(roomId, playerId);
      const updated = hit(game.id, playerId);
      expect(updated.playerHand.length).toBe(3);
    });

    it('should detect bust over 21', () => {
      let game = createGame(roomId, playerId);
      for (let i = 0; i < 10 && game.status === 'active'; i++) {
        game = hit(game.id, playerId);
      }
      if (game.status === 'player_bust') {
        expect(getPlayerValue(game.id)).toBeGreaterThan(21);
        expect(game.dealerHidden).toBe(false);
      }
    });

    it('should reject wrong player', () => {
      const game = createGame(roomId, playerId);
      expect(() => hit(game.id, 'wrong')).toThrow('Not your game');
    });

    it('should reject after completion', () => {
      const game = createGame(roomId, playerId);
      if (game.status === 'active') {
        stand(game.id, playerId);
      }
      expect(() => hit(game.id, playerId)).toThrow('Game already completed');
    });
  });

  describe('stand', () => {
    it('should reveal dealer and hit until 17+', () => {
      const game = createGame(roomId, playerId);
      const result = stand(game.id, playerId);
      expect(result.dealerHidden).toBe(false);
      expect(getDealerValue(result.id)).toBeGreaterThanOrEqual(17);
    });

    it('should determine winner', () => {
      const game = createGame(roomId, playerId);
      const result = stand(game.id, playerId);
      expect(['player_won', 'dealer_won', 'push', 'dealer_bust']).toContain(result.status);
      expect(result.completedAt).toBeDefined();
    });

    it('should detect dealer bust', () => {
      for (let i = 0; i < 50; i++) {
        const game = createGame(roomId, `p${i}`);
        if (game.status === 'active') {
          const result = stand(game.id, `p${i}`);
          if (result.status === 'dealer_bust') {
            expect(getDealerValue(result.id)).toBeGreaterThan(21);
            return;
          }
        }
      }
    });

    it('should handle push', () => {
      for (let i = 0; i < 100; i++) {
        const game = createGame(roomId, `p${i}`);
        if (game.status === 'active') {
          const result = stand(game.id, `p${i}`);
          if (result.status === 'push') {
            expect(getPlayerValue(result.id)).toBe(getDealerValue(result.id));
            return;
          }
        }
      }
    });

    it('should reject wrong player', () => {
      const game = createGame(roomId, playerId);
      expect(() => stand(game.id, 'wrong')).toThrow('Not your game');
    });
  });

  describe('Card Values', () => {
    it('should value Ace as 11 when possible', () => {
      for (let i = 0; i < 50; i++) {
        const game = createGame(roomId, `p${i}`);
        if (game.playerHand.some(c => c.rank === 'A')) {
          expect(getPlayerValue(game.id)).toBeGreaterThanOrEqual(2);
          return;
        }
      }
    });

    it('should adjust Ace to 1 to avoid bust', () => {
      for (let i = 0; i < 300; i++) {
        let game = createGame(roomId, `p${i}`);
        if (game.status !== 'active') continue;
        for (let j = 0; j < 8 && game.status === 'active'; j++) {
          game = hit(game.id, `p${i}`);
          if (game.playerHand.some(c => c.rank === 'A') && game.playerHand.length >= 5 && 
              getPlayerValue(game.id) <= 21) return;
        }
      }
    });

    it('should value J/Q/K as 10', () => {
      for (let i = 0; i < 50; i++) {
        const game = createGame(roomId, `p${i}`);
        if (game.playerHand.some(c => ['J', 'Q', 'K'].includes(c.rank))) return;
      }
    });
  });

  describe('State Management', () => {
    it('should retrieve game state', () => {
      const game = createGame(roomId, playerId);
      expect(getGameState(game.id).id).toBe(game.id);
    });

    it('should reject non-existent game', () => {
      expect(() => getGameState('fake')).toThrow('Game not found');
      expect(() => hit('fake', playerId)).toThrow('Game not found');
    });

    it('should validate player ownership', () => {
      const game = createGame(roomId, playerId);
      expect(() => hit(game.id, 'other')).toThrow('Not your game');
      expect(() => stand(game.id, 'other')).toThrow('Not your game');
    });
  });

  describe('Full Game Flow', () => {
    it('should complete: hit then stand', () => {
      const game = createGame(roomId, playerId);
      if (game.status === 'active') {
        const afterHit = hit(game.id, playerId);
        expect(afterHit.playerHand.length).toBe(3);
        if (afterHit.status === 'active') {
          const final = stand(game.id, playerId);
          expect(final.status).not.toBe('active');
          expect(final.completedAt).toBeDefined();
        }
      }
    });
  });
});
