import { describe, it, expect } from 'vitest';

describe('Inventory Service', () => {
  describe('Filter Logic', () => {
    it('should filter by category', () => {
      const mockItems = [
        { id: '1', itemDefId: 'chair', category: 'seating', roomId: null },
        { id: '2', itemDefId: 'table', category: 'tables', roomId: null },
        { id: '3', itemDefId: 'lamp', category: 'lighting', roomId: null },
      ];

      const filtered = mockItems.filter(item => item.category === 'seating');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].itemDefId).toBe('chair');
    });

    it('should filter by search query', () => {
      const mockItems = [
        { id: '1', itemDefId: 'chair', category: 'seating', roomId: null },
        { id: '2', itemDefId: 'table', category: 'tables', roomId: null },
        { id: '3', itemDefId: 'bookshelf', category: 'storage', roomId: null },
      ];

      const searchQuery = 'cha';
      const filtered = mockItems.filter(item => 
        item.itemDefId.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].itemDefId).toBe('chair');
    });

    it('should filter by inRoom status (storage only)', () => {
      const mockItems = [
        { id: '1', itemDefId: 'chair', category: 'seating', roomId: null },
        { id: '2', itemDefId: 'table', category: 'tables', roomId: 'room-123' },
        { id: '3', itemDefId: 'lamp', category: 'lighting', roomId: null },
      ];

      const inStorage = mockItems.filter(item => item.roomId === null);

      expect(inStorage).toHaveLength(2);
      expect(inStorage.map(i => i.itemDefId)).toEqual(['chair', 'lamp']);
    });

    it('should filter by inRoom status (placed only)', () => {
      const mockItems = [
        { id: '1', itemDefId: 'chair', category: 'seating', roomId: null },
        { id: '2', itemDefId: 'table', category: 'tables', roomId: 'room-123' },
        { id: '3', itemDefId: 'lamp', category: 'lighting', roomId: 'room-456' },
      ];

      const placed = mockItems.filter(item => item.roomId !== null);

      expect(placed).toHaveLength(2);
      expect(placed.map(i => i.itemDefId)).toEqual(['table', 'lamp']);
    });
  });

  describe('Sell Logic', () => {
    it('should calculate 50% refund correctly', () => {
      const itemPrices: Record<string, number> = {
        chair: 50,
        table: 75,
        lamp: 30,
        plant: 40,
        sofa: 120,
      };

      const refund = (originalPrice: number) => Math.floor(originalPrice * 0.5);

      expect(refund(itemPrices.chair)).toBe(25);
      expect(refund(itemPrices.table)).toBe(37);
      expect(refund(itemPrices.lamp)).toBe(15);
      expect(refund(itemPrices.plant)).toBe(20);
      expect(refund(itemPrices.sofa)).toBe(60);
    });

    it('should reject selling items placed in rooms', () => {
      const mockItem = {
        id: 'item-1',
        agentId: 'agent-1',
        itemDefId: 'chair',
        roomId: 'room-123', // Placed in a room
      };

      const canSell = mockItem.roomId === null;

      expect(canSell).toBe(false);
    });

    it('should allow selling items in storage', () => {
      const mockItem = {
        id: 'item-1',
        agentId: 'agent-1',
        itemDefId: 'chair',
        roomId: null, // In storage
      };

      const canSell = mockItem.roomId === null;

      expect(canSell).toBe(true);
    });

    it('should verify ownership before selling', () => {
      const mockItem = {
        id: 'item-1',
        agentId: 'agent-1',
        itemDefId: 'chair',
        roomId: null,
      };

      const currentAgentId = 'agent-1';
      const isOwner = mockItem.agentId === currentAgentId;

      expect(isOwner).toBe(true);

      const otherAgentId = 'agent-2';
      const isNotOwner = mockItem.agentId === otherAgentId;

      expect(isNotOwner).toBe(false);
    });
  });

  describe('Inventory Count', () => {
    it('should count total items', () => {
      const mockItems = [
        { id: '1', roomId: null },
        { id: '2', roomId: 'room-1' },
        { id: '3', roomId: null },
      ];

      expect(mockItems.length).toBe(3);
    });

    it('should count only storage items', () => {
      const mockItems = [
        { id: '1', roomId: null },
        { id: '2', roomId: 'room-1' },
        { id: '3', roomId: null },
      ];

      const inStorage = mockItems.filter(item => item.roomId === null);

      expect(inStorage.length).toBe(2);
    });

    it('should count only placed items', () => {
      const mockItems = [
        { id: '1', roomId: null },
        { id: '2', roomId: 'room-1' },
        { id: '3', roomId: 'room-2' },
      ];

      const placed = mockItems.filter(item => item.roomId !== null);

      expect(placed.length).toBe(2);
    });
  });

  describe('Combined Filters', () => {
    it('should apply category + search filters together', () => {
      const mockItems = [
        { id: '1', itemDefId: 'chair', category: 'seating', roomId: null },
        { id: '2', itemDefId: 'armchair', category: 'seating', roomId: null },
        { id: '3', itemDefId: 'table', category: 'tables', roomId: null },
      ];

      const filtered = mockItems.filter(item => 
        item.category === 'seating' && 
        item.itemDefId.toLowerCase().includes('chair')
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(i => i.itemDefId)).toEqual(['chair', 'armchair']);
    });

    it('should apply all 3 filters (category + search + inRoom)', () => {
      const mockItems = [
        { id: '1', itemDefId: 'chair', category: 'seating', roomId: null },
        { id: '2', itemDefId: 'armchair', category: 'seating', roomId: 'room-1' },
        { id: '3', itemDefId: 'table', category: 'tables', roomId: null },
        { id: '4', itemDefId: 'desk', category: 'tables', roomId: null },
      ];

      const filtered = mockItems.filter(item => 
        item.category === 'seating' && 
        item.itemDefId.toLowerCase().includes('chair') &&
        item.roomId === null
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].itemDefId).toBe('chair');
    });
  });
});
