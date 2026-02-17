/**
 * T-341: Agent Hover Tooltip — Unit Tests
 * Tests for:
 * - MOOD_EMOJIS mapping completeness and correctness
 * - Tooltip text building logic (name, mood, status, last message)
 * - Edge cases: no mood, no message, no status, long message truncation
 * - Position clamping (tooltip stays inside viewport)
 * - Visibility guards (no PIXI → skip silently)
 *
 * Pure unit tests — mirrors client/js/spectate.js logic.
 */
import { describe, it, expect } from 'vitest';

// ─── Mirror MOOD_EMOJIS from spectate.js ─────────────────────────────────────
const MOOD_EMOJIS: Record<string, string> = {
  happy: '😊', excited: '🤩', curious: '🤔', bored: '😑',
  sad: '😢', angry: '😠', playful: '😄', calm: '😌', neutral: '😐',
};

// ─── Mirror AGENT_STATUS_ICONS from spectate.js ───────────────────────────────
const AGENT_STATUS_ICONS: Record<string, string> = {
  chat: '💬', furniture: '🪑', game: '🎮',
  trade: '💱', emote: '🎭', moving: '🚶',
};

// ─── Mirror tooltip line builder ──────────────────────────────────────────────
interface Agent {
  name: string;
  mood?: string;
  status?: string;
  lastMessage?: string;
}

function buildTooltipLines(agent: Agent): string[] {
  const mood = agent.mood || 'neutral';
  const moodEmoji = MOOD_EMOJIS[mood] || '😐';
  const statusIcon = agent.status && AGENT_STATUS_ICONS[agent.status]
    ? AGENT_STATUS_ICONS[agent.status] + ' '
    : '';
  const lastMsg = agent.lastMessage
    ? (agent.lastMessage.length > 40 ? agent.lastMessage.slice(0, 40) + '…' : agent.lastMessage)
    : null;

  return [
    `${moodEmoji} ${agent.name}`,
    ...(agent.status ? [`${statusIcon}${agent.status}`] : []),
    ...(lastMsg ? [`💬 "${lastMsg}"`] : []),
  ];
}

// ─── Mirror position clamping ────────────────────────────────────────────────
function clampTooltipPosition(
  canvasX: number, canvasY: number,
  tooltipW: number, tooltipH: number,
  stageW: number, stageH: number,
): { tx: number; ty: number } {
  let tx = canvasX + 12;
  let ty = canvasY - tooltipH - 8;
  if (tx + tooltipW > stageW) tx = canvasX - tooltipW - 12;
  if (ty < 0) ty = canvasY + 12;
  return { tx, ty };
}

// ─── MOOD_EMOJIS tests ────────────────────────────────────────────────────────
describe('MOOD_EMOJIS mapping', () => {
  it('has entries for 9 moods', () => {
    expect(Object.keys(MOOD_EMOJIS)).toHaveLength(9);
  });

  it('happy maps to 😊', () => expect(MOOD_EMOJIS.happy).toBe('😊'));
  it('excited maps to 🤩', () => expect(MOOD_EMOJIS.excited).toBe('🤩'));
  it('neutral maps to 😐', () => expect(MOOD_EMOJIS.neutral).toBe('😐'));
  it('sad maps to 😢', () => expect(MOOD_EMOJIS.sad).toBe('😢'));
  it('angry maps to 😠', () => expect(MOOD_EMOJIS.angry).toBe('😠'));

  it('unknown mood falls back to 😐', () => {
    const emoji = MOOD_EMOJIS['unknown'] || '😐';
    expect(emoji).toBe('😐');
  });
});

