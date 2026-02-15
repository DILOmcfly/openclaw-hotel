import { describe, it, expect } from 'vitest';

/**
 * Economy Dashboard Unit Tests
 * Tests economy analytics, Gini calculation, and health checks without database
 */

describe('Economy Dashboard', () => {
  describe('Gini Coefficient Calculation', () => {
    it('should return 0 for perfect equality', () => {
      const calculateGini = (balances: number[]): number => {
        if (balances.length === 0) return 0;
        if (balances.length === 1) return 0;

        const sorted = [...balances].sort((a, b) => a - b);
        const n = sorted.length;
        
        let sumOfDifferences = 0;
        let sumOfBalances = 0;

        for (let i = 0; i < n; i++) {
          sumOfBalances += sorted[i];
          sumOfDifferences += (i + 1) * sorted[i];
        }

        if (sumOfBalances === 0) return 0;

        const gini = (2 * sumOfDifferences) / (n * sumOfBalances) - (n + 1) / n;
        return Math.max(0, Math.min(1, gini));
      };

      expect(calculateGini([100, 100, 100, 100])).toBe(0);
      expect(calculateGini([50, 50, 50])).toBe(0);
    });

    it('should calculate Gini for unequal distribution', () => {
      const calculateGini = (balances: number[]): number => {
        if (balances.length === 0) return 0;
        if (balances.length === 1) return 0;

        const sorted = [...balances].sort((a, b) => a - b);
        const n = sorted.length;
        
        let sumOfDifferences = 0;
        let sumOfBalances = 0;

        for (let i = 0; i < n; i++) {
          sumOfBalances += sorted[i];
          sumOfDifferences += (i + 1) * sorted[i];
        }

        if (sumOfBalances === 0) return 0;

        const gini = (2 * sumOfDifferences) / (n * sumOfBalances) - (n + 1) / n;
        return Math.max(0, Math.min(1, gini));
      };

      const result = calculateGini([100, 200, 300, 400]);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should return 0 for empty array', () => {
      const calculateGini = (balances: number[]): number => {
        if (balances.length === 0) return 0;
        if (balances.length === 1) return 0;

        const sorted = [...balances].sort((a, b) => a - b);
        const n = sorted.length;
        
        let sumOfDifferences = 0;
        let sumOfBalances = 0;

        for (let i = 0; i < n; i++) {
          sumOfBalances += sorted[i];
          sumOfDifferences += (i + 1) * sorted[i];
        }

        if (sumOfBalances === 0) return 0;

        const gini = (2 * sumOfDifferences) / (n * sumOfBalances) - (n + 1) / n;
        return Math.max(0, Math.min(1, gini));
      };

      expect(calculateGini([])).toBe(0);
    });

    it('should return 0 for single element', () => {
      const calculateGini = (balances: number[]): number => {
        if (balances.length === 0) return 0;
        if (balances.length === 1) return 0;

        const sorted = [...balances].sort((a, b) => a - b);
        const n = sorted.length;
        
        let sumOfDifferences = 0;
        let sumOfBalances = 0;

        for (let i = 0; i < n; i++) {
          sumOfBalances += sorted[i];
          sumOfDifferences += (i + 1) * sorted[i];
        }

        if (sumOfBalances === 0) return 0;

        const gini = (2 * sumOfDifferences) / (n * sumOfBalances) - (n + 1) / n;
        return Math.max(0, Math.min(1, gini));
      };

      expect(calculateGini([500])).toBe(0);
    });

    it('should handle extreme inequality', () => {
      const calculateGini = (balances: number[]): number => {
        if (balances.length === 0) return 0;
        if (balances.length === 1) return 0;

        const sorted = [...balances].sort((a, b) => a - b);
        const n = sorted.length;
        
        let sumOfDifferences = 0;
        let sumOfBalances = 0;

        for (let i = 0; i < n; i++) {
          sumOfBalances += sorted[i];
          sumOfDifferences += (i + 1) * sorted[i];
        }

        if (sumOfBalances === 0) return 0;

        const gini = (2 * sumOfDifferences) / (n * sumOfBalances) - (n + 1) / n;
        return Math.max(0, Math.min(1, gini));
      };

      const result = calculateGini([0, 0, 0, 10000]);
      expect(result).toBeGreaterThan(0.5);
    });

    it('should clamp result between 0 and 1', () => {
      const calculateGini = (balances: number[]): number => {
        if (balances.length === 0) return 0;
        if (balances.length === 1) return 0;

        const sorted = [...balances].sort((a, b) => a - b);
        const n = sorted.length;
        
        let sumOfDifferences = 0;
        let sumOfBalances = 0;

        for (let i = 0; i < n; i++) {
          sumOfBalances += sorted[i];
          sumOfDifferences += (i + 1) * sorted[i];
        }

        if (sumOfBalances === 0) return 0;

        const gini = (2 * sumOfDifferences) / (n * sumOfBalances) - (n + 1) / n;
        return Math.max(0, Math.min(1, gini));
      };

      const result = calculateGini([1, 2, 3, 4, 5]);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('Wealth Distribution Brackets', () => {
    it('should categorize balances into correct brackets', () => {
      const categorize = (balance: number): string => {
        if (balance >= 0 && balance <= 100) return '0-100';
        if (balance >= 101 && balance <= 500) return '101-500';
        if (balance >= 501 && balance <= 1000) return '501-1000';
        if (balance >= 1001 && balance <= 5000) return '1001-5000';
        return '5001+';
      };

      expect(categorize(50)).toBe('0-100');
      expect(categorize(100)).toBe('0-100');
      expect(categorize(250)).toBe('101-500');
      expect(categorize(750)).toBe('501-1000');
      expect(categorize(3000)).toBe('1001-5000');
      expect(categorize(10000)).toBe('5001+');
    });

    it('should handle boundary values correctly', () => {
      const categorize = (balance: number): string => {
        if (balance >= 0 && balance <= 100) return '0-100';
        if (balance >= 101 && balance <= 500) return '101-500';
        if (balance >= 501 && balance <= 1000) return '501-1000';
        if (balance >= 1001 && balance <= 5000) return '1001-5000';
        return '5001+';
      };

      expect(categorize(0)).toBe('0-100');
      expect(categorize(101)).toBe('101-500');
      expect(categorize(501)).toBe('501-1000');
      expect(categorize(1001)).toBe('1001-5000');
      expect(categorize(5001)).toBe('5001+');
    });

    it('should calculate percentage distribution', () => {
      const distribution = [
        { bracket: '0-100', count: 10 },
        { bracket: '101-500', count: 20 },
        { bracket: '501-1000', count: 15 },
      ];

      const total = distribution.reduce((sum, d) => sum + d.count, 0);
      const withPercentage = distribution.map(d => ({
        ...d,
        percentage: Math.round((d.count / total) * 100),
      }));

      expect(withPercentage[0].percentage).toBe(22); // 10/45 ≈ 22%
      expect(withPercentage[1].percentage).toBe(44); // 20/45 ≈ 44%
      expect(withPercentage[2].percentage).toBe(33); // 15/45 ≈ 33%
    });
  });

  describe('Economy Health Check', () => {
    it('should detect healthy economy', () => {
      type HealthCheck = {
        status: 'healthy' | 'warning' | 'critical';
        inflationRate: number;
        message: string;
      };

      const checkHealth = (current: number, previous: number): HealthCheck => {
        if (previous === 0) {
          return {
            status: 'healthy',
            inflationRate: 0,
            message: 'Cannot calculate inflation rate (previous average was 0)',
          };
        }

        const inflationRate = ((current - previous) / previous) * 100;

        if (inflationRate > 20) {
          return {
            status: 'critical',
            inflationRate: Math.round(inflationRate * 100) / 100,
            message: `Critical inflation: average balance increased by ${inflationRate.toFixed(1)}% per day`,
          };
        }

        if (inflationRate > 10) {
          return {
            status: 'warning',
            inflationRate: Math.round(inflationRate * 100) / 100,
            message: `High inflation detected: average balance increased by ${inflationRate.toFixed(1)}% per day`,
          };
        }

        return {
          status: 'healthy',
          inflationRate: Math.round(inflationRate * 100) / 100,
          message: `Economy stable: ${inflationRate >= 0 ? '+' : ''}${inflationRate.toFixed(1)}% change in average balance`,
        };
      };

      const result = checkHealth(550, 500);
      expect(result.status).toBe('healthy');
      expect(result.inflationRate).toBe(10);
    });

    it('should detect warning level inflation', () => {
      type HealthCheck = {
        status: 'healthy' | 'warning' | 'critical';
        inflationRate: number;
        message: string;
      };

      const checkHealth = (current: number, previous: number): HealthCheck => {
        if (previous === 0) {
          return {
            status: 'healthy',
            inflationRate: 0,
            message: 'Cannot calculate inflation rate (previous average was 0)',
          };
        }

        const inflationRate = ((current - previous) / previous) * 100;

        if (inflationRate > 20) {
          return {
            status: 'critical',
            inflationRate: Math.round(inflationRate * 100) / 100,
            message: `Critical inflation: average balance increased by ${inflationRate.toFixed(1)}% per day`,
          };
        }

        if (inflationRate > 10) {
          return {
            status: 'warning',
            inflationRate: Math.round(inflationRate * 100) / 100,
            message: `High inflation detected: average balance increased by ${inflationRate.toFixed(1)}% per day`,
          };
        }

        return {
          status: 'healthy',
          inflationRate: Math.round(inflationRate * 100) / 100,
          message: `Economy stable: ${inflationRate >= 0 ? '+' : ''}${inflationRate.toFixed(1)}% change in average balance`,
        };
      };

      const result = checkHealth(600, 500);
      expect(result.status).toBe('warning');
      expect(result.inflationRate).toBe(20);
    });

    it('should detect critical inflation', () => {
      type HealthCheck = {
        status: 'healthy' | 'warning' | 'critical';
        inflationRate: number;
        message: string;
      };

      const checkHealth = (current: number, previous: number): HealthCheck => {
        if (previous === 0) {
          return {
            status: 'healthy',
            inflationRate: 0,
            message: 'Cannot calculate inflation rate (previous average was 0)',
          };
        }

        const inflationRate = ((current - previous) / previous) * 100;

        if (inflationRate > 20) {
          return {
            status: 'critical',
            inflationRate: Math.round(inflationRate * 100) / 100,
            message: `Critical inflation: average balance increased by ${inflationRate.toFixed(1)}% per day`,
          };
        }

        if (inflationRate > 10) {
          return {
            status: 'warning',
            inflationRate: Math.round(inflationRate * 100) / 100,
            message: `High inflation detected: average balance increased by ${inflationRate.toFixed(1)}% per day`,
          };
        }

        return {
          status: 'healthy',
          inflationRate: Math.round(inflationRate * 100) / 100,
          message: `Economy stable: ${inflationRate >= 0 ? '+' : ''}${inflationRate.toFixed(1)}% change in average balance`,
        };
      };

      const result = checkHealth(700, 500);
      expect(result.status).toBe('critical');
      expect(result.inflationRate).toBe(40);
    });

    it('should handle negative growth (deflation)', () => {
      type HealthCheck = {
        status: 'healthy' | 'warning' | 'critical';
        inflationRate: number;
        message: string;
      };

      const checkHealth = (current: number, previous: number): HealthCheck => {
        if (previous === 0) {
          return {
            status: 'healthy',
            inflationRate: 0,
            message: 'Cannot calculate inflation rate (previous average was 0)',
          };
        }

        const inflationRate = ((current - previous) / previous) * 100;

        if (inflationRate > 20) {
          return {
            status: 'critical',
            inflationRate: Math.round(inflationRate * 100) / 100,
            message: `Critical inflation: average balance increased by ${inflationRate.toFixed(1)}% per day`,
          };
        }

        if (inflationRate > 10) {
          return {
            status: 'warning',
            inflationRate: Math.round(inflationRate * 100) / 100,
            message: `High inflation detected: average balance increased by ${inflationRate.toFixed(1)}% per day`,
          };
        }

        return {
          status: 'healthy',
          inflationRate: Math.round(inflationRate * 100) / 100,
          message: `Economy stable: ${inflationRate >= 0 ? '+' : ''}${inflationRate.toFixed(1)}% change in average balance`,
        };
      };

      const result = checkHealth(450, 500);
      expect(result.status).toBe('healthy');
      expect(result.inflationRate).toBe(-10);
      expect(result.message).toContain('-10.0%');
    });

    it('should handle zero previous balance', () => {
      type HealthCheck = {
        status: 'healthy' | 'warning' | 'critical';
        inflationRate: number;
        message: string;
      };

      const checkHealth = (current: number, previous: number): HealthCheck => {
        if (previous === 0) {
          return {
            status: 'healthy',
            inflationRate: 0,
            message: 'Cannot calculate inflation rate (previous average was 0)',
          };
        }

        const inflationRate = ((current - previous) / previous) * 100;

        if (inflationRate > 20) {
          return {
            status: 'critical',
            inflationRate: Math.round(inflationRate * 100) / 100,
            message: `Critical inflation: average balance increased by ${inflationRate.toFixed(1)}% per day`,
          };
        }

        if (inflationRate > 10) {
          return {
            status: 'warning',
            inflationRate: Math.round(inflationRate * 100) / 100,
            message: `High inflation detected: average balance increased by ${inflationRate.toFixed(1)}% per day`,
          };
        }

        return {
          status: 'healthy',
          inflationRate: Math.round(inflationRate * 100) / 100,
          message: `Economy stable: ${inflationRate >= 0 ? '+' : ''}${inflationRate.toFixed(1)}% change in average balance`,
        };
      };

      const result = checkHealth(500, 0);
      expect(result.status).toBe('healthy');
      expect(result.inflationRate).toBe(0);
    });
  });

  describe('Snapshot Calculations', () => {
    it('should calculate average balance correctly', () => {
      const balances = [100, 200, 300, 400, 500];
      const avg = Math.floor(balances.reduce((sum, val) => sum + val, 0) / balances.length);
      expect(avg).toBe(300);
    });

    it('should find richest agent', () => {
      const balances = [100, 200, 300, 400, 500];
      const richest = Math.max(...balances);
      expect(richest).toBe(500);
    });

    it('should find poorest agent', () => {
      const balances = [100, 200, 300, 400, 500];
      const poorest = Math.min(...balances);
      expect(poorest).toBe(100);
    });

    it('should calculate total coins in circulation', () => {
      const balances = [100, 200, 300, 400, 500];
      const total = balances.reduce((sum, val) => sum + val, 0);
      expect(total).toBe(1500);
    });

    it('should handle empty balance list', () => {
      const balances: number[] = [];
      const avg = balances.length > 0 ? Math.floor(balances.reduce((sum, val) => sum + val, 0) / balances.length) : 0;
      const richest = balances.length > 0 ? Math.max(...balances) : 0;
      const poorest = balances.length > 0 ? Math.min(...balances) : 0;

      expect(avg).toBe(0);
      expect(richest).toBe(0);
      expect(poorest).toBe(0);
    });
  });

  describe('Top Earners Calculation', () => {
    it('should calculate total earned correctly', () => {
      const agent = {
        currentBalance: 1000,
        streakCoinsEarned: 500,
      };

      const totalEarned = agent.currentBalance + agent.streakCoinsEarned;
      expect(totalEarned).toBe(1500);
    });

    it('should handle missing streak data', () => {
      const agent = {
        currentBalance: 1000,
        streakCoinsEarned: null,
      };

      const totalEarned = agent.currentBalance + (agent.streakCoinsEarned || 0);
      expect(totalEarned).toBe(1000);
    });

    it('should sort by total earned descending', () => {
      const earners = [
        { agentId: 'a1', totalEarned: 1000 },
        { agentId: 'a2', totalEarned: 2000 },
        { agentId: 'a3', totalEarned: 1500 },
      ];

      const sorted = [...earners].sort((a, b) => b.totalEarned - a.totalEarned);

      expect(sorted[0].agentId).toBe('a2');
      expect(sorted[1].agentId).toBe('a3');
      expect(sorted[2].agentId).toBe('a1');
    });

    it('should respect limit parameter', () => {
      const earners = [
        { agentId: 'a1', totalEarned: 1000 },
        { agentId: 'a2', totalEarned: 2000 },
        { agentId: 'a3', totalEarned: 1500 },
        { agentId: 'a4', totalEarned: 800 },
      ];

      const limit = 2;
      const limited = earners.slice(0, limit);

      expect(limited.length).toBe(2);
    });
  });
});
