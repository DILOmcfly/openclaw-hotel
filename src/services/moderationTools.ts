import { sql } from '../db/index.js';

export interface ModerationAction {
  id: string;
  agent_id: string;
  action_type: 'mute' | 'ban' | 'ip_ban' | 'kick' | 'warn';
  reason: string | null;
  muted_until: Date | null;
  ip_address: string | null;
  moderator_id: string;
  created_at: Date;
  expires_at: Date | null;
  is_active: boolean;
}

export interface WordFilter {
  id: string;
  pattern: string;
  severity: 'low' | 'medium' | 'high';
  action: 'flag' | 'block' | 'auto_mute';
  auto_mute_duration_minutes: number | null;
  created_by: string | null;
  created_at: Date;
  is_active: boolean;
}

export interface FilterCheckResult {
  blocked: boolean;
  flagged: boolean;
  autoMute: boolean;
  muteDurationMinutes: number | null;
  matchedFilters: string[];
}

/**
 * Mute an agent for a specific duration
 */
export async function muteAgent(
  agentId: string,
  moderatorId: string,
  durationMinutes: number | null, // null = permanent
  reason: string,
  db: any = sql
): Promise<ModerationAction> {
  const expiresAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;

  const result = await db`
    INSERT INTO moderation_actions 
    (agent_id, action_type, reason, expires_at, moderator_id, is_active)
    VALUES (${agentId}, 'mute', ${reason}, ${expiresAt}, ${moderatorId}, TRUE)
    RETURNING *
  `;

  return result[0];
}

/**
 * Unmute an agent by deactivating all active mutes
 */
export async function unmuteAgent(agentId: string, db: any = sql): Promise<void> {
  await db`
    UPDATE moderation_actions 
    SET is_active = FALSE 
    WHERE agent_id = ${agentId} AND action_type = 'mute' AND is_active = TRUE
  `;
}

/**
 * Check if an agent is currently muted
 */
export async function isAgentMuted(agentId: string, db: any = sql): Promise<boolean> {
  const result = await db`
    SELECT COUNT(*) as count FROM moderation_actions 
    WHERE agent_id = ${agentId} 
      AND action_type = 'mute' 
      AND is_active = TRUE 
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `;

  return parseInt(result[0]?.count ?? '0', 10) > 0;
}

/**
 * Get active mute details for an agent
 */
export async function getActiveMute(agentId: string, db: any = sql): Promise<ModerationAction | null> {
  const result = await db`
    SELECT * FROM moderation_actions 
    WHERE agent_id = ${agentId} 
      AND action_type = 'mute' 
      AND is_active = TRUE 
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  return result[0] ?? null;
}

/**
 * Ban an IP address
 */
export async function banIP(
  ipAddress: string,
  moderatorId: string,
  reason: string,
  durationMinutes: number | null = null, // null = permanent
  db: any = sql
): Promise<ModerationAction> {
  const expiresAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;

  const result = await db`
    INSERT INTO moderation_actions 
    (agent_id, action_type, reason, ip_address, expires_at, moderator_id, is_active)
    VALUES ('00000000-0000-0000-0000-000000000000', 'ip_ban', ${reason}, ${ipAddress}, ${expiresAt}, ${moderatorId}, TRUE)
    RETURNING *
  `;

  return result[0];
}

/**
 * Check if an IP address is banned
 */
export async function isIPBanned(ipAddress: string, db: any = sql): Promise<boolean> {
  const result = await db`
    SELECT COUNT(*) as count FROM moderation_actions 
    WHERE ip_address = ${ipAddress} 
      AND action_type = 'ip_ban' 
      AND is_active = TRUE 
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `;

  return parseInt(result[0]?.count ?? '0', 10) > 0;
}

/**
 * Check message content against word filters
 */
export async function checkMessageFilters(message: string, db: any = sql): Promise<FilterCheckResult> {
  const result = await db`
    SELECT * FROM word_filters WHERE is_active = TRUE
  `;

  const filters = result;
  const matched: string[] = [];
  let blocked = false;
  let flagged = false;
  let autoMute = false;
  let muteDurationMinutes: number | null = null;

  const lowerMessage = message.toLowerCase();

  for (const filter of filters) {
    try {
      const regex = new RegExp(filter.pattern, 'i');
      if (regex.test(lowerMessage)) {
        matched.push(filter.pattern);

        if (filter.action === 'block') {
          blocked = true;
        } else if (filter.action === 'flag') {
          flagged = true;
        } else if (filter.action === 'auto_mute') {
          autoMute = true;
          muteDurationMinutes = filter.auto_mute_duration_minutes;
        }
      }
    } catch (err) {
      console.error(`Invalid regex pattern: ${filter.pattern}`, err);
    }
  }

  return {
    blocked,
    flagged,
    autoMute,
    muteDurationMinutes,
    matchedFilters: matched,
  };
}

/**
 * Add a new word filter
 */
export async function addWordFilter(
  pattern: string,
  severity: 'low' | 'medium' | 'high',
  action: 'flag' | 'block' | 'auto_mute',
  autoMuteDurationMinutes: number | null,
  createdBy: string,
  db: any = sql
): Promise<WordFilter> {
  // Validate regex
  try {
    new RegExp(pattern);
  } catch (err) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }

  const result = await db`
    INSERT INTO word_filters 
    (pattern, severity, action, auto_mute_duration_minutes, created_by, is_active)
    VALUES (${pattern}, ${severity}, ${action}, ${autoMuteDurationMinutes}, ${createdBy}, TRUE)
    RETURNING *
  `;

  return result[0];
}

/**
 * Get all word filters
 */
export async function getWordFilters(db: any = sql): Promise<WordFilter[]> {
  const result = await db`
    SELECT * FROM word_filters ORDER BY severity DESC, created_at DESC
  `;

  return result;
}

/**
 * Delete a word filter
 */
export async function deleteWordFilter(filterId: string, db: any = sql): Promise<void> {
  await db`UPDATE word_filters SET is_active = FALSE WHERE id = ${filterId}`;
}

/**
 * Get moderation history for an agent
 */
export async function getModerationHistory(
  agentId: string,
  limit = 50,
  db: any = sql
): Promise<ModerationAction[]> {
  const result = await db`
    SELECT * FROM moderation_actions 
    WHERE agent_id = ${agentId} 
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `;

  return result;
}

/**
 * Cleanup expired moderation actions (run periodically)
 */
export async function cleanupExpiredActions(db: any = sql): Promise<number> {
  const result = await db`
    UPDATE moderation_actions 
    SET is_active = FALSE 
    WHERE is_active = TRUE 
      AND expires_at IS NOT NULL 
      AND expires_at < CURRENT_TIMESTAMP
  `;

  return result.count ?? 0;
}
