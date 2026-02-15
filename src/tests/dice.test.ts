import { describe, it, expect } from 'vitest';

/**
 * Dice Game Unit Tests
 * All tests are pure logic - NO database calls
 */

describe('Dice Game Logic', () => {
  describe('Payout Calculation', () => {
    const calculatePayout = (bet: number, targetType: string): number => {
      switch (targetType) {
        case 'exact':
          return bet * 5;
        case 'over':
        case 'under':
          return bet * 2;
        case 'even':
        case 'odd':
          return Math.floor(bet * 1.5);
        default:
          return 0;
      }
    };

    it('should calculate exact match payout (bet × 5)', () => {
      expect(calculatePayout(10, 'exact')).toBe(50);
      expect(calculatePayout(100, 'exact')).toBe(500);
    });

    it('should calculate over/under payout (bet × 2)', () => {
      expect(calculatePayout(10, 'over')).toBe(20);
      expect(calculatePayout(10, 'under')).toBe(20);
      expect(calculatePayout(50, 'over')).toBe(100);
    });

    it('should calculate even/odd payout (bet × 1.5)', () => {
      expect(calculatePayout(10, 'even')).toBe(15);
      expect(calculatePayout(10, 'odd')).toBe(15);
      expect(calculatePayout(100, 'even')).toBe(150);
    });

    it('should floor even/odd payout for non-integer results', () => {
      expect(calculatePayout(11, 'even')).toBe(16); // 11 * 1.5 = 16.5 → 16
      expect(calculatePayout(13, 'odd')).toBe(19); // 13 * 1.5 = 19.5 → 19
    });

    it('should return 0 for invalid bet type', () => {
      expect(calculatePayout(10, 'invalid')).toBe(0);
    });
  });

  describe('Win Condition Checking', () => {
    const checkWin = (total: number, targetType: string, targetValue: number | null): boolean => {
      switch (targetType) {
        case 'over':
          return targetValue !== null && total > targetValue;
        case 'under':
          return targetValue !== null && total < targetValue;
        case 'exact':
          return targetValue !== null && total === targetValue;
        case 'even':
          return total % 2 === 0;
        case 'odd':
          return total % 2 === 1;
        default:
          return false;
      }
    };

    it('should check "over" bet correctly', () => {
      expect(checkWin(8, 'over', 7)).toBe(true);
      expect(checkWin(7, 'over', 7)).toBe(false);
      expect(checkWin(6, 'over', 7)).toBe(false);
    });

    it('should check "under" bet correctly', () => {
      expect(checkWin(6, 'under', 7)).toBe(true);
      expect(checkWin(7, 'under', 7)).toBe(false);
      expect(checkWin(8, 'under', 7)).toBe(false);
    });

    it('should check "exact" bet correctly', () => {
      expect(checkWin(7, 'exact', 7)).toBe(true);
      expect(checkWin(6, 'exact', 7)).toBe(false);
      expect(checkWin(8, 'exact', 7)).toBe(false);
    });

    it('should check "even" bet correctly', () => {
      expect(checkWin(2, 'even', null)).toBe(true);
      expect(checkWin(4, 'even', null)).toBe(true);
      expect(checkWin(10, 'even', null)).toBe(true);
      expect(checkWin(3, 'even', null)).toBe(false);
      expect(checkWin(7, 'even', null)).toBe(false);
    });

    it('should check "odd" bet correctly', () => {
      expect(checkWin(3, 'odd', null)).toBe(true);
      expect(checkWin(7, 'odd', null)).toBe(true);
      expect(checkWin(11, 'odd', null)).toBe(true);
      expect(checkWin(2, 'odd', null)).toBe(false);
      expect(checkWin(10, 'odd', null)).toBe(false);
    });

    it('should handle null target value for over/under/exact', () => {
      expect(checkWin(7, 'over', null)).toBe(false);
      expect(checkWin(7, 'under', null)).toBe(false);
      expect(checkWin(7, 'exact', null)).toBe(false);
    });
  });

  describe('Dice Roll Validation', () => {
    const isValidDiceCount = (count: number): boolean => {
      return count >= 1 && count <= 5;
    };

    it('should accept valid dice counts (1-5)', () => {
      expect(isValidDiceCount(1)).toBe(true);
      expect(isValidDiceCount(2)).toBe(true);
      expect(isValidDiceCount(3)).toBe(true);
      expect(isValidDiceCount(4)).toBe(true);
      expect(isValidDiceCount(5)).toBe(true);
    });

    it('should reject invalid dice counts', () => {
      expect(isValidDiceCount(0)).toBe(false);
      expect(isValidDiceCount(6)).toBe(false);
      expect(isValidDiceCount(-1)).toBe(false);
      expect(isValidDiceCount(10)).toBe(false);
    });
  });

  describe('Bet Validation', () => {
    const isValidBet = (bet: number): boolean => {
      return bet >= 1;
    };

    it('should accept valid bets (≥ 1)', () => {
      expect(isValidBet(1)).toBe(true);
      expect(isValidBet(10)).toBe(true);
      expect(isValidBet(100)).toBe(true);
    });

    it('should reject invalid bets', () => {
      expect(isValidBet(0)).toBe(false);
      expect(isValidBet(-1)).toBe(false);
      expect(isValidBet(-100)).toBe(false);
    });
  });

  describe('Dice Range Validation', () => {
    const isValidDiceValue = (value: number): boolean => {
      return value >= 1 && value <= 6;
    };

    it('should accept valid dice values (1-6)', () => {
      expect(isValidDiceValue(1)).toBe(true);
      expect(isValidDiceValue(2)).toBe(true);
      expect(isValidDiceValue(3)).toBe(true);
      expect(isValidDiceValue(4)).toBe(true);
      expect(isValidDiceValue(5)).toBe(true);
      expect(isValidDiceValue(6)).toBe(true);
    });

    it('should reject invalid dice values', () => {
      expect(isValidDiceValue(0)).toBe(false);
      expect(isValidDiceValue(7)).toBe(false);
      expect(isValidDiceValue(-1)).toBe(false);
    });
  });

  describe('Total Calculation', () => {
    const calculateTotal = (rolls: number[]): number => {
      return rolls.reduce((sum, roll) => sum + roll, 0);
    };

    it('should sum dice rolls correctly', () => {
      expect(calculateTotal([1, 1])).toBe(2);
      expect(calculateTotal([6, 6])).toBe(12);
      expect(calculateTotal([3, 4])).toBe(7);
      expect(calculateTotal([1, 2, 3])).toBe(6);
      expect(calculateTotal([6, 6, 6, 6, 6])).toBe(30);
    });

    it('should handle single die', () => {
      expect(calculateTotal([5])).toBe(5);
    });

    it('should handle empty array', () => {
      expect(calculateTotal([])).toBe(0);
    });
  });

  describe('Odds Calculation', () => {
    const calculateOdds = (diceCount: number, targetType: string, targetValue: number | null): number => {
      const min = diceCount;
      const max = diceCount * 6;

      if (targetType === 'even' || targetType === 'odd') {
        return 0.5;
      }

      if (targetType === 'exact' && targetValue !== null) {
        const range = max - min + 1;
        return 1 / range;
      }

      if (targetType === 'over' && targetValue !== null) {
        const possibleValues = max - targetValue;
        return possibleValues / (max - min + 1);
      }

      if (targetType === 'under' && targetValue !== null) {
        const possibleValues = targetValue - min;
        return possibleValues / (max - min + 1);
      }

      return 0;
    };

    it('should calculate even/odd odds as 50%', () => {
      expect(calculateOdds(2, 'even', null)).toBe(0.5);
      expect(calculateOdds(2, 'odd', null)).toBe(0.5);
      expect(calculateOdds(5, 'even', null)).toBe(0.5);
    });

    it('should calculate exact odds for 2 dice', () => {
      // 2 dice: range 2-12 (11 possible values)
      expect(calculateOdds(2, 'exact', 7)).toBeCloseTo(0.0909, 3);
    });

    it('should calculate over odds correctly', () => {
      // 2 dice: range 2-12 (11 values), over 7 means 8,9,10,11,12 = 5 values
      expect(calculateOdds(2, 'over', 7)).toBeCloseTo(0.4545, 3);
    });

    it('should calculate under odds correctly', () => {
      // 2 dice: range 2-12 (11 values), under 7 means 2,3,4,5,6 = 5 values
      expect(calculateOdds(2, 'under', 7)).toBeCloseTo(0.4545, 3);
    });

    it('should return 0 for invalid bet type', () => {
      expect(calculateOdds(2, 'invalid', 7)).toBe(0);
    });
  });

  describe('Target Type Validation', () => {
    const VALID_TARGET_TYPES = ['over', 'under', 'exact', 'even', 'odd'];

    const isValidTargetType = (type: string): boolean => {
      return VALID_TARGET_TYPES.includes(type);
    };

    it('should accept valid target types', () => {
      expect(isValidTargetType('over')).toBe(true);
      expect(isValidTargetType('under')).toBe(true);
      expect(isValidTargetType('exact')).toBe(true);
      expect(isValidTargetType('even')).toBe(true);
      expect(isValidTargetType('odd')).toBe(true);
    });

    it('should reject invalid target types', () => {
      expect(isValidTargetType('invalid')).toBe(false);
      expect(isValidTargetType('OVER')).toBe(false);
      expect(isValidTargetType('')).toBe(false);
    });
  });

  describe('Target Value Requirement', () => {
    const requiresTargetValue = (targetType: string): boolean => {
      return targetType === 'over' || targetType === 'under' || targetType === 'exact';
    };

    it('should require target value for over/under/exact', () => {
      expect(requiresTargetValue('over')).toBe(true);
      expect(requiresTargetValue('under')).toBe(true);
      expect(requiresTargetValue('exact')).toBe(true);
    });

    it('should not require target value for even/odd', () => {
      expect(requiresTargetValue('even')).toBe(false);
      expect(requiresTargetValue('odd')).toBe(false);
    });
  });

  describe('Stats Calculation', () => {
    type Stats = {
      gamesPlayed: number;
      wins: number;
      totalWagered: number;
      totalWon: number;
      biggestWin: number;
    };

    it('should calculate win rate correctly', () => {
      const calculateWinRate = (stats: Stats): number => {
        if (stats.gamesPlayed === 0) return 0;
        return (stats.wins / stats.gamesPlayed) * 100;
      };

      expect(calculateWinRate({ gamesPlayed: 10, wins: 5, totalWagered: 0, totalWon: 0, biggestWin: 0 })).toBe(50);
      expect(calculateWinRate({ gamesPlayed: 0, wins: 0, totalWagered: 0, totalWon: 0, biggestWin: 0 })).toBe(0);
    });

    it('should calculate net winnings correctly', () => {
      const calculateNet = (stats: Stats): number => {
        return stats.totalWon - stats.totalWagered;
      };

      expect(calculateNet({ gamesPlayed: 0, wins: 0, totalWagered: 100, totalWon: 200, biggestWin: 0 })).toBe(100);
      expect(calculateNet({ gamesPlayed: 0, wins: 0, totalWagered: 200, totalWon: 100, biggestWin: 0 })).toBe(-100);
    });

    it('should track biggest win correctly', () => {
      const updateBiggestWin = (current: number, newWin: number): number => {
        return Math.max(current, newWin);
      };

      expect(updateBiggestWin(100, 200)).toBe(200);
      expect(updateBiggestWin(200, 100)).toBe(200);
      expect(updateBiggestWin(0, 50)).toBe(50);
    });
  });

  describe('Dice Totals - Range Validation', () => {
    it('should validate minimum total for dice count', () => {
      const getMinTotal = (diceCount: number): number => diceCount;
      
      expect(getMinTotal(1)).toBe(1);
      expect(getMinTotal(2)).toBe(2);
      expect(getMinTotal(5)).toBe(5);
    });

    it('should validate maximum total for dice count', () => {
      const getMaxTotal = (diceCount: number): number => diceCount * 6;
      
      expect(getMaxTotal(1)).toBe(6);
      expect(getMaxTotal(2)).toBe(12);
      expect(getMaxTotal(5)).toBe(30);
    });
  });

  describe('Payout Zero for Losses', () => {
    it('should return 0 payout when bet loses', () => {
      const calculateGamePayout = (won: boolean, bet: number, targetType: string): number => {
        if (!won) return 0;
        
        switch (targetType) {
          case 'exact': return bet * 5;
          case 'over':
          case 'under': return bet * 2;
          case 'even':
          case 'odd': return Math.floor(bet * 1.5);
          default: return 0;
        }
      };

      expect(calculateGamePayout(false, 100, 'exact')).toBe(0);
      expect(calculateGamePayout(false, 50, 'over')).toBe(0);
      expect(calculateGamePayout(false, 25, 'even')).toBe(0);
    });
  });
});
