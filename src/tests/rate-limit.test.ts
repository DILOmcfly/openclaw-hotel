import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, resetRateLimits } from '../utils/rate-limit.js';

describe('rate limit utility', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useRealTimers();
  });

  it('allows requests under limit', () => {
    const first = checkRateLimit('agent-1', 'messages', 3, 10_000);
    const second = checkRateLimit('agent-1', 'messages', 3, 10_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it('blocks request at limit and returns retryAfterMs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    expect(checkRateLimit('agent-1', 'messages', 2, 1_000)).toEqual({ allowed: true });
    expect(checkRateLimit('agent-1', 'messages', 2, 1_000)).toEqual({ allowed: true });

    const blocked = checkRateLimit('agent-1', 'messages', 2, 1_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(1_000);
  });

  it('allows again after window passes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    expect(checkRateLimit('agent-1', 'messages', 1, 1_000)).toEqual({ allowed: true });
    expect(checkRateLimit('agent-1', 'messages', 1, 1_000).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(checkRateLimit('agent-1', 'messages', 1, 1_000)).toEqual({ allowed: true });
  });

  it('treats different actions as independent buckets', () => {
    expect(checkRateLimit('agent-1', 'messages', 1, 10_000)).toEqual({ allowed: true });
    expect(checkRateLimit('agent-1', 'messages', 1, 10_000).allowed).toBe(false);

    expect(checkRateLimit('agent-1', 'room_join', 1, 10_000)).toEqual({ allowed: true });
  });

  it('resetRateLimits clears existing state', () => {
    expect(checkRateLimit('agent-1', 'messages', 1, 10_000)).toEqual({ allowed: true });
    expect(checkRateLimit('agent-1', 'messages', 1, 10_000).allowed).toBe(false);

    resetRateLimits();

    expect(checkRateLimit('agent-1', 'messages', 1, 10_000)).toEqual({ allowed: true });
  });
});
