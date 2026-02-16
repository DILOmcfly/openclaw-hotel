/**
 * Integration Tests: Trading Flow
 * 
 * Tests the complete trading lifecycle with real database:
 * - Create trade offer
 * - Add items to trade
 * - Accept trade (atomic item transfer)
 * - Reject/cancel trade
 * - Trade history
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Sql } from 'postgres';
import { setupIntegrationTests, teardownIntegrationTests, getTestSql, isDatabaseAvailable } from './setup.js';
import * as tradingService from '../../services/trading.js';
import { nanoid } from 'nanoid';

let sql: Sql;

describe('Integration: Trading Flow', () => {
  beforeAll(async () => {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.log('⏭️  Skipping integration tests: PostgreSQL database not available');
      return;
    }
    sql = await setupIntegrationTests();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  beforeEach(async () => {
    // Clear trades between tests
    await sql`DELETE FROM trade_items`;
    await sql`DELETE FROM trades`;
  });

  describe('Create → Add Items → Accept Flow', () => {
    it('should create pending trade between two agents', async () => {
      const initiatorId = 'test-agent-1';
      const targetId = 'test-agent-2';

      // Create trade
      const trade = await tradingService.createTrade(initiatorId, targetId, sql);

      expect(trade).toBeDefined();
      expect(trade.id).toBeDefined();
      expect(trade.initiatorId).toBe(initiatorId);
      expect(trade.targetId).toBe(targetId);
      expect(trade.status).toBe('pending');
      expect(trade.createdAt).toBeInstanceOf(Date);
      expect(trade.completedAt).toBeNull();

      // Verify in database
      const [dbTrade] = await sql`
        SELECT id, initiator_id, target_id, status, created_at, completed_at
        FROM trades
        WHERE id = ${trade.id}
      `;

      expect(dbTrade).toBeDefined();
      expect(dbTrade.status).toBe('pending');
    });

    it('should add items to trade and transfer atomically on accept', async () => {
      const initiatorId = 'test-agent-1';
      const targetId = 'test-agent-2';

      // Create trade
      const trade = await tradingService.createTrade(initiatorId, targetId, sql);

      // Add items from initiator (offering furn_chair and furn_table)
      await tradingService.addItemToTrade(
        trade.id,
        initiatorId,
        'item-1', // furn_chair owned by test-agent-1
        1,
        sql
      );

      await tradingService.addItemToTrade(
        trade.id,
        initiatorId,
        'item-2', // furn_table owned by test-agent-1
        1,
        sql
      );

      // Add item from target (offering furn_sofa)
      await tradingService.addItemToTrade(
        trade.id,
        targetId,
        'item-5', // furn_sofa owned by test-agent-2
        1,
        sql
      );

      // Verify items are in trade
      const items = await tradingService.getTradeItems(trade.id, sql);
      expect(items).toHaveLength(3);
      expect(items.filter(i => i.agentId === initiatorId)).toHaveLength(2);
      expect(items.filter(i => i.agentId === targetId)).toHaveLength(1);

      // Accept trade (as target)
      const result = await tradingService.acceptTrade(trade.id, targetId, sql);

      expect(result.status).toBe('accepted');
      expect(result.completedAt).toBeInstanceOf(Date);

      // Verify items transferred atomically
      const [item1] = await sql`SELECT agent_id FROM inventory_items WHERE id = 'item-1'`;
      const [item2] = await sql`SELECT agent_id FROM inventory_items WHERE id = 'item-2'`;
      const [item5] = await sql`SELECT agent_id FROM inventory_items WHERE id = 'item-5'`;

      // Items should have swapped owners
      expect(item1.agent_id).toBe(targetId); // chair now belongs to target
      expect(item2.agent_id).toBe(targetId); // table now belongs to target
      expect(item5.agent_id).toBe(initiatorId); // sofa now belongs to initiator
    });

    it('should reject trade and NOT transfer items', async () => {
      const initiatorId = 'test-agent-1';
      const targetId = 'test-agent-2';

      // Create trade with items
      const trade = await tradingService.createTrade(initiatorId, targetId, sql);
      await tradingService.addItemToTrade(trade.id, initiatorId, 'item-1', 1, sql);

      // Reject trade (as target)
      const result = await tradingService.rejectTrade(trade.id, targetId, sql);

      expect(result.status).toBe('rejected');

      // Verify items NOT transferred
      const [item1] = await sql`SELECT agent_id FROM inventory_items WHERE id = 'item-1'`;
      expect(item1.agent_id).toBe(initiatorId); // Still belongs to initiator
    });

    it('should allow only initiator to cancel trade', async () => {
      const initiatorId = 'test-agent-1';
      const targetId = 'test-agent-2';

      // Create trade
      const trade = await tradingService.createTrade(initiatorId, targetId, sql);

      // Target tries to cancel (should fail)
      await expect(
        tradingService.cancelTrade(trade.id, targetId, sql)
      ).rejects.toThrow(/Only the initiator can cancel/i);

      // Initiator cancels (should succeed)
      const result = await tradingService.cancelTrade(trade.id, initiatorId, sql);
      expect(result.status).toBe('cancelled');
    });

    it('should retrieve trade history for agent', async () => {
      const agent1 = 'test-agent-1';
      const agent2 = 'test-agent-2';

      // Create multiple trades
      const trade1 = await tradingService.createTrade(agent1, agent2, sql);
      const trade2 = await tradingService.createTrade(agent2, agent1, sql);

      // Accept one, reject another
      await tradingService.acceptTrade(trade1.id, agent2, sql);
      await tradingService.rejectTrade(trade2.id, agent1, sql);

      // Get history for agent1
      const history = await tradingService.getTradeHistory(agent1, sql);

      expect(history).toHaveLength(2);
      expect(history.some(t => t.id === trade1.id && t.status === 'accepted')).toBe(true);
      expect(history.some(t => t.id === trade2.id && t.status === 'rejected')).toBe(true);

      // Verify both trades appear for agent2 as well
      const agent2History = await tradingService.getTradeHistory(agent2, sql);
      expect(agent2History).toHaveLength(2);
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should reject self-trading', async () => {
      await expect(
        tradingService.createTrade('test-agent-1', 'test-agent-1', sql)
      ).rejects.toThrow(/Cannot trade with yourself/i);
    });

    it('should prevent modifying accepted trades', async () => {
      const trade = await tradingService.createTrade('test-agent-1', 'test-agent-2', sql);
      await tradingService.addItemToTrade(trade.id, 'test-agent-1', 'item-1', 1, sql);
      await tradingService.acceptTrade(trade.id, 'test-agent-2', sql);

      // Try to add item to accepted trade (should fail)
      await expect(
        tradingService.addItemToTrade(trade.id, 'test-agent-1', 'item-2', 1, sql)
      ).rejects.toThrow(/Trade is already/i);
    });

    it('should prevent adding items you don\'t own', async () => {
      const trade = await tradingService.createTrade('test-agent-1', 'test-agent-2', sql);

      // Agent 1 tries to add item owned by agent 2
      await expect(
        tradingService.addItemToTrade(trade.id, 'test-agent-1', 'item-5', 1, sql)
      ).rejects.toThrow(/do not own this item/i);
    });
  });
});
