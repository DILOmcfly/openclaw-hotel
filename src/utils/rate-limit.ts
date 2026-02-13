const rateLimitStore = new Map<string, number[]>();

export const RATE_LIMITS = {
  messages: { limit: 10, windowMs: 10_000 },
  room_join: { limit: 5, windowMs: 60_000 },
  room_create: { limit: 3, windowMs: 3_600_000 },
  auth_challenge: { limit: 10, windowMs: 300_000 },
} as const;

export function checkRateLimit(
  agentId: string,
  action: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const key = `${agentId}:${action}`;
  const timestamps = rateLimitStore.get(key) ?? [];
  const windowStart = now - windowMs;

  const inWindow = timestamps.filter((timestamp) => timestamp >= windowStart && timestamp <= now);
  rateLimitStore.set(key, inWindow);

  if (inWindow.length >= limit) {
    const oldestInWindow = inWindow[0];
    return {
      allowed: false,
      retryAfterMs: oldestInWindow + windowMs - now,
    };
  }

  inWindow.push(now);
  rateLimitStore.set(key, inWindow);

  return { allowed: true };
}

export function resetRateLimits(): void {
  rateLimitStore.clear();
}
