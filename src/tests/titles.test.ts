import { describe, it, expect } from 'vitest';

/**
 * Titles System Unit Tests
 * All tests are fully mocked without database connection
 */

describe('Titles System - Validation & Logic', () => {
  type Title = {
    id: string;
    name: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    requirementType: string | null;
    requirementValue: number;
  };

  type EarnedTitle = Title & {
    agentId: string;
    isActive: boolean;
    earnedAt: string;
  };

  it('should prevent duplicate title awards', () => {
    const earnedTitles: EarnedTitle[] = [
      {
        id: 'title-1',
        name: 'Newcomer',
        rarity: 'common',
        requirementType: 'messages',
        requirementValue: 1,
        agentId: 'agent-123',
        isActive: false,
        earnedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const hasTitle = (agentId: string, titleId: string, earned: EarnedTitle[]): boolean => {
      return earned.some(t => t.agentId === agentId && t.id === titleId);
    };

    expect(hasTitle('agent-123', 'title-1', earnedTitles)).toBe(true);
    expect(hasTitle('agent-123', 'title-2', earnedTitles)).toBe(false);
    expect(hasTitle('agent-456', 'title-1', earnedTitles)).toBe(false);
  });

  it('should only allow one active title at a time', () => {
    const setActiveTitle = (
      agentId: string,
      titleId: string,
      earned: EarnedTitle[]
    ): EarnedTitle[] => {
      return earned.map(t => ({
        ...t,
        isActive: t.agentId === agentId && t.id === titleId,
      }));
    };

    const earnedTitles: EarnedTitle[] = [
      {
        id: 'title-1',
        name: 'Newcomer',
        rarity: 'common',
        requirementType: 'messages',
        requirementValue: 1,
        agentId: 'agent-123',
        isActive: true,
        earnedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'title-2',
        name: 'Trader',
        rarity: 'uncommon',
        requirementType: 'trades',
        requirementValue: 5,
        agentId: 'agent-123',
        isActive: false,
        earnedAt: '2024-01-02T00:00:00Z',
      },
    ];

    const updated = setActiveTitle('agent-123', 'title-2', earnedTitles);
    const activeTitles = updated.filter(t => t.isActive);

    expect(activeTitles).toHaveLength(1);
    expect(activeTitles[0].id).toBe('title-2');
  });

  it('should check eligibility based on requirement value', () => {
    const isEligible = (currentCount: number, requiredCount: number): boolean => {
      return currentCount >= requiredCount;
    };

    expect(isEligible(10, 5)).toBe(true);
    expect(isEligible(5, 5)).toBe(true);
    expect(isEligible(4, 5)).toBe(false);
    expect(isEligible(0, 1)).toBe(false);
    expect(isEligible(100, 50)).toBe(true);
  });

  it('should sort titles by rarity correctly', () => {
    const titles: Title[] = [
      { id: 't1', name: 'Legend', rarity: 'legendary', requirementType: 'manual', requirementValue: 0 },
      { id: 't2', name: 'Newcomer', rarity: 'common', requirementType: 'messages', requirementValue: 1 },
      { id: 't3', name: 'Champion', rarity: 'epic', requirementType: 'games_won', requirementValue: 25 },
      { id: 't4', name: 'Trader', rarity: 'uncommon', requirementType: 'trades', requirementValue: 5 },
      { id: 't5', name: 'Generous', rarity: 'rare', requirementType: 'gifts_sent', requirementValue: 20 },
    ];

    const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
    const sorted = [...titles].sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

    expect(sorted.map(t => t.rarity)).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary']);
  });

  it('should filter titles by rarity', () => {
    const titles: Title[] = [
      { id: 't1', name: 'Newcomer', rarity: 'common', requirementType: 'messages', requirementValue: 1 },
      { id: 't2', name: 'Trader', rarity: 'uncommon', requirementType: 'trades', requirementValue: 5 },
      { id: 't3', name: 'Legend', rarity: 'legendary', requirementType: 'manual', requirementValue: 0 },
      { id: 't4', name: 'Generous', rarity: 'rare', requirementType: 'gifts_sent', requirementValue: 20 },
    ];

    const filterByRarity = (titles: Title[], rarity: Title['rarity']): Title[] => {
      return titles.filter(t => t.rarity === rarity);
    };

    expect(filterByRarity(titles, 'common')).toHaveLength(1);
    expect(filterByRarity(titles, 'uncommon')).toHaveLength(1);
    expect(filterByRarity(titles, 'rare')).toHaveLength(1);
    expect(filterByRarity(titles, 'legendary')).toHaveLength(1);
    expect(filterByRarity(titles, 'epic')).toHaveLength(0);
  });

  it('should validate requirement types', () => {
    const validTypes = ['messages', 'trades', 'friends', 'rooms_created', 'games_won', 'photos', 'gifts_sent', 'manual'];

    const isValidRequirementType = (type: string): boolean => {
      return validTypes.includes(type);
    };

    expect(isValidRequirementType('messages')).toBe(true);
    expect(isValidRequirementType('trades')).toBe(true);
    expect(isValidRequirementType('manual')).toBe(true);
    expect(isValidRequirementType('invalid')).toBe(false);
    expect(isValidRequirementType('')).toBe(false);
  });

  it('should prevent activating unearned titles', () => {
    const canActivate = (agentId: string, titleId: string, earned: EarnedTitle[]): boolean => {
      return earned.some(t => t.agentId === agentId && t.id === titleId);
    };

    const earnedTitles: EarnedTitle[] = [
      {
        id: 'title-1',
        name: 'Newcomer',
        rarity: 'common',
        requirementType: 'messages',
        requirementValue: 1,
        agentId: 'agent-123',
        isActive: false,
        earnedAt: '2024-01-01T00:00:00Z',
      },
    ];

    expect(canActivate('agent-123', 'title-1', earnedTitles)).toBe(true);
    expect(canActivate('agent-123', 'title-999', earnedTitles)).toBe(false);
    expect(canActivate('agent-456', 'title-1', earnedTitles)).toBe(false);
  });

  it('should calculate progress percentage correctly', () => {
    const calculateProgress = (current: number, required: number): number => {
      if (required === 0) return 100;
      return Math.min(100, Math.round((current / required) * 100));
    };

    expect(calculateProgress(5, 10)).toBe(50);
    expect(calculateProgress(10, 10)).toBe(100);
    expect(calculateProgress(15, 10)).toBe(100);
    expect(calculateProgress(0, 10)).toBe(0);
    expect(calculateProgress(7, 10)).toBe(70);
  });

  it('should format title display correctly', () => {
    const formatTitleDisplay = (name: string, icon: string): string => {
      return `${icon} ${name}`;
    };

    expect(formatTitleDisplay('Newcomer', '👋')).toBe('👋 Newcomer');
    expect(formatTitleDisplay('Legend', '⭐')).toBe('⭐ Legend');
    expect(formatTitleDisplay('Trader', '🤝')).toBe('🤝 Trader');
  });

  it('should count total earned titles per agent', () => {
    const earnedTitles: EarnedTitle[] = [
      {
        id: 'title-1',
        name: 'Newcomer',
        rarity: 'common',
        requirementType: 'messages',
        requirementValue: 1,
        agentId: 'agent-123',
        isActive: false,
        earnedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'title-2',
        name: 'Trader',
        rarity: 'uncommon',
        requirementType: 'trades',
        requirementValue: 5,
        agentId: 'agent-123',
        isActive: false,
        earnedAt: '2024-01-02T00:00:00Z',
      },
      {
        id: 'title-1',
        name: 'Newcomer',
        rarity: 'common',
        requirementType: 'messages',
        requirementValue: 1,
        agentId: 'agent-456',
        isActive: false,
        earnedAt: '2024-01-01T00:00:00Z',
      },
    ];

    const countTitlesForAgent = (agentId: string, titles: EarnedTitle[]): number => {
      return titles.filter(t => t.agentId === agentId).length;
    };

    expect(countTitlesForAgent('agent-123', earnedTitles)).toBe(2);
    expect(countTitlesForAgent('agent-456', earnedTitles)).toBe(1);
    expect(countTitlesForAgent('agent-789', earnedTitles)).toBe(0);
  });

  it('should get active title for agent', () => {
    const earnedTitles: EarnedTitle[] = [
      {
        id: 'title-1',
        name: 'Newcomer',
        rarity: 'common',
        requirementType: 'messages',
        requirementValue: 1,
        agentId: 'agent-123',
        isActive: false,
        earnedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'title-2',
        name: 'Trader',
        rarity: 'uncommon',
        requirementType: 'trades',
        requirementValue: 5,
        agentId: 'agent-123',
        isActive: true,
        earnedAt: '2024-01-02T00:00:00Z',
      },
    ];

    const getActiveTitle = (agentId: string, titles: EarnedTitle[]): EarnedTitle | null => {
      return titles.find(t => t.agentId === agentId && t.isActive) || null;
    };

    const active = getActiveTitle('agent-123', earnedTitles);
    expect(active).not.toBeNull();
    expect(active?.id).toBe('title-2');
    expect(active?.name).toBe('Trader');

    const noActive = getActiveTitle('agent-456', earnedTitles);
    expect(noActive).toBeNull();
  });

  it('should identify manual vs automatic titles', () => {
    const isManualTitle = (requirementType: string | null): boolean => {
      return requirementType === 'manual' || requirementType === null;
    };

    expect(isManualTitle('manual')).toBe(true);
    expect(isManualTitle(null)).toBe(true);
    expect(isManualTitle('messages')).toBe(false);
    expect(isManualTitle('trades')).toBe(false);
  });

  it('should filter non-manual titles for eligibility check', () => {
    const titles: Title[] = [
      { id: 't1', name: 'Newcomer', rarity: 'common', requirementType: 'messages', requirementValue: 1 },
      { id: 't2', name: 'Legend', rarity: 'legendary', requirementType: 'manual', requirementValue: 0 },
      { id: 't3', name: 'Trader', rarity: 'uncommon', requirementType: 'trades', requirementValue: 5 },
    ];

    const getAutoAwardableTitles = (titles: Title[]): Title[] => {
      return titles.filter(t => t.requirementType !== 'manual' && t.requirementType !== null);
    };

    const autoAwardable = getAutoAwardableTitles(titles);
    expect(autoAwardable).toHaveLength(2);
    expect(autoAwardable.map(t => t.id)).toEqual(['t1', 't3']);
  });

  it('should sort earned titles by date descending', () => {
    const earnedTitles: EarnedTitle[] = [
      {
        id: 'title-1',
        name: 'Newcomer',
        rarity: 'common',
        requirementType: 'messages',
        requirementValue: 1,
        agentId: 'agent-123',
        isActive: false,
        earnedAt: '2024-01-01T10:00:00Z',
      },
      {
        id: 'title-2',
        name: 'Trader',
        rarity: 'uncommon',
        requirementType: 'trades',
        requirementValue: 5,
        agentId: 'agent-123',
        isActive: false,
        earnedAt: '2024-01-03T10:00:00Z',
      },
      {
        id: 'title-3',
        name: 'Architect',
        rarity: 'uncommon',
        requirementType: 'rooms_created',
        requirementValue: 3,
        agentId: 'agent-123',
        isActive: false,
        earnedAt: '2024-01-02T10:00:00Z',
      },
    ];

    const sorted = [...earnedTitles].sort(
      (a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime()
    );

    expect(sorted.map(t => t.id)).toEqual(['title-2', 'title-3', 'title-1']);
  });

  it('should validate title name uniqueness', () => {
    const titles: Title[] = [
      { id: 't1', name: 'Newcomer', rarity: 'common', requirementType: 'messages', requirementValue: 1 },
      { id: 't2', name: 'Trader', rarity: 'uncommon', requirementType: 'trades', requirementValue: 5 },
    ];

    const hasUniqueName = (name: string, titles: Title[]): boolean => {
      return titles.filter(t => t.name === name).length <= 1;
    };

    expect(hasUniqueName('Newcomer', titles)).toBe(true);
    expect(hasUniqueName('Legend', titles)).toBe(true);

    titles.push({ id: 't3', name: 'Newcomer', rarity: 'rare', requirementType: 'manual', requirementValue: 0 });
    expect(hasUniqueName('Newcomer', titles)).toBe(false);
  });
});
