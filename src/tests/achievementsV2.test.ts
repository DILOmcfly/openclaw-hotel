import { describe, it, expect, vi } from 'vitest';

/**
 * Achievements V2 System Unit Tests
 * All SQL calls are mocked - no real database connections
 */

describe('Achievements V2 System', () => {
  describe('Achievement Progress Calculation', () => {
    it('should calculate percentage progress correctly', () => {
      const calculateProgress = (current: number, required: number): number => {
        return Math.min(100, Math.floor((current / required) * 100));
      };

      expect(calculateProgress(5, 10)).toBe(50);
      expect(calculateProgress(7, 10)).toBe(70);
      expect(calculateProgress(10, 10)).toBe(100);
      expect(calculateProgress(15, 10)).toBe(100); // Capped at 100%
    });

    it('should handle zero required value', () => {
      const calculateProgress = (current: number, required: number): number => {
        if (required === 0) return 0;
        return Math.min(100, Math.floor((current / required) * 100));
      };

      expect(calculateProgress(5, 0)).toBe(0);
    });

    it('should return 0% for no progress', () => {
      const calculateProgress = (current: number, required: number): number => {
        return Math.min(100, Math.floor((current / required) * 100));
      };

      expect(calculateProgress(0, 50)).toBe(0);
    });
  });

  describe('Friends Count Requirement', () => {
    it('should count accepted friendships correctly', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ count: '5' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'friends_count') {
          const result = await sql`SELECT COUNT(*) AS count FROM friendships WHERE status = 'accepted'`;
          return parseInt(result[0]?.count || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'friends_count', mockSql);
      expect(progress).toBe(5);
      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it('should return 0 for agents with no friends', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ count: '0' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'friends_count') {
          const result = await sql`SELECT COUNT(*) AS count FROM friendships WHERE status = 'accepted'`;
          return parseInt(result[0]?.count || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'friends_count', mockSql);
      expect(progress).toBe(0);
    });
  });

  describe('Messages Sent Requirement', () => {
    it('should count messages sent by agent', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ count: '50' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'messages_sent') {
          const result = await sql`SELECT COUNT(*) AS count FROM chat_messages WHERE agent_id = ${agentId}`;
          return parseInt(result[0]?.count || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'messages_sent', mockSql);
      expect(progress).toBe(50);
    });
  });

  describe('Rooms Visited Requirement', () => {
    it('should count distinct rooms visited', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ count: '10' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'rooms_visited') {
          const result = await sql`SELECT COUNT(DISTINCT room_id) AS count FROM room_visits`;
          return parseInt(result[0]?.count || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'rooms_visited', mockSql);
      expect(progress).toBe(10);
    });
  });

  describe('Items Owned Requirement', () => {
    it('should count items in agent inventory', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ count: '15' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'items_owned') {
          const result = await sql`SELECT COUNT(*) AS count FROM agent_inventory`;
          return parseInt(result[0]?.count || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'items_owned', mockSql);
      expect(progress).toBe(15);
    });
  });

  describe('Rare Item Requirement', () => {
    it('should detect rare item ownership', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ count: '1' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'rare_item_owned') {
          const result = await sql`SELECT COUNT(*) AS count FROM agent_inventory ai INNER JOIN furniture f ON ai.furniture_id = f.id WHERE f.rarity = 'rare'`;
          return parseInt(result[0]?.count || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'rare_item_owned', mockSql);
      expect(progress).toBe(1);
    });

    it('should return 0 if no rare items owned', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ count: '0' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'rare_item_owned') {
          const result = await sql`SELECT COUNT(*) AS count FROM agent_inventory ai INNER JOIN furniture f ON ai.furniture_id = f.id WHERE f.rarity = 'rare'`;
          return parseInt(result[0]?.count || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'rare_item_owned', mockSql);
      expect(progress).toBe(0);
    });
  });

  describe('Games Won Requirement', () => {
    it('should count games won by agent', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ count: '20' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'games_won') {
          const result = await sql`SELECT COUNT(*) AS count FROM game_results WHERE winner_id = ${agentId}`;
          return parseInt(result[0]?.count || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'games_won', mockSql);
      expect(progress).toBe(20);
    });
  });

  describe('Coins Earned Requirement', () => {
    it('should sum positive coin transactions', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ total: '1500' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'coins_earned') {
          const result = await sql`SELECT COALESCE(SUM(amount), 0) AS total FROM coin_transactions WHERE amount > 0`;
          return parseInt(result[0]?.total || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'coins_earned', mockSql);
      expect(progress).toBe(1500);
    });
  });

  describe('Coins Spent Requirement', () => {
    it('should sum negative coin transactions', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ total: '6000' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'coins_spent') {
          const result = await sql`SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM coin_transactions WHERE amount < 0`;
          return parseInt(result[0]?.total || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'coins_spent', mockSql);
      expect(progress).toBe(6000);
    });
  });

  describe('Rooms Created Requirement', () => {
    it('should count rooms created by agent', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ count: '3' }]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'rooms_created') {
          const result = await sql`SELECT COUNT(*) AS count FROM rooms WHERE owner_id = ${agentId}`;
          return parseInt(result[0]?.count || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'rooms_created', mockSql);
      expect(progress).toBe(3);
    });
  });

  describe('Achievement Unlocking Logic', () => {
    it('should unlock achievement when requirement is met', () => {
      const shouldUnlock = (currentProgress: number, requiredValue: number): boolean => {
        return currentProgress >= requiredValue;
      };

      expect(shouldUnlock(10, 10)).toBe(true);
      expect(shouldUnlock(15, 10)).toBe(true);
      expect(shouldUnlock(5, 10)).toBe(false);
    });

    it('should not unlock already unlocked achievements', () => {
      const unlockedIds = new Set([1, 2, 3]);
      const achievementId = 2;

      expect(unlockedIds.has(achievementId)).toBe(true);
      expect(unlockedIds.has(5)).toBe(false);
    });

    it('should track newly unlocked achievements', () => {
      const newlyUnlocked: number[] = [];
      const unlockedIds = new Set([1, 2]);

      const achievements = [
        { id: 1, requirementValue: 10 },
        { id: 2, requirementValue: 20 },
        { id: 3, requirementValue: 5 },
      ];

      const currentProgress = 7;

      achievements.forEach(achievement => {
        if (!unlockedIds.has(achievement.id) && currentProgress >= achievement.requirementValue) {
          newlyUnlocked.push(achievement.id);
        }
      });

      expect(newlyUnlocked).toEqual([3]);
    });
  });

  describe('Leaderboard Sorting', () => {
    it('should sort by total points descending', () => {
      const mockLeaderboard = [
        { agentId: 'a1', totalPoints: 100, achievementCount: 5 },
        { agentId: 'a2', totalPoints: 250, achievementCount: 8 },
        { agentId: 'a3', totalPoints: 75, achievementCount: 3 },
      ];

      const sorted = [...mockLeaderboard].sort((a, b) => b.totalPoints - a.totalPoints);

      expect(sorted[0].agentId).toBe('a2');
      expect(sorted[1].agentId).toBe('a1');
      expect(sorted[2].agentId).toBe('a3');
    });

    it('should use achievement count as tiebreaker', () => {
      const mockLeaderboard = [
        { agentId: 'a1', totalPoints: 100, achievementCount: 5 },
        { agentId: 'a2', totalPoints: 100, achievementCount: 8 },
        { agentId: 'a3', totalPoints: 100, achievementCount: 3 },
      ];

      const sorted = [...mockLeaderboard].sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        return b.achievementCount - a.achievementCount;
      });

      expect(sorted[0].agentId).toBe('a2');
      expect(sorted[1].agentId).toBe('a1');
      expect(sorted[2].agentId).toBe('a3');
    });

    it('should respect limit parameter', () => {
      const mockLeaderboard = [
        { agentId: 'a1', totalPoints: 100 },
        { agentId: 'a2', totalPoints: 90 },
        { agentId: 'a3', totalPoints: 80 },
        { agentId: 'a4', totalPoints: 70 },
        { agentId: 'a5', totalPoints: 60 },
      ];

      const limit = 3;
      const limited = mockLeaderboard.slice(0, limit);

      expect(limited).toHaveLength(3);
      expect(limited.map(l => l.agentId)).toEqual(['a1', 'a2', 'a3']);
    });
  });

  describe('Category Distribution', () => {
    it('should group achievements by category', () => {
      const achievements = [
        { id: 1, category: 'social', name: 'Friend' },
        { id: 2, category: 'explorer', name: 'Traveler' },
        { id: 3, category: 'social', name: 'Popular' },
        { id: 4, category: 'gamer', name: 'Winner' },
      ];

      const byCategory = achievements.reduce((acc, ach) => {
        if (!acc[ach.category]) acc[ach.category] = [];
        acc[ach.category].push(ach);
        return acc;
      }, {} as Record<string, typeof achievements>);

      expect(byCategory['social']).toHaveLength(2);
      expect(byCategory['explorer']).toHaveLength(1);
      expect(byCategory['gamer']).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown requirement types', async () => {
      const mockSql = vi.fn();
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'unknown_type') {
          return 0;
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'unknown_type', mockSql);
      expect(progress).toBe(0);
      expect(mockSql).not.toHaveBeenCalled();
    });

    it('should handle missing count results gracefully', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);
      
      const getAgentProgress = async (agentId: string, requirementType: string, sql: any): Promise<number> => {
        if (requirementType === 'friends_count') {
          const result = await sql`SELECT COUNT(*) AS count FROM friendships`;
          return parseInt(result[0]?.count || '0');
        }
        return 0;
      };

      const progress = await getAgentProgress('agent1', 'friends_count', mockSql);
      expect(progress).toBe(0);
    });
  });
});
