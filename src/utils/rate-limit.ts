export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface SlidingWindowEntry {
  timestamps: number[];
}

export interface LimitConfig {
  limit: number;
  windowMs: number;
}

export class SlidingWindowRateLimiter {
  private readonly windows = new Map<string, SlidingWindowEntry>();

  check(key: string, config: LimitConfig, now = Date.now()): RateLimitResult {
    const windowStart = now - config.windowMs;
    const entry = this.windows.get(key) ?? { timestamps: [] };

    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    if (entry.timestamps.length >= config.limit) {
      this.windows.set(key, entry);
      const oldest = entry.timestamps[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, config.windowMs - (now - oldest)),
      };
    }

    entry.timestamps.push(now);
    this.windows.set(key, entry);

    return {
      allowed: true,
      remaining: config.limit - entry.timestamps.length,
      retryAfterMs: 0,
    };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  prune(now = Date.now()): void {
    for (const [key, entry] of this.windows) {
      if (entry.timestamps.length === 0) {
        this.windows.delete(key);
        continue;
      }

      const maxTs = Math.max(...entry.timestamps);
      if (now - maxTs > 60 * 60 * 1000) {
        this.windows.delete(key);
      }
    }
  }
}
