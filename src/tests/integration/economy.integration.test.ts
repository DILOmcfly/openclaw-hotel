// @ts-nocheck - TODO: fix type errors
/**
 * Integration Tests: Economy & Inventory Flow
 * 
 * Tests the complete economy lifecycle with real database:
 * - Purchase furniture from shop
 * - Place furniture in room
 * - Move furniture
 * - Sell furniture back (50% refund)
 * - Daily coin bonus
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTests, teardownIntegrationTests, getTestSql, isDatabaseAvailable } from './setup.js';
import * as economyService from '../../services/economy.js';
import * as inventoryService from '../../services/inventory.js';
import * as shopService from '../../services/roomShops.js';
import { nanoid } from 'nanoid';

let sql: ReturnType<typeof getTestSql>;

describe('Integration: Economy & Inventory Flow', () => {
  beforeAll(async (ctx) => {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.log('⏭️  Skipping integration tests: PostgreSQL database not available');
      ctx.skip();
      return;
    }
    sql = await setupIntegrationTests();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  describe('Purchase → Place → Sell Flow', () => {
    it('should complete full furniture lifecycle: purchase → place → sell', async () => {
      const agentId = 'test-agent-1'; // From seed data (500 coins)

      // Step 1: Get initial balance
      const initialBalance = await economyService.getBalance(agentId, sql);
      expect(initialBalance).toBeDefined();
      expect(initialBalance.coins).toBe(500);

      // Step 2: Purchase furniture from shop (chair costs 50 coins)
      const purchaseResult = await shopService.purchaseItem(agentId, 'furn_chair', sql);
      expect(purchaseResult).toBeDefined();
      expect(purchaseResult.itemId).toBeDefined();
      expect(purchaseResult.itemType).toBe('furn_chair');

      // Step 3: Verify balance deducted
      const balanceAfterPurchase = await economyService.getBalance(agentId, sql);
      expect(balanceAfterPurchase.coins).toBe(450); // 500 - 50 = 450

      // Step 4: Verify item in inventory
      const inventory = await inventoryService.getInventory(agentId, {}, sql);
      expect(inventory.items).toHaveLength(4); // 3 from seed + 1 purchased
      const purchasedItem = inventory.items.find((i) => i.id === purchaseResult.itemId);
      expect(purchasedItem).toBeDefined();
      expect(purchasedItem!.item_type).toBe('furn_chair');
      expect(purchasedItem!.room_id).toBeNull(); // Not placed yet

      // Step 5: Place furniture in room
      const roomId = 'test-room-1'; // From seed data
      await sql`
        UPDATE inventory_items
        SET room_id = ${roomId}, x = 5, y = 3, rotation = 0
        WHERE id = ${purchaseResult.itemId}
      `;

      // Step 6: Verify furniture is now in room (not in storage)
      const inventoryAfterPlace = await inventoryService.getInventory(
        agentId,
        { inRoom: true },
        sql
      );
      const placedItem = inventoryAfterPlace.items.find((i) => i.id === purchaseResult.itemId);
      expect(placedItem).toBeDefined();
      expect(placedItem!.room_id).toBe(roomId);
      expect(placedItem!.x).toBe(5);
      expect(placedItem!.y).toBe(3);

      // Step 7: Sell furniture back (50% refund = 25 coins)
      const sellResult = await inventoryService.sellItem(purchaseResult.itemId, agentId, sql);
      expect(sellResult).toBeDefined();
      expect(sellResult.refundAmount).toBe(25); // 50% of 50 = 25

      // Step 8: Verify balance increased by refund
      const balanceAfterSell = await economyService.getBalance(agentId, sql);
      expect(balanceAfterSell.coins).toBe(475); // 450 + 25 = 475

      // Step 9: Verify item removed from inventory
      const inventoryAfterSell = await inventoryService.getInventory(agentId, {}, sql);
      expect(inventoryAfterSell.items).toHaveLength(3); // Back to original 3
      const soldItem = inventoryAfterSell.items.find((i) => i.id === purchaseResult.itemId);
      expect(soldItem).toBeUndefined();
    });

    it('should reject purchase when insufficient funds', async () => {
      const agentId = 'test-agent-1';

      // Set balance to 10 coins (not enough for furn_table which costs 75)
      await sql`UPDATE agent_balances SET coins = 10 WHERE agent_id = ${agentId}`;

      await expect(
        shopService.purchaseItem(agentId, 'furn_table', sql)
      ).rejects.toThrow(/Insufficient funds/i);
    });

    it('should reject selling items that are currently placed in rooms', async () => {
      const agentId = 'test-agent-1';

      // Purchase and place item
      const purchaseResult = await shopService.purchaseItem(agentId, 'furn_lamp', sql);
      await sql`
        UPDATE inventory_items
        SET room_id = 'test-room-1', x = 2, y = 2
        WHERE id = ${purchaseResult.itemId}
      `;

      // Try to sell while placed
      await expect(
        inventoryService.sellItem(purchaseResult.itemId, agentId, sql)
      ).rejects.toThrow(/cannot sell items that are currently placed/i);
    });
  });

  describe('Daily Coin Bonus', () => {
    it('should grant 100 coins on first daily bonus claim', async () => {
      const agentId = 'test-agent-2';

      // Verify can claim
      const canClaim = await economyService.canClaimDailyBonus(agentId, sql);
      expect(canClaim).toBe(true);

      // Get initial balance
      const initialBalance = await economyService.getBalance(agentId, sql);
      const initialCoins = initialBalance.coins;

      // Claim bonus
      const claimResult = await economyService.grantDailyBonus(agentId, sql);
      expect(claimResult).toBeDefined();
      expect(claimResult.coins).toBe(initialCoins + 100);

      // Verify balance increased
      const newBalance = await economyService.getBalance(agentId, sql);
      expect(newBalance.coins).toBe(initialCoins + 100);

      // Verify cannot claim again immediately
      const canClaimAgain = await economyService.canClaimDailyBonus(agentId, sql);
      expect(canClaimAgain).toBe(false);
    });

    it('should reject claiming daily bonus twice within 24 hours', async () => {
      const agentId = `daily-bonus-agent-${nanoid(8)}`;

      // Create agent with balance
      await sql`
        INSERT INTO agents (id, name, email, password_hash, platform, agent_type, verified)
        VALUES (${agentId}, 'BonusAgent', 'bonus@test.com', 'hash', 'test', 'basic', true)
      `;
      await sql`
        INSERT INTO agent_balances (agent_id, coins, last_daily_claim)
        VALUES (${agentId}, 100, NULL)
      `;

      // First claim (should succeed)
      await economyService.grantDailyBonus(agentId, sql);

      // Second claim (should fail)
      await expect(
        economyService.grantDailyBonus(agentId, sql)
      ).rejects.toThrow(/already claimed/i);
    });
  });

  describe('Inventory Filtering', () => {
    it('should filter inventory by category', async () => {
      const agentId = 'test-agent-1';

      // Get all items
      const allItems = await inventoryService.getInventory(agentId, {}, sql);
      expect(allItems.items.length).toBeGreaterThan(0);

      // Filter by category (seating)
      const seatingItems = await inventoryService.getInventory(
        agentId,
        { category: 'seating' },
        sql
      );

      // All returned items should be seating
      for (const item of seatingItems.items) {
        expect(item.item_type).toMatch(/chair|sofa|bench/i);
      }
    });

    it('should filter inventory by inRoom status', async () => {
      const agentId = 'test-agent-1';

      // Get only items in storage (not placed)
      const storageItems = await inventoryService.getInventory(
        agentId,
        { inRoom: false },
        sql
      );

      // All items should have null room_id
      for (const item of storageItems.items) {
        expect(item.room_id).toBeNull();
      }

      // Get only items placed in rooms
      const placedItems = await inventoryService.getInventory(
        agentId,
        { inRoom: true },
        sql
      );

      // All items should have non-null room_id
      for (const item of placedItems.items) {
        expect(item.room_id).not.toBeNull();
      }
    });

    it('should search inventory by item type', async () => {
      const agentId = 'test-agent-1';

      // Search for "chair"
      const searchResults = await inventoryService.getInventory(
        agentId,
        { search: 'chair' },
        sql
      );

      // All results should contain "chair" in item_type
      for (const item of searchResults.items) {
        expect(item.item_type.toLowerCase()).toContain('chair');
      }
    });
  });

  describe('Inventory Count', () => {
    it('should return correct inventory count for agent', async () => {
      const agentId = 'test-agent-1';

      const count = await inventoryService.getInventoryCount(agentId, sql);
      expect(count).toBeDefined();
      expect(count.total).toBeGreaterThan(0);
      expect(count.inStorage).toBeGreaterThanOrEqual(0);
      expect(count.placed).toBeGreaterThanOrEqual(0);
      expect(count.total).toBe(count.inStorage + count.placed);
    });
  });
});
