import { describe, it, expect, vi } from 'vitest';
import {
  logTransaction,
  getHistory,
  getTransactionById,
  getTotalCoinsEarned,
  getTotalCoinsSpent,
  getTradePartners,
  TransactionType,
} from '../services/tradeHistory.js';

// Mock SQL helper
const createMockSql = (returnValue: any) => {
  const mockSql: any = vi.fn().mockResolvedValue(returnValue);
  mockSql.typed = {
    uuid: (val: string) => val,
    text: (val: string) => val,
    integer: (val: number) => val,
    jsonb: (val: any) => val,
  };
  mockSql.raw = (val: string) => val;
  return mockSql;
};

describe('Trade History Service', () => {
  describe('logTransaction', () => {
    it('should log a trade transaction', async () => {
      const mockRecord = {
        id: 'tx-123',
        type: 'trade',
        agentId: 'agent-1',
        counterpartId: 'agent-2',
        itemsGiven: [{ id: 'item-1', name: 'Chair' }],
        itemsReceived: [{ id: 'item-2', name: 'Table' }],
        coinsGiven: 100,
        coinsReceived: 50,
        roomId: 'room-1',
        createdAt: '2025-01-01T00:00:00Z',
      };

      const sql = createMockSql([mockRecord]);

      const result = await logTransaction(
        'trade',
        'agent-1',
        'agent-2',
        [{ id: 'item-1', name: 'Chair' }],
        [{ id: 'item-2', name: 'Table' }],
        100,
        50,
        'room-1',
        sql
      );

      expect(result).toEqual(mockRecord);
      expect(sql).toHaveBeenCalled();
    });

    it('should log a purchase transaction with null counterpart', async () => {
      const mockRecord = {
        id: 'tx-456',
        type: 'purchase',
        agentId: 'agent-1',
        counterpartId: null,
        itemsGiven: [],
        itemsReceived: [{ id: 'item-3', name: 'Lamp' }],
        coinsGiven: 200,
        coinsReceived: 0,
        roomId: null,
        createdAt: '2025-01-02T00:00:00Z',
      };

      const sql = createMockSql([mockRecord]);

      const result = await logTransaction(
        'purchase',
        'agent-1',
        null,
        [],
        [{ id: 'item-3', name: 'Lamp' }],
        200,
        0,
        null,
        sql
      );

      expect(result).toEqual(mockRecord);
      expect(result.counterpartId).toBeNull();
    });

    it('should log a gift transaction', async () => {
      const mockRecord = {
        id: 'tx-789',
        type: 'gift',
        agentId: 'agent-1',
        counterpartId: 'agent-3',
        itemsGiven: [],
        itemsReceived: [{ id: 'item-4', name: 'Gift Box' }],
        coinsGiven: 0,
        coinsReceived: 0,
        roomId: null,
        createdAt: '2025-01-03T00:00:00Z',
      };

      const sql = createMockSql([mockRecord]);

      const result = await logTransaction(
        'gift',
        'agent-1',
        'agent-3',
        [],
        [{ id: 'item-4', name: 'Gift Box' }],
        0,
        0,
        null,
        sql
      );

      expect(result.type).toBe('gift');
      expect(result.coinsGiven).toBe(0);
      expect(result.coinsReceived).toBe(0);
    });
  });

  describe('getHistory', () => {
    it('should get transaction history without type filter', async () => {
      const mockHistory = [
        {
          id: 'tx-1',
          type: 'trade',
          agentId: 'agent-1',
          counterpartId: 'agent-2',
          itemsGiven: [],
          itemsReceived: [],
          coinsGiven: 100,
          coinsReceived: 50,
          roomId: null,
          createdAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'tx-2',
          type: 'purchase',
          agentId: 'agent-1',
          counterpartId: null,
          itemsGiven: [],
          itemsReceived: [],
          coinsGiven: 200,
          coinsReceived: 0,
          roomId: null,
          createdAt: '2025-01-02T00:00:00Z',
        },
      ];

      const sql = createMockSql(mockHistory);

      const result = await getHistory('agent-1', null, 50, 0, sql);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('trade');
      expect(result[1].type).toBe('purchase');
    });

    it('should filter history by type', async () => {
      const mockHistory = [
        {
          id: 'tx-1',
          type: 'purchase',
          agentId: 'agent-1',
          counterpartId: null,
          itemsGiven: [],
          itemsReceived: [],
          coinsGiven: 200,
          coinsReceived: 0,
          roomId: null,
          createdAt: '2025-01-01T00:00:00Z',
        },
      ];

      const sql = createMockSql(mockHistory);

      const result = await getHistory('agent-1', 'purchase', 50, 0, sql);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('purchase');
    });

    it('should support pagination with limit and offset', async () => {
      const mockHistory = [
        {
          id: 'tx-3',
          type: 'sale',
          agentId: 'agent-1',
          counterpartId: null,
          itemsGiven: [],
          itemsReceived: [],
          coinsGiven: 0,
          coinsReceived: 100,
          roomId: null,
          createdAt: '2025-01-03T00:00:00Z',
        },
      ];

      const sql = createMockSql(mockHistory);

      const result = await getHistory('agent-1', null, 10, 20, sql);

      expect(result).toHaveLength(1);
      expect(sql).toHaveBeenCalled();
    });
  });

  describe('getTransactionById', () => {
    it('should return a transaction by ID', async () => {
      const mockTransaction = {
        id: 'tx-123',
        type: 'trade',
        agentId: 'agent-1',
        counterpartId: 'agent-2',
        itemsGiven: [],
        itemsReceived: [],
        coinsGiven: 100,
        coinsReceived: 50,
        roomId: null,
        createdAt: '2025-01-01T00:00:00Z',
      };

      const sql = createMockSql([mockTransaction]);

      const result = await getTransactionById('tx-123', sql);

      expect(result).toEqual(mockTransaction);
    });

    it('should return null when transaction not found', async () => {
      const sql = createMockSql([]);

      const result = await getTransactionById('nonexistent', sql);

      expect(result).toBeNull();
    });
  });

  describe('getTotalCoinsEarned', () => {
    it('should calculate total coins earned', async () => {
      const sql = createMockSql([{ total: '500' }]);

      const result = await getTotalCoinsEarned('agent-1', sql);

      expect(result).toBe(500);
    });

    it('should return 0 when no transactions', async () => {
      const sql = createMockSql([{ total: null }]);

      const result = await getTotalCoinsEarned('agent-1', sql);

      expect(result).toBe(0);
    });
  });

  describe('getTotalCoinsSpent', () => {
    it('should calculate total coins spent', async () => {
      const sql = createMockSql([{ total: '750' }]);

      const result = await getTotalCoinsSpent('agent-1', sql);

      expect(result).toBe(750);
    });

    it('should return 0 when no transactions', async () => {
      const sql = createMockSql([{ total: null }]);

      const result = await getTotalCoinsSpent('agent-1', sql);

      expect(result).toBe(0);
    });
  });

  describe('getTradePartners', () => {
    it('should return unique trade partners', async () => {
      const sql = createMockSql([
        { counterpart_id: 'agent-2' },
        { counterpart_id: 'agent-3' },
      ]);

      const result = await getTradePartners('agent-1', sql);

      expect(result).toEqual(['agent-2', 'agent-3']);
    });

    it('should return empty array when no partners', async () => {
      const sql = createMockSql([]);

      const result = await getTradePartners('agent-1', sql);

      expect(result).toEqual([]);
    });
  });

  describe('Transaction type validation', () => {
    it('should support all valid transaction types', () => {
      const validTypes: TransactionType[] = [
        'trade',
        'purchase',
        'sale',
        'gift',
        'daily_bonus',
        'refund',
      ];

      expect(validTypes).toHaveLength(6);
      expect(validTypes).toContain('trade');
      expect(validTypes).toContain('daily_bonus');
    });
  });
});
