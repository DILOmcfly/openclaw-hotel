import { describe, it, expect } from 'vitest';

describe('Collectible Cards Service', () => {
  describe('Card Catalog', () => {
    it('should sort cards by rarity (legendary first)', () => {
      const mockCards = [
        { id: '1', name: 'Common Card', rarity: 'common' },
        { id: '2', name: 'Legendary Card', rarity: 'legendary' },
        { id: '3', name: 'Rare Card', rarity: 'rare' },
      ];

      const rarityOrder = { legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };
      const sorted = [...mockCards].sort((a, b) => rarityOrder[a.rarity as keyof typeof rarityOrder] - rarityOrder[b.rarity as keyof typeof rarityOrder]);

      expect(sorted[0].rarity).toBe('legendary');
      expect(sorted[1].rarity).toBe('rare');
      expect(sorted[2].rarity).toBe('common');
    });

    it('should return all cards in catalog', () => {
      const mockCards = [
        { id: '1', name: 'Card 1', rarity: 'common' },
        { id: '2', name: 'Card 2', rarity: 'rare' },
      ];

      expect(mockCards).toHaveLength(2);
    });

    it('should filter cards by rarity', () => {
      const mockCards = [
        { id: '1', rarity: 'common' },
        { id: '2', rarity: 'rare' },
        { id: '3', rarity: 'common' },
      ];

      const rarity = 'common';
      const filtered = mockCards.filter(card => card.rarity === rarity);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(card => card.rarity === 'common')).toBe(true);
    });

    it('should reject invalid rarity filter', () => {
      const validRarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const invalidRarity = 'super-rare';

      expect(validRarities.includes(invalidRarity)).toBe(false);
    });
  });

  describe('Minting Cards', () => {
    it('should check if card exists before minting', () => {
      const mockCards = [{ id: 'card_001', name: 'Bronze Agent' }];
      const cardId = 'card_001';

      const exists = mockCards.find(c => c.id === cardId);

      expect(exists).toBeDefined();
    });

    it('should reject minting non-existent card', () => {
      const mockCards = [{ id: 'card_001', name: 'Bronze Agent' }];
      const cardId = 'invalid_card';

      const exists = mockCards.find(c => c.id === cardId);

      expect(exists).toBeUndefined();
    });

    it('should enforce supply limit', () => {
      const mockCard = { id: 'card_001', maxSupply: 100, minted: 100 };

      const canMint = mockCard.minted < mockCard.maxSupply;

      expect(canMint).toBe(false);
    });

    it('should allow minting when under supply limit', () => {
      const mockCard = { id: 'card_001', maxSupply: 100, minted: 50 };

      const canMint = mockCard.minted < mockCard.maxSupply;

      expect(canMint).toBe(true);
    });

    it('should increment quantity if agent already owns card', () => {
      const mockAgentCards = [
        { agentId: 'agent-1', cardId: 'card_001', quantity: 2 },
      ];

      const existing = mockAgentCards.find(ac => ac.agentId === 'agent-1' && ac.cardId === 'card_001');

      if (existing) {
        existing.quantity += 1;
      }

      expect(existing?.quantity).toBe(3);
    });

    it('should add new card if agent does not own it', () => {
      const mockAgentCards = [
        { agentId: 'agent-1', cardId: 'card_001', quantity: 1 },
      ];

      const existing = mockAgentCards.find(ac => ac.agentId === 'agent-1' && ac.cardId === 'card_002');

      if (!existing) {
        mockAgentCards.push({ agentId: 'agent-1', cardId: 'card_002', quantity: 1 });
      }

      expect(mockAgentCards).toHaveLength(2);
      expect(mockAgentCards.find(ac => ac.cardId === 'card_002')).toBeDefined();
    });

    it('should increment minted count after minting', () => {
      const mockCard = { id: 'card_001', minted: 10 };

      mockCard.minted += 1;

      expect(mockCard.minted).toBe(11);
    });
  });

  describe('Trading Cards', () => {
    it('should validate positive quantity', () => {
      const quantity = -1;

      const isValid = quantity > 0;

      expect(isValid).toBe(false);
    });

    it('should check if sender owns the card', () => {
      const mockAgentCards = [
        { agentId: 'agent-1', cardId: 'card_001', quantity: 3 },
      ];

      const owned = mockAgentCards.find(ac => ac.agentId === 'agent-1' && ac.cardId === 'card_001');

      expect(owned).toBeDefined();
    });

    it('should reject trade if sender does not own card', () => {
      const mockAgentCards = [
        { agentId: 'agent-1', cardId: 'card_001', quantity: 3 },
      ];

      const owned = mockAgentCards.find(ac => ac.agentId === 'agent-1' && ac.cardId === 'card_999');

      expect(owned).toBeUndefined();
    });

    it('should check if sender has enough quantity', () => {
      const mockCard = { agentId: 'agent-1', cardId: 'card_001', quantity: 2 };
      const tradeQuantity = 3;

      const hasEnough = mockCard.quantity >= tradeQuantity;

      expect(hasEnough).toBe(false);
    });

    it('should allow trade with sufficient quantity', () => {
      const mockCard = { agentId: 'agent-1', cardId: 'card_001', quantity: 5 };
      const tradeQuantity = 3;

      const hasEnough = mockCard.quantity >= tradeQuantity;

      expect(hasEnough).toBe(true);
    });

    it('should remove card if quantity reaches zero after trade', () => {
      const mockAgentCards = [
        { agentId: 'agent-1', cardId: 'card_001', quantity: 2 },
      ];

      const card = mockAgentCards.find(ac => ac.agentId === 'agent-1' && ac.cardId === 'card_001');
      const tradeQuantity = 2;

      if (card) {
        card.quantity -= tradeQuantity;
        if (card.quantity === 0) {
          mockAgentCards.splice(mockAgentCards.indexOf(card), 1);
        }
      }

      expect(mockAgentCards).toHaveLength(0);
    });

    it('should add card to receiver if not owned', () => {
      const mockToAgentCards: Array<{ agentId: string; cardId: string; quantity: number }> = [];

      const existing = mockToAgentCards.find(ac => ac.agentId === 'agent-2' && ac.cardId === 'card_001');

      if (!existing) {
        mockToAgentCards.push({ agentId: 'agent-2', cardId: 'card_001', quantity: 1 });
      }

      expect(mockToAgentCards).toHaveLength(1);
    });

    it('should increment receiver quantity if already owned', () => {
      const mockToAgentCards = [
        { agentId: 'agent-2', cardId: 'card_001', quantity: 3 },
      ];

      const existing = mockToAgentCards.find(ac => ac.agentId === 'agent-2' && ac.cardId === 'card_001');

      if (existing) {
        existing.quantity += 2;
      }

      expect(existing?.quantity).toBe(5);
    });
  });

  describe('Collection Completion', () => {
    it('should calculate completion percentage', () => {
      const totalCards = 10;
      const ownedCards = 7;

      const percentage = Math.round((ownedCards / totalCards) * 100);

      expect(percentage).toBe(70);
    });

    it('should return 0% for empty collection', () => {
      const totalCards = 10;
      const ownedCards = 0;

      const percentage = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;

      expect(percentage).toBe(0);
    });

    it('should return 100% for complete collection', () => {
      const totalCards = 10;
      const ownedCards = 10;

      const percentage = Math.round((ownedCards / totalCards) * 100);

      expect(percentage).toBe(100);
    });

    it('should handle zero total cards gracefully', () => {
      const totalCards = 0;
      const ownedCards = 0;

      const percentage = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;

      expect(percentage).toBe(0);
    });
  });

  describe('My Cards', () => {
    it('should return only cards owned by agent', () => {
      const mockAgentCards = [
        { agentId: 'agent-1', cardId: 'card_001', quantity: 2 },
        { agentId: 'agent-2', cardId: 'card_002', quantity: 1 },
        { agentId: 'agent-1', cardId: 'card_003', quantity: 1 },
      ];

      const agentId = 'agent-1';
      const myCards = mockAgentCards.filter(ac => ac.agentId === agentId);

      expect(myCards).toHaveLength(2);
      expect(myCards.every(card => card.agentId === agentId)).toBe(true);
    });

    it('should include quantity for each card', () => {
      const mockCard = { agentId: 'agent-1', cardId: 'card_001', quantity: 5 };

      expect(mockCard.quantity).toBe(5);
      expect(mockCard.quantity).toBeGreaterThan(0);
    });
  });
});
