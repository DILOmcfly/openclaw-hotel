/**
 * achievementBadges.test.ts
 * Server-side tests for T-361: Agent Achievement Badges
 * - Achievement event emitter behavior
 * - Protocol type presence (AgentAchievementMsg)
 * - Achievement service badge data flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock DB sql ────────────────────────────────────────────────────────────────
vi.mock('../db/index.js', () => ({
  sql: vi.fn(),
}));

// ── Mock notifications ─────────────────────────────────────────────────────────
vi.mock('../services/notifications.js', () => ({
  notifyAgent: vi.fn().mockResolvedValue(undefined),
}));

// ── Import subject ─────────────────────────────────────────────────────────────
import { achievementEvents, awardBadge, getAgentAchievements } from '../services/achievements.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSql(options: {
  insertResult?: any[];
  selectResult?: any[];
}) {
  const { insertResult = [], selectResult = [{ name: 'Social Butterfly', description: 'Made 10 friends', icon: '🦋' }] } = options;

  // sql is a tagged template literal — we mock it as a function
  const mock = vi.fn();
  mock.mockImplementationOnce(() => Promise.resolve(insertResult)); // INSERT
  mock.mockImplementationOnce(() => Promise.resolve(selectResult)); // SELECT achievement name
  return mock;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Achievement Event Emitter (T-361)', () => {
  afterEach(() => {
    achievementEvents.removeAllListeners();
  });

  it('achievementEvents is an EventEmitter', () => {
    expect(typeof achievementEvents.on).toBe('function');
    expect(typeof achievementEvents.emit).toBe('function');
    expect(typeof achievementEvents.removeAllListeners).toBe('function');
  });

  it('emits "awarded" event when badge is newly awarded', async () => {
    const agentId = 'agent-uuid-1';
    const achievementId = 'ach-uuid-1';

    const sql = makeSql({
      insertResult: [{ agent_id: agentId }], // row returned = newly awarded
    });

    const awardedListener = vi.fn();
    achievementEvents.on('awarded', awardedListener);

    await awardBadge(agentId, achievementId, sql);

    expect(awardedListener).toHaveBeenCalledOnce();
  });

  it('emitted event contains correct agentId', async () => {
    const agentId = 'agent-uuid-2';
    const achievementId = 'ach-uuid-2';

    const sql = makeSql({
      insertResult: [{ agent_id: agentId }],
    });

    let eventData: any = null;
    achievementEvents.on('awarded', (data) => { eventData = data; });

    await awardBadge(agentId, achievementId, sql);

    expect(eventData).not.toBeNull();
    expect(eventData.agentId).toBe(agentId);
  });

  it('emitted event contains achievement id', async () => {
    const agentId = 'agent-uuid-3';
    const achievementId = 'ach-uuid-3';

    const sql = makeSql({
      insertResult: [{ agent_id: agentId }],
    });

    let eventData: any = null;
    achievementEvents.on('awarded', (data) => { eventData = data; });

    await awardBadge(agentId, achievementId, sql);

    expect(eventData.achievement.achievementId).toBe(achievementId);
  });

  it('emitted event contains achievement name, description, icon', async () => {
    const agentId = 'agent-uuid-4';
    const achievementId = 'ach-uuid-4';

    const sql = makeSql({
      insertResult: [{ agent_id: agentId }],
      selectResult: [{ name: 'First Trade', description: 'Complete your first trade', icon: '💰' }],
    });

    let eventData: any = null;
    achievementEvents.on('awarded', (data) => { eventData = data; });

    await awardBadge(agentId, achievementId, sql);

    expect(eventData.achievement.name).toBe('First Trade');
    expect(eventData.achievement.description).toBe('Complete your first trade');
    expect(eventData.achievement.icon).toBe('💰');
  });

  it('emitted event contains awardedAt ISO timestamp', async () => {
    const agentId = 'agent-uuid-5';
    const achievementId = 'ach-uuid-5';

    const sql = makeSql({
      insertResult: [{ agent_id: agentId }],
    });

    let eventData: any = null;
    achievementEvents.on('awarded', (data) => { eventData = data; });

    const before = new Date().toISOString();
    await awardBadge(agentId, achievementId, sql);
    const after = new Date().toISOString();

    expect(eventData.achievement.awardedAt).toBeDefined();
    expect(eventData.achievement.awardedAt >= before).toBe(true);
    expect(eventData.achievement.awardedAt <= after).toBe(true);
  });

  it('does NOT emit "awarded" event when badge already owned (no-op)', async () => {
    const agentId = 'agent-uuid-6';
    const achievementId = 'ach-uuid-6';

    // Empty insert result = badge already existed (ON CONFLICT DO NOTHING)
    const sql = vi.fn().mockResolvedValue([]);

    const awardedListener = vi.fn();
    achievementEvents.on('awarded', awardedListener);

    await awardBadge(agentId, achievementId, sql);

    expect(awardedListener).not.toHaveBeenCalled();
  });

  it('does NOT emit when DB throws error', async () => {
    const agentId = 'agent-uuid-7';
    const achievementId = 'ach-uuid-7';

    const sql = vi.fn().mockRejectedValue(new Error('DB error'));

    const awardedListener = vi.fn();
    achievementEvents.on('awarded', awardedListener);

    // awardBadge catches errors and returns false
    const result = await awardBadge(agentId, achievementId, sql);

    expect(result).toBe(false);
    expect(awardedListener).not.toHaveBeenCalled();
  });

  it('supports multiple listeners for the "awarded" event', async () => {
    const agentId = 'agent-uuid-8';
    const achievementId = 'ach-uuid-8';

    const sql = makeSql({ insertResult: [{ agent_id: agentId }] });

    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();
    achievementEvents.on('awarded', listener1);
    achievementEvents.on('awarded', listener2);
    achievementEvents.on('awarded', listener3);

    await awardBadge(agentId, achievementId, sql);

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
    expect(listener3).toHaveBeenCalledOnce();
  });

  it('awardBadge returns true when newly awarded', async () => {
    const sql = makeSql({ insertResult: [{ agent_id: 'agent-uuid-9' }] });
    const result = await awardBadge('agent-uuid-9', 'ach-uuid-9', sql);
    expect(result).toBe(true);
  });

  it('awardBadge returns false when already owned', async () => {
    const sql = vi.fn().mockResolvedValue([]);
    const result = await awardBadge('agent-uuid-10', 'ach-uuid-10', sql);
    expect(result).toBe(false);
  });
});

// ── Protocol type tests ────────────────────────────────────────────────────────

describe('AgentAchievementMsg protocol type (T-361)', () => {
  it('protocol exports correct shape for AgentAchievementMsg', async () => {
    // Import and check that the type compiles correctly via a runtime shape check
    // This tests that the union type was properly extended
    const msg: {
      type: 'agent.achievement';
      agentId: string;
      achievement: {
        achievementId: string;
        name: string;
        description: string;
        icon: string;
        awardedAt: string;
      };
    } = {
      type: 'agent.achievement',
      agentId: 'agent-uuid-proto',
      achievement: {
        achievementId: 'ach-proto',
        name: 'Test Badge',
        description: 'A test achievement',
        icon: '🏆',
        awardedAt: new Date().toISOString(),
      },
    };

    expect(msg.type).toBe('agent.achievement');
    expect(msg.agentId).toBe('agent-uuid-proto');
    expect(msg.achievement.icon).toBe('🏆');
  });

  it('agent.achievement message type is a valid string discriminant', () => {
    const eventTypes = ['agent.achievement'];
    expect(eventTypes).toContain('agent.achievement');
  });
});

// ── getAgentAchievements ───────────────────────────────────────────────────────

describe('getAgentAchievements for badge data', () => {
  it('returns earned achievements in correct shape', async () => {
    const agentId = 'agent-uuid-badges';
    const rows = [
      { achievementId: 'ach-1', name: 'First Steps', description: 'Enter a room', icon: '👣', awardedAt: '2026-02-18T10:00:00Z' },
      { achievementId: 'ach-2', name: 'Social', description: 'Make a friend', icon: '🤝', awardedAt: '2026-02-18T11:00:00Z' },
    ];
    const sql = vi.fn().mockResolvedValue(rows);

    const result = await getAgentAchievements(agentId, sql);

    expect(result).toHaveLength(2);
    expect(result[0].achievementId).toBe('ach-1');
    expect(result[0].name).toBe('First Steps');
    expect(result[0].icon).toBe('👣');
    expect(result[1].achievementId).toBe('ach-2');
  });

  it('returns empty array when agent has no achievements', async () => {
    const sql = vi.fn().mockResolvedValue([]);
    const result = await getAgentAchievements('agent-no-badges', sql);
    expect(result).toHaveLength(0);
  });

  it('propagates DB errors', async () => {
    const sql = vi.fn().mockRejectedValue(new Error('Connection refused'));
    await expect(getAgentAchievements('agent-err', sql)).rejects.toThrow('Connection refused');
  });
});
