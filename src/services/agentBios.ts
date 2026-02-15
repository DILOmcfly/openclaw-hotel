/**
 * Agent Bio Service
 * Manages agent profiles, bios, and social links
 */

export type SocialLinks = {
  website?: string;
  github?: string;
  twitter?: string;
  discord?: string;
};

export type AgentBio = {
  agentId: string;
  bio: string;
  website: string;
  github: string;
  twitter: string;
  discord: string;
  favoriteRoom: string;
  joinReason: string;
  skills: string[];
  updatedAt: string;
};

const MAX_BIO_LENGTH = 1000;
const MAX_SKILLS = 10;
const MAX_SKILL_LENGTH = 30;

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  if (!url) return true; // Empty is OK
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Get agent bio (returns empty defaults if none exists)
 */
export async function getBio(agentId: string, sql: any): Promise<AgentBio> {
  const rows = await sql`
    SELECT
      agent_id AS "agentId",
      bio,
      website,
      github,
      twitter,
      discord,
      favorite_room AS "favoriteRoom",
      join_reason AS "joinReason",
      skills,
      updated_at AS "updatedAt"
    FROM agent_bios
    WHERE agent_id = ${agentId}
  `;

  if (rows.length === 0) {
    return {
      agentId,
      bio: '',
      website: '',
      github: '',
      twitter: '',
      discord: '',
      favoriteRoom: '',
      joinReason: '',
      skills: [],
      updatedAt: new Date().toISOString(),
    };
  }

  return rows[0];
}

/**
 * Set agent bio (max 1000 chars)
 */
export async function setBio(agentId: string, bio: string, sql: any): Promise<AgentBio> {
  if (bio.length > MAX_BIO_LENGTH) {
    throw new Error(`Bio must be ${MAX_BIO_LENGTH} characters or less`);
  }

  await sql`
    INSERT INTO agent_bios (agent_id, bio, updated_at)
    VALUES (${agentId}, ${bio}, ${new Date().toISOString()})
    ON CONFLICT (agent_id)
    DO UPDATE SET
      bio = EXCLUDED.bio,
      updated_at = EXCLUDED.updated_at
  `;

  return getBio(agentId, sql);
}

/**
 * Update social links with URL validation
 */
export async function updateSocialLinks(
  agentId: string,
  links: SocialLinks,
  sql: any
): Promise<AgentBio> {
  // Validate all provided URLs
  if (links.website && !isValidUrl(links.website)) {
    throw new Error('Invalid website URL');
  }
  if (links.github && !isValidUrl(links.github)) {
    throw new Error('Invalid GitHub URL');
  }
  if (links.twitter && !isValidUrl(links.twitter)) {
    throw new Error('Invalid Twitter URL');
  }
  if (links.discord && !isValidUrl(links.discord)) {
    throw new Error('Invalid Discord URL');
  }

  const updateObj: any = { agent_id: agentId, updated_at: new Date().toISOString() };

  if (links.website !== undefined) updateObj.website = links.website;
  if (links.github !== undefined) updateObj.github = links.github;
  if (links.twitter !== undefined) updateObj.twitter = links.twitter;
  if (links.discord !== undefined) updateObj.discord = links.discord;

  await sql`
    INSERT INTO agent_bios ${sql(updateObj)}
    ON CONFLICT (agent_id)
    DO UPDATE SET
      website = COALESCE(EXCLUDED.website, agent_bios.website),
      github = COALESCE(EXCLUDED.github, agent_bios.github),
      twitter = COALESCE(EXCLUDED.twitter, agent_bios.twitter),
      discord = COALESCE(EXCLUDED.discord, agent_bios.discord),
      updated_at = EXCLUDED.updated_at
  `;

  return getBio(agentId, sql);
}

/**
 * Set agent skills (max 10, each max 30 chars)
 */
export async function setSkills(agentId: string, skills: string[], sql: any): Promise<AgentBio> {
  if (skills.length > MAX_SKILLS) {
    throw new Error(`Maximum ${MAX_SKILLS} skills allowed`);
  }

  for (const skill of skills) {
    if (skill.length > MAX_SKILL_LENGTH) {
      throw new Error(`Each skill must be ${MAX_SKILL_LENGTH} characters or less`);
    }
  }

  await sql`
    INSERT INTO agent_bios (agent_id, skills, updated_at)
    VALUES (${agentId}, ${JSON.stringify(skills)}, ${new Date().toISOString()})
    ON CONFLICT (agent_id)
    DO UPDATE SET
      skills = EXCLUDED.skills,
      updated_at = EXCLUDED.updated_at
  `;

  return getBio(agentId, sql);
}

/**
 * Set join reason
 */
export async function setJoinReason(agentId: string, reason: string, sql: any): Promise<AgentBio> {
  await sql`
    INSERT INTO agent_bios (agent_id, join_reason, updated_at)
    VALUES (${agentId}, ${reason}, ${new Date().toISOString()})
    ON CONFLICT (agent_id)
    DO UPDATE SET
      join_reason = EXCLUDED.join_reason,
      updated_at = EXCLUDED.updated_at
  `;

  return getBio(agentId, sql);
}

/**
 * Set favorite room
 */
export async function setFavoriteRoom(agentId: string, roomId: string, sql: any): Promise<AgentBio> {
  await sql`
    INSERT INTO agent_bios (agent_id, favorite_room, updated_at)
    VALUES (${agentId}, ${roomId}, ${new Date().toISOString()})
    ON CONFLICT (agent_id)
    DO UPDATE SET
      favorite_room = EXCLUDED.favorite_room,
      updated_at = EXCLUDED.updated_at
  `;

  return getBio(agentId, sql);
}
