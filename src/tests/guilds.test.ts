import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Sql } from 'postgres';
import {
  createGuild,
  joinGuild,
  leaveGuild,
  promoteToOfficer,
  demoteToMember,
  getGuild,
  getMembers,
  getAgentGuild,
  disbandGuild,
} from '../services/guilds.js';

/**
 * Guild System Unit Tests
 * These tests validate guild logic with mocked SQL
 */

// Mock SQL client
const createMockSql = () => {
  const mockSql = vi.fn() as any;
  mockSql.mockReturnValue([]);
  return mockSql as Sql;
};

describe('Guild System - Create Guild', () => {
  let mockSql: Sql;

  beforeEach(() => {
    mockSql = createMockSql();
  });

  it('should create a guild successfully', async () => {
    // Mock: no existing membership
    (mockSql as any).mockReturnValueOnce([]);
    // Mock: guild creation
    (mockSql as any).mockReturnValueOnce([{
      id: 'guild-1',
      name: 'Test Guild',
      description: 'A test guild',
      tag: 'TEST',
      badgeIcon: '⚔️',
      leaderId: 'agent-1',
      memberCount: 1,
      createdAt: new Date(),
    }]);
    // Mock: member insertion
    (mockSql as any).mockReturnValueOnce([]);

    const guild = await createGuild('Test Guild', 'A test guild', 'TEST', '⚔️', 'agent-1', mockSql);

    expect(guild.name).toBe('Test Guild');
    expect(guild.tag).toBe('TEST');
    expect(guild.leaderId).toBe('agent-1');
    expect(guild.memberCount).toBe(1);
  });

  it('should reject empty guild name', async () => {
    await expect(createGuild('', 'desc', 'TEST', '⚔️', 'agent-1', mockSql))
      .rejects.toThrow('Guild name is required');
  });

  it('should reject tag longer than 5 characters', async () => {
    await expect(createGuild('Guild', 'desc', 'TOOLONG', '⚔️', 'agent-1', mockSql))
      .rejects.toThrow('Guild tag must be 1-5 characters');
  });

  it('should reject if agent is already in a guild', async () => {
    // Mock: existing membership
    (mockSql as any).mockReturnValueOnce([{
      guildId: 'other-guild',
      agentId: 'agent-1',
      role: 'member',
      joinedAt: new Date(),
    }]);

    await expect(createGuild('Guild', 'desc', 'TEST', '⚔️', 'agent-1', mockSql))
      .rejects.toThrow('Agent is already in a guild');
  });
});

describe('Guild System - Join Guild', () => {
  let mockSql: Sql;

  beforeEach(() => {
    mockSql = createMockSql();
  });

  it('should join a guild successfully', async () => {
    // Mock: guild exists with space
    (mockSql as any).mockReturnValueOnce([{
      id: 'guild-1',
      memberCount: 10,
    }]);
    // Mock: no existing membership
    (mockSql as any).mockReturnValueOnce([]);
    // Mock: member insertion
    (mockSql as any).mockReturnValueOnce([]);
    // Mock: update member count
    (mockSql as any).mockReturnValueOnce([]);

    await expect(joinGuild('guild-1', 'agent-1', mockSql)).resolves.not.toThrow();
  });

  it('should reject if guild is full (50 members)', async () => {
    // Mock: guild is full
    (mockSql as any).mockReturnValueOnce([{
      id: 'guild-1',
      memberCount: 50,
    }]);

    await expect(joinGuild('guild-1', 'agent-1', mockSql))
      .rejects.toThrow('Guild is full');
  });

  it('should reject if agent is already in a guild', async () => {
    // Mock: guild exists
    (mockSql as any).mockReturnValueOnce([{
      id: 'guild-1',
      memberCount: 10,
    }]);
    // Mock: existing membership
    (mockSql as any).mockReturnValueOnce([{
      guildId: 'other-guild',
    }]);

    await expect(joinGuild('guild-1', 'agent-1', mockSql))
      .rejects.toThrow('Agent is already in a guild');
  });

  it('should reject if guild does not exist', async () => {
    // Mock: guild not found
    (mockSql as any).mockReturnValueOnce([]);

    await expect(joinGuild('nonexistent', 'agent-1', mockSql))
      .rejects.toThrow('Guild not found');
  });
});