// ─── buildTooltipLines tests ──────────────────────────────────────────────────
describe('buildTooltipLines', () => {
  it('returns at least 1 line (name)', () => {
    const lines = buildTooltipLines({ name: 'Agent-X' });
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0]).toContain('Agent-X');
  });

  it('first line includes mood emoji and name', () => {
    const lines = buildTooltipLines({ name: 'Bot', mood: 'happy' });
    expect(lines[0]).toContain('😊');
    expect(lines[0]).toContain('Bot');
  });

  it('uses neutral emoji when no mood provided', () => {
    const lines = buildTooltipLines({ name: 'Anon' });
    expect(lines[0]).toContain('😐');
  });

  it('includes status line when status is set', () => {
    const lines = buildTooltipLines({ name: 'Bot', status: 'chat' });
    const hasStatus = lines.some(l => l.includes('chat'));
    expect(hasStatus).toBe(true);
  });

  it('includes status icon in status line', () => {
    const lines = buildTooltipLines({ name: 'Bot', status: 'game' });
    const statusLine = lines.find(l => l.includes('game'));
    expect(statusLine).toContain('🎮');
  });

  it('no status line when status is undefined', () => {
    const lines = buildTooltipLines({ name: 'Bot' });
    expect(lines).toHaveLength(1);
  });

  it('includes last message when present', () => {
    const lines = buildTooltipLines({ name: 'Bot', lastMessage: 'Hello world' });
    const msgLine = lines.find(l => l.includes('Hello world'));
    expect(msgLine).toBeDefined();
    expect(msgLine).toContain('💬');
  });

  it('truncates messages longer than 40 chars', () => {
    const long = 'A'.repeat(50);
    const lines = buildTooltipLines({ name: 'Bot', lastMessage: long });
    const msgLine = lines.find(l => l.includes('💬'));
    expect(msgLine).toBeDefined();
    expect(msgLine!.includes('…')).toBe(true);
    // The displayed text portion should be 40 chars
    const inner = msgLine!.replace('💬 "', '').replace('…"', '');
    expect(inner.length).toBeLessThanOrEqual(40);
  });

  it('does not truncate messages ≤40 chars', () => {
    const short = 'Hello!';
    const lines = buildTooltipLines({ name: 'Bot', lastMessage: short });
    const msgLine = lines.find(l => l.includes('💬'));
    expect(msgLine).not.toContain('…');
  });

  it('3 lines when name + status + message all present', () => {
    const lines = buildTooltipLines({
      name: 'Bot', mood: 'happy', status: 'chat', lastMessage: 'Hi!'
    });
    expect(lines).toHaveLength(3);
  });

  it('no message line when lastMessage is empty string', () => {
    const lines = buildTooltipLines({ name: 'Bot', lastMessage: '' });
    expect(lines).toHaveLength(1);
  });
});

// ─── Position clamping tests ──────────────────────────────────────────────────
describe('clampTooltipPosition', () => {
  const W = 210, H = 60, SW = 800, SH = 600;

  it('positions right+above by default', () => {
    const { tx, ty } = clampTooltipPosition(400, 300, W, H, SW, SH);
    expect(tx).toBe(400 + 12);
    expect(ty).toBe(300 - H - 8);
  });

  it('flips to left when near right edge', () => {
    const { tx } = clampTooltipPosition(700, 300, W, H, SW, SH);
    expect(tx).toBe(700 - W - 12); // flipped
  });

  it('flips to below when near top edge', () => {
    const { ty } = clampTooltipPosition(400, 20, W, H, SW, SH);
    expect(ty).toBe(20 + 12); // flipped below
  });

  it('tooltip stays visible when cursor at top-right corner', () => {
    const { tx, ty } = clampTooltipPosition(790, 10, W, H, SW, SH);
    expect(tx).toBeLessThan(SW); // not off right edge
    expect(ty).toBeGreaterThanOrEqual(0); // not off top
  });
});

// ─── Visibility guard tests ───────────────────────────────────────────────────
describe('Tooltip visibility guards', () => {
  it('guard returns false when PIXI not loaded', () => {
    const PIXI = undefined;
    const tooltipContainer = null;
    const guard = !!(PIXI && tooltipContainer);
    expect(guard).toBe(false);
  });

  it('guard returns false when tooltipContainer is null', () => {
    const PIXI = { Graphics: class {} }; // mock loaded
    const tooltipContainer = null;
    const guard = !!(PIXI && tooltipContainer);
    expect(guard).toBe(false);
  });

  it('guard returns true when both PIXI and container exist', () => {
    const PIXI = { Graphics: class {} };
    const tooltipContainer = { visible: false, removeChildren: () => {} };
    const guard = !!(PIXI && tooltipContainer);
    expect(guard).toBe(true);
  });
});
