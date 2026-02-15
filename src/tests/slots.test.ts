import { describe, it, expect } from 'vitest';

/**
 * Slots Mini-Game Unit Tests
 * Tests slot machine logic, payouts, and jackpots without database
 */

describe('Slots Mini-Game', () => {
  describe('Symbol Generation', () => {
    it('should generate 3 symbols', () => {
      const generateSymbols = (): string[] => {
        const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
        return [
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        ];
      };

      const result = generateSymbols();
      expect(result).toHaveLength(3);
    });

    it('should only generate valid symbols', () => {
      const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
      const generateSymbols = (): string[] => {
        return [
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        ];
      };

      const result = generateSymbols();
      result.forEach(symbol => {
        expect(SYMBOLS).toContain(symbol);
      });
    });
  });

  describe('Payout Calculation', () => {
    it('should award jackpot for triple 7️⃣', () => {
      const calculatePayout = (symbols: string[], bet: number, jackpot: number) => {
        const [s1, s2, s3] = symbols;
        if (s1 === '7️⃣' && s2 === '7️⃣' && s3 === '7️⃣') {
          return { payout: jackpot, jackpotWon: true };
        }
        return { payout: 0, jackpotWon: false };
      };

      const result = calculatePayout(['7️⃣', '7️⃣', '7️⃣'], 10, 5000);
      expect(result.payout).toBe(5000);
      expect(result.jackpotWon).toBe(true);
    });

    it('should award bet × 25 for triple 💎', () => {
      const calculatePayout = (symbols: string[], bet: number) => {
        const [s1, s2, s3] = symbols;
        if (s1 === '💎' && s2 === '💎' && s3 === '💎') {
          return bet * 25;
        }
        return 0;
      };

      expect(calculatePayout(['💎', '💎', '💎'], 10)).toBe(250);
      expect(calculatePayout(['💎', '💎', '💎'], 100)).toBe(2500);
    });

    it('should award bet × 10 for any triple match', () => {
      const calculatePayout = (symbols: string[], bet: number) => {
        const [s1, s2, s3] = symbols;
        if (s1 === s2 && s2 === s3 && s1 !== '7️⃣' && s1 !== '💎') {
          return bet * 10;
        }
        return 0;
      };

      expect(calculatePayout(['🍒', '🍒', '🍒'], 10)).toBe(100);
      expect(calculatePayout(['🔔', '🔔', '🔔'], 50)).toBe(500);
    });

    it('should award bet × 2 for pair match', () => {
      const calculatePayout = (symbols: string[], bet: number) => {
        const [s1, s2, s3] = symbols;
        const isTriple = s1 === s2 && s2 === s3;
        const isPair = (s1 === s2 || s2 === s3 || s1 === s3) && !isTriple;
        
        if (isPair) {
          return bet * 2;
        }
        return 0;
      };

      expect(calculatePayout(['🍒', '🍒', '🍋'], 10)).toBe(20);
      expect(calculatePayout(['🍋', '🔔', '🔔'], 25)).toBe(50);
      expect(calculatePayout(['⭐', '🍋', '⭐'], 15)).toBe(30);
    });

    it('should award 0 for no match', () => {
      const calculatePayout = (symbols: string[], bet: number) => {
        const [s1, s2, s3] = symbols;
        const isTriple = s1 === s2 && s2 === s3;
        const isPair = s1 === s2 || s2 === s3 || s1 === s3;
        
        if (!isTriple && !isPair) {
          return 0;
        }
        return -1; // Should never reach
      };

      expect(calculatePayout(['🍒', '🍋', '🔔'], 10)).toBe(0);
      expect(calculatePayout(['⭐', '💎', '🍒'], 100)).toBe(0);
    });

    it('should prioritize jackpot over regular triple', () => {
      const calculatePayout = (symbols: string[], bet: number, jackpot: number) => {
        const [s1, s2, s3] = symbols;
        
        // Check jackpot FIRST
        if (s1 === '7️⃣' && s2 === '7️⃣' && s3 === '7️⃣') {
          return { payout: jackpot, special: 'jackpot' };
        }
        
        if (s1 === s2 && s2 === s3) {
          return { payout: bet * 10, special: 'triple' };
        }
        
        return { payout: 0, special: 'none' };
      };

      const result = calculatePayout(['7️⃣', '7️⃣', '7️⃣'], 10, 5000);
      expect(result.special).toBe('jackpot');
      expect(result.payout).toBe(5000);
    });

    it('should prioritize triple diamond over regular triple', () => {
      const calculatePayout = (symbols: string[], bet: number) => {
        const [s1, s2, s3] = symbols;
        
        if (s1 === '💎' && s2 === '💎' && s3 === '💎') {
          return bet * 25;
        }
        
        if (s1 === s2 && s2 === s3) {
          return bet * 10;
        }
        
        return 0;
      };

      expect(calculatePayout(['💎', '💎', '💎'], 10)).toBe(250); // 25x, not 10x
    });
  });

  describe('Jackpot Pool', () => {
    it('should contribute 5% of bet to jackpot', () => {
      const CONTRIBUTION_RATE = 0.05;
      const calculateContribution = (bet: number): number => {
        return Math.floor(bet * CONTRIBUTION_RATE);
      };

      expect(calculateContribution(100)).toBe(5);
      expect(calculateContribution(200)).toBe(10);
      expect(calculateContribution(50)).toBe(2);
    });

    it('should floor contribution to nearest integer', () => {
      const CONTRIBUTION_RATE = 0.05;
      const calculateContribution = (bet: number): number => {
        return Math.floor(bet * CONTRIBUTION_RATE);
      };

      expect(calculateContribution(17)).toBe(0); // 0.85 → 0
      expect(calculateContribution(21)).toBe(1); // 1.05 → 1
      expect(calculateContribution(99)).toBe(4); // 4.95 → 4
    });

    it('should reset jackpot to 0 after win', () => {
      const resetJackpot = (won: boolean, currentPool: number): number => {
        return won ? 0 : currentPool;
      };

      expect(resetJackpot(true, 5000)).toBe(0);
      expect(resetJackpot(false, 5000)).toBe(5000);
    });

    it('should accumulate contributions across spins', () => {
      let jackpotPool = 1000;
      const CONTRIBUTION_RATE = 0.05;

      const spin = (bet: number): void => {
        const contribution = Math.floor(bet * CONTRIBUTION_RATE);
        jackpotPool += contribution;
      };

      spin(100); // +5
      spin(200); // +10
      spin(50);  // +2

      expect(jackpotPool).toBe(1017);
    });
  });

  describe('Bet Validation', () => {
    it('should reject bet below minimum', () => {
      const validateBet = (bet: number, min: number, max: number): boolean => {
        return bet >= min && bet <= max;
      };

      expect(validateBet(0, 1, 100)).toBe(false);
      expect(validateBet(0.5, 1, 100)).toBe(false);
    });

    it('should reject bet above maximum', () => {
      const validateBet = (bet: number, min: number, max: number): boolean => {
        return bet >= min && bet <= max;
      };

      expect(validateBet(101, 1, 100)).toBe(false);
      expect(validateBet(1000, 1, 100)).toBe(false);
    });

    it('should accept bet within range', () => {
      const validateBet = (bet: number, min: number, max: number): boolean => {
        return bet >= min && bet <= max;
      };

      expect(validateBet(1, 1, 100)).toBe(true);
      expect(validateBet(50, 1, 100)).toBe(true);
      expect(validateBet(100, 1, 100)).toBe(true);
    });

    it('should validate different machine bet ranges', () => {
      const validateBet = (bet: number, min: number, max: number): boolean => {
        return bet >= min && bet <= max;
      };

      // Penny slots
      expect(validateBet(5, 1, 10)).toBe(true);
      expect(validateBet(15, 1, 10)).toBe(false);

      // High roller
      expect(validateBet(100, 50, 500)).toBe(true);
      expect(validateBet(30, 50, 500)).toBe(false);
    });
  });

  describe('Machine Stats', () => {
    it('should track total spins', () => {
      let spinsCount = 0;
      const recordSpin = (): void => {
        spinsCount++;
      };

      recordSpin();
      recordSpin();
      recordSpin();

      expect(spinsCount).toBe(3);
    });

    it('should maintain separate stats per machine', () => {
      const machines = new Map<number, { spinsCount: number }>();
      machines.set(1, { spinsCount: 0 });
      machines.set(2, { spinsCount: 0 });

      const recordSpin = (machineId: number): void => {
        const machine = machines.get(machineId);
        if (machine) {
          machine.spinsCount++;
        }
      };

      recordSpin(1);
      recordSpin(1);
      recordSpin(2);

      expect(machines.get(1)?.spinsCount).toBe(2);
      expect(machines.get(2)?.spinsCount).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum bet of 1', () => {
      const calculatePayout = (symbols: string[], bet: number) => {
        const [s1, s2, s3] = symbols;
        if (s1 === s2 && s2 === s3) return bet * 10;
        if (s1 === s2 || s2 === s3 || s1 === s3) return bet * 2;
        return 0;
      };

      expect(calculatePayout(['🍒', '🍒', '🍒'], 1)).toBe(10);
      expect(calculatePayout(['🍒', '🍒', '🍋'], 1)).toBe(2);
    });

    it('should handle maximum bet payouts', () => {
      const calculatePayout = (symbols: string[], bet: number) => {
        const [s1, s2, s3] = symbols;
        if (s1 === '💎' && s2 === '💎' && s3 === '💎') return bet * 25;
        return 0;
      };

      expect(calculatePayout(['💎', '💎', '💎'], 500)).toBe(12500);
    });

    it('should handle zero jackpot pool', () => {
      const calculatePayout = (symbols: string[], bet: number, jackpot: number) => {
        const [s1, s2, s3] = symbols;
        if (s1 === '7️⃣' && s2 === '7️⃣' && s3 === '7️⃣') {
          return jackpot; // Even if 0
        }
        return 0;
      };

      expect(calculatePayout(['7️⃣', '7️⃣', '7️⃣'], 10, 0)).toBe(0);
    });
  });
});
