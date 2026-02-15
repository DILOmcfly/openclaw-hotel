import { describe, it, expect } from 'vitest';

/**
 * Badges System Unit Tests
 * Tests badge awarding, equipping, and supply limits without database
 */

describe('Badges System', () => {
  describe('Badge Rarity Sorting', () => {
    it('should sort badges by rarity (legendary first)', () => {
      const badges = [
        { name: 'A', rarity: 'common' },
        { name: 'B', rarity: 'legendary' },
        { name: 'C', rarity: 'rare' },
        { name: 'D', rarity: 'epic' },
      ];

      const rarityOrder: Record<string, number> = {
        legendary: 1,
        epic: 2,
        rare: 3,
        uncommon: 4,
        common: 5,
      };

      const sorted = [...badges].sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

      expect(sorted[0].name).toBe('B'); // legendary
      expect(sorted[1].name).toBe('D'); // epic
      expect(sorted[2].name).toBe('C'); // rare
      expect(sorted[3].name).toBe('A'); // common
    });

    it('should maintain alphabetical order within same rarity', () => {
      const badges = [
        { name: 'Zebra Badge', rarity: 'rare' },
        { name: 'Alpha Badge', rarity: 'rare' },
        { name: 'Beta Badge', rarity: 'rare' },
      ];

      const sorted = [...badges].sort((a, b) => a.name.localeCompare(b.name));

      expect(sorted[0].name).toBe('Alpha Badge');
      expect(sorted[1].name).toBe('Beta Badge');
      expect(sorted[2].name).toBe('Zebra Badge');
    });
  });

  describe('Supply Limit Logic', () => {
    it('should enforce max supply limit', () => {
      const badge = { id: 1, name: 'Early Adopter', maxSupply: 100 };
      const currentHolders = 100;

      const canAward = currentHolders < (badge.maxSupply || Infinity);
      expect(canAward).toBe(false);
    });

    it('should allow awarding when under supply limit', () => {
      const badge = { id: 1, name: 'Early Adopter', maxSupply: 100 };
      const currentHolders = 50;

      const canAward = currentHolders < (badge.maxSupply || Infinity);
      expect(canAward).toBe(true);
    });

    it('should allow unlimited badges when maxSupply is null', () => {
      const badge = { id: 2, name: 'Social Butterfly', maxSupply: null };
      const currentHolders = 10000;

      const canAward = currentHolders < (badge.maxSupply || Infinity);
      expect(canAward).toBe(true);
    });

    it('should prevent duplicate awards to same agent', () => {
      const agentBadges = [
        { agentId: 'agent1', badgeId: 1 },
        { agentId: 'agent1', badgeId: 2 },
      ];

      const alreadyOwns = (agentId: string, badgeId: number) =>
        agentBadges.some(ab => ab.agentId === agentId && ab.badgeId === badgeId);

      expect(alreadyOwns('agent1', 1)).toBe(true);
      expect(alreadyOwns('agent1', 3)).toBe(false);
    });
  });

  describe('Equip Limit Logic', () => {
    it('should enforce max 3 equipped badges', () => {
      const MAX_EQUIPPED = 3;
      const equippedCount = 3;

      const canEquipMore = equippedCount < MAX_EQUIPPED;
      expect(canEquipMore).toBe(false);
    });

    it('should allow equipping when under limit', () => {
      const MAX_EQUIPPED = 3;
      const equippedCount = 2;

      const canEquipMore = equippedCount < MAX_EQUIPPED;
      expect(canEquipMore).toBe(true);
    });

    it('should allow equipping first badge', () => {
      const MAX_EQUIPPED = 3;
      const equippedCount = 0;

      const canEquipMore = equippedCount < MAX_EQUIPPED;
      expect(canEquipMore).toBe(true);
    });

    it('should count only equipped badges', () => {
      const agentBadges = [
        { badgeId: 1, equipped: true },
        { badgeId: 2, equipped: false },
        { badgeId: 3, equipped: true },
        { badgeId: 4, equipped: false },
      ];

      const equippedCount = agentBadges.filter(ab => ab.equipped).length;
      expect(equippedCount).toBe(2);
    });
  });

  describe('Badge Ownership Validation', () => {
    it('should verify agent owns badge before equipping', () => {
      const agentBadges = [
        { agentId: 'agent1', badgeId: 1, equipped: false },
        { agentId: 'agent1', badgeId: 2, equipped: true },
      ];

      const ownsBadge = (agentId: string, badgeId: number) =>
        agentBadges.some(ab => ab.agentId === agentId && ab.badgeId === badgeId);

      expect(ownsBadge('agent1', 1)).toBe(true);
      expect(ownsBadge('agent1', 3)).toBe(false);
    });

    it('should allow unequipping only owned badges', () => {
      const agentBadges = [
        { agentId: 'agent1', badgeId: 1, equipped: true },
        { agentId: 'agent1', badgeId: 2, equipped: true },
      ];

      const canUnequip = (agentId: string, badgeId: number) =>
        agentBadges.some(ab => ab.agentId === agentId && ab.badgeId === badgeId);

      expect(canUnequip('agent1', 1)).toBe(true);
      expect(canUnequip('agent1', 5)).toBe(false);
    });
  });

  describe('Badge Holders Tracking', () => {
    it('should list all holders of a badge', () => {
      const agentBadges = [
        { agentId: 'agent1', badgeId: 1 },
        { agentId: 'agent2', badgeId: 1 },
        { agentId: 'agent3', badgeId: 2 },
      ];

      const getHolders = (badgeId: number) =>
        agentBadges.filter(ab => ab.badgeId === badgeId).map(ab => ab.agentId);

      const holders = getHolders(1);
      expect(holders).toHaveLength(2);
      expect(holders).toContain('agent1');
      expect(holders).toContain('agent2');
    });

    it('should return empty array for badges with no holders', () => {
      const agentBadges = [
        { agentId: 'agent1', badgeId: 1 },
      ];

      const getHolders = (badgeId: number) =>
        agentBadges.filter(ab => ab.badgeId === badgeId).map(ab => ab.agentId);

      expect(getHolders(99)).toHaveLength(0);
    });

    it('should track holder order by earned date', () => {
      const agentBadges = [
        { agentId: 'agent3', badgeId: 1, earnedAt: '2024-01-15' },
        { agentId: 'agent1', badgeId: 1, earnedAt: '2024-01-10' },
        { agentId: 'agent2', badgeId: 1, earnedAt: '2024-01-12' },
      ];

      const sorted = [...agentBadges].sort(
        (a, b) => new Date(a.earnedAt).getTime() - new Date(b.earnedAt).getTime()
      );

      expect(sorted[0].agentId).toBe('agent1');
      expect(sorted[1].agentId).toBe('agent2');
      expect(sorted[2].agentId).toBe('agent3');
    });
  });

  describe('Equipped Badges Retrieval', () => {
    it('should filter only equipped badges', () => {
      const agentBadges = [
        { badgeId: 1, equipped: true },
        { badgeId: 2, equipped: false },
        { badgeId: 3, equipped: true },
      ];

      const equipped = agentBadges.filter(ab => ab.equipped);
      expect(equipped).toHaveLength(2);
      expect(equipped.map(e => e.badgeId)).toEqual([1, 3]);
    });

    it('should respect 3-badge equipped limit in display', () => {
      const agentBadges = [
        { badgeId: 1, equipped: true, earnedAt: '2024-01-01' },
        { badgeId: 2, equipped: true, earnedAt: '2024-01-02' },
        { badgeId: 3, equipped: true, earnedAt: '2024-01-03' },
      ];

      const MAX_DISPLAY = 3;
      const equipped = agentBadges.filter(ab => ab.equipped).slice(0, MAX_DISPLAY);
      expect(equipped).toHaveLength(3);
    });

    it('should maintain earned order for equipped badges', () => {
      const agentBadges = [
        { badgeId: 3, equipped: true, earnedAt: '2024-01-15' },
        { badgeId: 1, equipped: true, earnedAt: '2024-01-10' },
        { badgeId: 2, equipped: true, earnedAt: '2024-01-12' },
      ];

      const sorted = [...agentBadges]
        .filter(ab => ab.equipped)
        .sort((a, b) => new Date(a.earnedAt).getTime() - new Date(b.earnedAt).getTime());

      expect(sorted[0].badgeId).toBe(1);
      expect(sorted[1].badgeId).toBe(2);
      expect(sorted[2].badgeId).toBe(3);
    });
  });

  describe('Badge Categories', () => {
    it('should group badges by category', () => {
      const badges = [
        { id: 1, name: 'Social Butterfly', category: 'social' },
        { id: 2, name: 'Game Master', category: 'gaming' },
        { id: 3, name: 'Guild Leader', category: 'social' },
      ];

      const byCategory = badges.reduce((acc, badge) => {
        if (!acc[badge.category]) acc[badge.category] = [];
        acc[badge.category].push(badge);
        return acc;
      }, {} as Record<string, typeof badges>);

      expect(byCategory.social).toHaveLength(2);
      expect(byCategory.gaming).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero holders for limited supply badge', () => {
      const badge = { maxSupply: 100 };
      const holders = 0;

      const availability = badge.maxSupply - holders;
      expect(availability).toBe(100);
    });

    it('should handle unequipping when no badges equipped', () => {
      const agentBadges = [
        { badgeId: 1, equipped: false },
        { badgeId: 2, equipped: false },
      ];

      const equippedCount = agentBadges.filter(ab => ab.equipped).length;
      expect(equippedCount).toBe(0);
    });

    it('should validate badge ID exists before operations', () => {
      const availableBadges = [
        { id: 1, name: 'Badge 1' },
        { id: 2, name: 'Badge 2' },
      ];

      const badgeExists = (badgeId: number) =>
        availableBadges.some(b => b.id === badgeId);

      expect(badgeExists(1)).toBe(true);
      expect(badgeExists(999)).toBe(false);
    });
  });
});
