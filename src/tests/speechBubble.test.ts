/**
 * T-359: Agent Speech Bubbles — Unit Tests
 *
 * Tests cover:
 * - truncateBubbleText: edge cases, exact limits, multi-line wrapping
 * - createChatBubble factory: dimensions, alpha, structure (mocked PixiJS)
 * - showSpeechBubble: guard conditions, overlap replacement, lastMessageTime
 * - Game-loop lifecycle: fade-in, hold, fade-out, removal
 *
 * Pure unit tests — no database or real PixiJS required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mirror of truncateBubbleText from spectate.js ───────────────────────────

function truncateBubbleText(
  text: string | null | undefined,
  innerWidth: number,
  fontSize: number,
  maxLines: number,
): string {
  const avgCharWidth = fontSize * 0.55;
  const charsPerLine = Math.max(1, Math.floor(innerWidth / avgCharWidth));
  const maxChars = charsPerLine * maxLines;
  if (!text || text.length <= maxChars) return text ?? '';
  return text.substring(0, maxChars - 3) + '...';
}

// ─── Minimal PixiJS mock ──────────────────────────────────────────────────────

interface MockText {
  text: string;
  style: Record<string, unknown>;
  width: number;
  height: number;
  anchor: { set: (x: number, y: number) => void };
  position: { set: (x: number, y: number) => void };
}

interface MockGraphics {
  calls: string[];
  beginFill(color: number, alpha?: number): MockGraphics;
  drawRoundedRect(x: number, y: number, w: number, h: number, r: number): MockGraphics;
  endFill(): MockGraphics;
  moveTo(x: number, y: number): MockGraphics;
  lineTo(x: number, y: number): MockGraphics;
  closePath(): MockGraphics;
}

interface MockContainer {
  children: (MockGraphics | MockText | MockContainer)[];
  alpha: number;
  parent: MockContainer | null;
  addChild(child: MockGraphics | MockText | MockContainer): void;
  removeChild(child: MockGraphics | MockText | MockContainer): void;
}

function makeGraphics(): MockGraphics {
  const g: MockGraphics = {
    calls: [],
    beginFill(color, alpha = 1) { g.calls.push(`beginFill(${color},${alpha})`); return g; },
    drawRoundedRect(x, y, w, h, r) { g.calls.push(`drawRoundedRect(${x},${y},${w},${h},${r})`); return g; },
    endFill() { g.calls.push('endFill'); return g; },
    moveTo(x, y) { g.calls.push(`moveTo(${x},${y})`); return g; },
    lineTo(x, y) { g.calls.push(`lineTo(${x},${y})`); return g; },
    closePath() { g.calls.push('closePath'); return g; },
  };
  return g;
}

function makeText(message: string, style: Record<string, unknown>): MockText {
  const charsPerLine = Math.floor(((style.wordWrapWidth as number) ?? 134) / ((style.fontSize as number) ?? 11) / 0.55);
  const lines = Math.ceil(message.length / Math.max(1, charsPerLine));
  return {
    text: message,
    style,
    width: Math.min(message.length * 6, (style.wordWrapWidth as number) ?? 134),
    height: lines * 16,
    anchor: { set: vi.fn() },
    position: { set: vi.fn() },
  };
}

function makeContainer(): MockContainer {
  const c: MockContainer = {
    children: [],
    alpha: 1,
    parent: null,
    addChild(child) { c.children.push(child); (child as MockContainer).parent = c; },
    removeChild(child) {
      const idx = c.children.indexOf(child);
      if (idx !== -1) c.children.splice(idx, 1);
    },
  };
  return c;
}

// ─── Minimal createChatBubble replica using mocks ────────────────────────────

const BUBBLE_MAX_WIDTH   = 150;
const BUBBLE_FONT_SIZE   = 11;
const BUBBLE_PADDING     = 8;
const BUBBLE_BOTTOM      = -60;

function createChatBubble(message: string) {
  const innerWidth = BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2;
  const truncated  = truncateBubbleText(message, innerWidth, BUBBLE_FONT_SIZE, 2);

  const text    = makeText(truncated, {
    fontFamily:    'sans-serif',
    fontSize:      BUBBLE_FONT_SIZE,
    fill:          0x000000,
    wordWrap:      true,
    wordWrapWidth: innerWidth,
  });

  const bubbleW = Math.min(text.width + BUBBLE_PADDING * 2, BUBBLE_MAX_WIDTH);
  const bubbleH = text.height + BUBBLE_PADDING * 2;
  const rectTop = BUBBLE_BOTTOM - bubbleH;

  const bg = makeGraphics();
  bg.beginFill(0xffffff, 0.9);
  bg.drawRoundedRect(-bubbleW / 2, rectTop, bubbleW, bubbleH, 8);
  bg.endFill();
  bg.beginFill(0xffffff, 0.9);
  bg.moveTo(-6, BUBBLE_BOTTOM);
  bg.lineTo(0,  BUBBLE_BOTTOM + 8);
  bg.lineTo(6,  BUBBLE_BOTTOM);
  bg.closePath();
  bg.endFill();

  text.anchor.set(0.5, 0);
  text.position.set(0, rectTop + BUBBLE_PADDING);

  const container = makeContainer();
  container.addChild(bg);
  container.addChild(text);
  container.alpha = 0;

  return { container, text, bg, bubbleW, bubbleH, rectTop, truncated };
}

// ─── Minimal showSpeechBubble replica ────────────────────────────────────────

interface Agent {
  sprite: MockContainer | null;
  bubble: MockContainer | null;
  lastMessageTime: number | null;
}

function showSpeechBubble(agents: Map<string, Agent>, agentId: string, text: string) {
  const agent = agents.get(agentId);
  if (!agent || !agent.sprite) return;

  if (agent.bubble) {
    agent.sprite.removeChild(agent.bubble);
    agent.bubble = null;
  }

  const { container } = createChatBubble(text);
  agent.sprite.addChild(container);
  agent.bubble = container;
  agent.lastMessageTime = Date.now();
}

// ─── Lifecycle simulator ──────────────────────────────────────────────────────

function simulateLifecycle(agents: Map<string, Agent>, agentId: string, elapsedMs: number): void {
  const agent = agents.get(agentId);
  if (!agent || !agent.bubble || !agent.lastMessageTime) return;

  const elapsed = elapsedMs;

  if (elapsed < 200) {
    agent.bubble.alpha = elapsed / 200;
  } else if (elapsed < 4500) {
    agent.bubble.alpha = 1;
  } else if (elapsed < 5000) {
    agent.bubble.alpha = 1 - (elapsed - 4500) / 500;
  } else {
    if (agent.bubble.parent) agent.bubble.parent.removeChild(agent.bubble);
    agent.bubble = null;
    agent.lastMessageTime = null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('truncateBubbleText', () => {
  const innerWidth = BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2; // 134px
  const fontSize   = BUBBLE_FONT_SIZE; // 11

  it('returns short text unchanged', () => {
    const result = truncateBubbleText('Hi', innerWidth, fontSize, 2);
    expect(result).toBe('Hi');
  });

  it('returns empty string for null input', () => {
    expect(truncateBubbleText(null, innerWidth, fontSize, 2)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(truncateBubbleText(undefined, innerWidth, fontSize, 2)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(truncateBubbleText('', innerWidth, fontSize, 2)).toBe('');
  });

  it('appends "..." when text exceeds 2-line limit', () => {
    const longText = 'A'.repeat(200);
    const result = truncateBubbleText(longText, innerWidth, fontSize, 2);
    expect(result.endsWith('...')).toBe(true);
  });

  it('truncated result is shorter than the original', () => {
    const longText = 'word '.repeat(50);
    const result = truncateBubbleText(longText, innerWidth, fontSize, 2);
    expect(result.length).toBeLessThan(longText.length);
  });

  it('respects maxLines=1 for tighter bubbles', () => {
    const charsPerLine = Math.floor(innerWidth / (fontSize * 0.55));
    const oneLiner = 'B'.repeat(charsPerLine + 5);
    const result = truncateBubbleText(oneLiner, innerWidth, fontSize, 1);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(charsPerLine);
  });

  it('does not truncate text at exactly the limit', () => {
    const charsPerLine = Math.floor(innerWidth / (fontSize * 0.55));
    const exactFit = 'C'.repeat(charsPerLine * 2);
    const result = truncateBubbleText(exactFit, innerWidth, fontSize, 2);
    expect(result.endsWith('...')).toBe(false);
    expect(result.length).toBe(exactFit.length);
  });
});

describe('createChatBubble', () => {
  it('container starts at alpha 0 (invisible for fade-in)', () => {
    const { container } = createChatBubble('Hello');
    expect(container.alpha).toBe(0);
  });

  it('has exactly 2 children: background + text', () => {
    const { container } = createChatBubble('Hello');
    expect(container.children.length).toBe(2);
  });

  it('bubble width does not exceed MAX_WIDTH (150px)', () => {
    const { bubbleW } = createChatBubble('This is a fairly long message that might push the width limit.');
    expect(bubbleW).toBeLessThanOrEqual(BUBBLE_MAX_WIDTH);
  });

  it('truncates long messages with "..."', () => {
    const { truncated } = createChatBubble('X'.repeat(300));
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('short messages are not truncated', () => {
    const { truncated } = createChatBubble('Short!');
    expect(truncated).toBe('Short!');
  });

  it('background draws a rounded rect at y = BUBBLE_BOTTOM - bubbleH', () => {
    // Use a message long enough to reach MAX_WIDTH so bubbleW clamps to 150
    const longMsg = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcde'; // ~40 chars, fills max width
    const { bg, bubbleH, bubbleW } = createChatBubble(longMsg);
    const expectedY = BUBBLE_BOTTOM - bubbleH;
    expect(bg.calls).toContain(
      `drawRoundedRect(${-(bubbleW / 2)},${expectedY},${bubbleW},${bubbleH},8)`,
    );
  });

  it('background includes triangle pointer moveTo BUBBLE_BOTTOM', () => {
    const { bg } = createChatBubble('Test');
    expect(bg.calls).toContain(`moveTo(-6,${BUBBLE_BOTTOM})`);
  });

  it('triangle pointer tip is 8px below BUBBLE_BOTTOM', () => {
    const { bg } = createChatBubble('Test');
    expect(bg.calls).toContain(`lineTo(0,${BUBBLE_BOTTOM + 8})`);
  });

  it('triangle has closePath', () => {
    const { bg } = createChatBubble('Test');
    expect(bg.calls).toContain('closePath');
  });

  it('text uses font size 11', () => {
    const { text } = createChatBubble('Hi');
    expect(text.style.fontSize).toBe(BUBBLE_FONT_SIZE);
  });

  it('text fill is black (0x000000)', () => {
    const { text } = createChatBubble('Hi');
    expect(text.style.fill).toBe(0x000000);
  });

  it('text has word wrap enabled at innerWidth', () => {
    const { text } = createChatBubble('Hi');
    expect(text.style.wordWrap).toBe(true);
    expect(text.style.wordWrapWidth).toBe(BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2);
  });
});

describe('showSpeechBubble', () => {
  let agents: Map<string, Agent>;

  beforeEach(() => {
    agents = new Map();
  });

  it('does nothing for unknown agentId', () => {
    // Should not throw
    expect(() => showSpeechBubble(agents, 'ghost', 'Hi')).not.toThrow();
  });

  it('does nothing when agent has no sprite', () => {
    agents.set('a1', { sprite: null, bubble: null, lastMessageTime: null });
    showSpeechBubble(agents, 'a1', 'Hi');
    expect(agents.get('a1')!.bubble).toBeNull();
  });

  it('creates bubble and adds to sprite', () => {
    const sprite = makeContainer();
    agents.set('a1', { sprite, bubble: null, lastMessageTime: null });
    showSpeechBubble(agents, 'a1', 'Hello!');
    expect(agents.get('a1')!.bubble).not.toBeNull();
    expect(sprite.children.length).toBe(1);
  });

  it('sets lastMessageTime to current time', () => {
    const before = Date.now();
    const sprite = makeContainer();
    agents.set('a1', { sprite, bubble: null, lastMessageTime: null });
    showSpeechBubble(agents, 'a1', 'Hi');
    const after = Date.now();
    const lmt = agents.get('a1')!.lastMessageTime!;
    expect(lmt).toBeGreaterThanOrEqual(before);
    expect(lmt).toBeLessThanOrEqual(after);
  });

  it('replaces existing bubble immediately (overlap prevention)', () => {
    const sprite = makeContainer();
    const oldBubble = makeContainer();
    sprite.addChild(oldBubble);
    agents.set('a1', { sprite, bubble: oldBubble, lastMessageTime: Date.now() - 1000 });

    showSpeechBubble(agents, 'a1', 'New message');

    const agent = agents.get('a1')!;
    expect(agent.bubble).not.toBe(oldBubble);
    expect(sprite.children).not.toContain(oldBubble);
    expect(sprite.children.length).toBe(1); // only new bubble
  });

  it('new bubble starts at alpha 0', () => {
    const sprite = makeContainer();
    agents.set('a1', { sprite, bubble: null, lastMessageTime: null });
    showSpeechBubble(agents, 'a1', 'Hi');
    expect(agents.get('a1')!.bubble!.alpha).toBe(0);
  });
});

describe('Speech bubble lifecycle (game loop simulation)', () => {
  let agents: Map<string, Agent>;
  const AGENT_ID = 'bot1';

  beforeEach(() => {
    agents = new Map();
    const sprite = makeContainer();
    agents.set(AGENT_ID, { sprite, bubble: null, lastMessageTime: null });
    showSpeechBubble(agents, AGENT_ID, 'Testing lifecycle');
  });

  it('at t=0ms alpha is ~0 (just started)', () => {
    simulateLifecycle(agents, AGENT_ID, 0);
    expect(agents.get(AGENT_ID)!.bubble!.alpha).toBe(0);
  });

  it('at t=100ms alpha is ~0.5 (halfway through fade-in)', () => {
    simulateLifecycle(agents, AGENT_ID, 100);
    expect(agents.get(AGENT_ID)!.bubble!.alpha).toBeCloseTo(0.5, 1);
  });

  it('at t=200ms alpha is 1 (fade-in complete)', () => {
    simulateLifecycle(agents, AGENT_ID, 200);
    expect(agents.get(AGENT_ID)!.bubble!.alpha).toBe(1);
  });

  it('at t=2000ms (mid-hold) alpha is 1', () => {
    simulateLifecycle(agents, AGENT_ID, 2000);
    expect(agents.get(AGENT_ID)!.bubble!.alpha).toBe(1);
  });

  it('at t=4500ms (fade-out start) alpha is 1', () => {
    simulateLifecycle(agents, AGENT_ID, 4500);
    expect(agents.get(AGENT_ID)!.bubble!.alpha).toBe(1);
  });

  it('at t=4750ms alpha is ~0.5 (halfway through fade-out)', () => {
    simulateLifecycle(agents, AGENT_ID, 4750);
    expect(agents.get(AGENT_ID)!.bubble!.alpha).toBeCloseTo(0.5, 1);
  });

  it('at t=4999ms alpha is near 0 (end of fade-out)', () => {
    simulateLifecycle(agents, AGENT_ID, 4999);
    expect(agents.get(AGENT_ID)!.bubble!.alpha).toBeLessThan(0.01);
  });

  it('at t=5000ms bubble is removed from sprite', () => {
    simulateLifecycle(agents, AGENT_ID, 5000);
    const agent = agents.get(AGENT_ID)!;
    expect(agent.bubble).toBeNull();
    expect(agent.sprite!.children.length).toBe(0);
  });

  it('at t=5000ms lastMessageTime is reset to null', () => {
    simulateLifecycle(agents, AGENT_ID, 5000);
    expect(agents.get(AGENT_ID)!.lastMessageTime).toBeNull();
  });

  it('no crash if simulateLifecycle called after bubble already removed', () => {
    simulateLifecycle(agents, AGENT_ID, 5000); // removes bubble
    expect(() => simulateLifecycle(agents, AGENT_ID, 6000)).not.toThrow();
  });
});
