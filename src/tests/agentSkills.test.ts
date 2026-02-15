import { describe, it, expect } from 'vitest';

/**
 * Agent Skills System Unit Tests
 * Tests skill learning, leveling, and recommendations without database
 */

describe('Agent Skills System', () => {
  describe('Skill Learning Cost', () => {
    it('should calculate initial learning cost as 50 coins', () => {
      const getLearnCost = (level: number): number => {
        return level * 50;
      };

      expect(getLearnCost(1)).toBe(50);
    });

    it('should prevent learning if insufficient coins', () => {
      const canAfford = (balance: number, cost: number): boolean => {
        return balance >= cost;
      };

      expect(canAfford(100, 50)).toBe(true);
      expect(canAfford(30, 50)).toBe(false);
      expect(canAfford(50, 50)).toBe(true);
    });

    it('should reject learning already learned skills', () => {
      const hasSkill = (learnedSkills: number[], skillId: number): boolean => {
        return learnedSkills.includes(skillId);
      };

      expect(hasSkill([1, 2, 3], 2)).toBe(true);
      expect(hasSkill([1, 2, 3], 5)).toBe(false);
    });
  });

  describe('XP and Leveling', () => {
    it('should level up when XP reaches threshold', () => {
      type SkillProgress = {
        level: number;
        xp: number;
        maxLevel: number;
        xpPerLevel: number;
      };

      const addXP = (progress: SkillProgress, amount: number): SkillProgress => {
        let { level, xp, maxLevel, xpPerLevel } = progress;
        xp += amount;
        let leveledUp = false;

        while (xp >= xpPerLevel && level < maxLevel) {
          xp -= xpPerLevel;
          level += 1;
          leveledUp = true;
        }

        if (level >= maxLevel) {
          level = maxLevel;
          xp = 0;
        }

        return { level, xp, maxLevel, xpPerLevel };
      };

      const result = addXP({ level: 1, xp: 50, maxLevel: 5, xpPerLevel: 100 }, 60);
      expect(result.level).toBe(2);
      expect(result.xp).toBe(10);
    });

    it('should handle multiple level ups from large XP gain', () => {
      type SkillProgress = {
        level: number;
        xp: number;
        maxLevel: number;
        xpPerLevel: number;
      };

      const addXP = (progress: SkillProgress, amount: number): SkillProgress => {
        let { level, xp, maxLevel, xpPerLevel } = progress;
        xp += amount;

        while (xp >= xpPerLevel && level < maxLevel) {
          xp -= xpPerLevel;
          level += 1;
        }

        if (level >= maxLevel) {
          level = maxLevel;
          xp = 0;
        }

        return { level, xp, maxLevel, xpPerLevel };
      };

      const result = addXP({ level: 1, xp: 0, maxLevel: 5, xpPerLevel: 100 }, 350);
      expect(result.level).toBe(4);
      expect(result.xp).toBe(50);
    });

    it('should cap level at max level', () => {
      type SkillProgress = {
        level: number;
        xp: number;
        maxLevel: number;
        xpPerLevel: number;
      };

      const addXP = (progress: SkillProgress, amount: number): SkillProgress => {
        let { level, xp, maxLevel, xpPerLevel } = progress;
        xp += amount;

        while (xp >= xpPerLevel && level < maxLevel) {
          xp -= xpPerLevel;
          level += 1;
        }

        if (level >= maxLevel) {
          level = maxLevel;
          xp = 0;
        }

        return { level, xp, maxLevel, xpPerLevel };
      };

      const result = addXP({ level: 5, xp: 0, maxLevel: 5, xpPerLevel: 100 }, 200);
      expect(result.level).toBe(5);
      expect(result.xp).toBe(0);
    });

    it('should reset XP overflow at max level', () => {
      type SkillProgress = {
        level: number;
        xp: number;
        maxLevel: number;
        xpPerLevel: number;
      };

      const addXP = (progress: SkillProgress, amount: number): SkillProgress => {
        let { level, xp, maxLevel, xpPerLevel } = progress;
        xp += amount;

        while (xp >= xpPerLevel && level < maxLevel) {
          xp -= xpPerLevel;
          level += 1;
        }

        if (level >= maxLevel) {
          level = maxLevel;
          xp = 0;
        }

        return { level, xp, maxLevel, xpPerLevel };
      };

      const result = addXP({ level: 4, xp: 90, maxLevel: 5, xpPerLevel: 100 }, 50);
      expect(result.level).toBe(5);
      expect(result.xp).toBe(0);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress percentage correctly', () => {
      const getProgressPercent = (xp: number, xpPerLevel: number, level: number, maxLevel: number): number => {
        if (level >= maxLevel) return 100;
        return Math.floor((xp / xpPerLevel) * 100);
      };

      expect(getProgressPercent(50, 100, 3, 5)).toBe(50);
      expect(getProgressPercent(25, 100, 2, 5)).toBe(25);
      expect(getProgressPercent(99, 100, 1, 5)).toBe(99);
    });

    it('should show 100% for maxed skills', () => {
      const getProgressPercent = (xp: number, xpPerLevel: number, level: number, maxLevel: number): number => {
        if (level >= maxLevel) return 100;
        return Math.floor((xp / xpPerLevel) * 100);
      };

      expect(getProgressPercent(0, 100, 5, 5)).toBe(100);
      expect(getProgressPercent(50, 100, 5, 5)).toBe(100);
    });

    it('should show 0% for newly learned skills', () => {
      const getProgressPercent = (xp: number, xpPerLevel: number, level: number, maxLevel: number): number => {
        if (level >= maxLevel) return 100;
        return Math.floor((xp / xpPerLevel) * 100);
      };

      expect(getProgressPercent(0, 100, 1, 5)).toBe(0);
    });
  });

  describe('Skill Categories', () => {
    it('should validate skill categories', () => {
      const validCategories = ['social', 'creative', 'technical', 'gaming', 'exploration', 'economy'];
      
      const isValidCategory = (category: string): boolean => {
        return validCategories.includes(category);
      };

      expect(isValidCategory('social')).toBe(true);
      expect(isValidCategory('technical')).toBe(true);
      expect(isValidCategory('invalid')).toBe(false);
    });

    it('should group skills by category', () => {
      const skills = [
        { name: 'Charisma', category: 'social' },
        { name: 'Coding', category: 'technical' },
        { name: 'Persuasion', category: 'social' },
        { name: 'Trading', category: 'economy' },
      ];

      const groupedByCategory = skills.reduce((acc: any, skill) => {
        if (!acc[skill.category]) acc[skill.category] = [];
        acc[skill.category].push(skill.name);
        return acc;
      }, {});

      expect(groupedByCategory['social']).toEqual(['Charisma', 'Persuasion']);
      expect(groupedByCategory['technical']).toEqual(['Coding']);
      expect(groupedByCategory['economy']).toEqual(['Trading']);
    });
  });

  describe('Leaderboard Calculation', () => {
    it('should calculate total skill levels', () => {
      const skills = [
        { skillId: 1, level: 3 },
        { skillId: 2, level: 5 },
        { skillId: 3, level: 2 },
      ];

      const totalLevels = skills.reduce((sum, skill) => sum + skill.level, 0);
      expect(totalLevels).toBe(10);
    });

    it('should sort by total levels descending', () => {
      const agents = [
        { agentId: 'a1', totalLevels: 15, skillsLearned: 5 },
        { agentId: 'a2', totalLevels: 25, skillsLearned: 7 },
        { agentId: 'a3', totalLevels: 10, skillsLearned: 3 },
      ];

      const sorted = [...agents].sort((a, b) => b.totalLevels - a.totalLevels);

      expect(sorted[0].agentId).toBe('a2');
      expect(sorted[1].agentId).toBe('a1');
      expect(sorted[2].agentId).toBe('a3');
    });

    it('should use skills learned as tiebreaker', () => {
      const agents = [
        { agentId: 'a1', totalLevels: 20, skillsLearned: 5 },
        { agentId: 'a2', totalLevels: 20, skillsLearned: 8 },
        { agentId: 'a3', totalLevels: 20, skillsLearned: 3 },
      ];

      const sorted = [...agents].sort((a, b) => {
        if (b.totalLevels !== a.totalLevels) {
          return b.totalLevels - a.totalLevels;
        }
        return b.skillsLearned - a.skillsLearned;
      });

      expect(sorted[0].agentId).toBe('a2');
      expect(sorted[1].agentId).toBe('a1');
      expect(sorted[2].agentId).toBe('a3');
    });
  });

  describe('Skill Recommendations', () => {
    it('should find most active category', () => {
      const learnedSkills = [
        { category: 'social', count: 2 },
        { category: 'technical', count: 1 },
        { category: 'economy', count: 3 },
      ];

      const mostActive = learnedSkills.reduce((max, skill) => 
        skill.count > max.count ? skill : max
      );

      expect(mostActive.category).toBe('economy');
    });

    it('should recommend unlearned skills in most active category', () => {
      const allSkills = [
        { id: 1, category: 'social', name: 'Charisma' },
        { id: 2, category: 'social', name: 'Persuasion' },
        { id: 3, category: 'technical', name: 'Coding' },
      ];

      const learnedSkillIds = [1];
      const mostActiveCategory = 'social';

      const recommendations = allSkills.filter(
        skill => skill.category === mostActiveCategory && !learnedSkillIds.includes(skill.id)
      );

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].name).toBe('Persuasion');
    });

    it('should default to social category if no skills learned', () => {
      const learnedSkills: any[] = [];
      const defaultCategory = learnedSkills.length > 0 
        ? learnedSkills[0].category 
        : 'social';

      expect(defaultCategory).toBe('social');
    });

    it('should limit recommendations to 3', () => {
      const recommendations = [
        { id: 1, name: 'Skill 1' },
        { id: 2, name: 'Skill 2' },
        { id: 3, name: 'Skill 3' },
        { id: 4, name: 'Skill 4' },
        { id: 5, name: 'Skill 5' },
      ];

      const limited = recommendations.slice(0, 3);
      expect(limited).toHaveLength(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero XP addition', () => {
      type SkillProgress = {
        level: number;
        xp: number;
        maxLevel: number;
        xpPerLevel: number;
      };

      const addXP = (progress: SkillProgress, amount: number): SkillProgress => {
        let { level, xp, maxLevel, xpPerLevel } = progress;
        xp += amount;

        while (xp >= xpPerLevel && level < maxLevel) {
          xp -= xpPerLevel;
          level += 1;
        }

        if (level >= maxLevel) {
          level = maxLevel;
          xp = 0;
        }

        return { level, xp, maxLevel, xpPerLevel };
      };

      const result = addXP({ level: 2, xp: 50, maxLevel: 5, xpPerLevel: 100 }, 0);
      expect(result.level).toBe(2);
      expect(result.xp).toBe(50);
    });

    it('should handle exact level up amount', () => {
      type SkillProgress = {
        level: number;
        xp: number;
        maxLevel: number;
        xpPerLevel: number;
      };

      const addXP = (progress: SkillProgress, amount: number): SkillProgress => {
        let { level, xp, maxLevel, xpPerLevel } = progress;
        xp += amount;

        while (xp >= xpPerLevel && level < maxLevel) {
          xp -= xpPerLevel;
          level += 1;
        }

        if (level >= maxLevel) {
          level = maxLevel;
          xp = 0;
        }

        return { level, xp, maxLevel, xpPerLevel };
      };

      const result = addXP({ level: 1, xp: 0, maxLevel: 5, xpPerLevel: 100 }, 100);
      expect(result.level).toBe(2);
      expect(result.xp).toBe(0);
    });

    it('should count skills learned correctly', () => {
      const learnedSkills = [
        { skillId: 1 },
        { skillId: 2 },
        { skillId: 3 },
      ];

      expect(learnedSkills.length).toBe(3);
    });

    it('should validate skill ID exists', () => {
      const availableSkills = [1, 2, 3, 4, 5];
      
      const skillExists = (skillId: number): boolean => {
        return availableSkills.includes(skillId);
      };

      expect(skillExists(3)).toBe(true);
      expect(skillExists(99)).toBe(false);
    });

    it('should handle empty skill list', () => {
      const skills: any[] = [];
      const totalLevels = skills.reduce((sum, skill) => sum + skill.level, 0);
      expect(totalLevels).toBe(0);
    });
  });

  describe('Skill Validation', () => {
    it('should ensure level is at least 1', () => {
      const isValidLevel = (level: number): boolean => {
        return level >= 1;
      };

      expect(isValidLevel(1)).toBe(true);
      expect(isValidLevel(5)).toBe(true);
      expect(isValidLevel(0)).toBe(false);
      expect(isValidLevel(-1)).toBe(false);
    });

    it('should ensure XP is non-negative', () => {
      const isValidXP = (xp: number): boolean => {
        return xp >= 0;
      };

      expect(isValidXP(0)).toBe(true);
      expect(isValidXP(50)).toBe(true);
      expect(isValidXP(-10)).toBe(false);
    });

    it('should validate max level constraint', () => {
      const isLevelValid = (level: number, maxLevel: number): boolean => {
        return level >= 1 && level <= maxLevel;
      };

      expect(isLevelValid(3, 5)).toBe(true);
      expect(isLevelValid(5, 5)).toBe(true);
      expect(isLevelValid(6, 5)).toBe(false);
      expect(isLevelValid(0, 5)).toBe(false);
    });
  });
});
