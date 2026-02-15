/**
 * Agent Profiles Service - Manage profile customization and preferences
 */

export type AgentProfile = {
  agentId: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerColor: string;
  accentColor: string;
  theme: 'dark' | 'light' | 'retro' | 'neon' | 'ocean';
  profileViews: number;
  showOnlineStatus: boolean;
  showActivity: boolean;
  updatedAt: Date;
};

export type ProfileUpdate = {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  bannerColor?: string;
  accentColor?: string;
  theme?: 'dark' | 'light' | 'retro' | 'neon' | 'ocean';
  showOnlineStatus?: boolean;
  showActivity?: boolean;
};

export type ProfileStats = { profileViews: number; completionPercentage: number };

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const MAX_BIO_LENGTH = 500;
const MAX_DISPLAY_NAME_LENGTH = 50;

export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

export async function getProfile(agentId: string, viewerId: string | null, sql: any): Promise<AgentProfile> {
  if (viewerId && viewerId !== agentId) {
    await sql`UPDATE agent_profiles SET profile_views = profile_views + 1 WHERE agent_id = ${agentId}`;
  }

  const result = await sql`
    SELECT agent_id AS "agentId", display_name AS "displayName", bio, avatar_url AS "avatarUrl",
           banner_color AS "bannerColor", accent_color AS "accentColor", theme,
           profile_views AS "profileViews", show_online_status AS "showOnlineStatus",
           show_activity AS "showActivity", updated_at AS "updatedAt"
    FROM agent_profiles WHERE agent_id = ${agentId}
  `;

  if (result.length === 0) {
    return {
      agentId, displayName: null, bio: null, avatarUrl: null,
      bannerColor: '#1a1a2e', accentColor: '#e94560', theme: 'dark',
      profileViews: 0, showOnlineStatus: true, showActivity: true, updatedAt: new Date(),
    };
  }
  return result[0];
}

export async function updateProfile(agentId: string, updates: ProfileUpdate, sql: any): Promise<AgentProfile> {
  if (updates.bio && updates.bio.length > MAX_BIO_LENGTH) {
    throw new Error(`Bio exceeds maximum length of ${MAX_BIO_LENGTH} characters`);
  }
  if (updates.displayName && updates.displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new Error(`Display name exceeds maximum length of ${MAX_DISPLAY_NAME_LENGTH} characters`);
  }
  if (updates.bannerColor && !isValidHexColor(updates.bannerColor)) {
    throw new Error('Invalid banner color format (must be #RRGGBB)');
  }
  if (updates.accentColor && !isValidHexColor(updates.accentColor)) {
    throw new Error('Invalid accent color format (must be #RRGGBB)');
  }

  const result = await sql`
    INSERT INTO agent_profiles (
      agent_id, display_name, bio, avatar_url, banner_color, accent_color, 
      theme, show_online_status, show_activity, updated_at
    ) VALUES (
      ${agentId}, ${updates.displayName ?? null}, ${updates.bio ?? null},
      ${updates.avatarUrl ?? null}, ${updates.bannerColor ?? '#1a1a2e'},
      ${updates.accentColor ?? '#e94560'}, ${updates.theme ?? 'dark'},
      ${updates.showOnlineStatus ?? true}, ${updates.showActivity ?? true}, NOW()
    )
    ON CONFLICT (agent_id) DO UPDATE SET
      display_name = COALESCE(${updates.displayName}, agent_profiles.display_name),
      bio = COALESCE(${updates.bio}, agent_profiles.bio),
      avatar_url = COALESCE(${updates.avatarUrl}, agent_profiles.avatar_url),
      banner_color = COALESCE(${updates.bannerColor}, agent_profiles.banner_color),
      accent_color = COALESCE(${updates.accentColor}, agent_profiles.accent_color),
      theme = COALESCE(${updates.theme}, agent_profiles.theme),
      show_online_status = COALESCE(${updates.showOnlineStatus}, agent_profiles.show_online_status),
      show_activity = COALESCE(${updates.showActivity}, agent_profiles.show_activity),
      updated_at = NOW()
    RETURNING agent_id AS "agentId", display_name AS "displayName", bio,
              avatar_url AS "avatarUrl", banner_color AS "bannerColor",
              accent_color AS "accentColor", theme, profile_views AS "profileViews",
              show_online_status AS "showOnlineStatus", show_activity AS "showActivity",
              updated_at AS "updatedAt"
  `;
  return result[0];
}

export async function getTopViewed(limit: number, sql: any): Promise<AgentProfile[]> {
  return await sql`
    SELECT agent_id AS "agentId", display_name AS "displayName", bio, avatar_url AS "avatarUrl",
           banner_color AS "bannerColor", accent_color AS "accentColor", theme,
           profile_views AS "profileViews", show_online_status AS "showOnlineStatus",
           show_activity AS "showActivity", updated_at AS "updatedAt"
    FROM agent_profiles WHERE profile_views > 0
    ORDER BY profile_views DESC LIMIT ${limit}
  `;
}

export async function searchProfiles(query: string, sql: any): Promise<AgentProfile[]> {
  return await sql`
    SELECT agent_id AS "agentId", display_name AS "displayName", bio, avatar_url AS "avatarUrl",
           banner_color AS "bannerColor", accent_color AS "accentColor", theme,
           profile_views AS "profileViews", show_online_status AS "showOnlineStatus",
           show_activity AS "showActivity", updated_at AS "updatedAt"
    FROM agent_profiles WHERE display_name ILIKE ${`%${query}%`}
    ORDER BY profile_views DESC LIMIT 20
  `;
}

export async function getOnlineProfiles(sql: any): Promise<AgentProfile[]> {
  return await sql`
    SELECT agent_id AS "agentId", display_name AS "displayName", bio, avatar_url AS "avatarUrl",
           banner_color AS "bannerColor", accent_color AS "accentColor", theme,
           profile_views AS "profileViews", show_online_status AS "showOnlineStatus",
           show_activity AS "showActivity", updated_at AS "updatedAt"
    FROM agent_profiles WHERE show_online_status = true ORDER BY updated_at DESC
  `;
}

export async function getProfileStats(agentId: string, sql: any): Promise<ProfileStats> {
  const profile = await getProfile(agentId, null, sql);
  const fields = [
    profile.displayName, profile.bio, profile.avatarUrl,
    profile.bannerColor !== '#1a1a2e', profile.accentColor !== '#e94560', profile.theme !== 'dark',
  ];
  const completionPercentage = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  return { profileViews: profile.profileViews, completionPercentage };
}
