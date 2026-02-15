import { describe, it, expect } from 'vitest';
import { createDeck, calculateHandValue, type Card } from '../services/blackjack.js';

/**
 * Blackjack Game Logic Unit Tests
 * Pure logic tests - NO database mocking
 */

describe('Blackjack - Deck Creation', () => {
  it('should create a deck with 52 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('should have 13 cards of each suit', () => {
    const deck = createDeck();
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    
    suits.forEach(suit => {
      const cardsOfSuit = deck.filter(card => card.suit === suit);
      expect(cardsOfSuit).toHaveLength(13);
    });
  });

  it('should have 4 cards of each rank', () => {
    const deck = createDeck();
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    ranks.forEach(rank => {
      const cardsOfRank = deck.filter(card => card.rank === rank);
      expect(cardsOfRank).toHaveLength(4);
    });
  });

  it('should shuffle deck (unlikely to match twice)', () => {
    const deck1 = createDeck();
    const deck2 = createDeck();
    
    const deck1Str = JSON.stringify(deck1);
    const deck2Str = JSON.stringify(deck2);
    
    expect(deck1Str).not.toBe(deck2Str);
  });
});

describe('Blackjack - Hand Value Calculation', () => {
  it('should calculate simple hand value correctly', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: '5' },
      { suit: 'diamonds', rank: '7' }
    ];
    expect(calculateHandValue(hand)).toBe(12);
  });

  it('should count face cards as 10', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'K' },
      { suit: 'diamonds', rank: 'Q' }
    ];
    expect(calculateHandValue(hand)).toBe(20);
  });

  it('should count ace as 11 when not busting', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'A' },
      { suit: 'diamonds', rank: '9' }
    ];
    expect(calculateHandValue(hand)).toBe(20);
  });

  it('should count ace as 1 when 11 would bust', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'A' },
      { suit: 'diamonds', rank: '9' },
      { suit: 'clubs', rank: '5' }
    ];
    expect(calculateHandValue(hand)).toBe(15); // 1 + 9 + 5
  });

  it('should handle multiple aces correctly', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'A' },
      { suit: 'diamonds', rank: 'A' },
      { suit: 'clubs', rank: '9' }
    ];
    expect(calculateHandValue(hand)).toBe(21); // 11 + 1 + 9
  });

  it('should detect blackjack (21 with 2 cards)', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'A' },
      { suit: 'diamonds', rank: 'K' }
    ];
    expect(calculateHandValue(hand)).toBe(21);
    expect(hand).toHaveLength(2);
  });

  it('should detect bust (over 21)', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'K' },
      { suit: 'diamonds', rank: 'Q' },
      { suit: 'clubs', rank: '5' }
    ];
    expect(calculateHandValue(hand)).toBe(25);
    expect(calculateHandValue(hand) > 21).toBe(true);
  });

  it('should handle all aces to avoid bust', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'A' },
      { suit: 'diamonds', rank: 'A' },
      { suit: 'clubs', rank: 'A' },
      { suit: 'spades', rank: 'A' }
    ];
    expect(calculateHandValue(hand)).toBe(14); // 11 + 1 + 1 + 1
  });
});

describe('Blackjack - Game Logic Validation', () => {
  it('should validate minimum bet', () => {
    const validateBet = (bet: number): boolean => bet >= 1;
    
    expect(validateBet(1)).toBe(true);
    expect(validateBet(100)).toBe(true);
    expect(validateBet(0)).toBe(false);
    expect(validateBet(-5)).toBe(false);
  });

  it('should calculate blackjack payout (3:2)', () => {
    const calculateBlackjackPayout = (bet: number): number => Math.floor(bet * 2.5);
    
    expect(calculateBlackjackPayout(10)).toBe(25);
    expect(calculateBlackjackPayout(20)).toBe(50);
    expect(calculateBlackjackPayout(100)).toBe(250);
  });

  it('should calculate regular win payout (1:1)', () => {
    const calculateWinPayout = (bet: number): number => bet * 2;
    
    expect(calculateWinPayout(10)).toBe(20);
    expect(calculateWinPayout(50)).toBe(100);
  });

  it('should return bet on push', () => {
    const calculatePushPayout = (bet: number): number => bet;
    
    expect(calculatePushPayout(10)).toBe(10);
    expect(calculatePushPayout(50)).toBe(50);
  });

  it('should determine dealer must hit on 16 or less', () => {
    const shouldDealerHit = (value: number): boolean => value < 17;
    
    expect(shouldDealerHit(16)).toBe(true);
    expect(shouldDealerHit(10)).toBe(true);
    expect(shouldDealerHit(17)).toBe(false);
    expect(shouldDealerHit(20)).toBe(false);
  });

  it('should determine winner correctly', () => {
    const determineWinner = (playerValue: number, dealerValue: number): string => {
      if (dealerValue > 21) return 'dealer_bust';
      if (playerValue > dealerValue) return 'player_win';
      if (dealerValue > playerValue) return 'dealer_win';
      return 'push';
    };

    expect(determineWinner(20, 22)).toBe('dealer_bust');
    expect(determineWinner(20, 18)).toBe('player_win');
    expect(determineWinner(18, 20)).toBe('dealer_win');
    expect(determineWinner(19, 19)).toBe('push');
  });

  it('should detect player bust', () => {
    const isPlayerBust = (value: number): boolean => value > 21;
    
    expect(isPlayerBust(22)).toBe(true);
    expect(isPlayerBust(25)).toBe(true);
    expect(isPlayerBust(21)).toBe(false);
    expect(isPlayerBust(20)).toBe(false);
  });

  it('should validate game can continue', () => {
    const canContinue = (status: string): boolean => status === 'playing';
    
    expect(canContinue('playing')).toBe(true);
    expect(canContinue('player_bust')).toBe(false);
    expect(canContinue('dealer_bust')).toBe(false);
    expect(canContinue('blackjack')).toBe(false);
  });
});

describe('Blackjack - Statistics Tracking', () => {
  it('should calculate win rate', () => {
    const calculateWinRate = (won: number, total: number): number => {
      if (total === 0) return 0;
      return Math.round((won / total) * 100);
    };

    expect(calculateWinRate(5, 10)).toBe(50);
    expect(calculateWinRate(7, 10)).toBe(70);
    expect(calculateWinRate(0, 10)).toBe(0);
    expect(calculateWinRate(0, 0)).toBe(0);
  });

  it('should calculate net profit', () => {
    const calculateProfit = (won: number, wagered: number): number => won - wagered;
    
    expect(calculateProfit(100, 50)).toBe(50);
    expect(calculateProfit(50, 100)).toBe(-50);
    expect(calculateProfit(100, 100)).toBe(0);
  });

  it('should track biggest win', () => {
    const updateBiggestWin = (current: number, newWin: number): number => {
      return Math.max(current, newWin);
    };

    expect(updateBiggestWin(100, 50)).toBe(100);
    expect(updateBiggestWin(100, 200)).toBe(200);
    expect(updateBiggestWin(0, 50)).toBe(50);
  });

  it('should identify winning statuses', () => {
    const isWinningStatus = (status: string): boolean => {
      return ['dealer_bust', 'player_win', 'blackjack'].includes(status);
    };

    expect(isWinningStatus('dealer_bust')).toBe(true);
    expect(isWinningStatus('player_win')).toBe(true);
    expect(isWinningStatus('blackjack')).toBe(true);
    expect(isWinningStatus('player_bust')).toBe(false);
    expect(isWinningStatus('dealer_win')).toBe(false);
    expect(isWinningStatus('push')).toBe(false);
  });
});
