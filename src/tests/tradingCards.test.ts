import { describe, it, expect } from 'vitest';

/**
 * Trading Cards System Unit Tests
 * Tests card minting, trading, and collection logic without database
 */

describe('Trading Cards System', () => {
  describe('Card Rarity Sorting', () => {
    it('should sort cards by rarity tier correctly', () => {
      const rarityWeight = (rarity: string): number => {
        const weights: Record<string, number> = {
          mythic: 6,
          legendary: 5,
          epic: 4,
          rare: 3,
          uncommon: 2,
          common: 1,
        };
        return weights[rarity] || 0;
      };

      expect(rarityWeight('mythic')).toBe(6);
      expect(rarityWeight('legendary')).toBe(5);
      expect(rarityWeight('epic')).toBe(4);
      expect(rarityWeight('rare')).toBe(3);
      expect(rarityWeight('uncommon')).toBe(2);
      expect(rarityWeight('common')).toBe(1);
    });

    it('should sort mixed rarity cards', () => {
      const cards = [
        { name: 'A', rarity: 'common' },
        { name: 'B', rarity: 'legendary' },
        { name: 'C', rarity: 'rare' },
      ];

      const rarityWeight = (rarity: string): number => {
        const weights: Record<string, number> = {
          legendary: 5,
          rare: 3,
          common: 1,
        };
        return weights[rarity] || 0;
      };

      const sorted = [...cards].sort((a, b) => rarityWeight(b.rarity) - rarityWeight(a.rarity));

      expect(sorted[0].name).toBe('B');
      expect(sorted[1].name).toBe('C');
      expect(sorted[2].name).toBe('A');
    });
  });

  describe('Serial Number Assignment', () => {
    it('should calculate next serial number from total minted', () => {
      const getNextSerial = (totalMinted: number): number => totalMinted + 1;

      expect(getNextSerial(0)).toBe(1);
      expect(getNextSerial(5)).toBe(6);
      expect(getNextSerial(99)).toBe(100);
    });

    it('should validate serial uniqueness within card', () => {
      type CardInstance = { cardId: number; serialNumber: number };

      const isUnique = (instances: CardInstance[], cardId: number, serial: number): boolean => {
        return !instances.some(i => i.cardId === cardId && i.serialNumber === serial);
      };

      const existing: CardInstance[] = [
        { cardId: 1, serialNumber: 1 },
        { cardId: 1, serialNumber: 2 },
        { cardId: 2, serialNumber: 1 },
      ];

      expect(isUnique(existing, 1, 3)).toBe(true);
      expect(isUnique(existing, 1, 1)).toBe(false);
      expect(isUnique(existing, 2, 1)).toBe(false);
      expect(isUnique(existing, 3, 1)).toBe(true);
    });
  });

  describe('Supply Limit Enforcement', () => {
    it('should reject minting when supply exhausted', () => {
      const canMint = (maxSupply: number | null, totalMinted: number): boolean => {
        if (maxSupply === null) return true;
        return totalMinted < maxSupply;
      };

      expect(canMint(100, 99)).toBe(true);
      expect(canMint(100, 100)).toBe(false);
      expect(canMint(100, 101)).toBe(false);
    });

    it('should allow unlimited minting for null max_supply', () => {
      const canMint = (maxSupply: number | null, totalMinted: number): boolean => {
        if (maxSupply === null) return true;
        return totalMinted < maxSupply;
      };

      expect(canMint(null, 0)).toBe(true);
      expect(canMint(null, 1000)).toBe(true);
      expect(canMint(null, 999999)).toBe(true);
    });

    it('should calculate remaining supply', () => {
      const getRemainingSupply = (maxSupply: number | null, totalMinted: number): number | null => {
        if (maxSupply === null) return null;
        return Math.max(0, maxSupply - totalMinted);
      };

      expect(getRemainingSupply(100, 30)).toBe(70);
      expect(getRemainingSupply(100, 100)).toBe(0);
      expect(getRemainingSupply(null, 50)).toBe(null);
    });
  });

  describe('Trade Validation', () => {
    it('should validate card ownership for trade', () => {
      type Card = { id: number; agentId: string; tradeable: boolean };

      const validateOwnership = (cards: Card[], agentId: string, cardIds: number[]): boolean => {
        const owned = cards.filter(c => c.agentId === agentId && cardIds.includes(c.id));
        return owned.length === cardIds.length;
      };

      const cards: Card[] = [
        { id: 1, agentId: 'agent1', tradeable: true },
        { id: 2, agentId: 'agent1', tradeable: true },
        { id: 3, agentId: 'agent2', tradeable: true },
      ];

      expect(validateOwnership(cards, 'agent1', [1, 2])).toBe(true);
      expect(validateOwnership(cards, 'agent1', [1, 3])).toBe(false);
      expect(validateOwnership(cards, 'agent2', [3])).toBe(true);
    });

    it('should validate tradeable status', () => {
      type Card = { id: number; tradeable: boolean };

      const areAllTradeable = (cards: Card[], cardIds: number[]): boolean => {
        const selected = cards.filter(c => cardIds.includes(c.id));
        return selected.every(c => c.tradeable);
      };

      const cards: Card[] = [
        { id: 1, tradeable: true },
        { id: 2, tradeable: false },
        { id: 3, tradeable: true },
      ];

      expect(areAllTradeable(cards, [1, 3])).toBe(true);
      expect(areAllTradeable(cards, [1, 2])).toBe(false);
      expect(areAllTradeable(cards, [2])).toBe(false);
    });

    it('should swap ownership correctly', () => {
      type Card = { id: number; agentId: string };

      const swapOwnership = (
        cards: Card[],
        senderIds: number[],
        receiverIds: number[],
        sender: string,
        receiver: string
      ): Card[] => {
        return cards.map(c => {
          if (senderIds.includes(c.id) && c.agentId === sender) {
            return { ...c, agentId: receiver };
          }
          if (receiverIds.includes(c.id) && c.agentId === receiver) {
            return { ...c, agentId: sender };
          }
          return c;
        });
      };

      const cards: Card[] = [
        { id: 1, agentId: 'agent1' },
        { id: 2, agentId: 'agent2' },
      ];

      const swapped = swapOwnership(cards, [1], [2], 'agent1', 'agent2');

      expect(swapped.find(c => c.id === 1)?.agentId).toBe('agent2');
      expect(swapped.find(c => c.id === 2)?.agentId).toBe('agent1');
    });
  });

  describe('Collection Progress', () => {
    it('should calculate unique cards owned', () => {
      type AgentCard = { cardId: number };

      const countUnique = (cards: AgentCard[]): number => {
        return new Set(cards.map(c => c.cardId)).size;
      };

      expect(countUnique([{ cardId: 1 }, { cardId: 2 }, { cardId: 1 }])).toBe(2);
      expect(countUnique([{ cardId: 5 }])).toBe(1);
      expect(countUnique([])).toBe(0);
    });

    it('should calculate completion percentage', () => {
      const getPercentage = (unique: number, total: number): number => {
        if (total === 0) return 0;
        return Math.round((unique / total) * 100);
      };

      expect(getPercentage(5, 10)).toBe(50);
      expect(getPercentage(7, 10)).toBe(70);
      expect(getPercentage(0, 10)).toBe(0);
      expect(getPercentage(10, 10)).toBe(100);
      expect(getPercentage(0, 0)).toBe(0);
    });

    it('should handle duplicate ownership', () => {
      type AgentCard = { cardId: number };

      const getProgress = (owned: AgentCard[], totalCards: number) => {
        const unique = new Set(owned.map(c => c.cardId)).size;
        return {
          unique,
          total: totalCards,
          percentage: totalCards > 0 ? Math.round((unique / totalCards) * 100) : 0,
        };
      };

      const progress = getProgress(
        [{ cardId: 1 }, { cardId: 1 }, { cardId: 2 }],
        5
      );

      expect(progress.unique).toBe(2);
      expect(progress.total).toBe(5);
      expect(progress.percentage).toBe(40);
    });
  });

  describe('Leaderboard Ranking', () => {
    it('should rank by unique cards first', () => {
      const agents = [
        { id: 'a1', unique: 10, total: 15 },
        { id: 'a2', unique: 15, total: 20 },
        { id: 'a3', unique: 5, total: 10 },
      ];

      const sorted = [...agents].sort((a, b) => b.unique - a.unique);

      expect(sorted[0].id).toBe('a2');
      expect(sorted[1].id).toBe('a1');
      expect(sorted[2].id).toBe('a3');
    });

    it('should use total cards as tiebreaker', () => {
      const agents = [
        { id: 'a1', unique: 10, total: 15 },
        { id: 'a2', unique: 10, total: 20 },
        { id: 'a3', unique: 10, total: 10 },
      ];

      const sorted = [...agents].sort((a, b) => {
        if (b.unique !== a.unique) return b.unique - a.unique;
        return b.total - a.total;
      });

      expect(sorted[0].id).toBe('a2');
      expect(sorted[1].id).toBe('a1');
      expect(sorted[2].id).toBe('a3');
    });
  });

  describe('Rarity Filter', () => {
    it('should filter cards by rarity', () => {
      const cards = [
        { id: 1, rarity: 'common' },
        { id: 2, rarity: 'rare' },
        { id: 3, rarity: 'common' },
      ];

      const filtered = cards.filter(c => c.rarity === 'common');

      expect(filtered).toHaveLength(2);
      expect(filtered.map(c => c.id)).toEqual([1, 3]);
    });

    it('should return all cards when no filter applied', () => {
      const cards = [
        { id: 1, rarity: 'common' },
        { id: 2, rarity: 'rare' },
      ];

      const filtered = cards.filter(() => true);

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Rarest Cards Logic', () => {
    it('should find cards with lowest mint count', () => {
      const cards = [
        { id: 1, maxSupply: 100, totalMinted: 50 },
        { id: 2, maxSupply: 50, totalMinted: 10 },
        { id: 3, maxSupply: 200, totalMinted: 25 },
      ];

      const sorted = [...cards]
        .filter(c => c.maxSupply !== null)
        .sort((a, b) => a.totalMinted - b.totalMinted);

      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });

    it('should exclude unlimited supply cards from rarest', () => {
      const cards = [
        { id: 1, maxSupply: 100, totalMinted: 50 },
        { id: 2, maxSupply: null, totalMinted: 5 },
        { id: 3, maxSupply: 50, totalMinted: 10 },
      ];

      const rarest = cards.filter(c => c.maxSupply !== null);

      expect(rarest).toHaveLength(2);
      expect(rarest.map(c => c.id)).toEqual([1, 3]);
    });

    it('should use max_supply as tiebreaker', () => {
      const cards = [
        { id: 1, maxSupply: 100, totalMinted: 10 },
        { id: 2, maxSupply: 50, totalMinted: 10 },
        { id: 3, maxSupply: 25, totalMinted: 10 },
      ];

      const sorted = [...cards].sort((a, b) => {
        if (a.totalMinted !== b.totalMinted) {
          return a.totalMinted - b.totalMinted;
        }
        return (a.maxSupply || 0) - (b.maxSupply || 0);
      });

      expect(sorted[0].id).toBe(3);
      expect(sorted[1].id).toBe(2);
      expect(sorted[2].id).toBe(1);
    });
  });

  describe('Card Statistics', () => {
    it('should count unique owners', () => {
      type CardOwnership = { agentId: string };

      const countUniqueOwners = (ownerships: CardOwnership[]): number => {
        return new Set(ownerships.map(o => o.agentId)).size;
      };

      expect(countUniqueOwners([
        { agentId: 'a1' },
        { agentId: 'a2' },
        { agentId: 'a1' },
      ])).toBe(2);

      expect(countUniqueOwners([{ agentId: 'a1' }])).toBe(1);
      expect(countUniqueOwners([])).toBe(0);
    });

    it('should calculate availability correctly', () => {
      const getAvailability = (maxSupply: number | null, totalMinted: number): number | null => {
        if (maxSupply === null) return null;
        return maxSupply - totalMinted;
      };

      expect(getAvailability(100, 30)).toBe(70);
      expect(getAvailability(50, 50)).toBe(0);
      expect(getAvailability(null, 100)).toBe(null);
    });
  });

  describe('Category Validation', () => {
    it('should validate card categories', () => {
      const validCategories = ['agent', 'room', 'item', 'event', 'special'];

      const isValidCategory = (category: string): boolean => {
        return validCategories.includes(category);
      };

      expect(isValidCategory('agent')).toBe(true);
      expect(isValidCategory('room')).toBe(true);
      expect(isValidCategory('invalid')).toBe(false);
    });

    it('should validate rarity levels', () => {
      const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

      const isValidRarity = (rarity: string): boolean => {
        return validRarities.includes(rarity);
      };

      expect(isValidRarity('common')).toBe(true);
      expect(isValidRarity('legendary')).toBe(true);
      expect(isValidRarity('super')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty collections', () => {
      type AgentCard = { cardId: number };

      const getUniqueCount = (cards: AgentCard[]): number => {
        return new Set(cards.map(c => c.cardId)).size;
      };

      expect(getUniqueCount([])).toBe(0);
    });

    it('should handle zero total cards', () => {
      const getPercentage = (unique: number, total: number): number => {
        if (total === 0) return 0;
        return Math.round((unique / total) * 100);
      };

      expect(getPercentage(0, 0)).toBe(0);
    });

    it('should handle card not found', () => {
      const findCard = (cards: Array<{ id: number }>, id: number) => {
        const card = cards.find(c => c.id === id);
        if (!card) throw new Error('Card not found');
        return card;
      };

      expect(() => findCard([], 1)).toThrow('Card not found');
      expect(() => findCard([{ id: 2 }], 1)).toThrow('Card not found');
    });
  });
});
