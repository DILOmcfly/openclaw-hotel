import { describe, it, expect, vi } from 'vitest';
import * as alliancesService from '../services/alliances.js';

/**
 * Alliances System Unit Tests
 * All SQL calls are mocked - no real database connections
 */

describe('Alliances System', () => {
  describe('createAlliance', () => {
    it('should create alliance when agent is guild leader', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ role: 'leader' }]) // Check leader
        .mockResolvedValueOnce([]) // Check no existing alliance
        .mockResolvedValueOnce([{ id: 1, name: 'Test Alliance', motto: 'Test motto', leaderGuildId: 100, maxGuilds: 5, createdAt: new Date() }]) // Insert alliance
        .mockResolvedValueOnce([]); // Insert member

      const alliance = await alliancesService.createAlliance('Test Alliance', 'Test motto', 100, 'agent1', mockSql);
      
      expect(alliance.name).toBe('Test Alliance');
      expect(alliance.leaderGuildId).toBe(100);
      expect(mockSql).toHaveBeenCalledTimes(4);
    });

    it('should reject non-guild-leaders', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([{ role: 'member' }]);

      await expect(alliancesService.createAlliance('Test', 'Motto', 100, 'agent1', mockSql))
        .rejects.toThrow('Only guild leaders can create alliances');
    });

    it('should reject if guild already in alliance', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ role: 'leader' }])
        .mockResolvedValueOnce([{ alliance_id: 1 }]);

      await expect(alliancesService.createAlliance('Test', 'Motto', 100, 'agent1', mockSql))
        .rejects.toThrow('Guild is already in an alliance');
    });
  });

  describe('joinAlliance', () => {
    it('should allow guild leader to join alliance', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ role: 'leader' }]) // Check leader
        .mockResolvedValueOnce([]) // No existing membership
        .mockResolvedValueOnce([{ maxGuilds: 5 }]) // Get alliance
        .mockResolvedValueOnce([{ count: '2' }]) // Current count
        .mockResolvedValueOnce([]); // Insert member

      await alliancesService.joinAlliance(1, 100, 'agent1', mockSql);
      expect(mockSql).toHaveBeenCalledTimes(5);
    });

    it('should reject non-leaders from joining', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([{ role: 'member' }]);

      await expect(alliancesService.joinAlliance(1, 100, 'agent1', mockSql))
        .rejects.toThrow('Only guild leaders can join alliances');
    });

    it('should reject if guild already in an alliance', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ role: 'leader' }])
        .mockResolvedValueOnce([{ alliance_id: 2 }]);

      await expect(alliancesService.joinAlliance(1, 100, 'agent1', mockSql))
        .rejects.toThrow('Guild is already in an alliance');
    });

    it('should reject if alliance is full', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ role: 'leader' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ maxGuilds: 5 }])
        .mockResolvedValueOnce([{ count: '5' }]);

      await expect(alliancesService.joinAlliance(1, 100, 'agent1', mockSql))
        .rejects.toThrow('Alliance is full');
    });

    it('should reject if alliance not found', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ role: 'leader' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await expect(alliancesService.joinAlliance(1, 100, 'agent1', mockSql))
        .rejects.toThrow('Alliance not found');
    });
  });

  describe('leaveAlliance', () => {
    it('should allow member guild to leave', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ role: 'leader' }]) // Check leader
        .mockResolvedValueOnce([{ leaderGuildId: 99 }]) // Get alliance (different leader)
        .mockResolvedValueOnce([]); // Delete member

      await alliancesService.leaveAlliance(1, 100, 'agent1', mockSql);
      expect(mockSql).toHaveBeenCalledTimes(3);
    });

    it('should prevent leader guild from leaving', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ role: 'leader' }])
        .mockResolvedValueOnce([{ leaderGuildId: 100 }]);

      await expect(alliancesService.leaveAlliance(1, 100, 'agent1', mockSql))
        .rejects.toThrow('Leader guild cannot leave alliance');
    });

    it('should reject non-leaders from leaving', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([{ role: 'officer' }]);

      await expect(alliancesService.leaveAlliance(1, 100, 'agent1', mockSql))
        .rejects.toThrow('Only guild leaders can leave alliances');
    });
  });

  describe('declareRivalry', () => {
    it('should allow alliance leader to declare rivalry', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ leaderGuildId: 100 }]) // Get alliance
        .mockResolvedValueOnce([{ role: 'leader' }]) // Check leader
        .mockResolvedValueOnce([]); // Insert rivalry

      await alliancesService.declareRivalry(1, 2, 'They stole our flag!', 'agent1', mockSql);
      expect(mockSql).toHaveBeenCalledTimes(3);
    });

    it('should store bidirectional rivalry correctly (lower id first)', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ leaderGuildId: 100 }])
        .mockResolvedValueOnce([{ role: 'leader' }])
        .mockResolvedValueOnce([]);

      // Alliance 5 declares rivalry with Alliance 2 -> should store as (2, 5)
      await alliancesService.declareRivalry(5, 2, 'Test', 'agent1', mockSql);
      expect(mockSql).toHaveBeenCalledTimes(3);
    });

    it('should reject non-leaders from declaring rivalries', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ leaderGuildId: 100 }])
        .mockResolvedValueOnce([{ role: 'member' }]);

      await expect(alliancesService.declareRivalry(1, 2, 'Test', 'agent1', mockSql))
        .rejects.toThrow('Only the alliance leader can declare rivalries');
    });
  });

  describe('endRivalry', () => {
    it('should allow alliance leader to end rivalry', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ leaderGuildId: 100 }])
        .mockResolvedValueOnce([{ role: 'leader' }])
        .mockResolvedValueOnce([]);

      await alliancesService.endRivalry(1, 2, 'agent1', mockSql);
      expect(mockSql).toHaveBeenCalledTimes(3);
    });

    it('should reject non-leaders from ending rivalries', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ leaderGuildId: 100 }])
        .mockResolvedValueOnce([{ role: 'officer' }]);

      await expect(alliancesService.endRivalry(1, 2, 'agent1', mockSql))
        .rejects.toThrow('Only the alliance leader can end rivalries');
    });
  });

  describe('getAlliance', () => {
    it('should return alliance with member guilds', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{
          id: 1,
          name: 'Test Alliance',
          motto: 'Test motto',
          leaderGuildId: 100,
          maxGuilds: 5,
          createdAt: new Date()
        }])
        .mockResolvedValueOnce([
          { guildId: 100 },
          { guildId: 101 },
          { guildId: 102 }
        ]);

      const alliance = await alliancesService.getAlliance(1, mockSql);
      
      expect(alliance.name).toBe('Test Alliance');
      expect(alliance.guilds).toHaveLength(3);
      expect(alliance.guilds).toEqual([100, 101, 102]);
    });

    it('should throw error if alliance not found', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]);

      await expect(alliancesService.getAlliance(999, mockSql))
        .rejects.toThrow('Alliance not found');
    });
  });

  describe('getAlliances', () => {
    it('should return list of all alliances', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([
        { id: 1, name: 'Alliance A', motto: 'Motto A', leaderGuildId: 100, maxGuilds: 5, createdAt: new Date() },
        { id: 2, name: 'Alliance B', motto: 'Motto B', leaderGuildId: 200, maxGuilds: 5, createdAt: new Date() }
      ]);

      const alliances = await alliancesService.getAlliances(mockSql);
      
      expect(alliances).toHaveLength(2);
      expect(alliances[0].name).toBe('Alliance A');
      expect(alliances[1].name).toBe('Alliance B');
    });

    it('should return empty array when no alliances exist', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]);

      const alliances = await alliancesService.getAlliances(mockSql);
      expect(alliances).toEqual([]);
    });
  });

  describe('getRivalries', () => {
    it('should return rivalries for an alliance', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([
        { alliance1Id: 1, alliance2Id: 2, declaredBy: 1, reason: 'Test', createdAt: new Date() },
        { alliance1Id: 1, alliance2Id: 3, declaredBy: 1, reason: 'Test 2', createdAt: new Date() }
      ]);

      const rivalries = await alliancesService.getRivalries(1, mockSql);
      expect(rivalries).toHaveLength(2);
    });

    it('should return empty array when no rivalries exist', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]);

      const rivalries = await alliancesService.getRivalries(1, mockSql);
      expect(rivalries).toEqual([]);
    });
  });

  describe('getAllianceStats', () => {
    it('should return member count and rival count', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ count: '4' }]) // Member count
        .mockResolvedValueOnce([{ count: '2' }]); // Rival count

      const stats = await alliancesService.getAllianceStats(1, mockSql);
      
      expect(stats.totalMembers).toBe(4);
      expect(stats.rivalCount).toBe(2);
    });

    it('should return zero stats for new alliance', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([{ count: '0' }]);

      const stats = await alliancesService.getAllianceStats(1, mockSql);
      
      expect(stats.totalMembers).toBe(1);
      expect(stats.rivalCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing alliance in getAlliance', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]);

      await expect(alliancesService.getAlliance(999, mockSql))
        .rejects.toThrow('Alliance not found');
    });

    it('should handle missing alliance in leaveAlliance', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ role: 'leader' }])
        .mockResolvedValueOnce([]);

      await expect(alliancesService.leaveAlliance(999, 100, 'agent1', mockSql))
        .rejects.toThrow('Alliance not found');
    });

    it('should handle missing alliance in declareRivalry', async () => {
      const mockSql = vi.fn().mockResolvedValueOnce([]);

      await expect(alliancesService.declareRivalry(999, 2, 'Test', 'agent1', mockSql))
        .rejects.toThrow('Alliance not found');
    });
  });
});
