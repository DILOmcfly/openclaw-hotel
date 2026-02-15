/**
 * Alliances Service - Manages guild alliances and rivalries
 */

export type Alliance = {
  id: number;
  name: string;
  motto: string | null;
  leaderGuildId: number;
  maxGuilds: number;
  createdAt: Date;
};

export type AllianceMember = {
  allianceId: number;
  guildId: number;
  joinedAt: Date;
};

export type Rivalry = {
  alliance1Id: number;
  alliance2Id: number;
  declaredBy: number;
  reason: string | null;
  createdAt: Date;
};

async function verifyGuildLeader(guildId: number, agentId: string, sql: any, action: string): Promise<void> {
  const [m] = await sql`SELECT role FROM guild_members WHERE guild_id = ${guildId} AND agent_id = ${agentId}`;
  if (!m || m.role !== 'leader') throw new Error(`Only guild leaders can ${action}`);
}

async function verifyAllianceLeader(allianceId: number, agentId: string, sql: any): Promise<void> {
  const [a] = await sql`SELECT leader_guild_id AS "leaderGuildId" FROM alliances WHERE id = ${allianceId}`;
  if (!a) throw new Error('Alliance not found');
  const [m] = await sql`SELECT role FROM guild_members WHERE guild_id = ${a.leaderGuildId} AND agent_id = ${agentId}`;
  if (!m || m.role !== 'leader') throw new Error('Only the alliance leader can perform this action');
}

export async function createAlliance(name: string, motto: string, leaderGuildId: number, agentId: string, sql: any): Promise<Alliance> {
  await verifyGuildLeader(leaderGuildId, agentId, sql, 'create alliances');
  const [existing] = await sql`SELECT alliance_id FROM alliance_members WHERE guild_id = ${leaderGuildId}`;
  if (existing) throw new Error('Guild is already in an alliance');

  const [alliance] = await sql`
    INSERT INTO alliances (name, motto, leader_guild_id, max_guilds)
    VALUES (${name}, ${motto}, ${leaderGuildId}, 5)
    RETURNING id, name, motto, leader_guild_id AS "leaderGuildId", 
              max_guilds AS "maxGuilds", created_at AS "createdAt"
  `;

  await sql`INSERT INTO alliance_members (alliance_id, guild_id) VALUES (${alliance.id}, ${leaderGuildId})`;
  return alliance;
}

export async function inviteGuild(allianceId: number, guildId: number, agentId: string, sql: any): Promise<void> {
  const [a] = await sql`SELECT leader_guild_id AS "leaderGuildId" FROM alliances WHERE id = ${allianceId}`;
  if (!a) throw new Error('Alliance not found');
  const [m] = await sql`SELECT role FROM guild_members WHERE guild_id = ${a.leaderGuildId} AND agent_id = ${agentId}`;
  if (!m || m.role !== 'leader') throw new Error('Only the alliance leader can invite guilds');
}

export async function joinAlliance(allianceId: number, guildId: number, agentId: string, sql: any): Promise<void> {
  await verifyGuildLeader(guildId, agentId, sql, 'join alliances');
  const [existing] = await sql`SELECT alliance_id FROM alliance_members WHERE guild_id = ${guildId}`;
  if (existing) throw new Error('Guild is already in an alliance');

  const [alliance] = await sql`SELECT max_guilds AS "maxGuilds" FROM alliances WHERE id = ${allianceId}`;
  if (!alliance) throw new Error('Alliance not found');

  const [countResult] = await sql`SELECT COUNT(*) AS count FROM alliance_members WHERE alliance_id = ${allianceId}`;
  if (parseInt(countResult.count) >= alliance.maxGuilds) throw new Error('Alliance is full');

  await sql`INSERT INTO alliance_members (alliance_id, guild_id) VALUES (${allianceId}, ${guildId})`;
}

