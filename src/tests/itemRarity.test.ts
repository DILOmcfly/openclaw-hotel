import { describe, it, expect, vi } from 'vitest';
import * as itemRarityService from '../services/itemRarity.js';

describe('Item Rarity Service', () => {
  // Mock SQL client
  const createMockSql = (returnValue: any) => {
    const mock = vi.fn().mockResolvedValue(returnValue);
    mock.mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
      return Promise.resolve(returnValue);
    });
    return mock as any;
  };

  describe('getItemsByRarity', () => {
    it('should return items filtered by common rarity', async () => {
      const mockItems = [
        { id: 'chair_wood', name: 'Wooden Chair', rarity: 'common', tradeable: true, maxPerAgent: 99, releaseDate: new Date(), retired: false },
        { id: 'table_round', name: 'Round Table', rarity: 'common', tradeable: true, maxPerAgent: 99, releaseDate: new Date(), retired: false },
      ];
      const sql = createMockSql(mockItems);

      const items = await itemRarityService.getItemsByRarity('common', sql);

      expect(items).toHaveLength(2);
      expect(items[0].rarity).toBe('common');
      expect(items[1].rarity).toBe('common');
    });

    it('should return items filtered by legendary rarity', async () => {
      const mockItems = [
        { id: 'throne_gold', name: 'Golden Throne', rarity: 'legendary', tradeable: false, maxPerAgent: 1, releaseDate: new Date(), retired: false },
      ];
      const sql = createMockSql(mockItems);

      const items = await itemRarityService.getItemsByRarity('legendary', sql);

      expect(items).toHaveLength(1);
      expect(items[0].rarity).toBe('legendary');
      expect(items[0].id).toBe('throne_gold');
    });

    it('should return empty array when no items match rarity', async () => {
      const sql = createMockSql([]);

      const items = await itemRarityService.getItemsByRarity('mythic', sql);

      expect(items).toHaveLength(0);
    });
  });

  describe('getRarityDistribution', () => {
    it('should return distribution of owned items by rarity', async () => {
      const mockDistribution = [
        { rarity: 'common', count: '5' },
        { rarity: 'uncommon', count: '3' },
        { rarity: 'rare', count: '1' },
      ];
      const sql = createMockSql(mockDistribution);

      const distribution = await itemRarityService.getRarityDistribution('agent-123', sql);

      expect(distribution.common).toBe(5);
      expect(distribution.uncommon).toBe(3);
      expect(distribution.rare).toBe(1);
      expect(distribution.epic).toBe(0);
      expect(distribution.legendary).toBe(0);
      expect(distribution.mythic).toBe(0);
    });

    it('should return zero distribution for agent with no items', async () => {
      const sql = createMockSql([]);

      const distribution = await itemRarityService.getRarityDistribution('agent-new', sql);

      expect(distribution.common).toBe(0);
      expect(distribution.uncommon).toBe(0);
      expect(distribution.rare).toBe(0);
      expect(distribution.epic).toBe(0);
      expect(distribution.legendary).toBe(0);
      expect(distribution.mythic).toBe(0);
    });
  });

  describe('isRetired', () => {
    it('should return true for retired item', async () => {
      const sql = createMockSql([{ retired: true }]);

      const result = await itemRarityService.isRetired('old_furniture', sql);

      expect(result).toBe(true);
    });

    it('should return false for active item', async () => {
      const sql = createMockSql([{ retired: false }]);

      const result = await itemRarityService.isRetired('chair_wood', sql);

      expect(result).toBe(false);
    });

    it('should throw error for non-existent item', async () => {
      const sql = createMockSql([]);

      await expect(itemRarityService.isRetired('fake_item', sql)).rejects.toThrow('Item not found');
    });
  });

  describe('isTradeable', () => {
    it('should return true for tradeable item', async () => {
      const sql = createMockSql([{ tradeable: true }]);

      const result = await itemRarityService.isTradeable('chair_wood', sql);

      expect(result).toBe(true);
    });

    it('should return false for non-tradeable item', async () => {
      const sql = createMockSql([{ tradeable: false }]);

      const result = await itemRarityService.isTradeable('throne_gold', sql);

      expect(result).toBe(false);
    });

    it('should throw error for non-existent item', async () => {
      const sql = createMockSql([]);

      await expect(itemRarityService.isTradeable('fake_item', sql)).rejects.toThrow('Item not found');
    });
  });

  describe('canOwnMore', () => {
    it('should return true when under max_per_agent limit', async () => {
      const sql = createMockSql([{ maxPerAgent: 99 }]);
      sql.mockResolvedValueOnce([{ maxPerAgent: 99 }]) // furniture query
        .mockResolvedValueOnce([{ quantity: 50 }]); // inventory query

      const result = await itemRarityService.canOwnMore('agent-123', 'chair_wood', sql);

      expect(result).toBe(true);
    });

    it('should return false when at max_per_agent limit', async () => {
      const sql = createMockSql([{ maxPerAgent: 1 }]);
      sql.mockResolvedValueOnce([{ maxPerAgent: 1 }]) // furniture query
        .mockResolvedValueOnce([{ quantity: 1 }]); // inventory query

      const result = await itemRarityService.canOwnMore('agent-123', 'throne_gold', sql);

      expect(result).toBe(false);
    });

    it('should return true when agent owns zero of the item', async () => {
      const sql = createMockSql([{ maxPerAgent: 5 }]);
      sql.mockResolvedValueOnce([{ maxPerAgent: 5 }]) // furniture query
        .mockResolvedValueOnce([]); // inventory query (no records)

      const result = await itemRarityService.canOwnMore('agent-new', 'chair_wood', sql);

      expect(result).toBe(true);
    });

    it('should throw error for non-existent item', async () => {
      const sql = createMockSql([]);

      await expect(itemRarityService.canOwnMore('agent-123', 'fake_item', sql)).rejects.toThrow('Item not found');
    });
  });

  describe('getCollectionProgress', () => {
    it('should calculate collection progress correctly', async () => {
      const sql = createMockSql([]);
      sql.mockResolvedValueOnce([
        { rarity: 'common', count: '10' },
        { rarity: 'rare', count: '5' },
      ]) // total by rarity
        .mockResolvedValueOnce([
          { rarity: 'common', count: '7' },
          { rarity: 'rare', count: '2' },
        ]); // owned by rarity

      const progress = await itemRarityService.getCollectionProgress('agent-123', sql);

      expect(progress.totalItems).toBe(15);
      expect(progress.ownedItems).toBe(9);
      expect(progress.percentage).toBe(60);
      expect(progress.byRarity.common.total).toBe(10);
      expect(progress.byRarity.common.owned).toBe(7);
      expect(progress.byRarity.rare.total).toBe(5);
      expect(progress.byRarity.rare.owned).toBe(2);
    });

    it('should return 0% for agent with no items', async () => {
      const sql = createMockSql([]);
      sql.mockResolvedValueOnce([
        { rarity: 'common', count: '10' },
      ]) // total by rarity
        .mockResolvedValueOnce([]); // owned by rarity (none)

      const progress = await itemRarityService.getCollectionProgress('agent-new', sql);

      expect(progress.totalItems).toBe(10);
      expect(progress.ownedItems).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('should return 100% for complete collection', async () => {
      const sql = createMockSql([]);
      sql.mockResolvedValueOnce([
        { rarity: 'common', count: '5' },
        { rarity: 'rare', count: '3' },
      ])
        .mockResolvedValueOnce([
          { rarity: 'common', count: '5' },
          { rarity: 'rare', count: '3' },
        ]);

      const progress = await itemRarityService.getCollectionProgress('agent-collector', sql);

      expect(progress.totalItems).toBe(8);
      expect(progress.ownedItems).toBe(8);
      expect(progress.percentage).toBe(100);
    });

    it('should handle all six rarity levels', async () => {
      const sql = createMockSql([]);
      sql.mockResolvedValueOnce([
        { rarity: 'common', count: '10' },
        { rarity: 'uncommon', count: '8' },
        { rarity: 'rare', count: '5' },
        { rarity: 'epic', count: '3' },
        { rarity: 'legendary', count: '2' },
        { rarity: 'mythic', count: '1' },
      ])
        .mockResolvedValueOnce([
          { rarity: 'common', count: '5' },
          { rarity: 'epic', count: '1' },
        ]);

      const progress = await itemRarityService.getCollectionProgress('agent-123', sql);

      expect(progress.totalItems).toBe(29);
      expect(progress.ownedItems).toBe(6);
      expect(progress.byRarity.common.total).toBe(10);
      expect(progress.byRarity.common.owned).toBe(5);
      expect(progress.byRarity.epic.total).toBe(3);
      expect(progress.byRarity.epic.owned).toBe(1);
      expect(progress.byRarity.mythic.total).toBe(1);
      expect(progress.byRarity.mythic.owned).toBe(0);
    });
  });
});
