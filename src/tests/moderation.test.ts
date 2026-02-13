import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTO_MUTE_DURATION_MS,
  REPORT_THRESHOLD,
  banAgent,
  isBanned,
  isMuted,
  muteAgent,
  reportAgent,
  resetModeration,
  unbanAgent,
  unmuteAgent,
} from '../services/moderation.js';

describe('moderation service', () => {
  beforeEach(() => {
    resetModeration();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muteAgent makes isMuted return true', () => {
    muteAgent('agent-1', 30_000, 'spam');

    expect(isMuted('agent-1')).toBe(true);
  });

  it('isMuted returns false after expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    muteAgent('agent-1', 1_000, 'spam');
    expect(isMuted('agent-1')).toBe(true);

    vi.advanceTimersByTime(1_001);
    expect(isMuted('agent-1')).toBe(false);
  });

  it('unmuteAgent makes isMuted return false', () => {
    muteAgent('agent-1', 30_000, 'spam');
    unmuteAgent('agent-1');

    expect(isMuted('agent-1')).toBe(false);
  });

  it('banAgent makes isBanned return true', () => {
    banAgent('agent-1', 'abuse');

    expect(isBanned('agent-1')).toBe(true);
  });

  it('unbanAgent makes isBanned return false', () => {
    banAgent('agent-1', 'abuse');
    unbanAgent('agent-1');

    expect(isBanned('agent-1')).toBe(false);
  });

  it("room-specific ban doesn't affect other rooms", () => {
    banAgent('agent-1', 'abuse', 'room-1');

    expect(isBanned('agent-1', 'room-1')).toBe(true);
    expect(isBanned('agent-1', 'room-2')).toBe(false);
  });

  it('reportAgent auto-mutes after threshold', () => {
    for (let i = 1; i < REPORT_THRESHOLD; i += 1) {
      const result = reportAgent(`reporter-${i}`, 'target-1', 'spam');
      expect(result.autoMuted).toBe(false);
    }

    const thresholdResult = reportAgent(
      `reporter-${REPORT_THRESHOLD}`,
      'target-1',
      'spam'
    );

    expect(thresholdResult.autoMuted).toBe(true);
    expect(isMuted('target-1')).toBe(true);
  });

  it('resetModeration clears all state', () => {
    muteAgent('agent-1', AUTO_MUTE_DURATION_MS, 'spam');
    banAgent('agent-2', 'abuse');
    reportAgent('reporter-1', 'target-1', 'spam');

    resetModeration();

    expect(isMuted('agent-1')).toBe(false);
    expect(isBanned('agent-2')).toBe(false);
    expect(reportAgent('reporter-2', 'target-1', 'spam')).toEqual({ autoMuted: false });
  });
});
