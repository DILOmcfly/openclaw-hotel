import { describe, it, expect, vi } from 'vitest';
import * as marketplaceService from '../services/marketplace.js';

describe('Marketplace Service', () => {
  // Mock SQL client
  const createMockSql = (returnValue: any) => {
    const mock = vi.fn().mockResolvedValue(returnValue);
    mock.mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
      return Promise.resolve(returnValue);
    });
    mock.unsafe = vi.fn((query: string) => query);
    mock.begin = vi.fn(async (callback: any) => {
      const txMock = createMockSql(returnValue);
      return callback(txMock);
    });
    return mock as any;
  };

  describe('createListing', () => {
    it('should create a valid listing', async () => {
      const sql = createMockSql([{ agentId: 'seller-1', roomId: null }]);
      sql.mockResolvedValueOnce([{ agentId: 'seller-1', roomId: null }]) // ownership check
        .mockResolvedValueOnce([]) // no existing listing
        .mockResolvedValueOnce([{
          id: 'listing-1',
          itemId: 'item-1',
          sellerId: 'seller-1',
          itemType: 'chair',
          price: 100,
          status: 'active',
          buyerId: null,
          createdAt: new Date(),
          soldAt: null,
        }]);

      const listing = await marketplaceService.createListing(
        'item-1',
        'seller-1',
        'chair',
        100,
        sql
      );

      expect(listing.itemId).toBe('item-1');
      expect(listing.price).toBe(100);
      expect(listing.status).toBe('active');
    });

    it('should reject price less than 1', async () => {
      const sql = createMockSql([]);

      await expect(
        marketplaceService.createListing('item-1', 'seller-1', 'chair', 0, sql)
      ).rejects.toThrow('Price must be between 1 and 100,000 coins');
    });

    it('should reject price greater than 100,000', async () => {
      const sql = createMockSql([]);

      await expect(
        marketplaceService.createListing('item-1', 'seller-1', 'chair', 100001, sql)
      ).rejects.toThrow('Price must be between 1 and 100,000 coins');
    });

    it('should reject if agent does not own item', async () => {
      const sql = createMockSql([{ agentId: 'other-agent', roomId: null }]);

      await expect(
        marketplaceService.createListing('item-1', 'seller-1', 'chair', 100, sql)
      ).rejects.toThrow('You do not own this item');
    });

    it('should reject if item is placed in a room', async () => {
      const sql = createMockSql([{ agentId: 'seller-1', roomId: 'room-123' }]);

      await expect(
        marketplaceService.createListing('item-1', 'seller-1', 'chair', 100, sql)
      ).rejects.toThrow('Cannot list items that are placed in a room');
    });

    it('should reject if item is already listed', async () => {
      const sql = createMockSql([{ agentId: 'seller-1', roomId: null }]);
      sql.mockResolvedValueOnce([{ agentId: 'seller-1', roomId: null }])
        .mockResolvedValueOnce([{ id: 'existing-listing' }]); // already listed

      await expect(
        marketplaceService.createListing('item-1', 'seller-1', 'chair', 100, sql)
      ).rejects.toThrow('Item is already listed on the marketplace');
    });
  });

  describe('buyListing', () => {
    it('should successfully buy listing with sufficient funds', async () => {
      const mockListing = {
        id: 'listing-1',
        itemId: 'item-1',
        sellerId: 'seller-1',
        itemType: 'chair',
        price: 100,
        status: 'active',
      };

      const sql = createMockSql([]);
      sql.begin = vi.fn(async (callback: any) => {
        const tx = createMockSql([]);
        tx.mockResolvedValueOnce([mockListing]) // get listing
          .mockResolvedValueOnce([{ coins: 500 }]) // buyer balance
          .mockResolvedValueOnce([{ agentId: 'seller-1' }]) // item ownership
          .mockResolvedValueOnce([]) // deduct coins
          .mockResolvedValueOnce([]) // add coins to seller
          .mockResolvedValueOnce([]) // transfer item
          .mockResolvedValueOnce([]); // mark as sold
        return callback(tx);
      });

      await marketplaceService.buyListing('listing-1', 'buyer-1', sql);

      expect(sql.begin).toHaveBeenCalled();
    });

    it('should reject if buyer has insufficient funds', async () => {
      const mockListing = {
        id: 'listing-1',
        itemId: 'item-1',
        sellerId: 'seller-1',
        price: 100,
        status: 'active',
      };

      const sql = createMockSql([]);
      sql.begin = vi.fn(async (callback: any) => {
        const tx = createMockSql([]);
        tx.mockResolvedValueOnce([mockListing]) // get listing
          .mockResolvedValueOnce([{ coins: 50 }]); // insufficient balance
        return callback(tx);
      });

      await expect(
        marketplaceService.buyListing('listing-1', 'buyer-1', sql)
      ).rejects.toThrow('Insufficient funds');
    });

    it('should reject if listing is not active', async () => {
      const mockListing = {
        id: 'listing-1',
        itemId: 'item-1',
        sellerId: 'seller-1',
        price: 100,
        status: 'sold',
      };

      const sql = createMockSql([]);
      sql.begin = vi.fn(async (callback: any) => {
        const tx = createMockSql([]);
        tx.mockResolvedValueOnce([mockListing]);
        return callback(tx);
      });

      await expect(
        marketplaceService.buyListing('listing-1', 'buyer-1', sql)
      ).rejects.toThrow('Listing is not active');
    });

    it('should reject if buyer tries to buy their own listing', async () => {
      const mockListing = {
        id: 'listing-1',
        itemId: 'item-1',
        sellerId: 'seller-1',
        price: 100,
        status: 'active',
      };

      const sql = createMockSql([]);
      sql.begin = vi.fn(async (callback: any) => {
        const tx = createMockSql([]);
        tx.mockResolvedValueOnce([mockListing]);
        return callback(tx);
      });

      await expect(
        marketplaceService.buyListing('listing-1', 'seller-1', sql)
      ).rejects.toThrow('Cannot buy your own listing');
    });
  });

  describe('cancelListing', () => {
    it('should allow seller to cancel active listing', async () => {
      const sql = createMockSql([]);
      sql.mockResolvedValueOnce([{ sellerId: 'seller-1', status: 'active' }])
        .mockResolvedValueOnce([]);

      await marketplaceService.cancelListing('listing-1', 'seller-1', sql);

      expect(sql).toHaveBeenCalled();
    });

    it('should reject if non-seller tries to cancel', async () => {
      const sql = createMockSql([{ sellerId: 'seller-1', status: 'active' }]);

      await expect(
        marketplaceService.cancelListing('listing-1', 'other-agent', sql)
      ).rejects.toThrow('Only the seller can cancel this listing');
    });

    it('should reject if listing is not active', async () => {
      const sql = createMockSql([{ sellerId: 'seller-1', status: 'sold' }]);

      await expect(
        marketplaceService.cancelListing('listing-1', 'seller-1', sql)
      ).rejects.toThrow('Listing is not active');
    });
  });

  describe('getListings', () => {
    it('should filter by status', async () => {
      const mockListings = [
        { id: '1', status: 'active', price: 100, itemType: 'chair' },
        { id: '2', status: 'sold', price: 200, itemType: 'table' },
      ];

      const sql = createMockSql(mockListings.filter((l) => l.status === 'active'));
      sql.unsafe = vi.fn((query: string) => query);

      const listings = await marketplaceService.getListings({ status: 'active' }, 1, 20, sql);

      expect(listings.every((l) => l.status === 'active')).toBe(true);
    });

    it('should filter by item type', async () => {
      const mockListings = [
        { id: '1', itemType: 'chair', price: 100 },
        { id: '2', itemType: 'table', price: 200 },
      ];

      const sql = createMockSql(mockListings.filter((l) => l.itemType === 'chair'));
      sql.unsafe = vi.fn((query: string) => query);

      const listings = await marketplaceService.getListings({ itemType: 'chair' }, 1, 20, sql);

      expect(listings.every((l) => l.itemType === 'chair')).toBe(true);
    });

    it('should filter by price range', async () => {
      const mockListings = [
        { id: '1', price: 50 },
        { id: '2', price: 150 },
        { id: '3', price: 250 },
      ];

      const sql = createMockSql(
        mockListings.filter((l) => l.price >= 100 && l.price <= 200)
      );
      sql.unsafe = vi.fn((query: string) => query);

      const listings = await marketplaceService.getListings(
        { minPrice: 100, maxPrice: 200 },
        1,
        20,
        sql
      );

      expect(listings.every((l) => l.price >= 100 && l.price <= 200)).toBe(true);
    });

    it('should support pagination', async () => {
      const sql = createMockSql([]);
      sql.unsafe = vi.fn((query: string) => query);

      await marketplaceService.getListings({}, 2, 10, sql);

      expect(sql.unsafe).toHaveBeenCalled();
    });
  });

  describe('getMyListings', () => {
    it('should return only listings for specified agent', async () => {
      const mockListings = [
        { id: '1', sellerId: 'agent-1', itemType: 'chair' },
        { id: '2', sellerId: 'agent-1', itemType: 'table' },
      ];

      const sql = createMockSql(mockListings);

      const listings = await marketplaceService.getMyListings('agent-1', sql);

      expect(listings.every((l) => l.sellerId === 'agent-1')).toBe(true);
      expect(listings).toHaveLength(2);
    });
  });

  describe('getListingById', () => {
    it('should return listing if found', async () => {
      const mockListing = {
        id: 'listing-1',
        itemId: 'item-1',
        sellerId: 'seller-1',
        price: 100,
      };

      const sql = createMockSql([mockListing]);

      const listing = await marketplaceService.getListingById('listing-1', sql);

      expect(listing).toBeTruthy();
      expect(listing?.id).toBe('listing-1');
    });

    it('should return null if not found', async () => {
      const sql = createMockSql([]);

      const listing = await marketplaceService.getListingById('nonexistent', sql);

      expect(listing).toBeNull();
    });
  });
});
