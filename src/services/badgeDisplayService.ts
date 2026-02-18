/**
 * Badge Display Service — T-361
 *
 * Fetches the top 3 equipped badges per agent, caches results to reduce DB
 * round-trips, and broadcasts badge update messages to room spectators when
 * an achievement is unlocked.
 *
 * Design goals:
 *  - Zero circular imports (does NOT import from handler.ts)
 *  - All external dependencies injected → easy to unit-test
 *  - Cache is module-scoped (singleton per process) with TTL
 */

// ── Shared type (mirrors client/src/ui/BadgeRenderer.ts BadgeInfo) ───────────

export interface BadgeInfo {
  id: number;
  name: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum badges fetched / displayed per agent */
export const MAX_BADGES_PER_AGENT = 3;

/** Cache time-to-live in milliseconds (30 s) */
export const CACHE_TTL_MS = 30_000;

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CacheEntry {
  badges: BadgeInfo[];
  cachedAt: number;
}

/** Module-level cache: agentId → entry */
const _cache = new Map<string, CacheEntry>();

// ── Cache management ──────────────────────────────────────────────────────────

/** Return the number of cached entries (useful for tests). */
export function getCacheSize(): number {
  return _cache.size;
}

/** Return true when an agent's cache entry exists and is still within TTL. */
export function isCacheValid(agentId: string, now: number = Date.now()): boolean {
  const entry = _cache.get(agentId);
  if (!entry) return false;
  return now - entry.cachedAt < CACHE_TTL_MS;
}

/** Invalidate (remove) the cached badge list for one agent. */
export function invalidateCache(agentId: string): void {
  _cache.delete(agentId);
}

/** Clear the entire cache — useful in tests and shutdown hooks. */
export function clearCache(): void {
  _cache.clear();
}

/**
 * Manually seed the cache for an agent — used by tests and warm-up paths.
 */
export function setCacheEntry(
  agentId: string,
  badges: BadgeInfo[],
  now: number = Date.now(),
): void {
  _cache.set(agentId, { badges, cachedAt: now });
}

// ── Core fetch logic ──────────────────────────────────────────────────────────

/**
 * Fetch the top `MAX_BADGES_PER_AGENT` **equipped** badges for an agent.
 *
 * Uses the module-level in-memory cache.  Pass `skipCache: true` to force a
 * fresh DB query (e.g. immediately after a badge equip/award).
 *
 * @param agentId   UUID of the agent
 * @param sql       Database client (tagged-template or compatible mock)
 * @param options   skipCache — bypass cache; now — override Date.now() for tests
 */
export async function getTopBadges(
  agentId: string,
  sql: any,
  options: { skipCache?: boolean; now?: number } = {},
): Promise<BadgeInfo[]> {
  const now = options.now ?? Date.now();

  if (!options.skipCache) {
    const cached = _cache.get(agentId);
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return cached.badges;
    }
  }

  // Query DB for equipped badges, oldest first, limited to MAX_BADGES_PER_AGENT
  const rows = await sql`
    SELECT
      b.id,
      b.name,
      b.icon,
      b.rarity,
      b.description,
      ab.earned_at AS "earnedAt"
    FROM badges b
    INNER JOIN agent_badges ab ON b.id = ab.badge_id
    WHERE ab.agent_id = ${agentId}
      AND ab.equipped = true
    ORDER BY ab.earned_at ASC
    LIMIT ${MAX_BADGES_PER_AGENT}
  `;

  const badges: BadgeInfo[] = rows.map((r: any) => ({
    id:          r.id,
    name:        r.name,
    icon:        r.icon,
    rarity:      r.rarity,
    description: r.description,
  }));

  _cache.set(agentId, { badges, cachedAt: now });
  return badges;
}

// ── Broadcast helpers ─────────────────────────────────────────────────────────

/**
 * Broadcast message type sent to spectators when an agent's badges change.
 */
export interface BadgeUpdateMessage {
  type: 'achievement.badgeUpdate';
  agentId: string;
  badges: BadgeInfo[];
  timestamp: string;
}

/**
 * Fetch fresh badges for `agentId`, update the cache, and broadcast an
 * `achievement.badgeUpdate` message to all spectators watching `roomId`.
 *
 * @param agentId     Agent whose badges changed
 * @param roomId      Room the agent is currently in
 * @param broadcastFn Injected broadcast function — e.g. `broadcastToSpectators`
 * @param sql         Database client
 */
export async function broadcastBadgeUpdate(
  agentId: string,
  roomId: string,
  broadcastFn: (roomId: string, message: BadgeUpdateMessage) => void,
  sql: any,
): Promise<void> {
  invalidateCache(agentId);
  const badges = await getTopBadges(agentId, sql, { skipCache: true });

  broadcastFn(roomId, {
    type: 'achievement.badgeUpdate',
    agentId,
    badges,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Achievement-unlocked handler — T-361 step 4.
 *
 * Called from the achievement award flow (achievements.ts `awardBadge`).
 * Finds the room the agent is currently in, fetches their fresh badge list,
 * and broadcasts both an `achievement.unlocked` and an `achievement.badgeUpdate`
 * event to room spectators.
 *
 * @param agentId         Agent who just earned an achievement
 * @param achievementName Display name of the achievement
 * @param sql             Database client
 * @param broadcastFn     Injected spectator broadcast (broadcastToSpectators)
 * @param getRoomId       Returns the roomId the agent is currently in, or undefined
 */
export async function handleAchievementUnlocked(
  agentId: string,
  achievementName: string,
  sql: any,
  broadcastFn: (roomId: string, message: any) => void,
  getRoomId: (agentId: string) => string | undefined,
): Promise<void> {
  const roomId = getRoomId(agentId);
  if (!roomId) return; // Agent not in any room — nothing to broadcast

  invalidateCache(agentId);
  const badges = await getTopBadges(agentId, sql, { skipCache: true });

  const timestamp = new Date().toISOString();

  // 1. Notify spectators about the achievement unlock event
  broadcastFn(roomId, {
    type: 'achievement.unlocked',
    agentId,
    achievementName,
    timestamp,
  });

  // 2. Follow up with the updated badge list
  broadcastFn(roomId, {
    type: 'achievement.badgeUpdate',
    agentId,
    badges,
    timestamp,
  });
}
