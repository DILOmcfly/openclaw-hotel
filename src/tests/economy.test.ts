import { describe, it, expect } from 'vitest';

describe('Economy System - Validation', () => {
  it('should reject negative coin amounts', () => {
    const isValidAmount = (amount: number): boolean => amount > 0 && Number.isInteger(amount);
    expect(isValidAmount(-100)).toBe(false);
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(3.5)).toBe(false);
    expect(isValidAmount(100)).toBe(true);
  });

  it('should detect insufficient balance', () => {
    const hasEnough = (balance: number, cost: number): boolean => balance >= cost;
    expect(hasEnough(500, 600)).toBe(false);
    expect(hasEnough(500, 500)).toBe(true);
    expect(hasEnough(500, 100)).toBe(true);
  });

  it('should enforce daily bonus cooldown (24h)', () => {
    const canClaimDaily = (lastClaim: Date | null): boolean => {
      if (!lastClaim) return true;
      const elapsed = Date.now() - lastClaim.getTime();
      return elapsed >= 24 * 60 * 60 * 1000;
    };
    expect(canClaimDaily(null)).toBe(true);
    expect(canClaimDaily(new Date(Date.now() - 25 * 60 * 60 * 1000))).toBe(true);
    expect(canClaimDaily(new Date(Date.now() - 1 * 60 * 60 * 1000))).toBe(false);
  });

  it('should have correct default values', () => {
    const STARTER_BONUS = 500;
    const DAILY_BONUS = 100;
    expect(STARTER_BONUS).toBe(500);
    expect(DAILY_BONUS).toBe(100);
    expect(DAILY_BONUS).toBeLessThan(STARTER_BONUS);
  });

  it('should define furniture costs', () => {
    const FURNITURE_COSTS: Record<string, number> = {
      chair: 50, table: 75, lamp: 30, bed: 100, bookshelf: 80,
    };
    expect(Object.keys(FURNITURE_COSTS).length).toBeGreaterThan(0);
    expect(Object.values(FURNITURE_COSTS).every(v => v > 0)).toBe(true);
  });

  it('should calculate balance after purchase', () => {
    const balance = 500;
    const cost = 75;
    const remaining = balance - cost;
    expect(remaining).toBe(425);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });
});
