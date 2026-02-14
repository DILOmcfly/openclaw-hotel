import { describe, it, expect, vi } from 'vitest';
import * as economyService from '../services/economy.js';

describe('Economy Service', () => {
  // Mock SQL client
  const createMockSql = (returnValue: any) => {
    const mock = vi.fn().mockResolvedValue(returnValue);
    mock.mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
      return Promise.resolve(returnValue);
    });
    return mock as any;
  };

  describe('getBalance', () => {
    it('should return existing balance for agent', async () => {
      const mockBalance = {
        agentId: 'agent-123',
        coins: 750,
        lastDailyClaim: new Date('2024-01-15T10:00:00Z'),
      };
      const sql = createMockSql([mockBalance]);

      const balance = await economyService.getBalance('agent-123', sql);

      expect(balance).toEqual(mockBalance);
      expect(balance.coins).toBe(750);
    });

    it('should create default balance for new agent', async () => {
      const sql = createMockSql([]);
      sql.mockResolvedValueOnce([]) // First call returns empty (no existing balance)
        .mockResolvedValueOnce([{ // Second call returns new balance
          agentId: 'agent-new',
          coins: 500,
          lastDailyClaim: null,
        }]);

      const balance = await economyService.getBalance('agent-new', sql);

      expect(balance.agentId).toBe('agent-new');
      expect(balance.coins).toBe(500);
      expect(balance.lastDailyClaim).toBeNull();
    });
  });

  describe('addCoins', () => {
    it('should add coins to agent balance', async () => {
      const sql = createMockSql([
        { agentId: 'agent-123', coins: 500, lastDailyClaim: null },
      ]);
      sql.mockResolvedValueOnce([{ agentId: 'agent-123', coins: 500, lastDailyClaim: null }]) // getBalance
        .mockResolvedValueOnce([{ agentId: 'agent-123', coins: 700, lastDailyClaim: null }]); // addCoins

      const balance = await economyService.addCoins('agent-123', 200, sql);

      expect(balance.coins).toBe(700);
    });

    it('should throw error for negative amount', async () => {
      const sql = createMockSql([]);

      await expect(economyService.addCoins('agent-123', -50, sql)).rejects.toThrow(
        'Amount must be positive'
      );
    });

    it('should throw error for zero amount', async () => {
      const sql = createMockSql([]);

      await expect(economyService.addCoins('agent-123', 0, sql)).rejects.toThrow(
        'Amount must be positive'
      );
    });
  });

  describe('deductCoins', () => {
    it('should deduct coins when sufficient balance', async () => {
      const sql = createMockSql([
        { agentId: 'agent-123', coins: 500, lastDailyClaim: null },
      ]);
      sql.mockResolvedValueOnce([{ agentId: 'agent-123', coins: 500, lastDailyClaim: null }]) // getBalance
        .mockResolvedValueOnce([{ agentId: 'agent-123', coins: 300, lastDailyClaim: null }]); // deductCoins

      const balance = await economyService.deductCoins('agent-123', 200, sql);

      expect(balance.coins).toBe(300);
    });

    it('should throw error when insufficient balance', async () => {
      const sql = createMockSql([
        { agentId: 'agent-123', coins: 100, lastDailyClaim: null },
      ]);

      await expect(economyService.deductCoins('agent-123', 200, sql)).rejects.toThrow(
        'Insufficient funds'
      );
    });

    it('should throw error for negative amount', async () => {
      const sql = createMockSql([]);

      await expect(economyService.deductCoins('agent-123', -50, sql)).rejects.toThrow(
        'Amount must be positive'
      );
    });
  });

  describe('grantDailyBonus', () => {
    it('should grant bonus when never claimed before', async () => {
      const sql = createMockSql([
        { agentId: 'agent-123', coins: 500, lastDailyClaim: null },
      ]);
      sql.mockResolvedValueOnce([{ agentId: 'agent-123', coins: 500, lastDailyClaim: null }]) // getBalance
        .mockResolvedValueOnce([{ agentId: 'agent-123', coins: 600, lastDailyClaim: new Date() }]); // grantDailyBonus

      const balance = await economyService.grantDailyBonus('agent-123', sql);

      expect(balance.coins).toBe(600);
      expect(balance.lastDailyClaim).toBeTruthy();
    });

    it('should grant bonus when cooldown expired (>24h)', async () => {
      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const sql = createMockSql([
        { agentId: 'agent-123', coins: 500, lastDailyClaim: yesterday },
      ]);
      sql.mockResolvedValueOnce([{ agentId: 'agent-123', coins: 500, lastDailyClaim: yesterday }]) // getBalance
        .mockResolvedValueOnce([{ agentId: 'agent-123', coins: 600, lastDailyClaim: new Date() }]); // grantDailyBonus

      const balance = await economyService.grantDailyBonus('agent-123', sql);

      expect(balance.coins).toBe(600);
    });

    it('should throw error when cooldown not expired (<24h)', async () => {
      const recentClaim = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      const sql = createMockSql([
        { agentId: 'agent-123', coins: 500, lastDailyClaim: recentClaim },
      ]);

      await expect(economyService.grantDailyBonus('agent-123', sql)).rejects.toThrow(
        'Daily bonus already claimed'
      );
    });
  });

  describe('canClaimDailyBonus', () => {
    it('should return true when never claimed', () => {
      expect(economyService.canClaimDailyBonus(null)).toBe(true);
    });

    it('should return true when cooldown expired', () => {
      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
      expect(economyService.canClaimDailyBonus(yesterday)).toBe(true);
    });

    it('should return false when cooldown active', () => {
      const recent = new Date(Date.now() - 12 * 60 * 60 * 1000);
      expect(economyService.canClaimDailyBonus(recent)).toBe(false);
    });
  });

  describe('createDefaultBalance', () => {
    it('should create new balance with starter coins', async () => {
      const sql = createMockSql([
        { agentId: 'agent-new', coins: 500, lastDailyClaim: null },
      ]);

      const balance = await economyService.createDefaultBalance('agent-new', sql);

      expect(balance.agentId).toBe('agent-new');
      expect(balance.coins).toBe(500);
      expect(balance.lastDailyClaim).toBeNull();
    });
  });
});
