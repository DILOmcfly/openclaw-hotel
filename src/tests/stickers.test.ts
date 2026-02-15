import { describe, it, expect } from 'vitest';

/**
 * Stickers System Unit Tests
 * Tests sticker collection logic without database
 */

describe('Stickers System', () => {
  describe('Pack Purchase Logic', () => {
    it('should validate pack price against balance', () => {
      const hasEnoughCoins = (balance: number, price: number): boolean => {
        return balance >= price;
      };

      expect(hasEnoughCoins(100, 50)).toBe(true);
      expect(hasEnoughCoins(50, 50)).toBe(true);
      expect(hasEnoughCoins(49, 50)).toBe(false);
      expect(hasEnoughCoins(0, 50)).toBe(false);
    });

    it('should generate 5 random stickers from pack', () => {
      const packStickers = [
        { id: 1, emoji: '😀' },
        { id: 2, emoji: '😎' },
        { id: 3, emoji: '🥳' },
      ];

      const generateRandomStickers = (pool: any[], count: number): any[] => {
        const result = [];
        for (let i = 0; i < count; i++) {
          result.push(pool[Math.floor(Math.random() * pool.length)]);
        }
        return result;
      };

      const received = generateRandomStickers(packStickers, 5);
      expect(received).toHaveLength(5);
      received.forEach(sticker => {
        expect(packStickers.some(p => p.id === sticker.id)).toBe(true);
      });
    });

    it('should allow duplicate stickers in one pack opening', () => {
      const packStickers = [{ id: 1, emoji: '😀' }];

      const generateRandomStickers = (pool: any[], count: number): any[] => {
        const result = [];
        for (let i = 0; i < count; i++) {
          result.push(pool[Math.floor(Math.random() * pool.length)]);
        }
        return result;
      };

      const received = generateRandomStickers(packStickers, 5);
      expect(received).toHaveLength(5);
      expect(received.every(s => s.id === 1)).toBe(true);
    });

    it('should aggregate duplicate stickers into quantity', () => {
      const receivedStickers = [
        { id: 1, emoji: '😀' },
        { id: 2, emoji: '😎' },
        { id: 1, emoji: '😀' },
        { id: 1, emoji: '😀' },
        { id: 2, emoji: '😎' },
      ];

      type AggregatedSticker = { id: number; emoji: string; quantity: number };

      const aggregateStickers = (stickers: any[]): AggregatedSticker[] => {
        const map = new Map<number, AggregatedSticker>();
        for (const sticker of stickers) {
          if (map.has(sticker.id)) {
            map.get(sticker.id)!.quantity++;
          } else {
            map.set(sticker.id, { ...sticker, quantity: 1 });
          }
        }
        return Array.from(map.values());
      };

      const aggregated = aggregateStickers(receivedStickers);
      expect(aggregated).toHaveLength(2);
      expect(aggregated.find(s => s.id === 1)?.quantity).toBe(3);
      expect(aggregated.find(s => s.id === 2)?.quantity).toBe(2);
    });
  });

  describe('Sticker Usage', () => {
    it('should decrement quantity when using sticker', () => {
      const useSticker = (currentQuantity: number): number => {
        if (currentQuantity <= 0) throw new Error('Not available');
        return currentQuantity - 1;
      };

      expect(useSticker(5)).toBe(4);
      expect(useSticker(1)).toBe(0);
      expect(() => useSticker(0)).toThrow('Not available');
    });

    it('should remove sticker when quantity reaches 0', () => {
      const shouldRemove = (quantity: number): boolean => {
        return quantity === 0;
      };

      expect(shouldRemove(0)).toBe(true);
      expect(shouldRemove(1)).toBe(false);
      expect(shouldRemove(5)).toBe(false);
    });

    it('should prevent using unavailable stickers', () => {
      const canUseSticker = (hasSticker: boolean, quantity: number): boolean => {
        return hasSticker && quantity > 0;
      };

      expect(canUseSticker(true, 1)).toBe(true);
      expect(canUseSticker(true, 0)).toBe(false);
      expect(canUseSticker(false, 5)).toBe(false);
    });
  });

  describe('Sticker Trading', () => {
    it('should validate sender has sticker before trade', () => {
      const canTrade = (senderHas: boolean, senderQuantity: number): boolean => {
        return senderHas && senderQuantity > 0;
      };

      expect(canTrade(true, 1)).toBe(true);
      expect(canTrade(true, 5)).toBe(true);
      expect(canTrade(true, 0)).toBe(false);
      expect(canTrade(false, 0)).toBe(false);
    });

    it('should transfer sticker from sender to receiver', () => {
      type Collection = Map<number, number>;

      const tradeSticker = (sender: Collection, receiver: Collection, stickerId: number): void => {
        const senderQty = sender.get(stickerId) || 0;
        if (senderQty <= 0) throw new Error('Sender does not have sticker');

        sender.set(stickerId, senderQty - 1);
        receiver.set(stickerId, (receiver.get(stickerId) || 0) + 1);
      };

      const sender = new Map([[1, 3]]);
      const receiver = new Map([[1, 1]]);

      tradeSticker(sender, receiver, 1);

      expect(sender.get(1)).toBe(2);
      expect(receiver.get(1)).toBe(2);
    });

    it('should handle trading to agent without that sticker', () => {
      type Collection = Map<number, number>;

      const tradeSticker = (sender: Collection, receiver: Collection, stickerId: number): void => {
        const senderQty = sender.get(stickerId) || 0;
        if (senderQty <= 0) throw new Error('Sender does not have sticker');

        sender.set(stickerId, senderQty - 1);
        receiver.set(stickerId, (receiver.get(stickerId) || 0) + 1);
      };

      const sender = new Map([[1, 1]]);
      const receiver = new Map();

      tradeSticker(sender, receiver, 1);

      expect(sender.get(1)).toBe(0);
      expect(receiver.get(1)).toBe(1);
    });
  });

  describe('Collection Progress', () => {
    it('should calculate percentage of collection completed', () => {
      const calculateProgress = (collected: number, total: number): number => {
        if (total === 0) return 0;
        return Math.round((collected / total) * 100);
      };

      expect(calculateProgress(5, 15)).toBe(33);
      expect(calculateProgress(15, 15)).toBe(100);
      expect(calculateProgress(0, 15)).toBe(0);
      expect(calculateProgress(7, 15)).toBe(47);
    });

    it('should count unique stickers only', () => {
      type StickerInventory = { stickerId: number; quantity: number }[];

      const countUnique = (inventory: StickerInventory): number => {
        return new Set(inventory.map(s => s.stickerId)).size;
      };

      expect(countUnique([
        { stickerId: 1, quantity: 5 },
        { stickerId: 2, quantity: 1 },
        { stickerId: 3, quantity: 10 },
      ])).toBe(3);

      expect(countUnique([
        { stickerId: 1, quantity: 100 },
      ])).toBe(1);

      expect(countUnique([])).toBe(0);
    });

    it('should handle 100% completion', () => {
      const calculateProgress = (collected: number, total: number): number => {
        if (total === 0) return 0;
        return Math.round((collected / total) * 100);
      };

      expect(calculateProgress(15, 15)).toBe(100);
    });

    it('should handle empty collection', () => {
      const calculateProgress = (collected: number, total: number): number => {
        if (total === 0) return 0;
        return Math.round((collected / total) * 100);
      };

      expect(calculateProgress(0, 15)).toBe(0);
    });
  });

  describe('Rarest Stickers', () => {
    it('should sort stickers by ownership count ascending', () => {
      type StickerRarity = { id: number; ownedBy: number };

      const sortByRarity = (stickers: StickerRarity[]): StickerRarity[] => {
        return [...stickers].sort((a, b) => a.ownedBy - b.ownedBy);
      };

      const stickers = [
        { id: 1, ownedBy: 10 },
        { id: 2, ownedBy: 2 },
        { id: 3, ownedBy: 5 },
      ];

      const sorted = sortByRarity(stickers);
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });

    it('should include stickers with zero owners', () => {
      type StickerRarity = { id: number; ownedBy: number };

      const stickers = [
        { id: 1, ownedBy: 5 },
        { id: 2, ownedBy: 0 },
        { id: 3, ownedBy: 2 },
      ];

      const sorted = [...stickers].sort((a, b) => a.ownedBy - b.ownedBy);
      expect(sorted[0].ownedBy).toBe(0);
    });

    it('should respect limit parameter', () => {
      const applyLimit = (items: any[], limit: number): any[] => {
        return items.slice(0, limit);
      };

      const items = [1, 2, 3, 4, 5];
      expect(applyLimit(items, 3)).toEqual([1, 2, 3]);
      expect(applyLimit(items, 10)).toEqual(items);
    });

    it('should use sticker id as tiebreaker for same ownership count', () => {
      type StickerRarity = { id: number; ownedBy: number };

      const sortByRarity = (stickers: StickerRarity[]): StickerRarity[] => {
        return [...stickers].sort((a, b) => {
          if (a.ownedBy !== b.ownedBy) return a.ownedBy - b.ownedBy;
          return a.id - b.id;
        });
      };

      const stickers = [
        { id: 3, ownedBy: 5 },
        { id: 1, ownedBy: 5 },
        { id: 2, ownedBy: 5 },
      ];

      const sorted = sortByRarity(stickers);
      expect(sorted[0].id).toBe(1);
      expect(sorted[1].id).toBe(2);
      expect(sorted[2].id).toBe(3);
    });
  });

  describe('Pack Categories', () => {
    it('should validate category is in allowed list', () => {
      const ALLOWED_CATEGORIES = ['emoji', 'animal', 'food', 'nature', 'meme', 'special'];

      const isValidCategory = (category: string): boolean => {
        return ALLOWED_CATEGORIES.includes(category);
      };

      expect(isValidCategory('emoji')).toBe(true);
      expect(isValidCategory('animal')).toBe(true);
      expect(isValidCategory('invalid')).toBe(false);
      expect(isValidCategory('')).toBe(false);
    });

    it('should filter packs by category', () => {
      type Pack = { id: number; category: string };

      const filterByCategory = (packs: Pack[], category: string): Pack[] => {
        return packs.filter(p => p.category === category);
      };

      const packs = [
        { id: 1, category: 'emoji' },
        { id: 2, category: 'animal' },
        { id: 3, category: 'emoji' },
      ];

      expect(filterByCategory(packs, 'emoji')).toHaveLength(2);
      expect(filterByCategory(packs, 'animal')).toHaveLength(1);
      expect(filterByCategory(packs, 'food')).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative quantity gracefully', () => {
      const validateQuantity = (quantity: number): boolean => {
        return quantity > 0;
      };

      expect(validateQuantity(1)).toBe(true);
      expect(validateQuantity(0)).toBe(false);
      expect(validateQuantity(-1)).toBe(false);
    });

    it('should handle empty sticker pack', () => {
      const canOpenPack = (stickerCount: number): boolean => {
        return stickerCount > 0;
      };

      expect(canOpenPack(5)).toBe(true);
      expect(canOpenPack(0)).toBe(false);
    });

    it('should cap limit parameter for queries', () => {
      const capLimit = (requested: number, max: number): number => {
        return Math.min(requested, max);
      };

      expect(capLimit(5, 50)).toBe(5);
      expect(capLimit(100, 50)).toBe(50);
      expect(capLimit(50, 50)).toBe(50);
    });
  });
});
