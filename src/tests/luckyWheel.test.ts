import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as luckyWheelService from '../services/luckyWheel.js';

describe('Lucky Wheel Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWheelSegments', () => {
    it('should return 8 wheel segments', () => {
      const segments = luckyWheelService.getWheelSegments();
      expect(segments).toHaveLength(8);
    });

    it('should have correct probabilities that sum to 1.0', () => {
      const segments = luckyWheelService.getWheelSegments();
      const totalProbability = segments.reduce((sum, seg) => sum + seg.probability, 0);
      expect(totalProbability).toBeCloseTo(1.0, 5);
    });

    it('should include all required prize types', () => {
      const segments = luckyWheelService.getWheelSegments();
      const types = segments.map(s => s.type);
      
      expect(types).toContain('coins');
      expect(types).toContain('item');
      expect(types).toContain('title');
      expect(types).toContain('jackpot');
    });

    it('should have 10 coins as highest probability (30%)', () => {
      const segments = luckyWheelService.getWheelSegments();
      const tenCoins = segments.find(s => s.label === '10 Coins');
      
      expect(tenCoins).toBeDefined();
      expect(tenCoins!.probability).toBe(0.30);
    });

    it('should have jackpot as lowest probability (2%)', () => {
      const segments = luckyWheelService.getWheelSegments();
      const jackpot = segments.find(s => s.type === 'jackpot');
      
      expect(jackpot).toBeDefined();
      expect(jackpot!.probability).toBe(0.02);
      expect(jackpot!.value).toBe(1000);
    });
  });

  describe('canSpin', () => {
    it('should return true when agent has never spun', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);
      
      const result = await luckyWheelService.canSpin('agent-1', mockSql);
      
      expect(result).toBe(true);
      expect(mockSql).toHaveBeenCalled();
    });

    it('should return true when last spin was over 24h ago', async () => {
      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 'spin-1',
          agentId: 'agent-1',
          prizeType: 'coins',
          prizeValue: 10,
          prizeLabel: '10 Coins',
          createdAt: yesterday,
        },
      ]);
      
      const result = await luckyWheelService.canSpin('agent-1', mockSql);
      
      expect(result).toBe(true);
    });

    it('should return false when last spin was within 24h', async () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 'spin-1',
          agentId: 'agent-1',
          prizeType: 'coins',
          prizeValue: 10,
          prizeLabel: '10 Coins',
          createdAt: oneHourAgo,
        },
      ]);
      
      const result = await luckyWheelService.canSpin('agent-1', mockSql);
      
      expect(result).toBe(false);
    });
  });

  describe('spin', () => {
    it('should throw error when agent already spun today', async () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 'spin-1',
          agentId: 'agent-1',
          prizeType: 'coins',
          prizeValue: 10,
          prizeLabel: '10 Coins',
          createdAt: oneHourAgo,
        },
      ]);
      
      await expect(luckyWheelService.spin('agent-1', mockSql)).rejects.toThrow(
        /You can only spin once per day/
      );
    });

    it('should award coins and record spin when eligible', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([]) // First call: getLastSpin (check cooldown)
        .mockResolvedValueOnce([]) // Second call: getLastSpin (double check in canSpin)
        .mockResolvedValueOnce([{ agentId: 'agent-1', coins: 600, lastDailyClaim: null }]) // getBalance (in addCoins)
        .mockResolvedValueOnce([{ agentId: 'agent-1', coins: 610, lastDailyClaim: null }]) // UPDATE coins (in addCoins)
        .mockResolvedValueOnce([{
          id: 'spin-new',
          agentId: 'agent-1',
          prizeType: 'coins',
          prizeValue: 10,
          prizeLabel: '10 Coins',
          createdAt: new Date(),
        }]); // INSERT spin record (RETURNING)
      
      const result = await luckyWheelService.spin('agent-1', mockSql);
      
      expect(result).toBeDefined();
      expect(result.agentId).toBe('agent-1');
      expect(result.prizeType).toBeDefined();
      expect(result.prizeLabel).toBeDefined();
    });

    it('should select a prize from available segments', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([]) // No previous spin
        .mockResolvedValueOnce([{ agentId: 'agent-1', coins: 500, lastDailyClaim: null }])
        .mockResolvedValueOnce([{ agentId: 'agent-1', coins: 510, lastDailyClaim: null }])
        .mockResolvedValueOnce([{
          id: 'spin-new',
          agentId: 'agent-1',
          prizeType: 'coins',
          prizeValue: 10,
          prizeLabel: '10 Coins',
          createdAt: new Date(),
        }]);
      
      const result = await luckyWheelService.spin('agent-1', mockSql);
      const validTypes = ['coins', 'item', 'title', 'jackpot'];
      
      expect(validTypes).toContain(result.prizeType);
    });
  });

  describe('getRecentWins', () => {
    it('should return empty array when no spins exist', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);
      
      const result = await luckyWheelService.getRecentWins(10, mockSql);
      
      expect(result).toEqual([]);
      expect(mockSql).toHaveBeenCalled();
    });

    it('should return recent wins in descending order', async () => {
      const mockSpins = [
        {
          id: 'spin-3',
          agentId: 'agent-3',
          prizeType: 'coins',
          prizeValue: 50,
          prizeLabel: '50 Coins',
          createdAt: new Date('2025-01-03'),
        },
        {
          id: 'spin-2',
          agentId: 'agent-2',
          prizeType: 'coins',
          prizeValue: 25,
          prizeLabel: '25 Coins',
          createdAt: new Date('2025-01-02'),
        },
        {
          id: 'spin-1',
          agentId: 'agent-1',
          prizeType: 'jackpot',
          prizeValue: 1000,
          prizeLabel: 'Jackpot 1000 Coins',
          createdAt: new Date('2025-01-01'),
        },
      ];
      const mockSql = vi.fn().mockResolvedValue(mockSpins);
      
      const result = await luckyWheelService.getRecentWins(10, mockSql);
      
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('spin-3');
      expect(result[2].prizeType).toBe('jackpot');
    });

    it('should respect limit parameter', async () => {
      const mockSpins = Array.from({ length: 5 }, (_, i) => ({
        id: `spin-${i}`,
        agentId: `agent-${i}`,
        prizeType: 'coins',
        prizeValue: 10,
        prizeLabel: '10 Coins',
        createdAt: new Date(),
      }));
      const mockSql = vi.fn().mockResolvedValue(mockSpins.slice(0, 3));
      
      const result = await luckyWheelService.getRecentWins(3, mockSql);
      
      expect(result).toHaveLength(3);
    });
  });

  describe('Weighted Selection Logic', () => {
    it('should select prizes based on probability distribution', () => {
      const segments = luckyWheelService.getWheelSegments();
      
      // Test that high probability items exist
      const highProbItems = segments.filter(s => s.probability >= 0.2);
      expect(highProbItems.length).toBeGreaterThan(0);
      
      // Test that low probability items exist
      const lowProbItems = segments.filter(s => s.probability <= 0.05);
      expect(lowProbItems.length).toBeGreaterThan(0);
      
      // Test that segments have diverse values
      const uniqueValues = new Set(segments.map(s => s.value));
      expect(uniqueValues.size).toBeGreaterThan(1);
    });
  });
});
