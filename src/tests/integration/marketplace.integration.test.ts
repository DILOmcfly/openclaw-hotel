/**
 * Integration Tests: Marketplace Flow
 * 
 * Tests the complete marketplace lifecycle:
 * - List item for sale
 * - Buy item from marketplace
 * - Verify transaction (coins + item transfer)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegrationTests, teardownIntegrationTests, getTestSql, isDatabaseAvailable } from './setup.js';
import * as marketplaceService from '../../services/marketplace.js';
import * as economyService from '../../services/economy.js';

let sql: ReturnType<typeof getTestSql>;

describe('Integration: Marketplace Flow', () => {
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

  beforeEach(async () => {
    // Clear marketplace listings between tests
    await sql`DELETE FROM marketplace_listings`;
  });

  describe('List → Buy → Verify Transaction', () => {
    it('should list item for sale in marketplace', async () => {
      const sellerId = 'test-agent-1';
      const itemId = 'item-1'; // furn_chair owned by test-agent-1 (from seed)
      const price = 100;

      // List item
      const listing = await marketplaceService.createListing(
        sellerId,
        itemId,
        price,
        'Selling my chair!',
        sql
      );

      expect(listing).toBeDefined();
      expect(listing.id).toBeDefined();
      expect(listing.sellerId).toBe(sellerId);
      expect(listing.itemId).toBe(itemId);
      expect(listing.price).toBe(price);
      expect(listing.status).toBe('active');
      expect(listing.description).toBe('Selling my chair!');

      // Verify in database
      const [dbListing] = await sql`
        SELECT id, seller_id, item_id, price, status
        FROM marketplace_listings
        WHERE id = ${listing.id}
      `;

      expect(dbListing).toBeDefined();
      expect(dbListing.status).toBe('active');

      // Verify item marked as listed
      const [item] = await sql`
        SELECT listed_for_sale FROM inventory_items WHERE id = ${itemId}
      `;

      expect(item.listed_for_sale).toBe(true);
    });

    it('should buy item and transfer coins + ownership atomically', async () => {
      const sellerId = 'test-agent-1';
      const buyerId = 'test-agent-2';
      const itemId = 'item-2'; // furn_table owned by test-agent-1
      const price = 150;

      // Get initial balances
      const sellerBalanceBefore = await economyService.getBalance(sellerId, sql);
      const buyerBalanceBefore = await economyService.getBalance(buyerId, sql);

      // Seller lists item
      const listing = await marketplaceService.createListing(
        sellerId,
        itemId,
        price,
        'Quality table for sale',
        sql
      );

      // Buyer purchases item
      const purchase = await marketplaceService.purchaseListing(
        listing.id,
        buyerId,
        sql
      );

      expect(purchase).toBeDefined();
      expect(purchase.buyerId).toBe(buyerId);
      expect(purchase.status).toBe('sold');

      // Verify item ownership transferred
      const [item] = await sql`
        SELECT agent_id, listed_for_sale FROM inventory_items WHERE id = ${itemId}
      `;

      expect(item.agent_id).toBe(buyerId); // Now owned by buyer
      expect(item.listed_for_sale).toBe(false); // No longer listed

      // Verify coins transferred
      const sellerBalanceAfter = await economyService.getBalance(sellerId, sql);
      const buyerBalanceAfter = await economyService.getBalance(buyerId, sql);

      expect(sellerBalanceAfter.coins).toBe(sellerBalanceBefore.coins + price);
      expect(buyerBalanceAfter.coins).toBe(buyerBalanceBefore.coins - price);

      // Verify listing marked as sold
      const [soldListing] = await sql`
        SELECT status, buyer_id, sold_at
        FROM marketplace_listings
        WHERE id = ${listing.id}
      `;

      expect(soldListing.status).toBe('sold');
      expect(soldListing.buyer_id).toBe(buyerId);
      expect(soldListing.sold_at).not.toBeNull();
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should reject purchase with insufficient funds', async () => {
      const sellerId = 'test-agent-1';
      const buyerId = 'test-agent-2';
      const itemId = 'item-3'; // furn_lamp

      // Set buyer balance to 50 coins
      await sql`UPDATE agent_balances SET coins = 50 WHERE agent_id = ${buyerId}`;

      // List item for 200 coins (more than buyer has)
      const listing = await marketplaceService.createListing(
        sellerId,
        itemId,
        200,
        'Expensive lamp',
        sql
      );

      // Try to purchase (should fail)
      await expect(
        marketplaceService.purchaseListing(listing.id, buyerId, sql)
      ).rejects.toThrow(/insufficient funds/i);

      // Verify item still owned by seller
      const [item] = await sql`
        SELECT agent_id FROM inventory_items WHERE id = ${itemId}
      `;

      expect(item.agent_id).toBe(sellerId);
    });

    it('should prevent seller from buying their own listing', async () => {
      const sellerId = 'test-agent-1';
      const itemId = 'item-4'; // furn_bed

      // List item
      const listing = await marketplaceService.createListing(
        sellerId,
        itemId,
        100,
        'My bed',
        sql
      );

      // Seller tries to buy their own listing
      await expect(
        marketplaceService.purchaseListing(listing.id, sellerId, sql)
      ).rejects.toThrow(/cannot buy your own listing/i);
    });

    it('should prevent listing items you don\'t own', async () => {
      const notOwner = 'test-agent-2';
      const itemId = 'item-1'; // Owned by test-agent-1

      await expect(
        marketplaceService.createListing(notOwner, itemId, 100, 'Not my item', sql)
      ).rejects.toThrow(/do not own this item/i);
    });

    it('should allow seller to cancel listing', async () => {
      const sellerId = 'test-agent-1';
      const itemId = 'item-1';

      // Create listing
      const listing = await marketplaceService.createListing(
        sellerId,
        itemId,
        100,
        'Changed my mind',
        sql
      );

      // Cancel listing
      const cancelled = await marketplaceService.cancelListing(listing.id, sellerId, sql);

      expect(cancelled.status).toBe('cancelled');

      // Verify item no longer marked as listed
      const [item] = await sql`
        SELECT listed_for_sale FROM inventory_items WHERE id = ${itemId}
      `;

      expect(item.listed_for_sale).toBe(false);
    });

    it('should prevent buying already-sold listings', async () => {
      const sellerId = 'test-agent-1';
      const buyer1 = 'test-agent-2';
      const itemId = 'item-2';

      // Reset item ownership
      await sql`UPDATE inventory_items SET agent_id = ${sellerId} WHERE id = ${itemId}`;

      // Create listing
      const listing = await marketplaceService.createListing(
        sellerId,
        itemId,
        50,
        'Quick sale',
        sql
      );

      // First buyer purchases
      await marketplaceService.purchaseListing(listing.id, buyer1, sql);

      // Create a new agent to try to buy the already-sold item
      const buyer2 = 'test-buyer-2';
      await sql`
        INSERT INTO agents (id, name, email, password_hash, platform, agent_type, verified)
        VALUES (${buyer2}, 'Buyer2', 'buyer2@test.com', 'hash', 'test', 'basic', true)
      `;
      await sql`
        INSERT INTO agent_balances (agent_id, coins)
        VALUES (${buyer2}, 500)
      `;

      // Second buyer tries to buy (should fail)
      await expect(
        marketplaceService.purchaseListing(listing.id, buyer2, sql)
      ).rejects.toThrow(/already sold|not available/i);
    });

    it('should filter marketplace by price range', async () => {
      const sellerId = 'test-agent-1';

      // List multiple items at different prices
      await marketplaceService.createListing(sellerId, 'item-1', 50, 'Cheap', sql);
      await marketplaceService.createListing(sellerId, 'item-2', 150, 'Mid', sql);
      await marketplaceService.createListing(sellerId, 'item-3', 300, 'Expensive', sql);

      // Get listings in price range 100-200
      const listings = await marketplaceService.getListings(
        { minPrice: 100, maxPrice: 200 },
        sql
      );

      expect(listings).toHaveLength(1);
      expect(listings[0].price).toBe(150);
    });
  });
});