describe('Guild System - Leave Guild', () => {
  let mockSql: Sql;

  beforeEach(() => {
    mockSql = createMockSql();
  });

  it('should leave guild successfully', async () => {
    // Mock: membership exists (member)
    (mockSql as any).mockReturnValueOnce([{
      guildId: 'guild-1',
      agentId: 'agent-1',
      role: 'member',
    }]);
    // Mock: delete member
    (mockSql as any).mockReturnValueOnce([]);
    // Mock: update member count
    (mockSql as any).mockReturnValueOnce([]);

    await expect(leaveGuild('guild-1', 'agent-1', mockSql)).resolves.not.toThrow();
  });

  it('should prevent leader from leaving', async () => {
    // Mock: membership exists (leader)
    (mockSql as any).mockReturnValueOnce([{
      guildId: 'guild-1',
      agentId: 'agent-1',
      role: 'leader',
    }]);

    await expect(leaveGuild('guild-1', 'agent-1', mockSql))
      .rejects.toThrow('Leader cannot leave guild');
  });

  it('should reject if not a member', async () => {
    // Mock: no membership
    (mockSql as any).mockReturnValueOnce([]);

    await expect(leaveGuild('guild-1', 'agent-1', mockSql))
      .rejects.toThrow('Not a member of this guild');
  });
});

describe('Guild System - Promote to Officer', () => {
  let mockSql: Sql;

  beforeEach(() => {
    mockSql = createMockSql();
  });

  it('should promote member to officer successfully', async () => {
    // Mock: promoter is leader
    (mockSql as any).mockReturnValueOnce([{ role: 'leader' }]);
    // Mock: target is member
    (mockSql as any).mockReturnValueOnce([{ role: 'member' }]);
    // Mock: update role
    (mockSql as any).mockReturnValueOnce([]);

    await expect(promoteToOfficer('guild-1', 'agent-2', 'agent-1', mockSql))
      .resolves.not.toThrow();
  });

  it('should reject if promoter is not leader', async () => {
    // Mock: promoter is not leader
    (mockSql as any).mockReturnValueOnce([{ role: 'member' }]);

    await expect(promoteToOfficer('guild-1', 'agent-2', 'agent-3', mockSql))
      .rejects.toThrow('Only the leader can promote members');
  });

  it('should reject promoting the leader', async () => {
    // Mock: promoter is leader
    (mockSql as any).mockReturnValueOnce([{ role: 'leader' }]);
    // Mock: target is leader
    (mockSql as any).mockReturnValueOnce([{ role: 'leader' }]);

    await expect(promoteToOfficer('guild-1', 'agent-1', 'agent-1', mockSql))
      .rejects.toThrow('Cannot promote the leader');
  });

  it('should reject if target member not found', async () => {
    // Mock: promoter is leader
    (mockSql as any).mockReturnValueOnce([{ role: 'leader' }]);
    // Mock: target not found
    (mockSql as any).mockReturnValueOnce([]);

    await expect(promoteToOfficer('guild-1', 'nonexistent', 'agent-1', mockSql))
      .rejects.toThrow('Member not found');
  });
});

describe('Guild System - Demote to Member', () => {
  let mockSql: Sql;

  beforeEach(() => {
    mockSql = createMockSql();
  });

  it('should demote officer to member successfully', async () => {
    // Mock: demoter is leader
    (mockSql as any).mockReturnValueOnce([{ role: 'leader' }]);
    // Mock: target is officer
    (mockSql as any).mockReturnValueOnce([{ role: 'officer' }]);
    // Mock: update role
    (mockSql as any).mockReturnValueOnce([]);

    await expect(demoteToMember('guild-1', 'agent-2', 'agent-1', mockSql))
      .resolves.not.toThrow();
  });

  it('should reject if demoter is not leader', async () => {
    // Mock: demoter is not leader
    (mockSql as any).mockReturnValueOnce([{ role: 'officer' }]);

    await expect(demoteToMember('guild-1', 'agent-2', 'agent-3', mockSql))
      .rejects.toThrow('Only the leader can demote members');
  });

  it('should reject demoting the leader', async () => {
    // Mock: demoter is leader
    (mockSql as any).mockReturnValueOnce([{ role: 'leader' }]);
    // Mock: target is leader
    (mockSql as any).mockReturnValueOnce([{ role: 'leader' }]);

    await expect(demoteToMember('guild-1', 'agent-1', 'agent-1', mockSql))
      .rejects.toThrow('Cannot demote the leader');
  });
});

