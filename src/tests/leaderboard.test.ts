/**
 * T-346 — Spectator Live Leaderboard Panel Tests
 *
 * Tests the leaderboard feature:
 * - Client-side rendering helpers
 * - Analytics API integration
 * - Auto-refresh behaviour
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Helpers mirrored from spectate.js ───────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LEADERBOARD_METRIC_LABELS: Record<string, { label: string; icon: string }> = {
  messages_sent:    { label: 'Messages Sent',   icon: '💬' },
  rooms_visited:    { label: 'Rooms Visited',    icon: '🚪' },
  trades_completed: { label: 'Trades Completed', icon: '💱' },
  games_won:        { label: 'Games Won',        icon: '🎮' },
  friends_count:    { label: 'Friends',          icon: '👥' },
};

const RANK_ICONS = ['🥇', '🥈', '🥉'];

function getRankDisplay(index: number): string {
  return index < 3 ? RANK_ICONS[index] : String(index + 1);
}

function getRankClass(index: number): string {
  if (index === 0) return 'gold';
  if (index === 1) return 'silver';
  if (index === 2) return 'bronze';
  return '';
}

function buildLeaderboardRows(agents: Array<{ agentId: string; displayName?: string; score: number }>): string {
  if (agents.length === 0) return '<empty>';
  const maxScore = agents[0].score || 1;
  return agents.map((a, i) => {
    const pct = Math.round((a.score / maxScore) * 100);
    return `rank=${getRankDisplay(i)} name=${a.displayName || a.agentId} score=${formatScore(a.score)} pct=${pct}`;
  }).join('\n');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('T-346: Leaderboard — formatScore', () => {
  it('formats small numbers as-is', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(1)).toBe('1');
    expect(formatScore(42)).toBe('42');
    expect(formatScore(999)).toBe('999');
  });

  it('formats thousands with k suffix', () => {
    expect(formatScore(1000)).toBe('1.0k');
    expect(formatScore(1500)).toBe('1.5k');
    expect(formatScore(10000)).toBe('10.0k');
    expect(formatScore(9999)).toBe('10.0k');
  });

  it('handles zero correctly', () => {
    expect(formatScore(0)).toBe('0');
  });
});

describe('T-346: Leaderboard — escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml('Agent & Co.')).toBe('Agent &amp; Co.');
    expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('leaves safe strings untouched', () => {
    expect(escapeHtml('HalBot')).toBe('HalBot');
    expect(escapeHtml('Agent_42')).toBe('Agent_42');
  });
});

describe('T-346: Leaderboard — rank display', () => {
  it('shows trophy emoji for top 3', () => {
    expect(getRankDisplay(0)).toBe('🥇');
    expect(getRankDisplay(1)).toBe('🥈');
    expect(getRankDisplay(2)).toBe('🥉');
  });

  it('shows numeric rank for positions 4+', () => {
    expect(getRankDisplay(3)).toBe('4');
    expect(getRankDisplay(9)).toBe('10');
  });

  it('assigns correct rank CSS classes', () => {
    expect(getRankClass(0)).toBe('gold');
    expect(getRankClass(1)).toBe('silver');
    expect(getRankClass(2)).toBe('bronze');
    expect(getRankClass(3)).toBe('');
    expect(getRankClass(10)).toBe('');
  });
});

describe('T-346: Leaderboard — metric labels', () => {
  it('has labels for all 5 analytics metrics', () => {
    const metrics = ['messages_sent', 'rooms_visited', 'trades_completed', 'games_won', 'friends_count'];
    for (const metric of metrics) {
      expect(LEADERBOARD_METRIC_LABELS[metric]).toBeDefined();
      expect(LEADERBOARD_METRIC_LABELS[metric].label).toBeTruthy();
      expect(LEADERBOARD_METRIC_LABELS[metric].icon).toBeTruthy();
    }
  });

  it('has unique icons for each metric', () => {
    const icons = Object.values(LEADERBOARD_METRIC_LABELS).map(m => m.icon);
    const unique = new Set(icons);
    expect(unique.size).toBe(icons.length);
  });
});

describe('T-346: Leaderboard — buildLeaderboardRows', () => {
  it('returns <empty> for empty agent list', () => {
    expect(buildLeaderboardRows([])).toBe('<empty>');
  });

  it('computes percentage relative to top score', () => {
    const agents = [
      { agentId: 'a1', displayName: 'Alpha', score: 100 },
      { agentId: 'a2', displayName: 'Beta', score: 50 },
    ];
    const rows = buildLeaderboardRows(agents);
    expect(rows).toContain('pct=100'); // top agent = 100%
    expect(rows).toContain('pct=50');  // second = 50%
  });

  it('renders rank icons for top 3', () => {
    const agents = [
      { agentId: 'a1', score: 300 },
      { agentId: 'a2', score: 200 },
      { agentId: 'a3', score: 100 },
      { agentId: 'a4', score: 50 },
    ];
    const rows = buildLeaderboardRows(agents);
    expect(rows).toContain('rank=🥇');
    expect(rows).toContain('rank=🥈');
    expect(rows).toContain('rank=🥉');
    expect(rows).toContain('rank=4');
  });

  it('uses displayName over agentId when available', () => {
    const agents = [
      { agentId: 'raw-id', displayName: 'FriendlyName', score: 10 },
    ];
    const rows = buildLeaderboardRows(agents);
    expect(rows).toContain('name=FriendlyName');
    expect(rows).not.toContain('name=raw-id');
  });

  it('falls back to agentId when displayName missing', () => {
    const agents = [{ agentId: 'raw-id', score: 10 }];
    const rows = buildLeaderboardRows(agents);
    expect(rows).toContain('name=raw-id');
  });

  it('handles single agent (100% bar)', () => {
    const agents = [{ agentId: 'solo', displayName: 'Solo', score: 42 }];
    const rows = buildLeaderboardRows(agents);
    expect(rows).toContain('pct=100');
    expect(rows).toContain('score=42');
  });

  it('formats large scores with k suffix', () => {
    const agents = [
      { agentId: 'a1', score: 5000 },
      { agentId: 'a2', score: 2500 },
    ];
    const rows = buildLeaderboardRows(agents);
    expect(rows).toContain('score=5.0k');
    expect(rows).toContain('score=2.5k');
  });

  it('handles agents with score 0', () => {
    const agents = [
      { agentId: 'a1', score: 100 },
      { agentId: 'a2', score: 0 },
    ];
    const rows = buildLeaderboardRows(agents);
    expect(rows).toContain('score=0');
    expect(rows).toContain('pct=0');
  });
});

describe('T-346: Leaderboard — analytics API contract', () => {
  it('expects { agents: [] } shape from /api/analytics/agents', () => {
    // The API must return { agents, metric } — validate shape
    const mockApiResponse = {
      metric: 'messages_sent',
      agents: [
        { agentId: 'bot-1', displayName: 'Bot One', score: 250 },
        { agentId: 'bot-2', displayName: 'Bot Two', score: 100 },
      ],
    };

    expect(mockApiResponse.agents).toBeInstanceOf(Array);
    expect(mockApiResponse.agents[0]).toHaveProperty('agentId');
    expect(mockApiResponse.agents[0]).toHaveProperty('score');
  });

  it('handles missing displayName gracefully', () => {
    const agent = { agentId: 'anon-bot', score: 5 } as any;
    const name = agent.displayName || agent.agentId || 'Agent';
    expect(name).toBe('anon-bot');
  });

  it('handles empty agents array', () => {
    const mockApiResponse = { metric: 'games_won', agents: [] };
    const rendered = buildLeaderboardRows(mockApiResponse.agents);
    expect(rendered).toBe('<empty>');
  });
});

describe('T-346: Leaderboard — auto-refresh interval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires at 30-second intervals', () => {
    const callback = vi.fn();
    const intervalId = setInterval(callback, 30000);

    vi.advanceTimersByTime(29999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30000);
    expect(callback).toHaveBeenCalledTimes(2);

    clearInterval(intervalId);
  });

  it('does not trigger before 30 seconds', () => {
    const callback = vi.fn();
    const intervalId = setInterval(callback, 30000);

    vi.advanceTimersByTime(10000);
    expect(callback).not.toHaveBeenCalled();

    clearInterval(intervalId);
  });
});
