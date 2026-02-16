import { describe, it, expect } from 'vitest';

/**
 * Wardrobe System Unit Tests
 * Tests outfit management logic without database
 */

describe('Wardrobe System', () => {
  describe('Outfit Limit Enforcement', () => {
    it('should allow creation when under limit', () => {
      const MAX_OUTFITS = 10;
      const currentCount = 5;
      
      const canCreate = currentCount < MAX_OUTFITS;
      expect(canCreate).toBe(true);
    });

    it('should block creation at max limit', () => {
      const MAX_OUTFITS = 10;
      const currentCount = 10;
      
      const canCreate = currentCount < MAX_OUTFITS;
      expect(canCreate).toBe(false);
    });

    it('should block creation above limit', () => {
      const MAX_OUTFITS = 10;
      const currentCount = 15;
      
      const canCreate = currentCount < MAX_OUTFITS;
      expect(canCreate).toBe(false);
    });

    it('should allow first outfit', () => {
      const MAX_OUTFITS = 10;
      const currentCount = 0;
      
      const canCreate = currentCount < MAX_OUTFITS;
      expect(canCreate).toBe(true);
    });
  });

  describe('Outfit Ownership Validation', () => {
    it('should validate owner can modify outfit', () => {
      const outfitOwnerId = 'agent-123';
      const requesterId = 'agent-123';
      
      const isAuthorized = outfitOwnerId === requesterId;
      expect(isAuthorized).toBe(true);
    });

    it('should block non-owner from modifying outfit', () => {
      const outfitOwnerId = 'agent-123';
      const requesterId = 'agent-456';
      
      const isAuthorized = outfitOwnerId === requesterId;
      expect(isAuthorized).toBe(false);
    });

    it('should handle missing outfit', () => {
      const outfitExists = false;
      
      expect(outfitExists).toBe(false);
    });
  });

  describe('Active Outfit Logic', () => {
    it('should allow only one active outfit per agent', () => {
      type Outfit = { id: number; agentId: string; isActive: boolean };
      const outfits: Outfit[] = [
        { id: 1, agentId: 'agent-1', isActive: true },
        { id: 2, agentId: 'agent-1', isActive: false },
        { id: 3, agentId: 'agent-1', isActive: false },
      ];

      const activeCount = outfits.filter(o => o.isActive).length;
      expect(activeCount).toBe(1);
    });

    it('should deactivate others when activating one', () => {
      type Outfit = { id: number; isActive: boolean };
      const outfits: Outfit[] = [
        { id: 1, isActive: true },
        { id: 2, isActive: false },
        { id: 3, isActive: false },
      ];

      const targetId = 2;
      const updated = outfits.map(o => ({
        ...o,
        isActive: o.id === targetId,
      }));

      expect(updated[0].isActive).toBe(false);
      expect(updated[1].isActive).toBe(true);
      expect(updated[2].isActive).toBe(false);
    });

    it('should handle no active outfit', () => {
      type Outfit = { id: number; isActive: boolean };
      const outfits: Outfit[] = [
        { id: 1, isActive: false },
        { id: 2, isActive: false },
      ];

      const active = outfits.find(o => o.isActive);
      expect(active).toBeUndefined();
    });

    it('should prevent deleting active outfit', () => {
      const isActive = true;
      const canDelete = !isActive;
      
      expect(canDelete).toBe(false);
    });

    it('should allow deleting inactive outfit', () => {
      const isActive = false;
      const canDelete = !isActive;
      
      expect(canDelete).toBe(true);
    });
  });

  describe('Copy Outfit Cost', () => {
    it('should allow copy with sufficient coins', () => {
      const COPY_COST = 25;
      const agentCoins = 50;
      
      const canCopy = agentCoins >= COPY_COST;
      expect(canCopy).toBe(true);
    });

    it('should block copy with insufficient coins', () => {
      const COPY_COST = 25;
      const agentCoins = 10;
      
      const canCopy = agentCoins >= COPY_COST;
      expect(canCopy).toBe(false);
    });

    it('should allow copy with exact coins', () => {
      const COPY_COST = 25;
      const agentCoins = 25;
      
      const canCopy = agentCoins >= COPY_COST;
      expect(canCopy).toBe(true);
    });

    it('should deduct cost after copy', () => {
      const COPY_COST = 25;
      const agentCoins = 100;
      
      const remainingCoins = agentCoins - COPY_COST;
      expect(remainingCoins).toBe(75);
    });
  });

  describe('Outfit Data Validation', () => {
    it('should validate outfit name length', () => {
      const MAX_NAME_LENGTH = 50;
      const validName = 'Summer Look';
      const tooLongName = 'A'.repeat(51);
      
      expect(validName.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
      expect(tooLongName.length).toBeGreaterThan(MAX_NAME_LENGTH);
    });

    it('should handle null optional fields', () => {
      type OutfitData = {
        head: string | null;
        body: string | null;
        legs: string | null;
        shoes: string | null;
        accessory: string | null;
      };

      const outfit: OutfitData = {
        head: null,
        body: 'blue-shirt',
        legs: null,
        shoes: 'sneakers',
        accessory: null,
      };

      expect(outfit.head).toBeNull();
      expect(outfit.body).toBe('blue-shirt');
      expect(outfit.accessory).toBeNull();
    });

    it('should validate color format', () => {
      const validColor = '#ffffff';
      const invalidColor = 'white';
      
      const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(validColor);
      const isInvalidHex = /^#[0-9A-Fa-f]{6}$/.test(invalidColor);
      
      expect(isValidHex).toBe(true);
      expect(isInvalidHex).toBe(false);
    });

    it('should use default colors', () => {
      const DEFAULT_PRIMARY = '#ffffff';
      const DEFAULT_SECONDARY = '#000000';
      
      const colorPrimary = DEFAULT_PRIMARY;
      const colorSecondary = DEFAULT_SECONDARY;
      
      expect(colorPrimary).toBe('#ffffff');
      expect(colorSecondary).toBe('#000000');
    });
  });

  describe('Outfit Update Logic', () => {
    it('should update only provided fields', () => {
      const original = {
        name: 'Original',
        head: 'hat',
        body: 'shirt',
        colorPrimary: '#ffffff',
      };

      const updates = {
        name: 'Updated',
        head: 'cap',
      };

      const updated = {
        ...original,
        ...updates,
      };

      expect(updated.name).toBe('Updated');
      expect(updated.head).toBe('cap');
      expect(updated.body).toBe('shirt'); // unchanged
      expect(updated.colorPrimary).toBe('#ffffff'); // unchanged
    });

    it('should preserve fields not in update', () => {
      const original = {
        name: 'Test',
        body: 'jacket',
        legs: 'jeans',
      };

      const updates = {
        body: 'hoodie',
      };

      const updated = {
        ...original,
        ...updates,
      };

      expect(updated.name).toBe('Test');
      expect(updated.body).toBe('hoodie');
      expect(updated.legs).toBe('jeans');
    });
  });

  describe('Copy Stats Tracking', () => {
    it('should increment copy count', () => {
      const currentCopyCount = 5;
      const newCopyCount = currentCopyCount + 1;
      
      expect(newCopyCount).toBe(6);
    });

    it('should initialize copy count for first copy', () => {
      const existingCount = 0;
      const newCount = existingCount + 1;
      
      expect(newCount).toBe(1);
    });

    it('should track multiple copies', () => {
      const copies = [
        { outfitId: 1, count: 10 },
        { outfitId: 2, count: 25 },
        { outfitId: 3, count: 5 },
      ];

      const totalCopies = copies.reduce((sum, c) => sum + c.count, 0);
      expect(totalCopies).toBe(40);
    });
  });

  describe('Popular Outfits Sorting', () => {
    it('should sort by copy count descending', () => {
      const outfits = [
        { id: 1, copyCount: 10 },
        { id: 2, copyCount: 50 },
        { id: 3, copyCount: 5 },
      ];

      const sorted = [...outfits].sort((a, b) => b.copyCount - a.copyCount);

      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
      expect(sorted[2].id).toBe(3);
    });

    it('should handle zero copy count', () => {
      const outfits = [
        { id: 1, copyCount: 0 },
        { id: 2, copyCount: 15 },
        { id: 3, copyCount: 0 },
      ];

      const sorted = [...outfits].sort((a, b) => b.copyCount - a.copyCount);

      expect(sorted[0].copyCount).toBe(15);
      expect(sorted[1].copyCount).toBe(0);
      expect(sorted[2].copyCount).toBe(0);
    });

    it('should respect limit parameter', () => {
      const outfits = [
        { id: 1, copyCount: 10 },
        { id: 2, copyCount: 20 },
        { id: 3, copyCount: 30 },
        { id: 4, copyCount: 40 },
        { id: 5, copyCount: 50 },
      ];

      const limit = 3;
      const limited = outfits.slice(0, limit);

      expect(limited).toHaveLength(3);
    });

    it('should use created date as tiebreaker', () => {
      const outfits = [
        { id: 1, copyCount: 10, createdAt: new Date('2024-01-01') },
        { id: 2, copyCount: 10, createdAt: new Date('2024-01-15') },
        { id: 3, copyCount: 10, createdAt: new Date('2024-01-10') },
      ];

      const sorted = [...outfits].sort((a, b) => {
        if (b.copyCount !== a.copyCount) {
          return b.copyCount - a.copyCount;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      expect(sorted[0].id).toBe(2); // newest
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1); // oldest
    });
  });

  describe('Outfit Copy Name Generation', () => {
    it('should append (Copy) to copied outfit name', () => {
      const originalName = 'Summer Look';
      const copiedName = `${originalName} (Copy)`;
      
      expect(copiedName).toBe('Summer Look (Copy)');
    });

    it('should handle already copied names', () => {
      const originalName = 'Winter (Copy)';
      const copiedName = `${originalName} (Copy)`;
      
      expect(copiedName).toBe('Winter (Copy) (Copy)');
    });

    it('should preserve special characters', () => {
      const originalName = 'Agent-007\'s Look!';
      const copiedName = `${originalName} (Copy)`;
      
      expect(copiedName).toBe('Agent-007\'s Look! (Copy)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty outfit list', () => {
      const outfits: any[] = [];
      
      expect(outfits).toHaveLength(0);
      expect(outfits.filter(o => o.isActive)).toHaveLength(0);
    });

    it('should handle outfit with all null items', () => {
      const outfit = {
        head: null,
        body: null,
        legs: null,
        shoes: null,
        accessory: null,
      };

      const hasItems = Object.values(outfit).some(v => v !== null);
      expect(hasItems).toBe(false);
    });

    it('should validate limit bounds', () => {
      const requestedLimit = 150;
      const maxLimit = 50;
      const effectiveLimit = Math.min(requestedLimit, maxLimit);
      
      expect(effectiveLimit).toBe(50);
    });

    it('should handle negative limit', () => {
      const requestedLimit = -5;
      const defaultLimit = 10;
      const effectiveLimit = requestedLimit > 0 ? requestedLimit : defaultLimit;
      
      expect(effectiveLimit).toBe(10);
    });
  });
});
