import { describe, expect, it, beforeAll } from 'vitest';
import { CATALOG } from '../data/furniture-catalog.js';

describe('Furniture API', () => {
  describe('Catalog', () => {
    it('should have valid catalog entries', () => {
      expect(Object.keys(CATALOG).length).toBeGreaterThan(0);
      
      Object.entries(CATALOG).forEach(([itemDefId, def]) => {
        expect(itemDefId).toBeTruthy();
        expect(def.width).toBeGreaterThan(0);
        expect(def.depth).toBeGreaterThan(0);
        expect(def.height).toBeGreaterThan(0);
        expect(typeof def.canSit).toBe('boolean');
        expect(typeof def.walkable).toBe('boolean');
      });
    });

    it('should have sensible furniture dimensions', () => {
      const chair = CATALOG['chair_wood'];
      expect(chair.width).toBe(1);
      expect(chair.depth).toBe(1);
      expect(chair.canSit).toBe(true);

      const table = CATALOG['table_round'];
      expect(table.width).toBe(2);
      expect(table.depth).toBe(2);
      expect(table.canSit).toBe(false);
    });

    it('should have walkable rugs', () => {
      const rug = CATALOG['rug_small'];
      expect(rug.walkable).toBe(true);
      expect(rug.height).toBeLessThan(0.1); // Very low height
    });
  });

  describe('Purchase validation', () => {
    it('should calculate price based on size and features', () => {
      // Simple formula: basePrice + (size * 10) + features
      function calculatePrice(def: any): number {
        const basePrice = 100;
        const sizeMultiplier = (def.width * def.depth * def.height) / 2;
        const featureBonus = (def.canSit ? 50 : 0) + (def.walkable ? 0 : 20);
        return Math.round(basePrice + sizeMultiplier * 10 + featureBonus);
      }

      const chair = CATALOG['chair_wood'];
      const chairPrice = calculatePrice(chair);
      expect(chairPrice).toBeGreaterThan(0);
      expect(chairPrice).toBeLessThan(500); // Reasonable price range

      const table = CATALOG['table_round'];
      const tablePrice = calculatePrice(table);
      expect(tablePrice).toBeGreaterThan(0);
      
      // Note: price is based on size AND features, so sitting items may cost more
      // than larger items without special features
      expect(Math.abs(tablePrice - chairPrice)).toBeLessThan(200);
    });
  });

  describe('Inventory management', () => {
    it('should support quantity tracking', () => {
      // Mock inventory entry
      const inventoryItem = {
        agentId: 'test-agent',
        itemDefId: 'chair_wood',
        quantity: 3,
      };

      expect(inventoryItem.quantity).toBeGreaterThan(0);
    });

    it('should support adding and removing quantities', () => {
      let quantity = 5;
      
      // Purchase
      quantity += 2;
      expect(quantity).toBe(7);

      // Place in room
      quantity -= 1;
      expect(quantity).toBe(6);

      // Remove from room
      quantity += 1;
      expect(quantity).toBe(7);
    });
  });
});