describe('Guild System - Disband Guild', () => {
  let mockSql: Sql;

  beforeEach(() => {
    mockSql = createMockSql();
  });

  it('should disband guild successfully', async () => {
    // Mock: guild exists with correct leader
    (mockSql as any).mockReturnValueOnce([{ leaderId: 'agent-1' }]);
    // Mock: delete members
    (mockSql as any).mockReturnValueOnce([]);
    // Mock: delete guild
    (mockSql as any).mockReturnValueOnce([]);

    await expect(disbandGuild('guild-1', 'agent-1', mockSql)).resolves.not.toThrow();
  });

  it('should reject if not the leader', async () => {
    // Mock: guild exists with different leader
    (mockSql as any).mockReturnValueOnce([{ leaderId: 'agent-1' }]);

    await expect(disbandGuild('guild-1', 'agent-2', mockSql))
      .rejects.toThrow('Only the leader can disband the guild');
  });

  it('should reject if guild does not exist', async () => {
    // Mock: guild not found
    (mockSql as any).mockReturnValueOnce([]);

    await expect(disbandGuild('nonexistent', 'agent-1', mockSql))
      .rejects.toThrow('Guild not found');
  });
});

describe('Guild System - Get Guild', () => {
  let mockSql: Sql;

  beforeEach(() => {
    mockSql = createMockSql();
  });

  it('should return guild when found', async () => {
    const mockGuild = {
      id: 'guild-1',
      name: 'Test Guild',
      description: 'A test guild',
      tag: 'TEST',
      badgeIcon: '⚔️',
      leaderId: 'agent-1',
      memberCount: 5,
      createdAt: new Date(),
    };

    (mockSql as any).mockReturnValueOnce([mockGuild]);

    const guild = await getGuild('guild-1', mockSql);

    expect(guild).toEqual(mockGuild);
  });

  it('should return null when guild not found', async () => {
    (mockSql as any).mockReturnValueOnce([]);

    const guild = await getGuild('nonexistent', mockSql);

    expect(guild).toBeNull();
  });
});

describe('Guild System - Get Members', () => {
  let mockSql: Sql;

  beforeEach(() => {
    mockSql = createMockSql();
  });

  it('should return members ordered by role and join date', async () => {
    const mockMembers = [
      { agent_id: 'agent-1', display_name: 'Leader', role: 'leader', joined_at: new Date('2024-01-01') },
      { agent_id: 'agent-2', display_name: 'Officer', role: 'officer', joined_at: new Date('2024-01-02') },
      { agent_id: 'agent-3', display_name: 'Member', role: 'member', joined_at: new Date('2024-01-03') },
    ];

    (mockSql as any).mockReturnValueOnce(mockMembers);

    const members = await getMembers('guild-1', mockSql);

    expect(members).toHaveLength(3);
    expect(members[0].role).toBe('leader');
    expect(members[1].role).toBe('officer');
    expect(members[2].role).toBe('member');
  });
});

describe('Guild System - Get Agent Guild', () => {
  let mockSql: Sql;

  beforeEach(() => {
    mockSql = createMockSql();
  });

  it('should return guild when agent is a member', async () => {
    const mockGuild = {
      id: 'guild-1',
      name: 'Test Guild',
      description: 'A test guild',
      tag: 'TEST',
      badgeIcon: '⚔️',
      leaderId: 'agent-1',
      memberCount: 5,
      createdAt: new Date(),
    };

    // Mock: membership exists
    (mockSql as any).mockReturnValueOnce([{ guildId: 'guild-1' }]);
    // Mock: getGuild returns guild
    (mockSql as any).mockReturnValueOnce([mockGuild]);

    const guild = await getAgentGuild('agent-1', mockSql);

    expect(guild).toEqual(mockGuild);
  });

  it('should return null when agent is not in a guild', async () => {
    // Mock: no membership
    (mockSql as any).mockReturnValueOnce([]);

    const guild = await getAgentGuild('agent-1', mockSql);

    expect(guild).toBeNull();
  });
});
