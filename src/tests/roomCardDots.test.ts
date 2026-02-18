/**
 * Tests for RoomCardDots — T-354
 * Room Card Agent Dot Previews
 */
import { describe, it, expect } from 'vitest';
import {
  getAgentColor,
  getAgentInitial,
  getPulseClass,
  renderAgentDots,
  MAX_VISIBLE_DOTS,
  type AgentPreview,
} from '../../client/src/ui/RoomCardDots.js';

// ---------------------------------------------------------------------------
// getAgentColor
// ---------------------------------------------------------------------------
describe('getAgentColor', () => {
  it('returns a hex color string', () => {
    const color = getAgentColor('agent-abc-123');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('is deterministic — same ID always returns same color', () => {
    const id = 'fixed-agent-id-xyz';
    const c1 = getAgentColor(id);
    const c2 = getAgentColor(id);
    expect(c1).toBe(c2);
  });

  it('returns different colors for different IDs', () => {
    const colors = new Set(
      ['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6'].map(getAgentColor)
    );
    // With 12 palette entries and 6 IDs we expect at least 4 distinct colors
    expect(colors.size).toBeGreaterThanOrEqual(4);
  });

  it('handles empty ID gracefully', () => {
    const color = getAgentColor('');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('handles UUID-style IDs', () => {
    const color = getAgentColor('550e8400-e29b-41d4-a716-446655440000');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

// ---------------------------------------------------------------------------
// getAgentInitial
// ---------------------------------------------------------------------------
describe('getAgentInitial', () => {
  it('returns first letter uppercase', () => {
    expect(getAgentInitial('alice')).toBe('A');
    expect(getAgentInitial('Bob')).toBe('B');
    expect(getAgentInitial('CHARLIE')).toBe('C');
  });

  it('returns ? for empty string', () => {
    expect(getAgentInitial('')).toBe('?');
  });

  it('handles single-char names', () => {
    expect(getAgentInitial('Z')).toBe('Z');
  });

  it('handles non-Latin first character', () => {
    const initial = getAgentInitial('Αλφα');
    expect(initial).toBe('Α');
  });
});

// ---------------------------------------------------------------------------
// getPulseClass
// ---------------------------------------------------------------------------
describe('getPulseClass', () => {
  it('returns pulse-slow for 1-2 agents', () => {
    expect(getPulseClass(1)).toBe('pulse-slow');
    expect(getPulseClass(2)).toBe('pulse-slow');
  });

  it('returns pulse-medium for 3-5 agents', () => {
    expect(getPulseClass(3)).toBe('pulse-medium');
    expect(getPulseClass(4)).toBe('pulse-medium');
    expect(getPulseClass(5)).toBe('pulse-medium');
  });

  it('returns pulse-fast for 6+ agents', () => {
    expect(getPulseClass(6)).toBe('pulse-fast');
    expect(getPulseClass(10)).toBe('pulse-fast');
    expect(getPulseClass(50)).toBe('pulse-fast');
  });

  it('handles 0 agents', () => {
    expect(getPulseClass(0)).toBe('pulse-slow');
  });
});

// ---------------------------------------------------------------------------
// renderAgentDots
// ---------------------------------------------------------------------------
describe('renderAgentDots', () => {
  const makeAgents = (count: number): AgentPreview[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `agent-${i.toString().padStart(3, '0')}`,
      displayName: `Agent${i}`,
    }));

  it('returns empty-state container for empty array', () => {
    const html = renderAgentDots([]);
    expect(html).toContain('agent-dot-container');
    expect(html).toContain('agent-dot-empty');
    expect(html).toContain('No agents');
  });

  it('returns empty-state container for null/undefined-like', () => {
    const html = renderAgentDots([] as AgentPreview[]);
    expect(html).toContain('agent-dot-empty');
  });

  it('renders correct number of dots for small set', () => {
    const html = renderAgentDots(makeAgents(3));
    const dotMatches = html.match(/class="agent-dot /g);
    expect(dotMatches).toHaveLength(3);
  });

  it('renders exactly MAX_VISIBLE_DOTS dots when agents > MAX', () => {
    const html = renderAgentDots(makeAgents(MAX_VISIBLE_DOTS + 3));
    const dotMatches = html.match(/class="agent-dot /g);
    expect(dotMatches).toHaveLength(MAX_VISIBLE_DOTS);
  });

  it('shows overflow badge when agents > MAX_VISIBLE_DOTS', () => {
    const overflow = 3;
    const html = renderAgentDots(makeAgents(MAX_VISIBLE_DOTS + overflow));
    expect(html).toContain('agent-dot-overflow');
    expect(html).toContain(`+${overflow}`);
  });

  it('does NOT show overflow badge when agents <= MAX_VISIBLE_DOTS', () => {
    const html = renderAgentDots(makeAgents(MAX_VISIBLE_DOTS));
    expect(html).not.toContain('agent-dot-overflow');
  });

  it('each dot has a title attribute with agent name', () => {
    const agents: AgentPreview[] = [
      { id: 'a1', displayName: 'Zephyr' },
      { id: 'a2', displayName: 'Nova' },
    ];
    const html = renderAgentDots(agents);
    expect(html).toContain('title="Zephyr"');
    expect(html).toContain('title="Nova"');
  });

  it('each dot shows the agent initial as text', () => {
    const agents: AgentPreview[] = [
      { id: 'x1', displayName: 'Aurora' },
      { id: 'x2', displayName: 'Blaze' },
    ];
    const html = renderAgentDots(agents);
    expect(html).toContain('>A<');
    expect(html).toContain('>B<');
  });

  it('each dot has a background-color inline style', () => {
    const agents: AgentPreview[] = [{ id: 'y1', displayName: 'Test' }];
    const html = renderAgentDots(agents);
    expect(html).toMatch(/style="background-color: #[0-9A-Fa-f]{6};"/);
  });

  it('each dot has data-agent-id attribute', () => {
    const agents: AgentPreview[] = [{ id: 'agent-xyz', displayName: 'Test' }];
    const html = renderAgentDots(agents);
    expect(html).toContain('data-agent-id="agent-xyz"');
  });

  it('container has data-agent-count attribute', () => {
    const agents = makeAgents(5);
    const html = renderAgentDots(agents);
    expect(html).toContain('data-agent-count="5"');
  });

  it('overflow badge is singular when 1 overflow agent', () => {
    const html = renderAgentDots(makeAgents(MAX_VISIBLE_DOTS + 1));
    expect(html).toContain('+1</span>');
    expect(html).toContain('1 more agent"');
  });

  it('overflow badge is plural when >1 overflow agents', () => {
    const html = renderAgentDots(makeAgents(MAX_VISIBLE_DOTS + 2));
    expect(html).toContain('+2</span>');
    expect(html).toContain('2 more agents"');
  });

  it('HTML-escapes agent displayName in title', () => {
    const agents: AgentPreview[] = [
      { id: 'a1', displayName: '<script>alert(1)</script>' },
    ];
    const html = renderAgentDots(agents);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('assigns pulse class based on agent count', () => {
    const slowHtml = renderAgentDots(makeAgents(2));
    const medHtml = renderAgentDots(makeAgents(4));
    const fastHtml = renderAgentDots(makeAgents(8));
    expect(slowHtml).toContain('pulse-slow');
    expect(medHtml).toContain('pulse-medium');
    expect(fastHtml).toContain('pulse-fast');
  });

  it('renders single agent dot correctly', () => {
    const agents: AgentPreview[] = [{ id: 'solo-123', displayName: 'Solo' }];
    const html = renderAgentDots(agents);
    expect(html).toContain('agent-dot');
    expect(html).toContain('>S<');
    expect(html).toContain('title="Solo"');
  });

  it('renders exactly MAX_VISIBLE_DOTS dots for exactly MAX agents', () => {
    const html = renderAgentDots(makeAgents(MAX_VISIBLE_DOTS));
    const matches = html.match(/class="agent-dot /g);
    expect(matches).toHaveLength(MAX_VISIBLE_DOTS);
    expect(html).not.toContain('agent-dot-overflow');
  });
});

// ---------------------------------------------------------------------------
// MAX_VISIBLE_DOTS constant
// ---------------------------------------------------------------------------
describe('MAX_VISIBLE_DOTS', () => {
  it('is a positive number <= 8', () => {
    expect(MAX_VISIBLE_DOTS).toBeGreaterThan(0);
    expect(MAX_VISIBLE_DOTS).toBeLessThanOrEqual(8);
  });
});