export async function leaveAlliance(allianceId: number, guildId: number, agentId: string, sql: any): Promise<void> {
  await verifyGuildLeader(guildId, agentId, sql, 'leave alliances');
  const [alliance] = await sql`SELECT leader_guild_id AS "leaderGuildId" FROM alliances WHERE id = ${allianceId}`;
  if (!alliance) throw new Error('Alliance not found');
  if (alliance.leaderGuildId === guildId) throw new Error('Leader guild cannot leave alliance');

  await sql`DELETE FROM alliance_members WHERE alliance_id = ${allianceId} AND guild_id = ${guildId}`;
}

export async function declareRivalry(allianceId: number, targetAllianceId: number, reason: string, agentId: string, sql: any): Promise<void> {
  const [a] = await sql`SELECT leader_guild_id AS "leaderGuildId" FROM alliances WHERE id = ${allianceId}`;
  if (!a) throw new Error('Alliance not found');
  const [m] = await sql`SELECT role FROM guild_members WHERE guild_id = ${a.leaderGuildId} AND agent_id = ${agentId}`;
  if (!m || m.role !== 'leader') throw new Error('Only the alliance leader can declare rivalries');

  const [aid1, aid2] = allianceId < targetAllianceId ? [allianceId, targetAllianceId] : [targetAllianceId, allianceId];
  await sql`
    INSERT INTO alliance_rivalries (alliance1_id, alliance2_id, declared_by, reason)
    VALUES (${aid1}, ${aid2}, ${allianceId}, ${reason})
    ON CONFLICT (alliance1_id, alliance2_id) DO NOTHING
  `;
}

export async function endRivalry(allianceId: number, targetAllianceId: number, agentId: string, sql: any): Promise<void> {
  const [a] = await sql`SELECT leader_guild_id AS "leaderGuildId" FROM alliances WHERE id = ${allianceId}`;
  if (!a) throw new Error('Alliance not found');
  const [m] = await sql`SELECT role FROM guild_members WHERE guild_id = ${a.leaderGuildId} AND agent_id = ${agentId}`;
  if (!m || m.role !== 'leader') throw new Error('Only the alliance leader can end rivalries');

  const [aid1, aid2] = allianceId < targetAllianceId ? [allianceId, targetAllianceId] : [targetAllianceId, allianceId];
  await sql`DELETE FROM alliance_rivalries WHERE alliance1_id = ${aid1} AND alliance2_id = ${aid2}`;
}

export async function getAlliance(allianceId: number, sql: any): Promise<Alliance & { guilds: number[] }> {
  const [alliance] = await sql`
    SELECT id, name, motto, leader_guild_id AS "leaderGuildId",
           max_guilds AS "maxGuilds", created_at AS "createdAt"
    FROM alliances WHERE id = ${allianceId}
  `;
  if (!alliance) throw new Error('Alliance not found');

  const members = await sql`SELECT guild_id AS "guildId" FROM alliance_members WHERE alliance_id = ${allianceId}`;
  return { ...alliance, guilds: members.map((m: any) => m.guildId) };
}

export async function getAlliances(sql: any): Promise<Alliance[]> {
  return await sql`
    SELECT id, name, motto, leader_guild_id AS "leaderGuildId",
           max_guilds AS "maxGuilds", created_at AS "createdAt"
    FROM alliances ORDER BY created_at DESC
  `;
}

export async function getRivalries(allianceId: number, sql: any): Promise<Rivalry[]> {
  return await sql`
    SELECT alliance1_id AS "alliance1Id", alliance2_id AS "alliance2Id",
           declared_by AS "declaredBy", reason, created_at AS "createdAt"
    FROM alliance_rivalries WHERE alliance1_id = ${allianceId} OR alliance2_id = ${allianceId}
  `;
}

export async function getAllianceStats(allianceId: number, sql: any): Promise<{ totalMembers: number; rivalCount: number }> {
  const [memberCount] = await sql`SELECT COUNT(*) AS count FROM alliance_members WHERE alliance_id = ${allianceId}`;
  const [rivalCount] = await sql`
    SELECT COUNT(*) AS count FROM alliance_rivalries
    WHERE alliance1_id = ${allianceId} OR alliance2_id = ${allianceId}
  `;
  return { totalMembers: parseInt(memberCount.count), rivalCount: parseInt(rivalCount.count) };
}
