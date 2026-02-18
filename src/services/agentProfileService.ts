/**
 * agentProfileService.ts — T-363: Agent Mini-Profile Popover
 *
 * Aggregates agent data for the mini-profile popover:
 *   - name, avatar color
 *   - top 3 badges (via badgeDisplayService)
 *   - current mood emoji (via moodService)
 *   - last 3 messages
 *   - stats: messages sent, trades completed, rooms visited
 *
 * Design:
 *   - Pure functions, fully injectable dependencies (sql, services)
 *   - Module-level cache with TTL to avoid redundant DB queries
 *   - Zero circular imports (no handler.ts references)
 */

import {
  getTopBadges,
  type BadgeInfo,
} from './badgeDisplayService.js';

import {
  deriveMood,
  moodToEmoji,
  type ActivityMood,
} from './moodService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecentMessage {
  id: string;
  text: string;
  sentAt: Date;
}

export interface AgentStats {
  /** Total chat messages sent by this agent */
  messageCount: number;
  /** Total completed trades involving this agent */
  tradeCount: number;
  /** Total distinct rooms visited by this agent */
  roomCount: number;
}

export interface AgentMiniProfile {
  agentId: string;
  name: string;
  /** Hex color string, e.g. "#ff6b6b" */
  avatarColor: string;
  /** Top 3 equipped badges */
  badges: BadgeInfo[];
  /** Current mood identifier */
  mood: ActivityMood;
  /** Emoji representation of the current mood */
  moodEmoji: string;
  /** Last 3 messages (newest first) */
  recentMessages: RecentMessage[];
  stats: AgentStats;
  /** Unix ms timestamp when this profile was assembled */
  cachedAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Cache TTL in milliseconds (20 s) */
export const PROFILE_CACHE_TTL_MS = 20_000;

/** Maximum number of recent messages returned */
export const MAX_RECENT_MESSAGES = 3;

/** Maximum number of badges shown */
export const MAX_BADGES = 3;

/** Default avatar color when none is stored */
export const DEFAULT_AVATAR_COLOR = '#4ecdc4';

// ─── In-memory cache ──────────────────────────────────────────────────────────

const _profileCache = new Map<string, AgentMiniProfile>();

/** Return the number of cached profile entries (useful for tests). */
export function getProfileCacheSize(): number {
  return _profileCache.size;
}

/** Return true when an agent's cache entry is still within TTL. */
export function isProfileCacheValid(
  agentId: string,
  now: number = Date.now(),
): boolean {
  const entry = _profileCache.get(agentId);
  if (!entry) return false;
  return now - entry.cachedAt < PROFILE_CACHE_TTL_MS;
}

/** Remove a single agent's cached profile. */
export function invalidateProfileCache(agentId: string): void {
  _profileCache.delete(agentId);
}

/** Clear the entire profile cache. */
export function clearProfileCache(): void {
  _profileCache.clear();
}

/** Seed the cache with a pre-built profile (used in tests / warm-up). */
export function setProfileCacheEntry(profile: AgentMiniProfile): void {
  _profileCache.set(profile.agentId, profile);
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Convert a numeric PixiJS tint color (0xRRGGBB) to a CSS hex string.
 * Falls back to DEFAULT_AVATAR_COLOR for invalid values.
 */
export function numberToHexColor(color: number | null | undefined): string {
  if (color == null || !Number.isFinite(color) || color < 0) {
    return DEFAULT_AVATAR_COLOR;
  }
  return `#${Math.floor(color).toString(16).padStart(6, '0')}`;
}

/**
 * Truncate a message to `maxLen` characters, appending '…' if cut.
 */
export function truncateMessage(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

/**
 * Sort messages newest-first and return only the first `limit`.
 * Non-mutating.
 */
export function pickRecentMessages(
  messages: RecentMessage[],
  limit = MAX_RECENT_MESSAGES,
): RecentMessage[] {
  return [...messages]
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
    .slice(0, limit);
}

/**
 * Derive the current mood for an agent given their last activity details.
 * Returns { mood, moodEmoji }.
 */
export function deriveAgentMood(
  activityType: 'chat' | 'trade' | 'achievement' | 'idle' | 'default',
  idleSinceMs?: number,
  now: number = Date.now(),
): { mood: ActivityMood; moodEmoji: string } {
  const mood = deriveMood({ type: activityType, idleSince: idleSinceMs, now });
  return { mood, moodEmoji: moodToEmoji(mood) };
}

// ─── Data fetchers (DB-dependent, injectable) ─────────────────────────────────

/**
 * Fetch the agent's display name and avatar color from DB.
 * Returns defaults when the row is not found.
 */
export async function fetchAgentIdentity(
  agentId: string,
  sql: any,
): Promise<{ name: string; avatarColor: string }> {
  const rows = await sql`
    SELECT
      COALESCE(ap.display_name, a.name, 'Unknown') AS name,
      a.color
    FROM agents a
    LEFT JOIN agent_profiles ap ON ap.agent_id = a.id
    WHERE a.id = ${agentId}
    LIMIT 1
  `;

  if (!rows.length) {
    return { name: 'Unknown', avatarColor: DEFAULT_AVATAR_COLOR };
  }

  const row = rows[0];
  return {
    name: row.name ?? 'Unknown',
    avatarColor: numberToHexColor(row.color),
  };
}

/**
 * Fetch the agent's aggregate stats (messages, trades, rooms) from DB.
 */
export async function fetchAgentStats(
  agentId: string,
  sql: any,
): Promise<AgentStats> {
  const [msgRow, tradeRow, roomRow] = await Promise.all([
    sql`
      SELECT COUNT(*) AS count
      FROM chat_messages
      WHERE agent_id = ${agentId}
        AND message_type = 'chat'
    `,
    sql`
      SELECT COUNT(*) AS count
      FROM trades
      WHERE (initiator_id = ${agentId} OR receiver_id = ${agentId})
        AND status = 'completed'
    `,
    sql`
      SELECT COUNT(DISTINCT room_id) AS count
      FROM visitor_log
      WHERE agent_id = ${agentId}
    `,
  ]);

  return {
    messageCount: Number(msgRow[0]?.count ?? 0),
    tradeCount:   Number(tradeRow[0]?.count ?? 0),
    roomCount:    Number(roomRow[0]?.count ?? 0),
  };
}

/**
 * Fetch the last `MAX_RECENT_MESSAGES` chat messages from this agent.
 */
export async function fetchRecentMessages(
  agentId: string,
  sql: any,
): Promise<RecentMessage[]> {
  const rows = await sql`
    SELECT id, message, created_at AS "sentAt"
    FROM chat_messages
    WHERE agent_id = ${agentId}
      AND message_type = 'chat'
    ORDER BY created_at DESC
    LIMIT ${MAX_RECENT_MESSAGES}
  `;

  return rows.map((r: any) => ({
    id:     r.id,
    text:   truncateMessage(r.message),
    sentAt: new Date(r.sentAt),
  }));
}

// ─── Main aggregator ──────────────────────────────────────────────────────────

/**
 * Assemble the full mini-profile for an agent.
 *
 * Reads from cache when valid.  Pass `skipCache: true` to force a fresh query.
 *
 * @param agentId         Agent to build profile for
 * @param sql             Database client (tagged-template or compatible mock)
 * @param activityType    Most recent activity type (for mood derivation)
 * @param idleSinceMs     When the agent went idle (ms), if applicable
 * @param options.skipCache  Force bypass of in-memory cache
 * @param options.now        Override Date.now() for tests
 */
export async function getAgentMiniProfile(
  agentId: string,
  sql: any,
  activityType: 'chat' | 'trade' | 'achievement' | 'idle' | 'default' = 'default',
  idleSinceMs?: number,
  options: { skipCache?: boolean; now?: number } = {},
): Promise<AgentMiniProfile> {
  const now = options.now ?? Date.now();

  if (!options.skipCache) {
    const cached = _profileCache.get(agentId);
    if (cached && now - cached.cachedAt < PROFILE_CACHE_TTL_MS) {
      return cached;
    }
  }

  const [identity, badges, recentMessages, stats] = await Promise.all([
    fetchAgentIdentity(agentId, sql),
    getTopBadges(agentId, sql, { now }),
    fetchRecentMessages(agentId, sql),
    fetchAgentStats(agentId, sql),
  ]);

  const { mood, moodEmoji } = deriveAgentMood(activityType, idleSinceMs, now);

  const profile: AgentMiniProfile = {
    agentId,
    name:           identity.name,
    avatarColor:    identity.avatarColor,
    badges:         badges.slice(0, MAX_BADGES),
    mood,
    moodEmoji,
    recentMessages: pickRecentMessages(recentMessages),
    stats,
    cachedAt:       now,
  };

  _profileCache.set(agentId, profile);
  return profile;
}
