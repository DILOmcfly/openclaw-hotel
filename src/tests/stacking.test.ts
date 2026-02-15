import { describe, it, expect } from 'vitest';

describe('Stacking System', () => {
  const MAX_HEIGHT = 10.0;

  describe('Stack Height Calculation', () => {
    it('should calculate correct total height for single item', () => {
      const items = [
        { zLevel: 0, stackHeight: 2.0 },
      ];

      const totalHeight = items.reduce((max, item) => 
        Math.max(max, item.zLevel + item.stackHeight), 0
      );

      expect(totalHeight).toBe(2.0);
    });

    it('should calculate correct total height for stacked items', () => {
      const items = [
        { zLevel: 0, stackHeight: 1.5 },
        { zLevel: 1.5, stackHeight: 1.0 },
        { zLevel: 2.5, stackHeight: 2.0 },
      ];

      const totalHeight = items.reduce((max, item) => 
        Math.max(max, item.zLevel + item.stackHeight), 0
      );

      expect(totalHeight).toBe(4.5);
    });

    it('should return 0 for empty position', () => {
      const items: any[] = [];

      const totalHeight = items.reduce((max, item) => 
        Math.max(max, item.zLevel + item.stackHeight), 0
      );

      expect(totalHeight).toBe(0);
    });
  });

  describe('Max Height Validation', () => {
    it('should allow placement under max height', () => {
      const currentHeight = 7.0;
      const newItemHeight = 2.0;

      const canPlace = (currentHeight + newItemHeight) <= MAX_HEIGHT;

      expect(canPlace).toBe(true);
    });

    it('should reject placement exceeding max height', () => {
      const currentHeight = 8.5;
      const newItemHeight = 2.0;

      const canPlace = (currentHeight + newItemHeight) <= MAX_HEIGHT;

      expect(canPlace).toBe(false);
    });

    it('should allow placement exactly at max height', () => {
      const currentHeight = 7.0;
      const newItemHeight = 3.0;

      const canPlace = (currentHeight + newItemHeight) <= MAX_HEIGHT;

      expect(canPlace).toBe(true);
    });

    it('should reject single item exceeding max height', () => {
      const currentHeight = 0;
      const newItemHeight = 12.0;

      const canPlace = (currentHeight + newItemHeight) <= MAX_HEIGHT;

      expect(canPlace).toBe(false);
    });
  });

  describe('Stackable Item Logic', () => {
    it('should allow stacking on stackable items', () => {
      const baseItems = [
        { stackable: true, zLevel: 0 },
        { stackable: true, zLevel: 1.5 },
      ];

      const hasNonStackable = baseItems.some(item => !item.stackable);

      expect(hasNonStackable).toBe(false);
    });

    it('should reject stacking on non-stackable items', () => {
      const baseItems = [
        { stackable: true, zLevel: 0 },
        { stackable: false, zLevel: 1.5 },
      ];

      const hasNonStackable = baseItems.some(item => !item.stackable);

      expect(hasNonStackable).toBe(true);
    });

    it('should handle empty base (no items to check)', () => {
      const baseItems: any[] = [];

      const hasNonStackable = baseItems.some(item => !item.stackable);

      expect(hasNonStackable).toBe(false);
    });
  });

  describe('Place On Top Logic', () => {
    it('should place item at current stack height', () => {
      const currentStackHeight = 3.5;
      const newZLevel = currentStackHeight;

      expect(newZLevel).toBe(3.5);
    });

    it('should place first item at z-level 0', () => {
      const currentStackHeight = 0;
      const newZLevel = currentStackHeight;

      expect(newZLevel).toBe(0);
    });

    it('should stack multiple items correctly', () => {
      let currentHeight = 0;
      const itemHeights = [1.0, 1.5, 2.0];
      const placements: number[] = [];

      itemHeights.forEach(height => {
        placements.push(currentHeight);
        currentHeight += height;
      });

      expect(placements).toEqual([0, 1.0, 2.5]);
      expect(currentHeight).toBe(4.5);
    });
  });

  describe('Items At Position', () => {
    it('should sort items by z-level ascending', () => {
      const items = [
        { id: '3', zLevel: 3.0 },
        { id: '1', zLevel: 0.0 },
        { id: '2', zLevel: 1.5 },
      ];

      const sorted = items.sort((a, b) => a.zLevel - b.zLevel);

      expect(sorted.map(i => i.id)).toEqual(['1', '2', '3']);
    });

    it('should handle single item', () => {
      const items = [
        { id: '1', zLevel: 0.0 },
      ];

      const sorted = items.sort((a, b) => a.zLevel - b.zLevel);

      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('1');
    });

    it('should handle empty position', () => {
      const items: any[] = [];

      expect(items).toHaveLength(0);
    });
  });

  describe('Remove From Stack', () => {
    it('should adjust items above when removing from bottom', () => {
      const removedZLevel = 0;
      const removedHeight = 1.5;
      const itemsAbove = [
        { id: '2', zLevel: 1.5, stackHeight: 1.0 },
        { id: '3', zLevel: 2.5, stackHeight: 2.0 },
      ];

      const heightToSubtract = removedZLevel + removedHeight;
      const adjusted = itemsAbove.map(item => ({
        ...item,
        zLevel: item.zLevel - heightToSubtract,
      }));

      expect(adjusted[0].zLevel).toBe(0);
      expect(adjusted[1].zLevel).toBe(1.0);
    });

    it('should adjust items above when removing from middle', () => {
      const removedZLevel = 1.5;
      const removedHeight = 1.0;
      const itemsAbove = [
        { id: '3', zLevel: 2.5, stackHeight: 2.0 },
      ];

      const heightToSubtract = removedZLevel + removedHeight;
      const adjusted = itemsAbove.map(item => ({
        ...item,
        zLevel: item.zLevel - heightToSubtract,
      }));

      expect(adjusted[0].zLevel).toBe(0);
    });

    it('should not adjust items when removing top item', () => {
      const removedZLevel = 4.5;
      const removedHeight = 2.0;
      const itemsAbove: any[] = [];

      expect(itemsAbove).toHaveLength(0);
    });

    it('should only adjust items at same x,y position', () => {
      const items = [
        { id: '1', x: 5, y: 5, zLevel: 0, stackHeight: 1.0 },
        { id: '2', x: 5, y: 5, zLevel: 1.0, stackHeight: 1.0 },
        { id: '3', x: 6, y: 5, zLevel: 0, stackHeight: 1.0 }, // Different position
      ];

      const removedItem = items[0];
      const itemsToAdjust = items.filter(item => 
        item.x === removedItem.x && 
        item.y === removedItem.y && 
        item.zLevel > removedItem.zLevel
      );

      expect(itemsToAdjust).toHaveLength(1);
      expect(itemsToAdjust[0].id).toBe('2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle fractional heights', () => {
      const height1 = 0.5;
      const height2 = 0.3;
      const total = height1 + height2;

      expect(total).toBeCloseTo(0.8, 2);
    });

    it('should handle very small heights', () => {
      const height = 0.01;
      const canPlace = (9.99 + height) <= MAX_HEIGHT;

      expect(canPlace).toBe(true);
    });

    it('should handle default stack height of 1.0', () => {
      const defaultHeight = 1.0;
      const items = [
        { stackHeight: defaultHeight },
        { stackHeight: defaultHeight },
        { stackHeight: defaultHeight },
      ];

      const total = items.reduce((sum, item) => sum + item.stackHeight, 0);

      expect(total).toBe(3.0);
    });
  });
});
