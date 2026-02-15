import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type GuildRole = 'leader' | 'officer' | 'member';

export type Guild = {
  id: string;
  name: string;
  description: string;
  tag: string;
  badgeIcon: string;
  leaderId: string;
  memberCount: number;
  createdAt: Date;
};

export type GuildMember = {
  guildId: string;
  agentId: string;
  role: GuildRole;
  joinedAt: Date;
};

const MAX_MEMBERS = 50;

export async function createGuild(name: string, description: string, tag: string, badgeIcon: string, leaderId: string, sql: Sql): Promise<Guild> {
  if (!name || name.trim().length === 0) throw new Error('Guild name is required');
  if (!tag || tag.length > 5) throw new Error('Guild tag must be 1-5 characters');
  
  const [existing] = await sql<GuildMember[]>`SELECT guild_id AS "guildId", agent_id AS "agentId", role, joined_at AS "joinedAt" FROM guild_members WHERE agent_id = ${leaderId}`;
  if (existing) throw new Error('Agent is already in a guild');

  const guildId = randomUUID();
  const [guild] = await sql<Guild[]>`INSERT INTO guilds (id, name, description, tag, badge_icon, leader_id, member_count) VALUES (${guildId}, ${name}, ${description}, ${tag}, ${badgeIcon}, ${leaderId}, 1) RETURNING id, name, description, tag, badge_icon AS "badgeIcon", leader_id AS "leaderId", member_count AS "memberCount", created_at AS "createdAt"`;
  await sql`INSERT INTO guild_members (guild_id, agent_id, role) VALUES (${guildId}, ${leaderId}, 'leader')`;
  return guild;
}

export async function joinGuild(guildId: string, agentId: string, sql: Sql): Promise<void> {
  const [guild] = await sql<Guild[]>`SELECT id, member_count AS "memberCount" FROM guilds WHERE id = ${guildId}`;
  if (!guild) throw new Error('Guild not found');
  if (guild.memberCount >= MAX_MEMBERS) throw new Error('Guild is full');

  const [existingMembership] = await sql<GuildMember[]>`SELECT guild_id AS "guildId" FROM guild_members WHERE agent_id = ${agentId}`;
  if (existingMembership) throw new Error('Agent is already in a guild');

  await sql`INSERT INTO guild_members (guild_id, agent_id, role) VALUES (${guildId}, ${agentId}, 'member')`;
  await sql`UPDATE guilds SET member_count = member_count + 1 WHERE id = ${guildId}`;
}

export async function leaveGuild(guildId: string, agentId: string, sql: Sql): Promise<void> {
  const [membership] = await sql<GuildMember[]>`SELECT guild_id AS "guildId", agent_id AS "agentId", role FROM guild_members WHERE guild_id = ${guildId} AND agent_id = ${agentId}`;
  if (!membership) throw new Error('Not a member of this guild');
  if (membership.role === 'leader') throw new Error('Leader cannot leave guild');

  await sql`DELETE FROM guild_members WHERE guild_id = ${guildId} AND agent_id = ${agentId}`;
  await sql`UPDATE guilds SET member_count = member_count - 1 WHERE id = ${guildId}`;
}

export async function promoteToOfficer(guildId: string, agentId: string, promotedBy: string, sql: Sql): Promise<void> {
  const [promoter] = await sql<GuildMember[]>`SELECT role FROM guild_members WHERE guild_id = ${guildId} AND agent_id = ${promotedBy}`;
  if (!promoter || promoter.role !== 'leader') throw new Error('Only the leader can promote members');

  const [target] = await sql<GuildMember[]>`SELECT role FROM guild_members WHERE guild_id = ${guildId} AND agent_id = ${agentId}`;
  if (!target) throw new Error('Member not found');
  if (target.role === 'leader') throw new Error('Cannot promote the leader');

  await sql`UPDATE guild_members SET role = 'officer' WHERE guild_id = ${guildId} AND agent_id = ${agentId}`;
}

export async function demoteToMember(guildId: string, agentId: string, demotedBy: string, sql: Sql): Promise<void> {
  const [demoter] = await sql<GuildMember[]>`SELECT role FROM guild_members WHERE guild_id = ${guildId} AND agent_id = ${demotedBy}`;
  if (!demoter || demoter.role !== 'leader') throw new Error('Only the leader can demote members');

  const [target] = await sql<GuildMember[]>`SELECT role FROM guild_members WHERE guild_id = ${guildId} AND agent_id = ${agentId}`;
  if (!target) throw new Error('Member not found');
  if (target.role === 'leader') throw new Error('Cannot demote the leader');

  await sql`UPDATE guild_members SET role = 'member' WHERE guild_id = ${guildId} AND agent_id = ${agentId}`;
}

export async function getGuild(guildId: string, sql: Sql): Promise<Guild | null> {
  const [guild] = await sql<Guild[]>`SELECT id, name, description, tag, badge_icon AS "badgeIcon", leader_id AS "leaderId", member_count AS "memberCount", created_at AS "createdAt" FROM guilds WHERE id = ${guildId}`;
  return guild || null;
}

export async function getMembers(guildId: string, sql: Sql): Promise<Array<{ agentId: string; displayName: string; role: GuildRole; joinedAt: Date; }>> {
  const members = await sql<any[]>`SELECT gm.agent_id, a.display_name, gm.role, gm.joined_at FROM guild_members gm JOIN agents a ON gm.agent_id = a.id WHERE gm.guild_id = ${guildId} ORDER BY CASE gm.role WHEN 'leader' THEN 1 WHEN 'officer' THEN 2 ELSE 3 END, gm.joined_at ASC`;
  return members.map(m => ({ agentId: m.agent_id, displayName: m.display_name, role: m.role, joinedAt: m.joined_at }));
}

export async function getAgentGuild(agentId: string, sql: Sql): Promise<Guild | null> {
  const [membership] = await sql<{ guildId: string }[]>`SELECT guild_id AS "guildId" FROM guild_members WHERE agent_id = ${agentId}`;
  if (!membership) return null;
  return getGuild(membership.guildId, sql);
}

export async function disbandGuild(guildId: string, leaderId: string, sql: Sql): Promise<void> {
  const [guild] = await sql<Guild[]>`SELECT leader_id AS "leaderId" FROM guilds WHERE id = ${guildId}`;
  if (!guild) throw new Error('Guild not found');
  if (guild.leaderId !== leaderId) throw new Error('Only the leader can disband the guild');

  await sql`DELETE FROM guild_members WHERE guild_id = ${guildId}`;
  await sql`DELETE FROM guilds WHERE id = ${guildId}`;
}
