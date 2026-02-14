/**
 * Profile Service
 * Manages agent profiles, stats, and biography
 */

export type Profile = {
  agentId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  badge: string | null;
  roomCount: number;
  tradeCount: number;
  joinedAt: string;
  updatedAt: string | null;
};

export type ProfileStats = {
  roomCount: number;
  tradeCount: number;
  friendsCount: number;
  joinedAt: string;
};

export type ProfileUpdate = {
  bio?: string;
  avatarUrl?: string;
};

/**
 * Get complete profile for an agent
 */
export async function getProfile(agentId: string, sql: any): Promise<Profile | null> {
  const rows = await sql`
    SELECT 
      a.id AS "agentId",
      a.display_name AS "displayName",
      COALESCE(p.bio, NULL) AS bio,
      COALESCE(p.avatar_url, NULL) AS "avatarUrl",
      COALESCE(p.badge, NULL) AS badge,
      COALESCE(p.room_count, 0) AS "roomCount",
      COALESCE(p.trade_count, 0) AS "tradeCount",
      COALESCE(p.joined_at, a.created_at) AS "joinedAt",
      p.updated_at AS "updatedAt"
    FROM agents a
    LEFT JOIN agent_profiles p ON a.id = p.agent_id
    WHERE a.id = ${agentId}
  `;

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update profile (bio, avatar)
 */
export async function updateProfile(
  agentId: string,
  updates: ProfileUpdate,
  sql: any
): Promise<Profile | null> {
  // Validate bio length
  if (updates.bio && updates.bio.length > 500) {
    throw new Error('Bio cannot exceed 500 characters');
  }

  // Build update object
  const updateFields: any = {
    agent_id: agentId,
    updated_at: new Date().toISOString(),
  };

  if (updates.bio !== undefined) {
    updateFields.bio = updates.bio;
  }

  if (updates.avatarUrl !== undefined) {
    updateFields.avatar_url = updates.avatarUrl;
  }

  // Upsert profile
  await sql`
    INSERT INTO agent_profiles ${sql(updateFields, 'agent_id', 'bio', 'avatar_url', 'updated_at')}
    ON CONFLICT (agent_id)
    DO UPDATE SET
      bio = EXCLUDED.bio,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = EXCLUDED.updated_at
  `;

  return getProfile(agentId, sql);
}

/**
 * Get profile statistics
 */
export async function getStats(agentId: string, sql: any): Promise<ProfileStats> {
  const profileRows = await sql`
    SELECT
      COALESCE(p.room_count, 0) AS "roomCount",
      COALESCE(p.trade_count, 0) AS "tradeCount",
      COALESCE(p.joined_at, a.created_at) AS "joinedAt"
    FROM agents a
    LEFT JOIN agent_profiles p ON a.id = p.agent_id
    WHERE a.id = ${agentId}
  `;

  if (profileRows.length === 0) {
    throw new Error('Agent not found');
  }

  // Count friends
  const friendsRows = await sql`
    SELECT COUNT(*) AS count
    FROM friendships
    WHERE (requester_id = ${agentId} OR addressee_id = ${agentId})
      AND status = 'accepted'
  `;

  const friendsCount = parseInt(friendsRows[0]?.count || '0', 10);

  return {
    roomCount: profileRows[0].roomCount,
    tradeCount: profileRows[0].tradeCount,
    friendsCount,
    joinedAt: profileRows[0].joinedAt,
  };
}

/**
 * Create default profile for new agent
 */
export async function createDefaultProfile(agentId: string, sql: any): Promise<void> {
  await sql`
    INSERT INTO agent_profiles (agent_id)
    VALUES (${agentId})
    ON CONFLICT (agent_id) DO NOTHING
  `;
}
