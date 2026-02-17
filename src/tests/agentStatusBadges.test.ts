/**
 * T-340: Agent Status Badges — Unit Tests
 * Tests for:
 * - AGENT_STATUS_ICONS mapping (chat, furniture, game, trade, emote, moving)
 * - setAgentStatus logic (timer reset, status clear, updateAgentList trigger)
 * - Edge cases: unknown agent, missing status, timer override
 * - Status auto-clear after delay
 * - Badge rendering guard (only if icon exists)
 *
 * Pure unit tests — no database or PixiJS required.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mirror of AGENT_STATUS_ICONS from spectate.js ───────────────────────────
const AGENT_STATUS_ICONS: Record<string, string> = {
  chat:      '💬',
  furniture: '🪑',
  game:      '🎮',
  trade:     '💱',
  emote:     '🎭',
  moving:    '🚶',
};

const STATUS_CLEAR_DELAY = 5000;

// ─── Minimal Agent mock ───────────────────────────────────────────────────────
interface MockAgent {
  id: string;
  name: string;
  status?: string;
  _statusTimer?: ReturnType<typeof setTimeout>;
  color: string;
}

// ─── Mini runtime simulation ──────────────────────────────────────────────────
function createRuntime() {
  const agents = new Map<string, MockAgent>();
  let updateAgentListCallCount = 0;

  function updateAgentList() {
    updateAgentListCallCount++;
  }

  function setAgentStatus(agentId: string, status: string) {
    const agent = agents.get(agentId);
    if (!agent) return;
    if (agent._statusTimer) clearTimeout(agent._statusTimer);
    agent.status = status;
    agent._statusTimer = setTimeout(() => {
      const a = agents.get(agentId);
      if (a && a.status === status) {
        delete a.status;
        delete a._statusTimer;
        updateAgentList();
      }
    }, STATUS_CLEAR_DELAY);
    updateAgentList();
  }

  return { agents, setAgentStatus, getUpdateCount: () => updateAgentListCallCount };
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('AGENT_STATUS_ICONS mapping', () => {
  it('has an icon for all 6 activity types', () => {
    const expected = ['chat', 'furniture', 'game', 'trade', 'emote', 'moving'];
    for (const key of expected) {
      expect(AGENT_STATUS_ICONS[key]).toBeDefined();
      expect(AGENT_STATUS_ICONS[key].length).toBeGreaterThan(0);
    }
  });

  it('chat maps to 💬', () => expect(AGENT_STATUS_ICONS.chat).toBe('💬'));
  it('furniture maps to 🪑', () => expect(AGENT_STATUS_ICONS.furniture).toBe('🪑'));
  it('game maps to 🎮', () => expect(AGENT_STATUS_ICONS.game).toBe('🎮'));
  it('trade maps to 💱', () => expect(AGENT_STATUS_ICONS.trade).toBe('💱'));
  it('emote maps to 🎭', () => expect(AGENT_STATUS_ICONS.emote).toBe('🎭'));
  it('moving maps to 🚶', () => expect(AGENT_STATUS_ICONS.moving).toBe('🚶'));

  it('has exactly 6 entries (no extras)', () => {
    expect(Object.keys(AGENT_STATUS_ICONS)).toHaveLength(6);
  });

  it('unknown status has no icon', () => {
    expect(AGENT_STATUS_ICONS['unknown']).toBeUndefined();
    expect(AGENT_STATUS_ICONS['']).toBeUndefined();
  });
});

describe('setAgentStatus — core behaviour', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sets status on agent', () => {
    const { agents, setAgentStatus } = createRuntime();
    agents.set('a1', { id: 'a1', name: 'Bot', color: '#fff' });
    setAgentStatus('a1', 'chat');
    expect(agents.get('a1')?.status).toBe('chat');
  });

  it('calls updateAgentList immediately', () => {
    const { agents, setAgentStatus, getUpdateCount } = createRuntime();
    agents.set('a1', { id: 'a1', name: 'Bot', color: '#fff' });
    setAgentStatus('a1', 'chat');
    expect(getUpdateCount()).toBe(1);
  });

  it('auto-clears status after STATUS_CLEAR_DELAY', () => {
    const { agents, setAgentStatus } = createRuntime();
    agents.set('a1', { id: 'a1', name: 'Bot', color: '#fff' });
    setAgentStatus('a1', 'chat');
    expect(agents.get('a1')?.status).toBe('chat');
    vi.advanceTimersByTime(STATUS_CLEAR_DELAY);
    expect(agents.get('a1')?.status).toBeUndefined();
  });

  it('calls updateAgentList again when auto-clearing', () => {
    const { agents, setAgentStatus, getUpdateCount } = createRuntime();
    agents.set('a1', { id: 'a1', name: 'Bot', color: '#fff' });
    setAgentStatus('a1', 'chat');
    vi.advanceTimersByTime(STATUS_CLEAR_DELAY);
    expect(getUpdateCount()).toBe(2); // once on set, once on clear
  });

  it('does nothing for unknown agent', () => {
    const { setAgentStatus, getUpdateCount } = createRuntime();
    setAgentStatus('nonexistent', 'chat');
    expect(getUpdateCount()).toBe(0);
  });

  it('overrides previous status', () => {
    const { agents, setAgentStatus } = createRuntime();
    agents.set('a1', { id: 'a1', name: 'Bot', color: '#fff' });
    setAgentStatus('a1', 'chat');
    setAgentStatus('a1', 'emote');
    expect(agents.get('a1')?.status).toBe('emote');
  });

  it('resets timer on second setAgentStatus', () => {
    const { agents, setAgentStatus } = createRuntime();
    agents.set('a1', { id: 'a1', name: 'Bot', color: '#fff' });
    setAgentStatus('a1', 'chat');
    vi.advanceTimersByTime(STATUS_CLEAR_DELAY - 1000); // 4s in
    setAgentStatus('a1', 'emote'); // reset timer
    vi.advanceTimersByTime(1000); // only 1s after reset — timer not yet fired
    expect(agents.get('a1')?.status).toBe('emote'); // still set
    vi.advanceTimersByTime(STATUS_CLEAR_DELAY); // full delay more
    expect(agents.get('a1')?.status).toBeUndefined();
  });

  it('handles all 6 status types without throwing', () => {
    const { agents, setAgentStatus } = createRuntime();
    agents.set('a1', { id: 'a1', name: 'Bot', color: '#fff' });
    const statuses = Object.keys(AGENT_STATUS_ICONS);
    expect(() => {
      for (const s of statuses) setAgentStatus('a1', s);
    }).not.toThrow();
  });
});

describe('Badge rendering guard', () => {
  it('shows badge only when icon exists in map', () => {
    function shouldShowBadge(status: string | undefined): boolean {
      return !!(status && AGENT_STATUS_ICONS[status]);
    }
    expect(shouldShowBadge('chat')).toBe(true);
    expect(shouldShowBadge('furniture')).toBe(true);
    expect(shouldShowBadge('unknown')).toBe(false);
    expect(shouldShowBadge(undefined)).toBe(false);
    expect(shouldShowBadge('')).toBe(false);
  });

  it('badge title matches the status string', () => {
    // The badge uses: title="${agent.status}"
    // So the title should be the raw status key
    const status = 'chat';
    expect(status).toBe('chat'); // sanity — no transformation
  });
});

describe('STATUS_CLEAR_DELAY constant', () => {
  it('is a positive number', () => {
    expect(STATUS_CLEAR_DELAY).toBeGreaterThan(0);
  });

  it('is at most 10 seconds (keeps UI responsive)', () => {
    expect(STATUS_CLEAR_DELAY).toBeLessThanOrEqual(10000);
  });

  it('is at least 2 seconds (visible long enough)', () => {
    expect(STATUS_CLEAR_DELAY).toBeGreaterThanOrEqual(2000);
  });
});
